"""Valida que todos los archivos de configuración existen y tienen la estructura correcta."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.logger import get_logger
from utils.data_loader import load_config

logger = get_logger("validate_config")

REQUIRED_CONFIGS = {
    "markets": ["countries"],
    "categories": ["mercadolibre", "amazon", "settings"],
    "mercadolibre_config": ["api", "endpoints", "search_params", "site_ids"],
    "scraping_config": ["playwright", "amazon", "retry"],
    "notion_config": ["database", "property_mapping"],
    "scheduling_config": ["schedule", "pipeline", "execution_order"],
}


def validate_all():
    errors = 0

    for config_name, required_keys in REQUIRED_CONFIGS.items():
        try:
            data = load_config(config_name)
            missing = [k for k in required_keys if k not in data]
            if missing:
                logger.error(f"  {config_name}.json: Faltan keys: {missing}")
                errors += 1
            else:
                logger.info(f"  {config_name}.json: OK")
        except FileNotFoundError:
            logger.error(f"  {config_name}.json: NO EXISTE")
            errors += 1
        except Exception as e:
            logger.error(f"  {config_name}.json: ERROR - {e}")
            errors += 1

    # Validar .env
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        logger.info("  .env: OK (existe)")
    else:
        logger.warning("  .env: NO EXISTE - copia .env.example a .env y configura credenciales")

    # Validar Notion database ID
    try:
        notion = load_config("notion_config")
        db_id = notion.get("database", {}).get("id", "")
        if db_id == "PLACEHOLDER_DATABASE_ID" or not db_id:
            logger.warning("  Notion DB ID: PENDIENTE - actualizar config/notion_config.json con el ID real")
        else:
            logger.info(f"  Notion DB ID: Configurado ({db_id[:8]}...)")
    except Exception:
        pass

    return errors


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("VALIDACIÓN DE CONFIGURACIONES")
    logger.info("=" * 60)

    errors = validate_all()

    print()
    if errors == 0:
        logger.info("Todas las configuraciones son válidas")
    else:
        logger.error(f"{errors} configuración(es) con problemas")
