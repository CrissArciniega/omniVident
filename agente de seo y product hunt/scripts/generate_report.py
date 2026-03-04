"""
Generador de Reporte HTML Interactivo
Lee los archivos raw JSON y genera un reporte visual con tabla interactiva.

Uso:
    python scripts/generate_report.py                    # Reporte del día
    python scripts/generate_report.py --date 20260209    # Fecha específica
    python scripts/generate_report.py --no-open          # Sin abrir navegador
"""

import argparse
import html
import json
import os
import sys
import time
import webbrowser
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

# ── Progress reporting ──────────────────────────────────────────
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

from utils.logger import get_logger
from utils.data_loader import load_json, load_config, PROCESSED_DIR, RAW_DIR

logger = get_logger("generate_report")

CATEGORY_COLORS = {
    "Celulares y Teléfonos": "#6366f1",
    "Computación": "#3b82f6",
    "Electrónica, Audio y Video": "#0ea5e9",
    "Hogar, Muebles y Jardín": "#10b981",
    "Deportes y Fitness": "#f97316",
    "Belleza y Cuidado Personal": "#ec4899",
    "Ropa y Accesorios": "#ef4444",
    "Consolas y Videojuegos": "#8b5cf6",
    "Juguetes y Bebés": "#f59e0b",
    "Herramientas": "#6b7280",
}

COUNTRY_FLAGS = {"EC": "🇪🇨", "MX": "🇲🇽", "CO": "🇨🇴", "USA": "🇺🇸", "GLOBAL": "🌏"}
COUNTRY_NAMES = {"EC": "Ecuador", "MX": "México", "CO": "Colombia", "USA": "USA", "GLOBAL": "Global"}


