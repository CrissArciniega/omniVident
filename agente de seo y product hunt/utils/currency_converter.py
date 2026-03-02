"""Conversión de monedas a USD usando exchangerate-api.com (free tier)."""

import json
import os
import time
from datetime import datetime
from pathlib import Path

import requests

from .data_loader import load_config

PROJECT_ROOT = Path(__file__).parent.parent
CACHE_FILE = PROJECT_ROOT / "config" / ".exchange_rates_cache.json"


def get_exchange_rates(force_refresh: bool = False) -> dict[str, float]:
    """Obtiene tasas de cambio a USD. Usa cache si es válido.

    Returns:
        Dict con tasas ej: {"MXN": 17.2, "COP": 4150.0, "USD": 1.0}
    """
    if not force_refresh and CACHE_FILE.exists():
        cache = json.loads(CACHE_FILE.read_text(encoding="utf-8"))
        cache_time = datetime.fromisoformat(cache.get("timestamp", "2000-01-01"))
        markets = load_config("markets")
        cache_hours = markets.get("currency_api", {}).get("cache_hours", 168)
        age_hours = (datetime.now() - cache_time).total_seconds() / 3600
        if age_hours < cache_hours:
            return cache["rates"]

    api_key = os.getenv("EXCHANGE_RATE_API_KEY", "")
    if not api_key:
        return _get_fallback_rates()

    try:
        url = f"https://v6.exchangerate-api.com/v6/{api_key}/latest/USD"
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        data = response.json()

        if data.get("result") == "success":
            rates = data["conversion_rates"]
            cache_data = {
                "timestamp": datetime.now().isoformat(),
                "rates": rates,
            }
            CACHE_FILE.write_text(json.dumps(cache_data, indent=2), encoding="utf-8")
            return rates
    except Exception:
        pass

    return _get_fallback_rates()


def _get_fallback_rates() -> dict[str, float]:
    """Tasas de cambio hardcodeadas como fallback."""
    markets = load_config("markets")
    rates = {"USD": 1.0}
    for country_data in markets["countries"].values():
        currency = country_data["currency"]
        if currency != "USD":
            rates[currency] = 1.0 / country_data["fallback_usd_rate"]
    return rates


def convert_to_usd(amount: float, currency: str, rates: dict[str, float] | None = None) -> float:
    """Convierte un monto a USD.

    Args:
        amount: Monto en moneda original
        currency: Código de moneda (MXN, COP, USD)
        rates: Tasas de cambio (si None, las obtiene automáticamente)

    Returns:
        Monto en USD
    """
    if currency == "USD":
        return round(amount, 2)

    if rates is None:
        rates = get_exchange_rates()

    rate = rates.get(currency)
    if rate is None or rate == 0:
        raise ValueError(f"Tasa de cambio no disponible para {currency}")

    return round(amount / rate, 2)
