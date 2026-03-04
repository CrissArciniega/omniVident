"""
Trend Analyzer - Cache inteligente de tendencias
Compara datos actuales vs anteriores para detectar cambios y tendencias.

Detecta:
- Productos NUEVOS en ranking
- Productos que SALIERON del ranking
- Cambios de PRECIO >5%
- Cambios de RANKING >3 posiciones
- Tendencias por CATEGORIA (creciendo/decreciendo)
- Velocidad de VENTAS (cambios en sold_quantity, solo MercadoLibre)

Uso:
    python scripts/trend_analyzer.py                    # Comparar con fecha anterior mas reciente
    python scripts/trend_analyzer.py --date 20260302    # Comparar fecha especifica
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.logger import get_logger
from utils.data_loader import RAW_DIR, PROCESSED_DIR, save_json

logger = get_logger("trend_analyzer")


def find_raw_files(date_str: str | None = None) -> dict[str, list[Path]]:
    """Find all raw files grouped by date, most recent first."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)

    # Collect all dates
    files_by_date: dict[str, list[Path]] = {}

    for f in RAW_DIR.iterdir():
        if not f.name.endswith(".json"):
            continue
        if not (f.name.startswith("raw_mercadolibre_") or f.name.startswith("raw_amazon_")
                or f.name.startswith("raw_temu_") or f.name.startswith("raw_alibaba_")):
            continue
        # Extract date from filename: raw_source_COUNTRY_YYYYMMDD.json
        match_date = f.name.rstrip(".json").split("_")[-1]
        if len(match_date) == 8 and match_date.isdigit():
            files_by_date.setdefault(match_date, []).append(f)

    return dict(sorted(files_by_date.items(), reverse=True))


def load_products_for_date(files: list[Path]) -> list[dict]:
    """Load all products from a set of raw files for one date."""
    products = []
    for f in files:
        try:
            data = json.loads(f.read_text(encoding="utf-8"))
            source = data.get("source", "mercadolibre")
            country = data.get("country", "N/A")

            product_list = data.get("products", [])
            for p in product_list:
                # Normalize to common format
                if source == "amazon":
                    products.append({
                        "id": p.get("asin", ""),
                        "title": p.get("title", ""),
                        "price": p.get("price") or 0,
                        "currency": p.get("currency", "USD"),
                        "country": country,
                        "category": p.get("category_name", p.get("category", "")),
                        "sold_quantity": 0,
                        "rating": p.get("rating") or 0,
                        "ranking": p.get("ranking"),
                        "source": "amazon",
                    })
                elif source == "temu":
                    products.append({
                        "id": p.get("product_id", ""),
                        "title": p.get("title", ""),
                        "price": p.get("price") or 0,
                        "currency": p.get("currency", "USD"),
                        "country": country,
                        "category": p.get("category_name", ""),
                        "sold_quantity": 0,
                        "rating": p.get("rating") or 0,
                        "ranking": p.get("ranking"),
                        "source": "temu",
                    })
                elif source == "alibaba":
                    price_min = p.get("price_min") or 0
                    price_max = p.get("price_max") or 0
                    products.append({
                        "id": p.get("product_id", ""),
                        "title": p.get("title", ""),
                        "price": price_min if price_min else price_max,
                        "currency": "USD",
                        "country": country,
                        "category": p.get("category_name", ""),
                        "sold_quantity": p.get("orders_count", 0),
                        "rating": p.get("rating") or 0,
                        "ranking": p.get("ranking"),
                        "source": "alibaba",
                    })
                else:
                    products.append({
                        "id": p.get("product_id", ""),
                        "title": p.get("title", ""),
                        "price": p.get("price") or 0,
                        "currency": p.get("currency", "USD"),
                        "country": country,
                        "category": p.get("category_name", ""),
                        "sold_quantity": p.get("sold_quantity", 0),
                        "rating": p.get("rating_average") or 0,
                        "ranking": p.get("ranking"),
                        "source": "mercadolibre",
                    })
        except Exception as e:
            logger.warning(f"Error loading {f.name}: {e}")

    return products


