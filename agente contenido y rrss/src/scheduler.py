"""
Scheduler para ejecucion automatica del pipeline.

Configura APScheduler con un trigger de intervalo quincenal
para ejecutar el pipeline de contenido automaticamente.

Uso:
    from src.scheduler import PipelineScheduler
    scheduler = PipelineScheduler()
    scheduler.start()  # Bloquea, ejecuta cada 2 semanas
"""

import signal
import sys
from pathlib import Path

from apscheduler.schedulers.blocking import BlockingScheduler
from apscheduler.triggers.interval import IntervalTrigger

from src.pipeline import ContentPipeline
from src.utils.file_helpers import load_yaml_config
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


def _run_pipeline_job() -> None:
    """Job que ejecuta el pipeline completo."""
    logger.info("Scheduler: Iniciando ejecucion programada del pipeline")
    try:
        pipeline = ContentPipeline()
        state = pipeline.run_full()
        logger.info(
            f"Scheduler: Pipeline finalizado con estado '{state.status.value}'"
        )
    except Exception as e:
        logger.error(f"Scheduler: Error en ejecucion del pipeline: {e}")


class PipelineScheduler:
    """
    Scheduler quincenal para el pipeline de contenido.

    Usa APScheduler con BlockingScheduler para ejecutar el pipeline
    automaticamente cada N semanas.
    """

    def __init__(self, config_path: str | Path | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        self.schedule_config = self.config.get("schedule", {})

    def start(self) -> None:
        """
        Inicia el scheduler. Este metodo BLOQUEA la ejecucion.

        Para detener: Ctrl+C o enviar SIGTERM.
        """
        timezone = self.schedule_config.get("timezone", "America/Mexico_City")
        interval_weeks = self.schedule_config.get("interval_weeks", 2)
        start_hour = self.schedule_config.get("start_hour", 9)
        start_minute = self.schedule_config.get("start_minute", 0)

        scheduler = BlockingScheduler(timezone=timezone)

        # Configurar trigger de intervalo
        trigger = IntervalTrigger(
            weeks=interval_weeks,
            timezone=timezone,
        )

        scheduler.add_job(
            _run_pipeline_job,
            trigger=trigger,
            id="content_pipeline",
            name=f"Content Pipeline (cada {interval_weeks} semanas)",
            misfire_grace_time=3600,  # 1 hora de gracia
            coalesce=True,  # Si se pierden ejecuciones, solo ejecutar una
            max_instances=1,  # No permitir ejecuciones paralelas
        )

        # Manejar shutdown gracefully
        def _signal_handler(signum, frame):
            logger.info("Scheduler: Senal de shutdown recibida, deteniendo...")
            scheduler.shutdown(wait=False)
            sys.exit(0)

        signal.signal(signal.SIGINT, _signal_handler)
        signal.signal(signal.SIGTERM, _signal_handler)

        logger.info(f"Scheduler iniciado:")
        logger.info(f"  Frecuencia: cada {interval_weeks} semanas")
        logger.info(f"  Timezone: {timezone}")
        logger.info(f"  Hora preferida: {start_hour:02d}:{start_minute:02d}")
        logger.info(f"  Presiona Ctrl+C para detener")

        try:
            scheduler.start()
        except (KeyboardInterrupt, SystemExit):
            logger.info("Scheduler detenido.")
