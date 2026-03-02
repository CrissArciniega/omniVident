"""
Modulo de logging centralizado.

Configura loggers con RotatingFileHandler (10MB, 5 backups) y salida a consola
con colores. Cada fase puede tener su propio archivo de log adicional.

Uso:
    from src.utils.logger import setup_logger
    logger = setup_logger(__name__)
    logger.info("Mensaje informativo")
    logger.error("Algo fallo", exc_info=True)
"""

import logging
import os
from logging.handlers import RotatingFileHandler
from pathlib import Path

import yaml

# Intentar importar colorlog para consola con colores
try:
    import colorlog

    HAS_COLORLOG = True
except ImportError:
    HAS_COLORLOG = False


def _load_log_config() -> dict:
    """Carga configuracion de logging desde config.yaml."""
    config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"
    defaults = {
        "level": "INFO",
        "file": "logs/pipeline.log",
        "max_bytes": 10485760,
        "backup_count": 5,
        "console_output": True,
        "format": "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
    }

    if config_path.exists():
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = yaml.safe_load(f)
                return config.get("logging", defaults)
        except Exception:
            pass

    return defaults


def setup_logger(name: str, phase: str | None = None) -> logging.Logger:
    """
    Crea y configura un logger con handlers de archivo y consola.

    Args:
        name: Nombre del logger (tipicamente __name__ del modulo).
        phase: Nombre de la fase (opcional). Si se proporciona, agrega
               un handler adicional que escribe a logs/phase_{phase}.log.

    Returns:
        Logger configurado.
    """
    log_config = _load_log_config()
    logger = logging.getLogger(name)

    # Evitar agregar handlers duplicados
    if logger.handlers:
        return logger

    level = getattr(logging, log_config.get("level", "INFO").upper(), logging.INFO)
    logger.setLevel(level)

    log_format = log_config.get(
        "format", "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"
    )

    # --- Handler de archivo principal ---
    log_file = Path(log_config.get("file", "logs/pipeline.log"))
    log_file.parent.mkdir(parents=True, exist_ok=True)

    file_handler = RotatingFileHandler(
        filename=str(log_file),
        maxBytes=log_config.get("max_bytes", 10485760),
        backupCount=log_config.get("backup_count", 5),
        encoding="utf-8",
    )
    file_handler.setLevel(level)
    file_handler.setFormatter(logging.Formatter(log_format))
    logger.addHandler(file_handler)

    # --- Handler de archivo por fase (opcional) ---
    if phase:
        phase_log_file = log_file.parent / f"phase_{phase}.log"
        phase_handler = RotatingFileHandler(
            filename=str(phase_log_file),
            maxBytes=log_config.get("max_bytes", 10485760),
            backupCount=log_config.get("backup_count", 5),
            encoding="utf-8",
        )
        phase_handler.setLevel(level)
        phase_handler.setFormatter(logging.Formatter(log_format))
        logger.addHandler(phase_handler)

    # --- Handler de consola ---
    if log_config.get("console_output", True):
        console_handler = logging.StreamHandler()
        console_handler.setLevel(level)

        if HAS_COLORLOG:
            color_format = (
                "%(log_color)s%(asctime)s | %(levelname)-8s%(reset)s | "
                "%(cyan)s%(name)s%(reset)s | %(message)s"
            )
            console_handler.setFormatter(
                colorlog.ColoredFormatter(
                    color_format,
                    log_colors={
                        "DEBUG": "white",
                        "INFO": "green",
                        "WARNING": "yellow",
                        "ERROR": "red",
                        "CRITICAL": "red,bg_white",
                    },
                )
            )
        else:
            console_handler.setFormatter(logging.Formatter(log_format))

        logger.addHandler(console_handler)

    return logger