def analyze_trends(current: list[dict], previous: list[dict]) -> dict:
    """Compare current vs previous data to detect trends."""

    # Build lookup maps by (source, id)
    curr_map = {}
    for p in current:
        key = (p["source"], p["id"])
        if key not in curr_map:
            curr_map[key] = p

    prev_map = {}
    for p in previous:
        key = (p["source"], p["id"])
        if key not in prev_map:
            prev_map[key] = p

    curr_ids = set(curr_map.keys())
    prev_ids = set(prev_map.keys())

    # 1. New products (in current but not previous)
    new_ids = curr_ids - prev_ids
    new_products = []
    for key in new_ids:
        p = curr_map[key]
        new_products.append({
            "id": p["id"],
            "title": p["title"],
            "price": p["price"],
            "category": p["category"],
            "country": p["country"],
            "source": p["source"],
            "ranking": p["ranking"],
        })

    # 2. Dropped products (in previous but not current)
    dropped_ids = prev_ids - curr_ids
    dropped_products = []
    for key in dropped_ids:
        p = prev_map[key]
        dropped_products.append({
            "id": p["id"],
            "title": p["title"],
            "price": p["price"],
            "category": p["category"],
            "country": p["country"],
            "source": p["source"],
            "ranking": p["ranking"],
        })

    # 3. Price changes >5%
    price_changes = []
    # 4. Ranking changes >3 positions
    ranking_changes = []
    # 5. Sales velocity changes (ML only)
    sales_changes = []

    common_ids = curr_ids & prev_ids
    for key in common_ids:
        curr_p = curr_map[key]
        prev_p = prev_map[key]

        # Price change
        old_price = prev_p.get("price", 0) or 0
        new_price = curr_p.get("price", 0) or 0
        if old_price > 0 and new_price > 0:
            pct_change = ((new_price - old_price) / old_price) * 100
            if abs(pct_change) >= 5:
                price_changes.append({
                    "id": curr_p["id"],
                    "title": curr_p["title"],
                    "old_price": old_price,
                    "new_price": new_price,
                    "pct_change": round(pct_change, 1),
                    "country": curr_p["country"],
                    "source": curr_p["source"],
                    "category": curr_p["category"],
                })

        # Ranking change
        old_rank = prev_p.get("ranking")
        new_rank = curr_p.get("ranking")
        if old_rank and new_rank:
            diff = old_rank - new_rank  # positive = improved (lower rank is better)
            if abs(diff) >= 3:
                ranking_changes.append({
                    "id": curr_p["id"],
                    "title": curr_p["title"],
                    "old_ranking": old_rank,
                    "new_ranking": new_rank,
                    "positions_changed": diff,
                    "direction": "up" if diff > 0 else "down",
                    "country": curr_p["country"],
                    "source": curr_p["source"],
                    "category": curr_p["category"],
                })

        # Sales velocity (ML only)
        if curr_p["source"] == "mercadolibre":
            old_sold = prev_p.get("sold_quantity", 0) or 0
            new_sold = curr_p.get("sold_quantity", 0) or 0
            if old_sold > 0 and new_sold > old_sold:
                sold_diff = new_sold - old_sold
                pct_sold = ((new_sold - old_sold) / old_sold) * 100
                if pct_sold >= 10:
                    sales_changes.append({
                        "id": curr_p["id"],
                        "title": curr_p["title"],
                        "old_sold": old_sold,
                        "new_sold": new_sold,
                        "sold_increase": sold_diff,
                        "pct_increase": round(pct_sold, 1),
                        "country": curr_p["country"],
                        "category": curr_p["category"],
                    })

    # 6. Category trends
    cat_counts_curr = {}
    cat_counts_prev = {}
    for p in current:
        cat = p["category"]
        cat_counts_curr[cat] = cat_counts_curr.get(cat, 0) + 1
    for p in previous:
        cat = p["category"]
        cat_counts_prev[cat] = cat_counts_prev.get(cat, 0) + 1

    category_trends = []
    all_cats = set(list(cat_counts_curr.keys()) + list(cat_counts_prev.keys()))
    for cat in all_cats:
        curr_count = cat_counts_curr.get(cat, 0)
        prev_count = cat_counts_prev.get(cat, 0)
        if prev_count > 0:
            change_pct = ((curr_count - prev_count) / prev_count) * 100
        elif curr_count > 0:
            change_pct = 100
        else:
            change_pct = 0

        if abs(change_pct) >= 10 or curr_count != prev_count:
            category_trends.append({
                "category": cat,
                "current_count": curr_count,
                "previous_count": prev_count,
                "change_pct": round(change_pct, 1),
                "trend": "growing" if change_pct > 0 else ("shrinking" if change_pct < 0 else "stable"),
            })

    category_trends.sort(key=lambda x: abs(x["change_pct"]), reverse=True)

    # Sort changes by impact
    price_changes.sort(key=lambda x: abs(x["pct_change"]), reverse=True)
    ranking_changes.sort(key=lambda x: abs(x["positions_changed"]), reverse=True)
    sales_changes.sort(key=lambda x: x["pct_increase"], reverse=True)

    # Build product-level enrichment map (for dashboard to overlay)
    enrichment = {}
    for key in new_ids:
        enrichment[f"{curr_map[key]['source']}:{curr_map[key]['id']}"] = {"isNew": True}

    for change in price_changes:
        eid = f"{change['source']}:{change['id']}"
        enrichment.setdefault(eid, {})
        enrichment[eid]["priceChange"] = change["pct_change"]
        enrichment[eid]["oldPrice"] = change["old_price"]

    for change in ranking_changes:
        eid = f"{change['source']}:{change['id']}"
        enrichment.setdefault(eid, {})
        enrichment[eid]["rankingChange"] = change["positions_changed"]
        enrichment[eid]["oldRanking"] = change["old_ranking"]

    return {
        "analysis_date": datetime.now().isoformat(),
        "current_total": len(current),
        "previous_total": len(previous),
        "summary": {
            "new_products": len(new_products),
            "dropped_products": len(dropped_products),
            "price_changes": len(price_changes),
            "ranking_changes": len(ranking_changes),
            "sales_velocity_changes": len(sales_changes),
            "category_trends": len(category_trends),
        },
        "new_products": new_products[:50],  # Top 50
        "dropped_products": dropped_products[:50],
        "price_changes": price_changes[:30],
        "ranking_changes": ranking_changes[:30],
        "sales_velocity": sales_changes[:20],
        "category_trends": category_trends[:20],
        "enrichment": enrichment,
    }


