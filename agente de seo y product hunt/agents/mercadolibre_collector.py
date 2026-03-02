"""
MercadoLibre Collector Agent
Scraping de productos más vendidos de MercadoLibre para EC, MX, CO usando Playwright.

Uso:
    python agents/mercadolibre_collector.py                     # Todos los países
    python agents/mercadolibre_collector.py --country MX        # Solo México
    python agents/mercadolibre_collector.py --country MX --test # Test rápido (1 categoría)
"""

import argparse
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


def get_category_urls(country: str, config: dict, categories: dict) -> list[dict]:
    """Genera las URLs de categorías más vendidos para un país."""
    tld = config["mercadolibre"]["domains"][country]
    cat_map = categories["mercadolibre"]["categories"]
    urls = []

    for slug, name in cat_map.items():
        url = f"https://listado.mercadolibre.com.{tld}/{slug}/mas-vendidos_NoIndex_True"
        urls.append({"url": url, "category_slug": slug, "category_name": name})

    return urls


def extract_product_id(url: str) -> str:
    """Extrae el ID del producto de una URL de MercadoLibre."""
    if not url:
        return ""
    # Match patterns like MLM-1234567890 or MLM1234567890
    match = re.search(r"(ML[A-Z]\d+|M[A-Z]{2}\d+)", url)
    if match:
        return match.group(1)
    # Fallback: hash de la URL
    return f"ML_{hash(url) % 10**10}"


def parse_review_text(text: str | None) -> tuple[float | None, int]:
    """Parsea texto como '4.6 | +1000 vendidos' → (4.6, 1000)."""
    if not text:
        return None, 0

    rating = None
    sold = 0

    # Rating: primer número decimal
    rating_match = re.search(r"(\d+\.?\d*)", text)
    if rating_match:
        try:
            rating = float(rating_match.group(1))
            if rating > 5:
                rating = None
        except ValueError:
            pass

    # Vendidos: buscar patrones como "+1000", "+25", "+500"
    sold_match = re.search(r"\+(\d+)", text.replace(",", "").replace(".", ""))
    if sold_match:
        try:
            sold = int(sold_match.group(1))
        except ValueError:
            pass

    return rating, sold


def parse_price(price_text: str | None) -> float | None:
    """Convierte texto de precio a float. Ej: '3,180' → 3180.0."""
    if not price_text:
        return None
    cleaned = price_text.replace(",", "").replace(".", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def get_currency_for_country(country: str) -> str:
    """Devuelve la moneda según el país."""
    return {"EC": "USD", "MX": "MXN", "CO": "COP"}.get(country, "USD")


def scrape_category(page, url: str, category_name: str, country: str, selectors: dict) -> list[dict]:
    """Scraping de una categoría específica de MercadoLibre."""
    products = []
    currency = get_currency_for_country(country)

    try:
        page.goto(url, timeout=30000)
        page.wait_for_timeout(2000)

        # Esperar a que carguen las cards
        page.wait_for_selector(selectors["product_card"], timeout=10000)

        cards = page.query_selector_all(selectors["product_card"])
        logger.info(f"    {len(cards)} productos encontrados en {category_name}")

        for card in cards:
            try:
                # Título y link
                title_el = card.query_selector(selectors["product_title"])
                title = title_el.text_content().strip() if title_el else None
                link = title_el.get_attribute("href") if title_el else None

                if not title:
                    continue

                # Precio
                price_el = card.query_selector(selectors["product_price_fraction"])
                price_text = price_el.text_content().strip() if price_el else None
                price = parse_price(price_text)

                # Rating y vendidos
                review_el = card.query_selector(selectors["product_review"])
                review_text = review_el.text_content().strip() if review_el else None
                rating, sold_quantity = parse_review_text(review_text)

                # Imagen
                img_el = card.query_selector(selectors["product_image"])
                thumbnail = None
                if img_el:
                    thumbnail = img_el.get_attribute("src") or img_el.get_attribute("data-src")

                # Seller
                seller_el = card.query_selector(selectors["product_seller"])
                seller = seller_el.text_content().strip() if seller_el else ""

                # ID del producto
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
                })

            except Exception as e:
                logger.warning(f"    Error parseando producto: {e}")
                continue

    except PlaywrightTimeout:
        logger.warning(f"    Timeout cargando {url}")
    except Exception as e:
        logger.error(f"    Error scrapeando {category_name}: {e}")

    return products


