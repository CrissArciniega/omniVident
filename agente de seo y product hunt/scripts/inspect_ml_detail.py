"""Inspeccionar estructura detallada de precio y datos de producto en ML."""

import json
from playwright.sync_api import sync_playwright


def inspect_detail():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )

        # Test with a specific category
        print("=== MercadoLibre MX - Mas Vendidos ===")
        page.goto("https://listado.mercadolibre.com.mx/mas-vendidos", timeout=30000)
        page.wait_for_timeout(3000)

        js_code = """
        () => {
            const cards = document.querySelectorAll('.ui-search-layout__item');
            const products = [];

            for (let i = 0; i < Math.min(5, cards.length); i++) {
                const card = cards[i];

                // Title and link
                const titleEl = card.querySelector('.poly-component__title');
                const title = titleEl ? titleEl.textContent.trim() : null;
                const link = titleEl ? titleEl.getAttribute('href') : null;

                // Price - current
                const priceContainer = card.querySelector('.poly-price__current .andes-money-amount');
                const priceFraction = card.querySelector('.poly-price__current .andes-money-amount__fraction');
                const priceCurrency = card.querySelector('.poly-price__current .andes-money-amount__currency-symbol');
                const price = priceFraction ? priceFraction.textContent.trim() : null;
                const currency = priceCurrency ? priceCurrency.textContent.trim() : null;

                // Rating and sold
                const reviewEl = card.querySelector('.poly-component__review-compacted');
                const reviewText = reviewEl ? reviewEl.textContent.trim() : null;

                // Image
                const imgEl = card.querySelector('.poly-component__picture');
                const imgSrc = imgEl ? (imgEl.getAttribute('src') || imgEl.getAttribute('data-src')) : null;

                // Seller
                const sellerEl = card.querySelector('.poly-component__seller');
                const seller = sellerEl ? sellerEl.textContent.trim() : null;

                // Shipping
                const shippingEl = card.querySelector('.poly-component__shipping');
                const shipping = shippingEl ? shippingEl.textContent.trim() : null;

                products.push({
                    index: i,
                    title: title,
                    price: price,
                    currency: currency,
                    reviewText: reviewText,
                    imgSrc: imgSrc,
                    seller: seller,
                    shipping: shipping,
                    linkPreview: link ? link.substring(0, 100) : null
                });
            }

            // Also check category links
            const categoryLinks = [];
            document.querySelectorAll('.ui-search-filter-dl a, .ui-search-link').forEach(a => {
                const text = a.textContent.trim();
                const href = a.getAttribute('href');
                if (text && href && href.includes('mercadolibre')) {
                    categoryLinks.push({text: text.substring(0, 50), href: href.substring(0, 120)});
                }
            });

            return JSON.stringify({products, categoryLinks: categoryLinks.slice(0, 15), totalCards: cards.length});
        }
        """

        result = page.evaluate(js_code)
        data = json.loads(result)

        print(f"\nTotal cards: {data['totalCards']}")
        print(f"\nFIRST 5 PRODUCTS:")
        for prod in data["products"]:
            print(f"\n  [{prod['index']}] {prod['title']}")
            print(f"      Price: {prod['currency']} {prod['price']}")
            print(f"      Review: {prod['reviewText']}")
            print(f"      Seller: {prod['seller']}")
            print(f"      Shipping: {prod['shipping']}")
            print(f"      Link: {prod['linkPreview']}")

        print(f"\nCATEGORY/FILTER LINKS ({len(data['categoryLinks'])}):")
        for link in data["categoryLinks"]:
            print(f"  {link['text']}: {link['href']}")

        # Now test Ecuador
        print("\n\n=== MercadoLibre EC - Mas Vendidos ===")
        page.goto("https://listado.mercadolibre.com.ec/mas-vendidos", timeout=30000)
        page.wait_for_timeout(3000)
        print(f"URL: {page.url}")
        print(f"Title: {page.title()}")

        ec_count = page.evaluate("document.querySelectorAll('.ui-search-layout__item').length")
        print(f"Products found: {ec_count}")

        # Test Colombia
        print("\n=== MercadoLibre CO - Mas Vendidos ===")
        page.goto("https://listado.mercadolibre.com.co/mas-vendidos", timeout=30000)
        page.wait_for_timeout(3000)
        print(f"URL: {page.url}")
        print(f"Title: {page.title()}")

        co_count = page.evaluate("document.querySelectorAll('.ui-search-layout__item').length")
        print(f"Products found: {co_count}")

        browser.close()


if __name__ == "__main__":
    inspect_detail()