def main():
    parser = argparse.ArgumentParser(description="Trend Analyzer - Detect market trends")
    parser.add_argument("--date", type=str, default=None,
                        help="Specific date to analyze (YYYYMMDD), default: most recent")
    args = parser.parse_args()

    logger.info("=" * 60)
    logger.info("TREND ANALYZER - Detecting market trends")
    logger.info("=" * 60)

    files_by_date = find_raw_files()
    dates = list(files_by_date.keys())

    if len(dates) < 2:
        logger.info("Not enough data for trend analysis (need at least 2 dates)")
        logger.info(f"Available dates: {dates}")

        # Still save a minimal trend file with no changes
        PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
        today = args.date or (dates[0] if dates else datetime.now().strftime("%Y%m%d"))
        empty_trend = {
            "analysis_date": datetime.now().isoformat(),
            "current_total": 0,
            "previous_total": 0,
            "summary": {
                "new_products": 0, "dropped_products": 0,
                "price_changes": 0, "ranking_changes": 0,
                "sales_velocity_changes": 0, "category_trends": 0,
            },
            "new_products": [], "dropped_products": [],
            "price_changes": [], "ranking_changes": [],
            "sales_velocity": [], "category_trends": [],
            "enrichment": {},
        }
        out_path = save_json(empty_trend, PROCESSED_DIR / f"trend_analysis_{today}.json")
        logger.info(f"Saved empty trend analysis to {out_path}")
        return 0

    # Determine current and previous dates
    if args.date:
        current_date = args.date
        if current_date not in files_by_date:
            logger.error(f"No data found for date {current_date}")
            logger.info(f"Available dates: {dates}")
            return 1
        # Find the most recent date BEFORE current_date
        prev_dates = [d for d in dates if d < current_date]
        if not prev_dates:
            logger.info(f"No previous data to compare with for {current_date}")
            current = load_products_for_date(files_by_date[current_date])
            # Create trend with all products as "new"
            empty_prev = []
            trend = analyze_trends(current, empty_prev)
        else:
            previous_date = prev_dates[0]
            current = load_products_for_date(files_by_date[current_date])
            previous = load_products_for_date(files_by_date[previous_date])
            logger.info(f"Comparing {current_date} ({len(current)} products) vs {previous_date} ({len(previous)} products)")
            trend = analyze_trends(current, previous)
    else:
        current_date = dates[0]
        previous_date = dates[1]
        current = load_products_for_date(files_by_date[current_date])
        previous = load_products_for_date(files_by_date[previous_date])
        logger.info(f"Comparing {current_date} ({len(current)} products) vs {previous_date} ({len(previous)} products)")
        trend = analyze_trends(current, previous)

    # Save trend analysis
    PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    out_path = save_json(trend, PROCESSED_DIR / f"trend_analysis_{current_date}.json")
    logger.info(f"\nTrend analysis saved to {out_path}")

    # Print summary
    s = trend["summary"]
    logger.info(f"\n  TRENDS SUMMARY:")
    logger.info(f"    New products:      {s['new_products']}")
    logger.info(f"    Dropped products:  {s['dropped_products']}")
    logger.info(f"    Price changes:     {s['price_changes']}")
    logger.info(f"    Ranking changes:   {s['ranking_changes']}")
    logger.info(f"    Sales velocity:    {s['sales_velocity_changes']}")
    logger.info(f"    Category trends:   {s['category_trends']}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
