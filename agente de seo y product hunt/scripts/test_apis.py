"""Script para verificar conexión a las APIs antes de ejecutar el pipeline."""

import os
import sys
from pathlib import Path

# Agregar raíz del proyecto al path
sys.path.insert(0, str(Path(__file__).parent.parent))

import requests
from dotenv import load_dotenv

from utils.logger import get_logger
from utils.data_loader import load_config

logger = get_logger("test_apis")
load_dotenv()


def test_mercadolibre_api():
    """Verifica que la API de MercadoLibre responde correctamente."""
    logger.info("Probando MercadoLibre API...")
    config = load_config("mercadolibre_config")
    base_url = config["api"]["base_url"]

    # Test 1: Categorías de un sitio (no requiere auth)
    for site_id in ["MEC", "MLM", "MCO"]:
        url = f"{base_url}/sites/{site_id}/categories"
        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                categories = response.json()
                logger.info(f"  {site_id}: OK - {len(categories)} categorías encontradas")
            else:
                logger.error(f"  {site_id}: FALLO - Status {response.status_code}")
        except Exception as e:
            logger.error(f"  {site_id}: ERROR - {e}")

    # Test 2: Tendencias (no requiere auth)
    url = f"{base_url}/trends/MLM"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            logger.info(f"  Trends MLM: OK - {len(response.json())} tendencias")
        else:
            logger.warning(f"  Trends MLM: Status {response.status_code} (puede requerir auth)")
    except Exception as e:
        logger.error(f"  Trends MLM: ERROR - {e}")

    # Test 3: Búsqueda (no requiere auth)
    url = f"{base_url}/sites/MLM/search?q=iphone&limit=5"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            results = response.json().get("results", [])
            logger.info(f"  Search MLM: OK - {len(results)} resultados para 'iphone'")
        else:
            logger.error(f"  Search MLM: FALLO - Status {response.status_code}")
    except Exception as e:
        logger.error(f"  Search MLM: ERROR - {e}")


def test_exchange_rate_api():
    """Verifica la API de tasas de cambio."""
    logger.info("Probando Exchange Rate API...")
    api_key = os.getenv("EXCHANGE_RATE_API_KEY", "")

    if not api_key:
        logger.warning("  EXCHANGE_RATE_API_KEY no configurada, usando tasas fallback")
        return

    url = f"https://v6.exchangerate-api.com/v6/{api_key}/latest/USD"
    try:
        response = requests.get(url, timeout=10)
        if response.status_code == 200:
            data = response.json()
            if data.get("result") == "success":
                mxn = data["conversion_rates"].get("MXN", "N/A")
                cop = data["conversion_rates"].get("COP", "N/A")
                logger.info(f"  Exchange Rate: OK - USD→MXN: {mxn}, USD→COP: {cop}")
            else:
                logger.error(f"  Exchange Rate: FALLO - {data.get('error-type', 'unknown')}")
        else:
            logger.error(f"  Exchange Rate: Status {response.status_code}")
    except Exception as e:
        logger.error(f"  Exchange Rate: ERROR - {e}")


def test_playwright():
    """Verifica que Playwright está instalado y funcional."""
    logger.info("Probando Playwright...")
    try:
        from playwright.sync_api import sync_playwright
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            page = browser.new_page()
            page.goto("https://www.amazon.com", timeout=15000)
            title = page.title()
            browser.close()
            logger.info(f"  Playwright: OK - Amazon title: '{title[:50]}...'")
    except ImportError:
        logger.error("  Playwright: NO INSTALADO - ejecuta: pip install playwright && playwright install chromium")
    except Exception as e:
        logger.error(f"  Playwright: ERROR - {e}")


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("TEST DE CONEXIÓN A APIs")
    logger.info("=" * 60)

    test_mercadolibre_api()
    print()
    test_exchange_rate_api()
    print()
    test_playwright()

    logger.info("=" * 60)
    logger.info("Tests completados")
