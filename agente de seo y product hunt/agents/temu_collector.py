"""
Temu Collector Agent
Scraping de productos BESTSELLERS de Temu para USA, MX, CO, EC.
Usa las paginas oficiales: temu.com/{path}bestsellers.html

Uso:
    python agents/temu_collector.py                     # Todos los paises
    python agents/temu_collector.py --country USA       # Solo USA
    python agents/temu_collector.py --country EC --test # Test rapido (2 categorias)
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
from schemas.temu_raw import TemuProduct, TemuRawCollection

logger = get_logger("temu_collector")

# -- Progress reporting -------------------------------------------------------
PROGRESS_FILE = Path(__file__).parent.parent / "outputs" / "agent_progress.json"

COUNTRY_NAMES = {"USA": "Estados Unidos", "MX": "Mexico", "CO": "Colombia", "EC": "Ecuador"}
COUNTRY_CURRENCIES = {"USA": "USD", "MX": "MXN", "CO": "COP", "EC": "USD"}
COUNTRY_PATHS = {"USA": "", "MX": "mx/", "CO": "co/", "EC": "ec/"}


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
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    window.chrome = { runtime: {}, loadTimes: function(){}, csi: function(){} };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
    });
    Object.defineProperty(navigator, 'languages', {
        get: () => ['en-US', 'en', 'es'],
    });
    // Hide webdriver from CDP
    delete navigator.__proto__.webdriver;
}
"""


def get_stealth_context(playwright, config, user_agent):
    """Create a Playwright browser context with stealth settings."""
    browser = playwright.chromium.launch(
        headless=config["playwright"]["headless"],
        args=[
            "--disable-blink-features=AutomationControlled",
            "--no-sandbox",
            "--disable-dev-shm-usage",
        ],
    )
    context = browser.new_context(
        user_agent=user_agent,
        viewport=config["playwright"]["viewport"],
        locale="en-US",
        timezone_id="America/New_York",
    )
    context.add_init_script(STEALTH_JS)
    return browser, context


# -- Parsing helpers ----------------------------------------------------------

def parse_temu_price(text: str | None) -> float | None:
    """Parse Temu price text like '$12.99', 'MX$299.00', 'COP$29.900'."""
    if not text:
        return None
    cleaned = re.sub(r"[^\d,.]", "", text.strip())
    if not cleaned:
        return None

    if "," in cleaned and "." in cleaned:
        # Check if comma or dot is decimal separator
        last_comma = cleaned.rfind(",")
        last_dot = cleaned.rfind(".")
        if last_comma > last_dot:
            # Comma is decimal: 1.299,99
            cleaned = cleaned.replace(".", "").replace(",", ".")
        else:
            # Dot is decimal: 1,299.99
            cleaned = cleaned.replace(",", "")
    elif "," in cleaned:
        parts = cleaned.split(",")
        if len(parts[-1]) == 2:
            cleaned = cleaned.replace(",", ".")
        else:
            cleaned = cleaned.replace(",", "")
    # Dot-only or no separator stays as-is

    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_sold_text(text: str | None) -> int:
    """Parse '10K+ sold', '1.5K sold', '500+ sold' → integer."""
    if not text:
        return 0
    text = text.lower().strip()

    match = re.search(r"([\d,.]+)\s*k", text)
    if match:
        try:
            return int(float(match.group(1).replace(",", "")) * 1000)
        except ValueError:
            return 0

    match = re.search(r"([\d,]+)", text)
    if match:
        try:
            return int(match.group(1).replace(",", ""))
        except ValueError:
            return 0

    return 0


def parse_discount(text: str | None) -> int | None:
    """Parse '-70%', '70% off' → 70."""
    if not text:
        return None
    match = re.search(r"(\d+)\s*%", text)
    return int(match.group(1)) if match else None


def parse_rating(text: str | None) -> float | None:
    """Parse rating text to float."""
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


def check_captcha(page, selectors: dict) -> bool:
    """Check if CAPTCHA is present on the page."""
    captcha_sel = selectors.get("captcha_indicators", "[class*='captcha'], .geetest_holder")
    try:
        captcha_el = page.query_selector(captcha_sel)
        return captcha_el is not None
    except Exception:
        return False


# -- Scraping -----------------------------------------------------------------

