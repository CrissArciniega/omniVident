"""Logging estructurado para todos los agentes del pipeline."""

import logging
import os
from datetime import datetime
from pathlib import Path

PROJECT_ROOT = Path(__file__).parent.parent
LOGS_DIR = PROJECT_ROOT / "outputs" / "logs"


def get_logger(agent_name: str, log_level: int = logging.INFO) -> logging.Logger:
    """Crea un logger configurado para un agente específico.

    Args:
        agent_name: Nombre del agente (ej: 'mercadolibre_collector')
        log_level: Nivel de logging (default: INFO)

    Returns:
        Logger configurado con handlers para archivo y consola.
    """
    LOGS_DIR.mkdir(parents=True, exist_ok=True)

    logger = logging.getLogger(f"market_research.{agent_name}")
    logger.setLevel(log_level)

    if logger.handlers:
        return logger

    date_str = datetime.now().strftime("%Y%m%d")
    log_file = LOGS_DIR / f"{agent_name}_{date_str}.log"

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setLevel(log_level)

    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)

    formatter = logging.Formatter(
        "%(asctime)s | %(name)s | %(levelname)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    file_handler.setFormatter(formatter)
    console_handler.setFormatter(formatter)

    logger.addHandler(file_handler)
    logger.addHandler(console_handler)

    return logger
