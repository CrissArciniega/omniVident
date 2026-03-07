"""
Alibaba Collector Agent
Scraping de productos TOP (B2B) de Alibaba por categoria.
Usa busqueda ordenada por transacciones: alibaba.com/trade/search?sort=TRANSACTION_LEVEL_DESC

Uso:
    python agents/alibaba_collector.py          # Todas las categorias
    python agents/alibaba_collector.py --test   # Test rapido (2 categorias)
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
from schemas.alibaba_raw import AlibabaProduct, AlibabaRawCollection

logger = get_logger("alibaba_collector")

# -- Progress reporting -------------------------------------------------------
PROGRESS_FILE = Path(__file__).parent.parent / "outputs" / "agent_progress.json"


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
    window.chrome = { runtime: {} };
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
        parameters.name === 'notifications'
            ? Promise.resolve({ state: Notification.permission })
            : originalQuery(parameters);
    Object.defineProperty(navigator, 'plugins', {
        get: () => [1, 2, 3, 4, 5],
    });
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
            "--disable-setuid-sandbox",
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

def parse_alibaba_price(text: str | None) -> tuple[float | None, float | None]:
    """Parse Alibaba price range like '$1.50 - $3.00' or '$2.99'.
    Returns (price_min, price_max)."""
    if not text:
        return None, None

    # Find all price values
    prices = re.findall(r"[\d,.]+", text)
    if not prices:
        return None, None

    parsed = []
    for p in prices:
        cleaned = p.replace(",", "")
        try:
            parsed.append(float(cleaned))
        except ValueError:
            continue

    if len(parsed) >= 2:
        return min(parsed), max(parsed)
    elif len(parsed) == 1:
        return parsed[0], parsed[0]
    return None, None


def parse_moq(text: str | None) -> tuple[int | None, str | None]:
    """Parse '100 Pieces', '1 Set', '500 Pieces (Min. Order)' → (100, '100 Pieces')."""
    if not text:
        return None, None
    text = text.strip()
    match = re.search(r"(\d[\d,]*)", text)
    if match:
        try:
            qty = int(match.group(1).replace(",", ""))
            return qty, text
        except ValueError:
            pass
    return None, text


def parse_orders(text: str | None) -> int | None:
    """Parse order count from text like '500+ orders', '1,234 orders'."""
    if not text:
        return None
    match = re.search(r"([\d,]+)\+?\s*order", text, re.I)
    if match:
        try:
            return int(match.group(1).replace(",", ""))
        except ValueError:
            pass
    # Also try transaction count
    match = re.search(r"([\d,]+)\+?\s*transaction", text, re.I)
    if match:
        try:
            return int(match.group(1).replace(",", ""))
        except ValueError:
            pass
    return None


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


# -- Scraping -----------------------------------------------------------------

def scrape_search_page(page, url: str, category_name: str,
                       selectors: dict) -> list[dict]:
    """Scrape a single Alibaba search results page (sorted by transactions)."""
    products = []

    try:
        page.goto(url, timeout=30000, wait_until="domcontentloaded")
        page.wait_for_timeout(random.randint(3000, 6000))

        # Wait for product listing
        try:
            page.wait_for_selector(selectors["product_container"], timeout=15000)
        except PlaywrightTimeout:
            logger.warning(f"    No products found for {category_name}")
            return products

        # Scroll to load lazy content
        for _ in range(3):
            page.evaluate("window.scrollBy(0, window.innerHeight)")
            page.wait_for_timeout(random.randint(500, 1200))

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
                    permalink = href if href.startswith("http") else f"https://www.alibaba.com{href}"
                    # Extract product ID
                    id_match = re.search(r"/(\d{5,})", permalink)
                    if id_match:
                        product_id = id_match.group(1)

                if not product_id:
                    product_id = f"ALI_{hash(title) % 10**10}"

                # Price range
                price_el = container.query_selector(selectors["product_price"])
                price_text = price_el.text_content().strip() if price_el else None
                price_min, price_max = parse_alibaba_price(price_text)

                # MOQ
                moq_el = container.query_selector(selectors["product_moq"])
                moq_text = moq_el.text_content().strip() if moq_el else None
                moq, moq_full = parse_moq(moq_text)

                # Image
                img_el = container.query_selector(selectors["product_image"])
                image_url = None
                if img_el:
                    image_url = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                # Supplier info
                supplier_el = container.query_selector(selectors["product_supplier"])
                supplier_name = supplier_el.text_content().strip() if supplier_el else None

                # Verified badge
                verified_el = container.query_selector(selectors["product_verified"])
                supplier_verified = verified_el is not None

                # Orders/transactions
                orders_count = None
                # Try to find in nearby elements
                order_els = container.query_selector_all(selectors["product_orders"])
                for oel in order_els:
                    oel_text = oel.text_content().strip()
                    oc = parse_orders(oel_text)
                    if oc:
                        orders_count = oc
                        break

                # Rating
                rating_el = container.query_selector(selectors["product_rating"])
                rating_text = rating_el.text_content().strip() if rating_el else None
                rating = parse_rating(rating_text)

                # Reviews count
                reviews_count = None
                if rating_text:
                    review_match = re.search(r"\((\d[\d,]*)\)", rating_text)
                    if review_match:
                        try:
                            reviews_count = int(review_match.group(1).replace(",", ""))
                        except ValueError:
                            pass

                products.append({
                    "product_id": product_id,
                    "title": title,
                    "price_min": price_min,
                    "price_max": price_max,
                    "currency": "USD",
                    "moq": moq,
                    "moq_text": moq_full,
                    "supplier_name": supplier_name,
                    "supplier_country": None,  # Alibaba doesn't always show this in listing
                    "supplier_verified": supplier_verified,
                    "orders_count": orders_count,
                    "rating": rating,
                    "reviews_count": reviews_count,
                    "image_url": image_url,
                    "permalink": permalink,
                    "category_name": category_name,
                })

            except Exception as e:
                logger.warning(f"    Error parsing product {idx}: {e}")
                continue

    except PlaywrightTimeout:
        logger.warning(f"    Timeout loading {url}")
    except Exception as e:
        logger.error(f"    Error scraping {category_name}: {e}")

    return products


def collect_global(scraping_config: dict, categories_config: dict,
                   test_mode: bool = False) -> dict | None:
    """Collect top products from Alibaba (global B2B marketplace)."""
    logger.info(f"\n  +== Iniciando Alibaba GLOBAL ==+")

    alibaba_config = scraping_config["alibaba"]
    selectors = alibaba_config["selectors"]

    # Get categories
    global_cats = categories_config.get("alibaba", {}).get("GLOBAL", {})
    if not global_cats:
        logger.error("  No categories configured for Alibaba GLOBAL")
        return None

    categories = [
        {"slug": slug, "name": name}
        for slug, name in global_cats.items()
    ]

    max_cats = alibaba_config.get("max_categories", 8)
    if len(categories) > max_cats:
        categories = categories[:max_cats]

    if test_mode:
        categories = categories[:2]
        logger.info(f"  [TEST MODE] Only processing {len(categories)} categories")

    user_agents = alibaba_config.get("user_agents", [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36"
    ])

    delay_min = alibaba_config.get("request_delay_min_ms", 4000) / 1000
    delay_max = alibaba_config.get("request_delay_max_ms", 10000) / 1000
    max_products = alibaba_config.get("max_products_per_category", 40)

    all_products = []
    total_cats = len(categories)

    try:
        with sync_playwright() as p:
            user_agent = random.choice(user_agents)
            browser, context = get_stealth_context(p, scraping_config, user_agent)
            page = context.new_page()

            for cat_idx, cat_info in enumerate(categories):
                cat_pct = 5 + int(((cat_idx) / max(total_cats, 1)) * 80)
                report_progress(
                    cat_pct,
                    f"Alibaba GLOBAL ({cat_idx + 1}/{total_cats})",
                    f"Categoria: {cat_info['name']}"
                )

                slug = cat_info["slug"]
                name = cat_info["name"]
                logger.info(f"  [{cat_idx+1}/{total_cats}] {name} ({slug})")

                # Search URL sorted by most transactions
                search_query = name.replace(" & ", " ").replace("&", " ")
                url = f"https://www.alibaba.com/trade/search?SearchText={search_query}&sort=TRANSACTION_LEVEL_DESC"

                products = scrape_search_page(page, url, name, selectors)

                # Limit per category
                if len(products) > max_products:
                    products = products[:max_products]

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

                # Conservative delay for Alibaba
                delay = random.uniform(delay_min, delay_max)
                time.sleep(delay)

            browser.close()

    except Exception as e:
        logger.error(f"  Fatal Playwright error for Alibaba: {e}")
        return None

    if not all_products:
        logger.warning(f"  No products found for Alibaba GLOBAL")
        return None

    # Deduplicate by product_id
    seen_ids = {}
    for prod in all_products:
        pid = prod.get("product_id", "")
        if not pid:
            continue
        if pid not in seen_ids:
            seen_ids[pid] = prod

    unique_products = list(seen_ids.values())

    # Sort by orders_count desc (those with orders first)
    unique_products.sort(key=lambda x: -(x.get("orders_count") or 0))

    logger.info(f"  Alibaba GLOBAL: {len(unique_products)} unique products (from {len(all_products)} total)")
    top3 = unique_products[:3]
    for t in top3:
        pmin = t.get("price_min")
        pmax = t.get("price_max")
        price_str = f"${pmin:.2f}-${pmax:.2f}" if pmin and pmax else "N/A"
        orders = t.get("orders_count") or 0
        logger.info(f"     {t['title'][:50]} | {price_str} | {orders} orders")

    collection = {
        "collection_timestamp": datetime.now(timezone.utc).isoformat(),
        "country": "GLOBAL",
        "source": "alibaba",
        "category_name": "Top Products - Alibaba B2B",
        "total_results": len(unique_products),
        "products": unique_products,
    }

    return collection


def main():
    parser = argparse.ArgumentParser(description="Alibaba Collector - Top B2B Products by Transaction Volume")
    parser.add_argument("--test", action="store_true", help="Test mode (2 categories)")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("ALIBABA COLLECTOR - Top B2B Products")
    logger.info("=" * 60)

    scraping_config = load_config("scraping_config")
    categories_config = load_config("categories")

    report_progress(0, "Iniciando scraping de Alibaba...", "Marketplace B2B global")

    try:
        collection = collect_global(
            scraping_config, categories_config,
            test_mode=args.test
        )

        if collection:
            validated = validate_data(collection, AlibabaRawCollection)
            if validated:
                filepath = save_raw_data(collection, "alibaba", "GLOBAL")
                logger.info(f"  GLOBAL: Data saved to {filepath}")
                status = "success"
            else:
                logger.error(f"  GLOBAL: Schema validation failed")
                filepath = save_raw_data(collection, "alibaba", "GLOBAL")
                logger.info(f"  GLOBAL: Data saved (without validation) to {filepath}")
                status = "partial"
        else:
            status = "failed"

    except Exception as e:
        logger.error(f"  GLOBAL: Unexpected error - {e}")
        status = "error"

    # Summary
    report_progress(85, "Alibaba scraping completado", "Preparando datos...")
    logger.info("")
    logger.info("=" * 60)
    emoji = {"success": "OK", "partial": "WARN", "failed": "FAIL", "error": "ERR"}.get(status, "?")
    logger.info(f"RESUMEN ALIBABA: GLOBAL [{emoji}] {status}")
    logger.info("=" * 60)

    report_progress(
        90,
        f"Alibaba: datos {'recopilados' if status in ('success', 'partial') else 'sin datos'}",
        "Listo para analisis"
    )

    return 0 if status in ("success", "partial") else 1


if __name__ == "__main__":
    sys.exit(main())