def scrape_bestsellers_page(page, url: str, category_name: str, country: str,
                            selectors: dict, ranking_offset: int = 0) -> list[dict]:
    """Scrape a single Temu bestsellers page."""
    products = []
    currency = COUNTRY_CURRENCIES.get(country, "USD")

    try:
        page.goto(url, timeout=30000, wait_until="domcontentloaded")
        page.wait_for_timeout(random.randint(3000, 5000))

        # Check for CAPTCHA
        if check_captcha(page, selectors):
            logger.warning(f"    CAPTCHA detectado en {url} - saltando")
            return products

        # Wait for products to render (Temu is heavy JS)
        try:
            page.wait_for_selector(selectors["product_container"], timeout=15000)
        except PlaywrightTimeout:
            logger.warning(f"    No products found for {category_name}")
            return products

        # Scroll down to load more products
        for _ in range(3):
            page.evaluate("window.scrollBy(0, window.innerHeight)")
            page.wait_for_timeout(random.randint(800, 1500))

        containers = page.query_selector_all(selectors["product_container"])
        logger.info(f"    {len(containers)} products for {category_name}")

        for idx, container in enumerate(containers):
            try:
                # Title
                title_el = container.query_selector(selectors["product_title"])
                title = title_el.text_content().strip() if title_el else None
                if not title or len(title) < 3:
                    continue

                # Link
                link_el = container.query_selector(selectors["product_link"])
                href = link_el.get_attribute("href") if link_el else None
                permalink = None
                product_id = None
                if href:
                    permalink = href if href.startswith("http") else f"https://www.temu.com{href}"
                    # Extract product ID from URL
                    id_match = re.search(r"goods/([^.?/]+)", permalink)
                    if id_match:
                        product_id = id_match.group(1)

                if not product_id:
                    product_id = f"TEMU_{hash(title) % 10**10}"

                # Price
                price_el = container.query_selector(selectors["product_price"])
                price_text = price_el.text_content().strip() if price_el else None
                price = parse_temu_price(price_text)

                # Original price
                orig_el = container.query_selector(selectors["product_original_price"])
                orig_text = orig_el.text_content().strip() if orig_el else None
                original_price = parse_temu_price(orig_text)

                # Discount
                discount_el = container.query_selector(selectors["product_discount"])
                discount_text = discount_el.text_content().strip() if discount_el else None
                discount_pct = parse_discount(discount_text)

                # Sold text
                sold_el = container.query_selector(selectors["product_sold"])
                sold_text = sold_el.text_content().strip() if sold_el else None

                # Rating
                rating_el = container.query_selector(selectors["product_rating"])
                rating_text = rating_el.text_content().strip() if rating_el else None
                rating = parse_rating(rating_text)

                # Image
                img_el = container.query_selector(selectors["product_image"])
                image_url = None
                if img_el:
                    image_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                # Reviews count from sold/rating area
                reviews_count = None
                review_match = re.search(r"(\d[\d,]*)\s*review", (sold_text or "") + " " + (rating_text or ""), re.I)
                if review_match:
                    try:
                        reviews_count = int(review_match.group(1).replace(",", ""))
                    except ValueError:
                        pass

                ranking = ranking_offset + idx + 1

                products.append({
                    "product_id": product_id,
                    "title": title,
                    "price": price if price else 0.0,
                    "original_price": original_price,
                    "currency": currency,
                    "discount_pct": discount_pct,
                    "rating": rating,
                    "reviews_count": reviews_count,
                    "sold_text": sold_text,
                    "image_url": image_url,
                    "permalink": permalink,
                    "category_name": category_name,
                    "ranking": ranking,
                })

            except Exception as e:
                logger.warning(f"    Error parsing product {idx}: {e}")
                continue

    except PlaywrightTimeout:
        logger.warning(f"    Timeout loading {url}")
    except Exception as e:
        logger.error(f"    Error scraping {category_name}: {e}")

    return products


