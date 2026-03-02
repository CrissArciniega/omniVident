"""Funciones de lectura/escritura de datos JSON para el pipeline."""

import json
from datetime import datetime
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
RAW_DIR = PROJECT_ROOT / "outputs" / "raw"
PROCESSED_DIR = PROJECT_ROOT / "outputs" / "processed"


def load_json(file_path: str | Path) -> dict | list:
    """Carga un archivo JSON."""
    path = Path(file_path)
    if not path.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, file_path: str | Path, indent: int = 2) -> Path:
    """Guarda datos como JSON, creando directorios si es necesario."""
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=indent, ensure_ascii=False, default=str)
    return path


def load_config(config_name: str) -> dict:
    """Carga un archivo de configuración por nombre (sin extensión)."""
    return load_json(CONFIG_DIR / f"{config_name}.json")


def save_raw_data(data: dict, source: str, country: str) -> Path:
    """Guarda datos crudos con timestamp en outputs/raw/."""
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"raw_{source}_{country}_{date_str}.json"
    return save_json(data, RAW_DIR / filename)


def save_processed_data(data: dict, name: str) -> Path:
    """Guarda datos procesados con timestamp en outputs/processed/."""
    date_str = datetime.now().strftime("%Y%m%d")
    filename = f"{name}_{date_str}.json"
    return save_json(data, PROCESSED_DIR / filename)


def get_latest_raw_files(source: str, country: str | None = None) -> list[Path]:
    """Obtiene los archivos raw más recientes para una fuente/país."""
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    pattern = f"raw_{source}_{country}_*.json" if country else f"raw_{source}_*.json"
    files = sorted(RAW_DIR.glob(pattern), reverse=True)
    return files
