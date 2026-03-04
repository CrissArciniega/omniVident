"""
Amazon Collector Agent
Scraping de productos BESTSELLERS de Amazon para USA y MX.
Usa las paginas oficiales: amazon.com/gp/bestsellers/{category}

Uso:
    python agents/amazon_collector.py                     # Todos los paises
    python agents/amazon_collector.py --country USA       # Solo USA
    python agents/amazon_collector.py --country MX --test # Test rapido (2 categorias)
"""

import argparse
import json
import random
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeout

from utils.logger import get_logger
from utils.data_loader import load_config, save_raw_data
from utils.validators import validate_data
from schemas.amazon_raw import AmazonProduct, AmazonRawCollection

logger = get_logger("amazon_collector")

# -- Progress reporting -------------------------------------------------------
PROGRESS_FILE = Path(__file__).parent.parent / "outputs" / "agent_progress.json"

COUNTRY_NAMES = {"USA": "Estados Unidos", "MX": "Mexico", "CO": "Colombia"}
COUNTRY_CURRENCIES = {"USA": "USD", "MX": "MXN", "CO": "USD"}


def report_progress(percent: int, message: str, detail: str = ""):
    """Write progress to JSON file for the dashboard to poll."""
    try:
        PROGRESS_FILE.parent.mkdir(parents=True, exist_ok=True)
        PROGRESS_FILE.write_text(json.dumps({
            "percent": percent,
            "message": message,
            "detail": detail,
            "timestamp": int(time.time() * 1000),
            "active": True,
        }, ensure_ascii=False), encoding="utf-8")
    except Exception:
        pass


# -- Stealth helpers ----------------------------------------------------------

STEALTH_JS = """
() => {
    // Override navigator.webdriver
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });

    // Override chrome runtime
    window.chrome = { runtime: {} };

    // Override permissions
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);

    // Override plugins (make it look like a real browser)
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
    });

    // Override languages
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en'],
    });
}
"""


def get_stealth_context(playwright, config, user_agent):
    """Create a Playwright browser context with stealth settings."""
    browser = playwright.chromium.launch(
        headless=config["playwright"]["headless"],
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
        ],
    )
    context = browser.new_context(
        user_agent=user_agent,
        viewport=config["playwright"]["viewport"],
        locale="en-US",
        timezone_id="America/New_York",
    )
    # Apply stealth script to all new pages
    context.add_init_script(STEALTH_JS)
    return browser, context


# -- Parsing helpers ----------------------------------------------------------

def extract_asin(url: str) -> str | None:
    """Extract ASIN from an Amazon product URL."""
    if not url:
        return None
    match = re.search(r"/dp/([A-Z0-9]{10})", url)
    if match:
        return match.group(1)
    match = re.search(r"/product/([A-Z0-9]{10})", url)
    if match:
        return match.group(1)
    return None


def parse_amazon_price(text: str | None, country: str) -> float | None:
    """Parse Amazon price text to float. Handles $1,299.99 and $1,299.00."""
    if not text:
        return None
    # Remove everything except digits, dots, and commas
    cleaned = re.sub(r"[^\d,.]", "", text.strip())
    if not cleaned:
        return None

    # Amazon USA/MX format: 1,299.99 or 1299.99
    if "," in cleaned and "." in cleaned:
        # Standard US format: 1,299.99
        cleaned = cleaned.replace(",", "")
    elif "," in cleaned and "." not in cleaned:
        # Could be MX format or just comma as thousands: 1,299
        parts = cleaned.split(",")
        if len(parts[-1]) == 2:
            # Looks like decimal: 29,99
            cleaned = cleaned.replace(",", ".")
        else:
            # Thousands separator: 1,299
            cleaned = cleaned.replace(",", "")
    # If only dots, it's standard decimal

    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_amazon_rating(text: str | None) -> float | None:
    """Parse '4.5 out of 5 stars' or '4.5 de 5 estrellas' to float."""
    if not text:
        return None
    match = re.search(r"(\d+[.,]\d+)", text)
    if match:
        try:
            val = float(match.group(1).replace(",", "."))
            if 0 <= val <= 5:
                return val
        except ValueError:
            pass
    return None


def parse_rank_badge(text: str | None) -> tuple[int | None, str | None]:
    """Parse '#1 Best Seller' or '#1' to (rank_number, label)."""
    if not text:
        return None, None
    text = text.strip()
    match = re.search(r"#(\d+)", text)
    rank = int(match.group(1)) if match else None
    return rank, text if rank else (None, None)


