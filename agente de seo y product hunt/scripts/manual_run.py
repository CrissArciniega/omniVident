"""Trigger manual del pipeline completo o de un agente específico.

Uso:
    python scripts/manual_run.py                    # Pipeline completo
    python scripts/manual_run.py --agent collector  # Solo collector
    python scripts/manual_run.py --dry-run          # Sin escribir datos
"""

import argparse
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from utils.logger import get_logger

logger = get_logger("manual_run")


def main():
    parser = argparse.ArgumentParser(description="Ejecutar pipeline de investigación de mercado")
    parser.add_argument("--agent", type=str, default=None,
                        choices=["collector", "trends", "analyzer", "publisher", "all"],
                        help="Agente específico a ejecutar (default: all)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Ejecutar sin escribir datos reales")
    parser.add_argument("--country", type=str, default=None,
                        choices=["EC", "MX", "CO", "USA"],
                        help="País específico (solo para collector)")

    args = parser.parse_args()

    agent = args.agent or "all"
    logger.info(f"Ejecutando: {agent} (dry_run={args.dry_run})")

    # TODO: Implementar cuando se creen los agentes
    # Este archivo servirá como punto de entrada para ejecución manual
    logger.info("Pipeline no implementado aún. Crea los agentes primero.")
    logger.info("Orden de creación recomendado:")
    logger.info("  1. mercadolibre_collector")
    logger.info("  2. amazon_collector")
    logger.info("  3. trends_enricher")
    logger.info("  4. market_analyzer")
    logger.info("  5. notion_publisher")
    logger.info("  6. orchestrator")


if __name__ == "__main__":
    main()