def find_raw_files(date_str: str | None = None) -> list[Path]:
    """Encuentra archivos raw para una fecha específica o la más reciente."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    if date_str:
        pattern = f"raw_*_{date_str}.json"
    else:
        pattern = "raw_*.json"

    files = sorted(RAW_DIR.glob(pattern), reverse=True)

    if not date_str and files:
        # Extraer la fecha más reciente
        latest_date = files[0].stem.split("_")[-1]
        files = [f for f in files if f.stem.endswith(latest_date)]

    return files


def load_all_products(files: list[Path]) -> list[dict]:
    """Carga y combina productos de múltiples archivos raw, normalizando campos."""
    all_products = []

    for filepath in files:
        try:
            data = load_json(filepath)
            country = data.get("country", "??")
            source = data.get("source", "mercadolibre")

            for product in data.get("products", []):
                if source == "amazon":
                    normalized = {
                        "product_id": product.get("asin", ""),
                        "title": product.get("title", ""),
                        "price": product.get("price") or 0,
                        "currency": product.get("currency", "USD"),
                        "category_name": product.get("category_name", product.get("category", "")),
                        "permalink": product.get("url", ""),
                        "seller_id": product.get("seller_id", ""),
                        "sold_quantity": 0,
                        "rating_average": product.get("rating"),
                        "reviews_count": product.get("reviews_count", 0),
                        "condition": "new",
                        "thumbnail": product.get("image_url", ""),
                        "ranking": product.get("ranking"),
                        "ranking_label": product.get("ranking_label", ""),
                        "_country": country,
                        "_source": "amazon",
                    }
                    all_products.append(normalized)
                elif source == "temu":
                    normalized = {
                        "product_id": product.get("product_id", ""),
                        "title": product.get("title", ""),
                        "price": product.get("price") or 0,
                        "currency": product.get("currency", "USD"),
                        "category_name": product.get("category_name", ""),
                        "permalink": product.get("permalink", ""),
                        "seller_id": "",
                        "sold_quantity": 0,
                        "rating_average": product.get("rating"),
                        "reviews_count": product.get("reviews_count", 0),
                        "condition": "new",
                        "thumbnail": product.get("image_url", ""),
                        "ranking": product.get("ranking"),
                        "ranking_label": "",
                        "original_price": product.get("original_price"),
                        "discount_pct": product.get("discount_pct"),
                        "_country": country,
                        "_source": "temu",
                    }
                    all_products.append(normalized)
                elif source == "alibaba":
                    price_min = product.get("price_min") or 0
                    price_max = product.get("price_max") or 0
                    normalized = {
                        "product_id": product.get("product_id", ""),
                        "title": product.get("title", ""),
                        "price": price_min if price_min else price_max,
                        "price_min": price_min,
                        "price_max": price_max,
                        "currency": "USD",
                        "category_name": product.get("category_name", ""),
                        "permalink": product.get("permalink", ""),
                        "seller_id": product.get("supplier_name", ""),
                        "sold_quantity": product.get("orders_count", 0),
                        "rating_average": product.get("rating"),
                        "reviews_count": product.get("reviews_count", 0),
                        "condition": "new",
                        "thumbnail": product.get("image_url", ""),
                        "ranking": product.get("ranking"),
                        "ranking_label": "",
                        "moq": product.get("moq"),
                        "moq_text": product.get("moq_text", ""),
                        "_country": country,
                        "_source": "alibaba",
                    }
                    all_products.append(normalized)
                else:
                    product["_country"] = country
                    product["_source"] = source
                    all_products.append(product)

        except Exception as e:
            logger.error(f"Error cargando {filepath}: {e}")

    return all_products


def format_price(price: float, currency: str) -> str:
    """Formatea precio según moneda."""
    if currency == "USD":
        return f"${price:,.2f}"
    elif currency == "MXN":
        return f"${price:,.0f} MXN"
    elif currency == "COP":
        return f"${price:,.0f} COP"
    return f"{price:,.2f} {currency}"


def render_stars(rating: float | None) -> str:
    """Renderiza estrellas HTML para un rating."""
    if rating is None:
        return '<span class="no-rating">Sin rating</span>'

    full = int(rating)
    has_half = (rating - full) >= 0.3
    empty = 5 - full - (1 if has_half else 0)

    stars = "★" * full
    if has_half:
        stars += "½"
    stars += "☆" * empty

    return f'<span class="stars" title="{rating:.1f}/5">{stars}</span> <span class="rating-num">{rating:.1f}</span>'


def generate_html(products: list[dict], date_str: str, files_loaded: list[str]) -> str:
    """Genera el HTML completo del reporte."""

    # Calcular métricas
    total = len(products)
    prices = [p["price"] for p in products if p.get("price", 0) > 0]
    ratings = [p["rating_average"] for p in products if p.get("rating_average")]
    solds = [p["sold_quantity"] for p in products if p.get("sold_quantity", 0) > 0]
    countries = sorted(set(p["_country"] for p in products))
    categories = sorted(set(p.get("category_name", "Sin categoría") for p in products))

    avg_rating = sum(ratings) / len(ratings) if ratings else 0
    total_sold = sum(solds) if solds else 0

    sources = sorted(set(p.get("_source", "mercadolibre") for p in products))

    # Generar filas de la tabla
    rows_html = ""
    for i, p in enumerate(products):
        cat = p.get("category_name", "Sin categoria")
        cat_color = CATEGORY_COLORS.get(cat, "#6b7280")
        country = p.get("_country", "??")
        flag = COUNTRY_FLAGS.get(country, "")
        price = p.get("price", 0)
        currency = p.get("currency", "USD")
        rating = p.get("rating_average")
        sold = p.get("sold_quantity", 0)
        title = html.escape(p.get("title", "Sin titulo")[:80])
        full_title = html.escape(p.get("title", ""))
        thumb = p.get("thumbnail", "")
        link = p.get("permalink", "")
        seller = html.escape(p.get("seller_id", "") or "")
        ranking = p.get("ranking")
        ranking_label = p.get("ranking_label", "")
        source = p.get("_source", "mercadolibre")

        img_html = f'<img src="{thumb}" alt="" loading="lazy" onerror="this.style.display=\'none\'">' if thumb else ""

        link_html = f'<a href="{link}" target="_blank" rel="noopener">Ver &rarr;</a>' if link else ""

        # Alibaba price range display
        price_min_val = p.get("price_min", 0) or 0
        price_max_val = p.get("price_max", 0) or 0
        moq_val = p.get("moq")
        if source == "alibaba" and price_min_val and price_max_val and price_min_val != price_max_val:
            price_display = f"{format_price(price_min_val, 'USD')}-{format_price(price_max_val, 'USD')}"
            if moq_val:
                price_display += f'<br><span style="font-size:10px;color:#888;font-weight:normal">MOQ: {moq_val}</span>'
        else:
            price_display = format_price(price, currency)

        # Ranking badge
        if ranking and ranking <= 3:
            rank_colors = {1: '#f59e0b', 2: '#9ca3af', 3: '#f97316'}
            rank_color = rank_colors.get(ranking, '#6366f1')
            ranking_html = f'<span class="rank-badge" style="background:{rank_color}20;color:{rank_color};border:1px solid {rank_color}40">&#127942; #{ranking}</span>'
        elif ranking:
            ranking_html = f'<span class="rank-badge" style="background:#6366f120;color:#6366f1;border:1px solid #6366f140">#{ranking}</span>'
        else:
            ranking_html = '-'

        # Source badge
        source_badges = {
            "amazon": '<span class="source-badge" style="background:#FF990020;color:#FF9900;border:1px solid #FF990040">AMZ</span>',
            "mercadolibre": '<span class="source-badge" style="background:#2D327720;color:#2D3277;border:1px solid #2D327740">ML</span>',
            "temu": '<span class="source-badge" style="background:#FB770120;color:#FB7701;border:1px solid #FB770140">TEMU</span>',
            "alibaba": '<span class="source-badge" style="background:#E84C3D20;color:#E84C3D;border:1px solid #E84C3D40">ALI</span>',
        }
        source_html = source_badges.get(source, source_badges["mercadolibre"])

        # Format sold with "mil" suffix
        if sold >= 1000:
            sold_display = f'+{sold // 1000}mil'
        elif sold > 0:
            sold_display = f'+{sold}'
        else:
            sold_display = '-'

        rows_html += f"""
        <tr data-country="{country}" data-category="{cat}" data-source="{source}" data-price="{price}" data-rating="{rating or 0}" data-sold="{sold}" data-ranking="{ranking or 999}">
            <td class="td-rank">{ranking_html}</td>
            <td class="td-source">{source_html}</td>
            <td class="td-img">{img_html}</td>
            <td class="td-title" title="{full_title}">{title}</td>
            <td class="td-price">{price_display}</td>
            <td class="td-rating">{render_stars(rating)}</td>
            <td class="td-sold" style="color:{'#16a34a' if sold > 0 else '#ccc'};font-weight:600">{sold_display}</td>
            <td class="td-cat"><span class="badge" style="background:{cat_color}">{html.escape(cat)}</span></td>
            <td class="td-country">{flag} {country}</td>
            <td class="td-seller">{seller}</td>
            <td class="td-link">{link_html}</td>
        </tr>"""

    # Generar opciones de filtros
    country_options = "".join(f'<option value="{c}">{COUNTRY_FLAGS.get(c, "")} {COUNTRY_NAMES.get(c, c)}</option>' for c in countries)
    category_options = "".join(f'<option value="{html.escape(c)}">{html.escape(c)}</option>' for c in categories)
    source_labels = {"mercadolibre": "MercadoLibre", "amazon": "Amazon", "temu": "Temu", "alibaba": "Alibaba"}
    source_options = "".join(f'<option value="{s}">{source_labels.get(s, s)}</option>' for s in sources)

    report_html = f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Market Research Report - {date_str}</title>
<style>
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f0f2f5; color: #1a1a2e; }}
.header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 40px; }}
.header h1 {{ font-size: 28px; margin-bottom: 5px; }}
.header .subtitle {{ opacity: 0.85; font-size: 14px; }}
.stats {{ display: flex; gap: 20px; padding: 20px 40px; flex-wrap: wrap; }}
.stat-card {{ background: white; border-radius: 12px; padding: 20px 24px; flex: 1; min-width: 180px; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
.stat-card .stat-value {{ font-size: 32px; font-weight: 700; color: #667eea; }}
.stat-card .stat-label {{ font-size: 13px; color: #666; margin-top: 4px; }}
.filters {{ display: flex; gap: 12px; padding: 15px 40px; flex-wrap: wrap; align-items: center; }}
.filters select, .filters input {{ padding: 8px 14px; border: 1px solid #ddd; border-radius: 8px; font-size: 14px; background: white; }}
.filters input {{ flex: 1; min-width: 200px; }}
.filters .filter-count {{ color: #888; font-size: 13px; margin-left: auto; }}
.table-wrap {{ padding: 0 40px 40px; overflow-x: auto; }}
table {{ width: 100%; border-collapse: collapse; background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); }}
th {{ background: #f8f9fa; padding: 12px 16px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666; cursor: pointer; user-select: none; white-space: nowrap; border-bottom: 2px solid #e9ecef; }}
th:hover {{ background: #e9ecef; }}
th.sorted-asc::after {{ content: ' ▲'; color: #667eea; }}
th.sorted-desc::after {{ content: ' ▼'; color: #667eea; }}
td {{ padding: 10px 16px; border-bottom: 1px solid #f0f0f0; font-size: 14px; vertical-align: middle; }}
tr:hover {{ background: #f8f9ff; }}
tr.hidden {{ display: none; }}
.td-rank {{ text-align: center; width: 70px; }}
.td-source {{ text-align: center; width: 50px; }}
.rank-badge {{ display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 11px; font-weight: 700; white-space: nowrap; }}
.source-badge {{ display: inline-block; padding: 2px 8px; border-radius: 8px; font-size: 10px; font-weight: 700; white-space: nowrap; }}
.td-img {{ width: 60px; padding: 6px; }}
.td-img img {{ width: 50px; height: 50px; object-fit: contain; border-radius: 6px; background: #f5f5f5; }}
.td-title {{ max-width: 300px; font-weight: 500; }}
.td-price {{ font-weight: 600; white-space: nowrap; color: #16a34a; }}
.td-sold {{ text-align: center; }}
.td-seller {{ color: #888; font-size: 12px; max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }}
.td-link a {{ color: #667eea; text-decoration: none; font-weight: 500; }}
.td-link a:hover {{ text-decoration: underline; }}
.badge {{ display: inline-block; padding: 3px 10px; border-radius: 12px; color: white; font-size: 11px; font-weight: 500; white-space: nowrap; }}
.stars {{ color: #f59e0b; letter-spacing: 1px; }}
.rating-num {{ color: #888; font-size: 12px; }}
.no-rating {{ color: #ccc; font-size: 12px; }}
.footer {{ text-align: center; padding: 20px; color: #aaa; font-size: 12px; }}
@media (max-width: 768px) {{
    .header, .stats, .filters, .table-wrap {{ padding-left: 16px; padding-right: 16px; }}
    .stats {{ flex-direction: column; }}
    .td-img {{ display: none; }}
    .td-seller {{ display: none; }}
}}
</style>
</head>
<body>

<div class="header">
    <h1>📊 Market Research Report</h1>
    <div class="subtitle">Fecha: {date_str} | Fuentes: {', '.join(files_loaded)} | Generado: {datetime.now().strftime('%Y-%m-%d %H:%M')}</div>
</div>

<div class="stats">
    <div class="stat-card">
        <div class="stat-value">{total}</div>
        <div class="stat-label">Productos encontrados</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{len(countries)}</div>
        <div class="stat-label">Países cubiertos</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{len(categories)}</div>
        <div class="stat-label">Categorías</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{"%.1f" % avg_rating if avg_rating else "N/A"} ★</div>
        <div class="stat-label">Rating promedio</div>
    </div>
    <div class="stat-card">
        <div class="stat-value">{total_sold:,}</div>
        <div class="stat-label">Total vendidos</div>
    </div>
</div>

<div class="filters">
    <select id="filterSource" onchange="applyFilters()">
        <option value="">Todas las fuentes</option>
        {source_options}
    </select>
    <select id="filterCountry" onchange="applyFilters()">
        <option value="">Todos los paises</option>
        {country_options}
    </select>
    <select id="filterCategory" onchange="applyFilters()">
        <option value="">Todas las categorias</option>
        {category_options}
    </select>
    <input type="text" id="filterSearch" placeholder="🔍 Buscar producto..." oninput="applyFilters()">
    <span class="filter-count" id="filterCount">{total} productos</span>
</div>

<div class="table-wrap">
<table id="productsTable">
<thead>
<tr>
    <th data-sort="ranking">Rank</th>
    <th data-sort="source">Fuente</th>
    <th></th>
    <th data-sort="title">Producto</th>
    <th data-sort="price">Precio</th>
    <th data-sort="rating">Rating</th>
    <th data-sort="sold">Vendidos</th>
    <th data-sort="category">Categoría</th>
    <th data-sort="country">País</th>
    <th>Vendedor</th>
    <th>Link</th>
</tr>
</thead>
<tbody>
{rows_html}
</tbody>
</table>
</div>

<div class="footer">
    Market Research Agent Pipeline — Generado automáticamente
</div>

<script>
// Sorting
let currentSort = {{ col: null, asc: true }};

document.querySelectorAll('th[data-sort]').forEach(th => {{
    th.addEventListener('click', () => {{
        const col = th.dataset.sort;
        if (currentSort.col === col) {{
            currentSort.asc = !currentSort.asc;
        }} else {{
            currentSort.col = col;
            currentSort.asc = true;
        }}

        document.querySelectorAll('th').forEach(h => h.classList.remove('sorted-asc', 'sorted-desc'));
        th.classList.add(currentSort.asc ? 'sorted-asc' : 'sorted-desc');

        const tbody = document.querySelector('#productsTable tbody');
        const rows = Array.from(tbody.querySelectorAll('tr'));

        rows.sort((a, b) => {{
            let va, vb;
            if (col === 'ranking') {{
                va = parseInt(a.dataset.ranking) || 999;
                vb = parseInt(b.dataset.ranking) || 999;
            }} else if (col === 'price') {{
                va = parseFloat(a.dataset.price) || 0;
                vb = parseFloat(b.dataset.price) || 0;
            }} else if (col === 'rating') {{
                va = parseFloat(a.dataset.rating) || 0;
                vb = parseFloat(b.dataset.rating) || 0;
            }} else if (col === 'sold') {{
                va = parseInt(a.dataset.sold) || 0;
                vb = parseInt(b.dataset.sold) || 0;
            }} else if (col === 'country') {{
                va = a.dataset.country;
                vb = b.dataset.country;
            }} else if (col === 'category') {{
                va = a.dataset.category;
                vb = b.dataset.category;
            }} else if (col === 'source') {{
                va = a.dataset.source;
                vb = b.dataset.source;
            }} else {{
                va = a.cells[3].textContent.toLowerCase();
                vb = b.cells[3].textContent.toLowerCase();
            }}

            if (typeof va === 'string') {{
                return currentSort.asc ? va.localeCompare(vb) : vb.localeCompare(va);
            }}
            return currentSort.asc ? va - vb : vb - va;
        }});

        rows.forEach(r => tbody.appendChild(r));
    }});
}});

// Filtering
function applyFilters() {{
    const source = document.getElementById('filterSource').value;
    const country = document.getElementById('filterCountry').value;
    const category = document.getElementById('filterCategory').value;
    const search = document.getElementById('filterSearch').value.toLowerCase();

    let visible = 0;
    document.querySelectorAll('#productsTable tbody tr').forEach(row => {{
        const matchSource = !source || row.dataset.source === source;
        const matchCountry = !country || row.dataset.country === country;
        const matchCategory = !category || row.dataset.category === category;
        const matchSearch = !search || row.cells[3].textContent.toLowerCase().includes(search);

        if (matchSource && matchCountry && matchCategory && matchSearch) {{
            row.classList.remove('hidden');
            visible++;
        }} else {{
            row.classList.add('hidden');
        }}
    }});

    document.getElementById('filterCount').textContent = visible + ' productos';
}}
</script>

</body>
</html>"""

    return report_html