# -- Scraping -----------------------------------------------------------------

def scrape_bestseller_page(page, url: str, category_slug: str, category_name: str,
                           country: str, selectors: dict, page_num: int = 1) -> list[dict]:
    """Scrape a single Amazon bestseller page."""
    products = []
    currency = COUNTRY_CURRENCIES.get(country, "USD")

    try:
        page.goto(url, timeout=20000, wait_until="domcontentloaded")
        # Brief wait for Amazon's JS to render
        page.wait_for_timeout(random.randint(800, 1500))

        # Wait for product containers
        try:
            page.wait_for_selector(selectors["product_container"], timeout=10000)
        except PlaywrightTimeout:
            logger.warning(f"    No products found on page {page_num} of {category_name}")
            return products

        # Get all product containers
        containers = page.query_selector_all(selectors["product_container"])
        logger.info(f"    Page {page_num}: {len(containers)} products in {category_name}")

        for idx, container in enumerate(containers):
            try:
                # Title
                title_el = container.query_selector(selectors["product_title"])
                title = title_el.get_attribute("title") or title_el.text_content().strip() if title_el else None

                if not title or len(title) < 3:
                    continue

                # Product link and ASIN
                link_el = container.query_selector(selectors["product_link"])
                href = link_el.get_attribute("href") if link_el else None
                full_url = None
                asin = None
                if href:
                    if href.startswith("/"):
                        domain = "amazon.com" if country == "USA" else "amazon.com.mx"
                        full_url = f"https://www.{domain}{href}"
                    else:
                        full_url = href
                    asin = extract_asin(full_url)

                # If no ASIN from link, try data attributes
                if not asin:
                    asin = container.get_attribute("data-asin") or f"AMZ_{hash(title) % 10**10}"

                # Price
                price_el = container.query_selector(selectors["product_price"])
                price_text = price_el.text_content().strip() if price_el else None
                price = parse_amazon_price(price_text, country)

                # Rating
                rating_el = container.query_selector(selectors["product_rating"])
                rating_text = rating_el.text_content().strip() if rating_el else None
                rating = parse_amazon_rating(rating_text)

                # Rank badge (#1, #2, etc.)
                rank_el = container.query_selector(selectors["bestseller_rank"])
                rank_text = rank_el.text_content().strip() if rank_el else None
                ranking, ranking_label = parse_rank_badge(rank_text)

                # If no badge rank, calculate from position
                if ranking is None:
                    ranking = ((page_num - 1) * 50) + idx + 1
                    ranking_label = f"#{ranking}"

                # Image
                img_el = container.query_selector(selectors["product_image"])
                image_url = None
                if img_el:
                    image_url = img_el.get_attribute("src") or img_el.get_attribute("data-a-dynamic-image")
                    # data-a-dynamic-image is a JSON with multiple URLs; take first key
                    if image_url and image_url.startswith("{"):
                        try:
                            img_dict = json.loads(image_url)
                            image_url = list(img_dict.keys())[0] if img_dict else None
                        except (json.JSONDecodeError, IndexError):
                            image_url = None

                # Review count (try to extract from rating element's parent area)
                reviews_count = None
                review_count_el = container.query_selector("span.a-size-small")
                if review_count_el:
                    rc_text = review_count_el.text_content().strip().replace(",", "").replace(".", "")
                    rc_match = re.search(r"(\d+)", rc_text)
                    if rc_match:
                        reviews_count = int(rc_match.group(1))

                products.append({
                    "asin": asin,
                    "title": title,
                    "price": price,
                    "currency": currency,
                    "rating": rating,
                    "reviews_count": reviews_count,
                    "bestseller_rank": ranking,
                    "category": category_slug,
                    "category_name": category_name,
                    "url": full_url,
                    "image_url": image_url,
                    "seller_id": None,
                    "ranking": ranking,
                    "ranking_label": ranking_label,
                })

            except Exception as e:
                logger.warning(f"    Error parsing product {idx}: {e}")
                continue

    except PlaywrightTimeout:
        logger.warning(f"    Timeout loading {url}")
    except Exception as e:
        logger.error(f"    Error scraping {category_name} page {page_num}: {e}")

    return products