def collect_country(country: str, scraping_config: dict, categories_config: dict,
                    test_mode: bool = False, country_idx: int = 0,
                    total_countries: int = 4) -> dict | None:
    """Collect bestseller products from Temu for one country."""
    country_label = COUNTRY_NAMES.get(country, country)
    logger.info(f"\n  +== Iniciando Temu {country_label} ==+")

    temu_config = scraping_config["temu"]
    selectors = temu_config["selectors"]
    country_path = COUNTRY_PATHS.get(country, "")

    # Get categories for this country
    country_cats = categories_config.get("temu", {}).get(country, {})
    if not country_cats:
        logger.error(f"  No categories configured for Temu {country}")
        return None

    categories = [
        {"slug": slug, "name": name}
        for slug, name in country_cats.items()
    ]

    max_cats = temu_config.get("max_categories_per_country", 8)
    if len(categories) > max_cats:
        categories = categories[:max_cats]

    if test_mode:
        categories = categories[:2]
        logger.info(f"  [TEST MODE] Only processing {len(categories)} categories")

    user_agents = temu_config.get("user_agents", [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ])

    delay_min = temu_config.get("request_delay_min_ms", 3000) / 1000
    delay_max = temu_config.get("request_delay_max_ms", 8000) / 1000

    base_pct = 5 + int((country_idx / total_countries) * 80)
    country_range = int(80 / total_countries)

    all_products = []
    total_cats = len(categories)

    try:
        with sync_playwright() as p:
            user_agent = random.choice(user_agents)
            browser, context = get_stealth_context(p, scraping_config, user_agent)
            page = context.new_page()

            # First, try the main bestsellers page
            base_url = f"https://www.temu.com/{country_path}bestsellers.html"

            for cat_idx, cat_info in enumerate(categories):
                cat_pct = base_pct + int(((cat_idx) / max(total_cats, 1)) * country_range)
                report_progress(
                    cat_pct,
                    f"Temu {country_label} ({cat_idx + 1}/{total_cats})",
                    f"Categoria: {cat_info['name']}"
                )

                slug = cat_info["slug"]
                name = cat_info["name"]
                logger.info(f"  [{cat_idx+1}/{total_cats}] {name} ({slug})")

                # Try category-specific bestsellers URL
                url = f"https://www.temu.com/{country_path}bestsellers-{slug}.html"

                products = scrape_bestsellers_page(
                    page, url, name, country, selectors
                )

                # If no products with category URL, try main bestsellers
                if not products and cat_idx == 0:
                    logger.info(f"    Trying main bestsellers page: {base_url}")
                    products = scrape_bestsellers_page(
                        page, base_url, "Bestsellers", country, selectors
                    )

                all_products.extend(products)

                # Rotate UA every 3 categories
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

                # Anti-detection delay
                delay = random.uniform(delay_min, delay_max)
                time.sleep(delay)

            browser.close()

    except Exception as e:
        logger.error(f"  Fatal Playwright error for Temu {country}: {e}")
        return None

    if not all_products:
        logger.warning(f"  No products found for Temu {country}")
        return None

    # Deduplicate by product_id
    seen_ids = {}
    for prod in all_products:
        pid = prod.get("product_id", "")
        if not pid:
            continue
        if pid not in seen_ids or (prod.get("ranking", 999) < seen_ids[pid].get("ranking", 999)):
            seen_ids[pid] = prod

    unique_products = list(seen_ids.values())
    unique_products.sort(key=lambda x: x.get("ranking", 999))

    logger.info(f"  Temu {country}: {len(unique_products)} unique products (from {len(all_products)} total)")
    top3 = unique_products[:3]
    for t in top3:
        price_str = f"${t['price']:.2f}" if t.get("price") else "N/A"
        logger.info(f"     #{t.get('ranking', '?')} {t['title'][:50]} | {price_str}")

    collection = {
        "collection_timestamp": datetime.now(timezone.utc).isoformat(),
        "country": country,
        "source": "temu",
        "category_name": f"Bestsellers - Temu {country_label}",
        "total_results": len(unique_products),
        "products": unique_products,
    }

    return collection


def main():
    parser = argparse.ArgumentParser(description="Temu Collector - Bestseller Rankings")
    parser.add_argument("--country", type=str, default=None, choices=["USA", "MX", "CO", "EC"],
                        help="Specific country (default: all)")
    parser.add_argument("--test", action="store_true", help="Test mode (2 categories per country)")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("TEMU COLLECTOR - Bestseller Rankings")
    logger.info("=" * 60)

    scraping_config = load_config("scraping_config")
    categories_config = load_config("categories")

    countries = [args.country] if args.country else ["USA", "MX", "CO", "EC"]

    report_progress(0, "Iniciando scraping de Temu...", f"{len(countries)} paises")

    results = {}

    for idx, country in enumerate(countries):
        report_progress(
            5 + int((idx / len(countries)) * 80),
            f"Analizando Temu {COUNTRY_NAMES.get(country, country)}...",
            "Conectando con Temu..."
        )

        try:
            collection = collect_country(
                country, scraping_config, categories_config,
                test_mode=args.test,
                country_idx=idx, total_countries=len(countries)
            )

            if collection:
                validated = validate_data(collection, TemuRawCollection)
                if validated:
                    filepath = save_raw_data(collection, "temu", country)
                    logger.info(f"  {country}: Data saved to {filepath}")
                    results[country] = "success"
                else:
                    logger.error(f"  {country}: Schema validation failed")
                    filepath = save_raw_data(collection, "temu", country)
                    logger.info(f"  {country}: Data saved (without validation) to {filepath}")
                    results[country] = "partial"
            else:
                results[country] = "failed"

        except Exception as e:
            logger.error(f"  {country}: Unexpected error - {e}")
            results[country] = "error"

    # Summary
    report_progress(85, "Temu scraping completado", "Preparando datos...")
    logger.info("")
    logger.info("=" * 60)
    logger.info("RESUMEN TEMU:")
    success_count = 0
    for country, status in results.items():
        emoji = {"success": "OK", "partial": "WARN", "failed": "FAIL", "error": "ERR"}.get(status, "?")
        logger.info(f"  {country}: [{emoji}] {status}")
        if status in ("success", "partial"):
            success_count += 1
    logger.info("=" * 60)

    report_progress(
        90,
        f"Temu: datos de {success_count}/{len(countries)} paises",
        "Listo para analisis"
    )

    return 0 if all(s in ("success", "partial") for s in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