def main():
    parser = argparse.ArgumentParser(description="Generar reporte HTML de investigación de mercado")
    parser.add_argument("--date", type=str, default=None, help="Fecha del reporte (YYYYMMDD)")
    parser.add_argument("--no-open", action="store_true", help="No abrir navegador automáticamente")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("GENERADOR DE REPORTE HTML")
    logger.info("=" * 60)

    # Encontrar archivos
    files = find_raw_files(args.date)
    if not files:
        logger.error("No se encontraron archivos raw. Ejecuta primero el collector.")
        return 1

    logger.info(f"Archivos encontrados: {len(files)}")
    for f in files:
        logger.info(f"  - {f.name}")

    # Cargar productos
    products = load_all_products(files)
    if not products:
        logger.error("No se encontraron productos en los archivos.")
        return 1

    logger.info(f"Total productos cargados: {len(products)}")
    report_progress(92, "Generando reporte HTML...", f"{len(products)} productos encontrados")

    # Determinar fecha del reporte
    date_str = args.date or files[0].stem.split("_")[-1]
    files_loaded = [f.stem for f in files]

    # Generar HTML
    html_content = generate_html(products, date_str, files_loaded)

    # Guardar
    report_progress(96, "Guardando reporte...", "")
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    output_path = PROCESSED_DIR / f"report_{date_str}.html"
    output_path.write_text(html_content, encoding="utf-8")
    logger.info(f"Reporte generado: {output_path}")

    # Abrir en navegador
    if not args.no_open:
        webbrowser.open(str(output_path.resolve()))
        logger.info("Reporte abierto en el navegador")

    report_progress(100, "Estudio de mercado completado", f"{len(products)} productos en reporte")
    return 0


if __name__ == "__main__":
    sys.exit(main())