def collect_country(country: str, scraping_config: dict, categories_config: dict,
                    test_mode: bool = False, country_idx: int = 0,
                    total_countries: int = 2) -> dict | None:
    """Collect bestseller products from Amazon for one country."""
    country_label = COUNTRY_NAMES.get(country, country)
    logger.info(f"\n  +== Iniciando Amazon {country_label} ==+")

    amazon_config = scraping_config["amazon"]
    selectors = amazon_config["selectors"]
    domain = amazon_config["domains"].get(country)

    if not domain:
        logger.error(f"  No domain configured for {country}")
        return None

    # Get categories for this country
    country_cats = categories_config.get("amazon", {}).get(country, {})
    if not country_cats:
        logger.error(f"  No categories configured for Amazon {country}")
        return None

    categories = [
        {"slug": slug, "name": name}
        for slug, name in country_cats.items()
    ]

    # Limit categories
    max_cats = amazon_config.get("max_categories_per_country", 8)
    if len(categories) > max_cats:
        logger.info(f"  Categories available: {len(categories)} -> limiting to {max_cats}")
        categories = categories[:max_cats]

    if test_mode:
        categories = categories[:2]
        logger.info(f"  [TEST MODE] Only processing {len(categories)} categories")

    user_agents = amazon_config.get("user_agents", [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ])

    max_pages = amazon_config.get("max_pages_per_category", 2)
    delay_min = amazon_config.get("request_delay_min_ms", 3000) / 1000
    delay_max = amazon_config.get("request_delay_max_ms", 8000) / 1000

    base_pct = 5 + int((country_idx / total_countries) * 80)
    country_range = int(80 / total_countries)

    all_products = []
    total_cats = len(categories)

    try:
        with sync_playwright() as p:
            user_agent = random.choice(user_agents)
            browser, context = get_stealth_context(p, scraping_config, user_agent)
            page = context.new_page()

            # ── Phase 1: Bestsellers ──
            logger.info(f"\n  --- Fase 1: Bestsellers ({total_cats} categorias) ---")
            for cat_idx, cat_info in enumerate(categories):
                cat_pct = base_pct + int(((cat_idx) / max(total_cats, 1)) * (country_range * 0.6))
                report_progress(
                    cat_pct,
                    f"Amazon {country_label} Bestsellers ({cat_idx + 1}/{total_cats})",
                    f"Categoria: {cat_info['name']}"
                )

                slug = cat_info["slug"]
                name = cat_info["name"]
                logger.info(f"  [{cat_idx+1}/{total_cats}] Bestseller: {name} ({slug})")

                for pg in range(1, max_pages + 1):
                    url = f"https://www.{domain}/gp/bestsellers/{slug}"
                    if pg > 1:
                        url += f"?pg={pg}"

                    products = scrape_bestseller_page(
                        page, url, slug, name, country, selectors, page_num=pg
                    )
                    all_products.extend(products)

                    if pg < max_pages:
                        delay = random.uniform(delay_min * 0.5, delay_max * 0.5)
                        time.sleep(delay)

                # Rotate user agent every few categories
                if (cat_idx + 1) % 3 == 0 and len(user_agents) > 1:
                    new_ua = random.choice([ua for ua in user_agents if ua != user_agent])
                    user_agent = new_ua
                    try:
                        page.close()
                        context.close()
                    except Exception:
                        pass
                    context = browser.new_context(
                        user_agent=user_agent,
                        viewport=scraping_config["playwright"]["viewport"],
                        locale="en-US",
                        timezone_id="America/New_York",
                    )
                    context.add_init_script(STEALTH_JS)
                    page = context.new_page()
                    logger.info(f"    Rotated user agent")

                delay = random.uniform(delay_min, delay_max)
                time.sleep(delay)

            browser.close()

    except Exception as e:
        logger.error(f"  Fatal Playwright error for Amazon {country}: {e}")
        return None

    if not all_products:
        logger.warning(f"  No products found for Amazon {country}")
        return None

    # Deduplicate by ASIN, keeping the one with best ranking
    seen_asins = {}
    for prod in all_products:
        asin = prod.get("asin", "")
        if not asin:
            continue
        if asin not in seen_asins or (prod.get("ranking", 999) < seen_asins[asin].get("ranking", 999)):
            seen_asins[asin] = prod

    unique_products = list(seen_asins.values())

    # Sort by ranking (lower = better)
    unique_products.sort(key=lambda x: x.get("ranking", 999))

    logger.info(f"  Amazon {country}: {len(unique_products)} unique products (from {len(all_products)} total)")
    top3 = unique_products[:3]
    for t in top3:
        price_str = f"${t['price']:.2f}" if t.get("price") else "N/A"
        logger.info(f"     {t.get('ranking_label', '')} {t['title'][:50]} | {price_str}")

    # Build the collection
    collection = {
        "collection_timestamp": datetime.now(timezone.utc).isoformat(),
        "country": country,
        "source": "amazon",
        "domain": domain,
        "site_id": country,
        "category_id": "all",
        "category_name": f"Bestsellers - Amazon {country_label}",
        "total_results": len(unique_products),
        "products": unique_products,
    }

    return collection


