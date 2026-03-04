"""
MercadoLibre Collector Agent
Scraping de productos MÁS VENDIDOS REALES de MercadoLibre para EC, MX, CO.
Usa las páginas oficiales de ranking: mercadolibre.com.{tld}/mas-vendidos/{CATEGORY_ID}

Uso:
    python agents/mercadolibre_collector.py                     # Todos los países
    python agents/mercadolibre_collector.py --country MX        # Solo México
    python agents/mercadolibre_collector.py --country MX --test # Test rápido (2 categorías)
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
from schemas.mercadolibre_raw import MLProduct, MLRawCollection

logger = get_logger("mercadolibre_collector")

# ── Progress reporting ──────────────────────────────────────────
PROGRESS_FILE = Path(__file__).parent.parent / "outputs" / "agent_progress.json"

COUNTRY_NAMES = {"EC": "Ecuador", "MX": "México", "CO": "Colombia"}
COUNTRY_PREFIXES = {"EC": "MEC", "MX": "MLM", "CO": "MCO"}


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


# ── Category discovery ──────────────────────────────────────────

def discover_categories(page, country: str, config: dict) -> list[dict]:
    """Descubre categorías dinámicamente desde la página principal de más vendidos."""
    tld = config["mercadolibre"]["domains"][country]
    prefix = COUNTRY_PREFIXES[country]
    main_url = f"https://www.mercadolibre.com.{tld}/mas-vendidos"

    logger.info(f"  Descubriendo categorías desde {main_url}")

    try:
        page.goto(main_url, timeout=20000)
        page.wait_for_timeout(800)

        # Extract all category links from the page
        raw_links = page.evaluate("""(prefix) => {
            const anchors = document.querySelectorAll('a[href*="mas-vendidos/"]');
            const results = [];
            const seen = new Set();
            for (const a of anchors) {
                const href = a.href;
                const regex = new RegExp('mas-vendidos/(' + prefix + '\\\\d+)');
                const match = href.match(regex);
                if (match && !seen.has(match[1])) {
                    seen.add(match[1]);
                    let text = a.textContent.trim().replace(/^Ver más/, '').trim();
                    if (text.length > 2) {
                        results.push({
                            id: match[1],
                            name: text,
                            url: href.split('#')[0]
                        });
                    }
                }
            }
            return results;
        }""", prefix)

        if raw_links:
            logger.info(f"  Descubiertas {len(raw_links)} categorías dinámicamente")
            return raw_links

    except Exception as e:
        logger.warning(f"  Error descubriendo categorías: {e}")

    return []


def get_fallback_categories(country: str, config: dict, categories_config: dict) -> list[dict]:
    """Genera URLs de categorías usando IDs estáticos como fallback."""
    tld = config["mercadolibre"]["domains"][country]
    prefix = COUNTRY_PREFIXES[country]
    ml_cats = categories_config.get("mercadolibre", {})

    # First try country-specific IDs
    country_cats = ml_cats.get("country_specific", {}).get(country, {})
    if country_cats:
        return [
            {
                "id": cat_id,
                "name": name,
                "url": f"https://www.mercadolibre.com.{tld}/mas-vendidos/{cat_id}"
            }
            for cat_id, name in country_cats.items()
        ]

    # Fallback: use common IDs with country prefix
    common = ml_cats.get("common_category_ids", {})
    return [
        {
            "id": f"{prefix}{num_id}",
            "name": name,
            "url": f"https://www.mercadolibre.com.{tld}/mas-vendidos/{prefix}{num_id}"
        }
        for num_id, name in common.items()
    ]


def discover_subcategories(page, category_url: str, country: str) -> list[dict]:
    """Descubre subcategorías dentro de una categoría de bestsellers."""
    prefix = COUNTRY_PREFIXES[country]

    try:
        sub_links = page.evaluate("""(args) => {
            const [prefix, parentUrl] = args;
            const anchors = document.querySelectorAll('a[href*="mas-vendidos/"]');
            const results = [];
            const seen = new Set();
            // Exclude the parent URL itself
            const parentMatch = parentUrl.match(/mas-vendidos\\/([A-Z]{3}\\d+)/);
            const parentId = parentMatch ? parentMatch[1] : '';

            for (const a of anchors) {
                const href = a.href;
                const regex = new RegExp('mas-vendidos/(' + prefix + '\\\\d+)');
                const match = href.match(regex);
                if (match && match[1] !== parentId && !seen.has(match[1])) {
                    seen.add(match[1]);
                    let text = a.textContent.trim().replace(/^Ver más/, '').trim();
                    if (text.length > 2) {
                        results.push({
                            id: match[1],
                            name: text,
                            url: href.split('#')[0]
                        });
                    }
                }
            }
            return results;
        }""", [prefix, category_url])

        return sub_links or []
    except Exception:
        return []


# ── Parsing helpers ─────────────────────────────────────────────

def extract_product_id(url: str) -> str:
    """Extrae el ID del producto de una URL de MercadoLibre."""
    if not url:
        return ""
    match = re.search(r"(ML[A-Z]\d+|M[A-Z]{2}\d+)", url)
    if match:
        return match.group(1)
    return f"ML_{hash(url) % 10**10}"


def parse_review_text(text: str | None) -> tuple[float | None, int]:
    """Parsea texto como '4.6 | +1000 vendidos' o '4.9 | +25mil vendidos'."""
    if not text:
        return None, 0

    rating = None
    sold = 0

    # Rating: primer número decimal <= 5
    rating_match = re.search(r"(\d+[.,]?\d*)", text)
    if rating_match:
        try:
            val = float(rating_match.group(1).replace(",", "."))
            if val <= 5:
                rating = val
        except ValueError:
            pass

    # Vendidos: patrones como "+100", "+1000", "+5mil", "+25mil", "+100mil"
    sold_match = re.search(r"\+\s*(\d+)\s*(mil)?", text.lower().replace(",", "").replace(".", ""))
    if sold_match:
        try:
            num = int(sold_match.group(1))
            if sold_match.group(2):  # "mil"
                num *= 1000
            sold = num
        except ValueError:
            pass

    return rating, sold


def parse_ranking(text: str | None) -> int | None:
    """Parsea texto como '1° MÁS VENDIDO' → 1."""
    if not text:
        return None
    match = re.search(r"(\d+)", text)
    return int(match.group(1)) if match else None


def parse_price(price_text: str | None) -> float | None:
    """Convierte texto de precio a float. Maneja formatos LATAM."""
    if not price_text:
        return None
    # Remove currency symbols and spaces
    cleaned = re.sub(r"[^\d,.]", "", price_text.strip())
    if not cleaned:
        return None

    # Handle LATAM format: 3.180 (thousands separator is dot)
    # vs decimal: 3,50
    if "," in cleaned and "." in cleaned:
        # Both present: 3.180,50 → 3180.50
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif "." in cleaned:
        # Only dot: could be 3.180 (thousands) or 3.50 (decimal)
        parts = cleaned.split(".")
        if len(parts[-1]) == 3:
            # Likely thousands separator: 3.180 → 3180
            cleaned = cleaned.replace(".", "")
        # else keep as decimal
    elif "," in cleaned:
        # Only comma: 3,50 → 3.50
        cleaned = cleaned.replace(",", ".")

    try:
        return float(cleaned)
    except ValueError:
        return None


def get_currency_for_country(country: str) -> str:
    return {"EC": "USD", "MX": "MXN", "CO": "COP"}.get(country, "USD")


# ── Scraping ────────────────────────────────────────────────────

def scrape_category(page, url: str, category_name: str, country: str, selectors: dict) -> list[dict]:
    """Scraping de una categoría de MÁS VENDIDOS REALES."""
    products = []
    currency = get_currency_for_country(country)

    try:
        page.goto(url, timeout=20000)
        page.wait_for_timeout(600)

        # Wait for product cards
        try:
            page.wait_for_selector(selectors["product_card"], timeout=8000)
        except PlaywrightTimeout:
            logger.warning(f"    No se encontraron productos en {category_name}")
            return products

        cards = page.query_selector_all(selectors["product_card"])
        logger.info(f"    {len(cards)} productos en {category_name}")

        for idx, card in enumerate(cards):
            try:
                # Title and link
                title_el = card.query_selector(selectors["product_title"])
                title = title_el.text_content().strip() if title_el else None
                link = title_el.get_attribute("href") if title_el else None

                if not title:
                    continue

                # Price (try current price first, then any price)
                price = None
                price_el = card.query_selector(".poly-price__current .andes-money-amount__fraction")
                if not price_el:
                    price_el = card.query_selector(selectors["product_price_fraction"])
                if price_el:
                    price = parse_price(price_el.text_content().strip())

                # Rating and sold quantity
                review_el = card.query_selector(selectors["product_review"])
                review_text = review_el.text_content().strip() if review_el else None
                rating, sold_quantity = parse_review_text(review_text)

                # Ranking badge (e.g., "1° MÁS VENDIDO")
                highlight_el = card.query_selector(selectors.get("product_highlight", ".poly-component__highlight"))
                highlight_text = highlight_el.text_content().strip() if highlight_el else None
                ranking = parse_ranking(highlight_text)

                # If no explicit ranking, use card position (1-based)
                if ranking is None:
                    ranking = idx + 1

                # Image
                img_el = card.query_selector(selectors["product_image"])
                thumbnail = None
                if img_el:
                    thumbnail = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                # Seller
                seller_el = card.query_selector(selectors["product_seller"])
                seller = seller_el.text_content().strip() if seller_el else ""
                # Clean seller name (remove SVG text artifacts)
                seller = re.sub(r"\s*(Tienda oficial|Es más vendido|Llegó gratis).*", "", seller).strip()

                # Product ID
                product_id = extract_product_id(link or "")

                products.append({
                    "product_id": product_id,
                    "title": title,
                    "price": price if price else 0.0,
                    "currency": currency,
                    "category_id": "",
                    "category_name": category_name,
                    "permalink": link or "",
                    "seller_id": seller,
                    "sold_quantity": sold_quantity,
                    "rating_average": rating,
                    "reviews_count": 0,
                    "available_quantity": 0,
                    "condition": "new",
                    "thumbnail": thumbnail,
                    "ranking": ranking,
                    "ranking_label": highlight_text or f"#{ranking}",
                })

            except Exception as e:
                logger.warning(f"    Error parseando producto: {e}")
                continue

    except PlaywrightTimeout:
        logger.warning(f"    Timeout cargando {url}")
    except Exception as e:
        logger.error(f"    Error scrapeando {category_name}: {e}")

    return products


def collect_country(country: str, scraping_config: dict, categories_config: dict,
                    test_mode: bool = False, country_idx: int = 0, total_countries: int = 3) -> dict | None:
    """Recolecta los productos MÁS VENDIDOS REALES de un país."""
    country_label = COUNTRY_NAMES.get(country, country)
    logger.info(f"\n  ╔══ Iniciando {country_label} ══╗")

    selectors = scraping_config["mercadolibre"]["selectors"]
    tld = scraping_config["mercadolibre"]["domains"][country]

    user_agents = scraping_config.get("amazon", {}).get("user_agents", [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ])

    base_pct = 5 + int((country_idx / total_countries) * 80)
    country_range = int(80 / total_countries)

    all_products = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=scraping_config["playwright"]["headless"])
            context = browser.new_context(
                user_agent=random.choice(user_agents),
                viewport=scraping_config["playwright"]["viewport"],
            )
            page = context.new_page()

            # ── Step 1: Discover categories dynamically ──
            report_progress(
                base_pct,
                f"Descubriendo categorías en {country_label}...",
                "Analizando página de más vendidos"
            )

            categories = []
            if scraping_config["mercadolibre"].get("discover_categories", True):
                categories = discover_categories(page, country, scraping_config)

            # Merge with fallback categories (add any we didn't discover)
            fallback = get_fallback_categories(country, scraping_config, categories_config)
            discovered_ids = {c["id"] for c in categories}
            for fb in fallback:
                if fb["id"] not in discovered_ids:
                    categories.append(fb)

            # Limit categories per country for speed
            max_cats = scraping_config["mercadolibre"].get("max_categories_per_country", 15)
            if len(categories) > max_cats:
                logger.info(f"  Total categorías disponibles para {country}: {len(categories)} → limitando a {max_cats}")
                categories = categories[:max_cats]
            else:
                logger.info(f"  Total categorías para {country}: {len(categories)}")

            if test_mode:
                categories = categories[:2]
                logger.info(f"  [TEST MODE] Solo procesando {len(categories)} categorías")

            total_cats = len(categories)

            # ── Step 2: Scrape each category's bestsellers ──
            logger.info(f"\n  --- Fase 1: Bestsellers ({total_cats} categorias) ---")
            for cat_idx, cat_info in enumerate(categories):
                cat_pct = base_pct + int(((cat_idx) / max(total_cats, 1)) * (country_range * 0.7))
                report_progress(
                    cat_pct,
                    f"ML {country_label} Bestsellers ({cat_idx + 1}/{total_cats})",
                    f"Categoría: {cat_info['name']}"
                )

                logger.info(f"  📊 [{cat_idx+1}/{total_cats}] {cat_info['name']} ({cat_info['id']})")

                products = scrape_category(
                    page, cat_info["url"], cat_info["name"], country, selectors
                )
                all_products.extend(products)

                # Also scrape subcategories if enabled
                max_subcats = scraping_config["mercadolibre"].get("max_subcategories_per_category", 2)
                if scraping_config["mercadolibre"].get("include_subcategories", True) and products and max_subcats > 0:
                    subcats = discover_subcategories(page, cat_info["url"], country)
                    for sub_idx, sub in enumerate(subcats[:max_subcats]):
                        if sub["id"] not in discovered_ids:
                            discovered_ids.add(sub["id"])
                            logger.info(f"    ↳ Subcategoría: {sub['name']} ({sub['id']})")

                            sub_products = scrape_category(
                                page, sub["url"], sub["name"], country, selectors
                            )
                            all_products.extend(sub_products)

                            time.sleep(random.uniform(0.5, 1.0))

                delay_min = scraping_config["mercadolibre"]["request_delay_min_ms"] / 1000
                delay_max = scraping_config["mercadolibre"]["request_delay_max_ms"] / 1000
                delay = random.uniform(delay_min, delay_max)
                time.sleep(delay)

            browser.close()

    except Exception as e:
        logger.error(f"  Error fatal en Playwright para {country}: {e}")
        return None

    if not all_products:
        logger.warning(f"  No se encontraron productos para {country}")
        return None

    # Deduplicate by product_id, keeping the one with highest ranking (lowest number)
    seen_ids = {}
    for prod in all_products:
        pid = prod["product_id"]
        if pid not in seen_ids or (prod.get("ranking", 999) < seen_ids[pid].get("ranking", 999)):
            seen_ids[pid] = prod

    unique_products = list(seen_ids.values())

    # Sort by sold_quantity desc, then by ranking asc
    unique_products.sort(key=lambda x: (-x.get("sold_quantity", 0), x.get("ranking", 999)))

    logger.info(f"  ✅ {country}: {len(unique_products)} productos únicos (de {len(all_products)} total)")
    top3 = unique_products[:3]
    for t in top3:
        logger.info(f"     🏆 {t['title'][:50]} | {t.get('ranking_label', '')} | {t['sold_quantity']} vendidos")

    # Build the collection
    collection = {
        "collection_timestamp": datetime.now(timezone.utc).isoformat(),
        "country": country,
        "source": "mercadolibre",
        "site_id": tld.upper(),
        "category_id": "all",
        "category_name": "Más Vendidos - Ranking Oficial",
        "total_results": len(unique_products),
        "products": unique_products,
    }

    return collection


def _collect_and_save(country, scraping_config, categories_config, test_mode, country_idx, total_countries):
    """Worker: collect one country and save results. Returns (country, status)."""
    try:
        report_progress(
            5 + int((country_idx / total_countries) * 80),
            f"Analizando {COUNTRY_NAMES.get(country, country)}...",
            "Conectando con MercadoLibre..."
        )
        collection = collect_country(
            country, scraping_config, categories_config,
            test_mode=test_mode,
            country_idx=country_idx, total_countries=total_countries
        )

        if collection:
            validated = validate_data(collection, MLRawCollection)
            if validated:
                filepath = save_raw_data(collection, "mercadolibre", country)
                logger.info(f"  {country}: Datos guardados en {filepath}")
                return (country, "success")
            else:
                logger.error(f"  {country}: Datos no pasaron validación de schema")
                filepath = save_raw_data(collection, "mercadolibre", country)
                logger.info(f"  {country}: Datos guardados (sin validación) en {filepath}")
                return (country, "partial")
        else:
            return (country, "failed")

    except Exception as e:
        logger.error(f"  {country}: Error inesperado - {e}")
        return (country, "error")


def main():
    parser = argparse.ArgumentParser(description="MercadoLibre Collector - Ranking oficial de más vendidos")
    parser.add_argument("--country", type=str, default=None, choices=["EC", "MX", "CO"],
                        help="País específico (default: todos)")
    parser.add_argument("--test", action="store_true", help="Modo test (2 categorías por país)")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("MERCADOLIBRE COLLECTOR v2 - Ranking Oficial Más Vendidos")
    logger.info("=" * 60)

    scraping_config = load_config("scraping_config")
    categories_config = load_config("categories")

    countries = [args.country] if args.country else ["EC", "MX", "CO"]

    report_progress(0, "Iniciando estudio de mercado...", f"{len(countries)} países")

    # ── PARALLEL: scrape all countries simultaneously ──
    from concurrent.futures import ThreadPoolExecutor, as_completed

    results = {}

    if len(countries) == 1:
        c, st = _collect_and_save(countries[0], scraping_config, categories_config, args.test, 0, 1)
        results[c] = st
    else:
        report_progress(5, "Scrapeando 3 países en paralelo...",
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
                    report_progress(pct, f"Completado {COUNTRY_NAMES.get(country, country)} ({done}/{len(countries)})",
                                    f"Estado: {status}")
                except Exception as e:
                    results[c] = "error"
                    logger.error(f"  {c}: Thread error - {e}")

    # Summary
    report_progress(85, "Recopilación completada", "Preparando datos...")
    logger.info("")
    logger.info("=" * 60)
    logger.info("RESUMEN:")
    success_count = 0
    for country, status in results.items():
        emoji = {"success": "✅", "partial": "⚠️", "failed": "❌", "error": "💥"}.get(status, "?")
        logger.info(f"  {country}: {emoji} {status}")
        if status in ("success", "partial"):
            success_count += 1
    logger.info("=" * 60)

    report_progress(
        90,
        f"Datos recopilados de {success_count}/{len(countries)} países",
        "Generando reporte HTML..."
    )

    return 0 if all(s in ("success", "partial") for s in results.values()) else 1


if __name__ == "__main__":
    sys.exit(main())
