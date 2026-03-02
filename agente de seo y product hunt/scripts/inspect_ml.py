"""Inspeccionar estructura HTML de MercadoLibre para obtener selectores CSS."""

import json
from playwright.sync_api import sync_playwright


def inspect_mercadolibre():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        print("Navegando a MercadoLibre México más vendidos...")
        page.goto("https://listado.mercadolibre.com.mx/mas-vendidos", timeout=30000)
        page.wait_for_timeout(4000)

        print(f"TITLE: {page.title()}")
        print(f"URL: {page.url}")

        js_code = """
        () => {
            const selectors = [
                '.ui-search-result',
                '.ui-search-layout__item',
                '.andes-card',
                '.poly-card',
                '.poly-card__content',
                '.promotion-item',
                '.ui-search-result__wrapper',
                '.ui-search-result__content',
                'li[class*=ui-search]',
                'ol li',
                'section li'
            ];

            let results = {};
            for (const sel of selectors) {
                const els = document.querySelectorAll(sel);
                results[sel] = els.length;
            }

            const allClasses = new Set();
            document.querySelectorAll('*').forEach(el => {
                el.classList.forEach(c => {
                    if (c.includes('poly') || c.includes('card') || c.includes('product') ||
                        c.includes('item') || c.includes('search') || c.includes('price') ||
                        c.includes('title') || c.includes('review') || c.includes('rating')) {
                        allClasses.add(c);
                    }
                });
            });

            // Get first product card outer HTML
            let sampleHTML = 'NONE';
            const possibleCards = document.querySelectorAll('.poly-card, .ui-search-layout__item, .andes-card, ol li');
            if (possibleCards.length > 0) {
                sampleHTML = possibleCards[0].outerHTML;
            }

            return JSON.stringify({
                selectors: results,
                relevantClasses: Array.from(allClasses).sort(),
                sampleCard: sampleHTML.substring(0, 4000),
                totalCards: possibleCards.length
            });
        }
        """

        result = page.evaluate(js_code)
        data = json.loads(result)

        print(f"\nSELECTOR COUNTS:")
        for sel, count in data["selectors"].items():
            print(f"  {sel}: {count}")

        print(f"\nRELEVANT CLASSES ({len(data['relevantClasses'])}):")
        for cls in data["relevantClasses"]:
            print(f"  .{cls}")

        print(f"\nTOTAL CARDS FOUND: {data['totalCards']}")
        print(f"\nSAMPLE CARD HTML:")
        print(data["sampleCard"][:3000])

        browser.close()


if __name__ == "__main__":
    inspect_mercadolibre()