def _collect_and_save(country, scraping_config, categories_config, test_mode, country_idx, total_countries):
    """Worker: collect one country and save results. Returns (country, status)."""
    try:
        report_progress(
            5 + int((country_idx / total_countries) * 80),
            f"Analizando Amazon {COUNTRY_NAMES.get(country, country)}...",
            "Conectando con Amazon..."
        )
        collection = collect_country(
            country, scraping_config, categories_config,
            test_mode=test_mode,
            country_idx=country_idx, total_countries=total_countries
        )

        if collection:
            validated = validate_data(collection, AmazonRawCollection)
            if validated:
                filepath = save_raw_data(collection, "amazon", country)
                logger.info(f"  {country}: Data saved to {filepath}")
                return (country, "success")
            else:
                logger.error(f"  {country}: Schema validation failed")
                filepath = save_raw_data(collection, "amazon", country)
                logger.info(f"  {country}: Data saved (without validation) to {filepath}")
                return (country, "partial")
        else:
            return (country, "failed")

    except Exception as e:
        logger.error(f"  {country}: Unexpected error - {e}")
        return (country, "error")


def main():
    parser = argparse.ArgumentParser(description="Amazon Collector - Official Bestseller Rankings")
    parser.add_argument("--country", type=str, default=None, choices=["USA", "MX", "CO"],
                        help="Specific country (default: all)")
    parser.add_argument("--test", action="store_true", help="Test mode (2 categories per country)")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("AMAZON COLLECTOR - Official Bestseller Rankings")
    logger.info("=" * 60)

    scraping_config = load_config("scraping_config")
    categories_config = load_config("categories")

    countries = [args.country] if args.country else ["USA", "MX", "CO"]

    report_progress(0, "Iniciando scraping de Amazon...", f"{len(countries)} paises")

    results = {}

    if len(countries) == 1:
        # Single country: run directly
        c, st = _collect_and_save(countries[0], scraping_config, categories_config, args.test, 0, 1)
        results[c] = st
    else:
        # PARALLEL: each country uses different Amazon domain, safe to parallelize
        from concurrent.futures import ThreadPoolExecutor, as_completed

        report_progress(5, f"Scrapeando {len(countries)} paises Amazon en paralelo...",
                        ", ".join(COUNTRY_NAMES.get(c, c) for c in countries))

        with ThreadPoolExecutor(max_workers=len(countries)) as executor:
            futures = {
                executor.submit(
                    _collect_and_save, c, scraping_config, categories_config, args.test, idx, len(countries)
                ): c
                for idx, c in enumerate(countries)
            }
            for future in as_completed(futures):
                c = futures[future]
                try:
                    country, status = future.result()
                    results[country] = status
                    done = len(results)
                    pct = 5 + int((done / len(countries)) * 80)
                    report_progress(pct, f"Amazon {COUNTRY_NAMES.get(country, country)} completado ({done}/{len(countries)})",
                                    f"Estado: {status}")
                except Exception as e:
                    results[c] = "error"
                    logger.error(f"  {c}: Thread error - {e}")

    # Summary
    report_progress(85, "Amazon scraping completado", "Preparando datos...")
    logger.info("")
    logger.info("=" * 60)
    logger.info("RESUMEN AMAZON:")
    success_count = 0
    for country, status in results.items():
        emoji = {"success": "OK", "partial": "WARN", "failed": "FAIL", "error": "ERR"}.get(status, "?")
        logger.info(f"  {country}: [{emoji}] {status}")
        if status in ("success", "partial"):
            success_count += 1
    logger.info("=" * 60)

    report_progress(
        90,
        f"Amazon: datos de {success_count}/{len(countries)} paises",
        "Listo para analisis"
    )

    return 0 if all(s in ("success", "partial") for s in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