def collect_country(country: str, scraping_config: dict, categories: dict, test_mode: bool = False) -> dict | None:
    """Recolecta todos los productos más vendidos de un país."""
    logger.info(f"  Iniciando recolección para {country}...")

    selectors = scraping_config["mercadolibre"]["selectors"]
    category_urls = get_category_urls(country, scraping_config, categories)

    if test_mode:
        category_urls = category_urls[:1]
        logger.info(f"  [TEST MODE] Solo procesando 1 categoría: {category_urls[0]['category_name']}")

    user_agents = scraping_config.get("amazon", {}).get("user_agents", [
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ])

    all_products = []

    try:
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=scraping_config["playwright"]["headless"])
            context = browser.new_context(
                user_agent=random.choice(user_agents),
                viewport=scraping_config["playwright"]["viewport"],
            )
            page = context.new_page()

            for cat_info in category_urls:
                logger.info(f"    Scrapeando: {cat_info['category_name']}...")
                products = scrape_category(
                    page, cat_info["url"], cat_info["category_name"], country, selectors
                )
                all_products.extend(products)

                # Delay anti-detección
                delay_min = scraping_config["mercadolibre"]["request_delay_min_ms"] / 1000
                delay_max = scraping_config["mercadolibre"]["request_delay_max_ms"] / 1000
                delay = random.uniform(delay_min, delay_max)
                logger.info(f"    Esperando {delay:.1f}s...")
                time.sleep(delay)

            browser.close()

    except Exception as e:
        logger.error(f"  Error fatal en Playwright para {country}: {e}")
        return None

    if not all_products:
        logger.warning(f"  No se encontraron productos para {country}")
        return None

    # Deduplicar por product_id
    seen_ids = set()
    unique_products = []
    for prod in all_products:
        pid = prod["product_id"]
        if pid not in seen_ids:
            seen_ids.add(pid)
            unique_products.append(prod)

    logger.info(f"  {country}: {len(unique_products)} productos únicos (de {len(all_products)} total)")

    # Construir la colección
    collection = {
        "collection_timestamp": datetime.now(timezone.utc).isoformat(),
        "country": country,
        "source": "mercadolibre",
        "site_id": scraping_config["mercadolibre"]["domains"][country].upper(),
        "category_id": "all",
        "category_name": "Más Vendidos - Todas las categorías",
        "total_results": len(unique_products),
        "products": unique_products,
    }

    return collection


def main():
    parser = argparse.ArgumentParser(description="MercadoLibre Collector - Scraping de más vendidos")
    parser.add_argument("--country", type=str, default=None, choices=["EC", "MX", "CO"],
                        help="País específico (default: todos)")
    parser.add_argument("--test", action="store_true", help="Modo test (1 categoría por país)")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("MERCADOLIBRE COLLECTOR - Inicio")
    logger.info("=" * 60)

    scraping_config = load_config("scraping_config")
    categories = load_config("categories")

    countries = [args.country] if args.country else ["EC", "MX", "CO"]
    results = {}

    for country in countries:
        try:
            collection = collect_country(country, scraping_config, categories, test_mode=args.test)

            if collection:
                # Validar contra schema
                validated = validate_data(collection, MLRawCollection)
                if validated:
                    # Guardar datos crudos
                    filepath = save_raw_data(collection, "mercadolibre", country)
                    logger.info(f"  {country}: Datos guardados en {filepath}")
                    results[country] = "success"
                else:
                    logger.error(f"  {country}: Datos no pasaron validación de schema")
                    # Guardar de todos modos para debugging
                    filepath = save_raw_data(collection, "mercadolibre", country)
                    logger.info(f"  {country}: Datos guardados (sin validación) en {filepath}")
                    results[country] = "partial"
            else:
                results[country] = "failed"

        except Exception as e:
            logger.error(f"  {country}: Error inesperado - {e}")
            results[country] = "error"

    # Resumen
    logger.info("")
    logger.info("=" * 60)
    logger.info("RESUMEN:")
    for country, status in results.items():
        emoji = {"success": "OK", "partial": "PARCIAL", "failed": "FALLO", "error": "ERROR"}.get(status, "?")
        logger.info(f"  {country}: {emoji}")
    logger.info("=" * 60)

    # Retornar código de salida
    if all(s in ("success", "partial") for s in results.values()):
        return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
