"""
Orquestacion principal del pipeline de contenido.

Ejecuta las 5 fases secuencialmente, manejando estado, errores
y reintentos. Es el nucleo que el agente orchestrator invoca.

Uso:
    from src.pipeline import ContentPipeline
    pipeline = ContentPipeline()
    pipeline.run_full()
    # O ejecutar una fase especifica:
    pipeline.run_phase(1)
"""

import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.utils.file_helpers import (
    ensure_dir,
    get_run_id,
    load_yaml_config,
    read_json,
    write_json,
)
from src.utils.json_schemas import (
    PhaseState,
    PhaseStatusEnum,
    PipelineState,
    PipelineStatusEnum,
)
from src.utils.logger import setup_logger

logger = setup_logger(__name__)


class ContentPipeline:
    """
    Pipeline principal que coordina las 5 fases de generacion de contenido.

    Cada fase se ejecuta secuencialmente. Si una fase falla despues de
    los reintentos configurados, el pipeline se detiene.
    """

    def __init__(self, config_path: str | Path | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        self.output_config = self.config.get("output", {})
        self.state_file = Path(self.output_config.get("state_file", "output/pipeline_state.json"))
        self.max_retries = 3

    def _init_state(self, run_id: str) -> PipelineState:
        """Inicializa el estado del pipeline."""
        state = PipelineState(
            pipeline_run_id=run_id,
            started_at=datetime.now(timezone.utc),
            status=PipelineStatusEnum.RUNNING,
        )
        self._save_state(state)
        return state

    def _save_state(self, state: PipelineState) -> None:
        """Guarda el estado actual del pipeline a disco."""
        state.last_updated = datetime.now(timezone.utc)
        ensure_dir(self.state_file.parent)
        write_json(self.state_file, state.model_dump(mode="json"))

    def _load_state(self) -> PipelineState | None:
        """Carga el estado del pipeline desde disco."""
        try:
            data = read_json(self.state_file)
            return PipelineState.model_validate(data)
        except (FileNotFoundError, Exception):
            return None

    def _update_phase_start(self, state: PipelineState, phase_name: str) -> None:
        """Marca una fase como iniciada."""
        state.current_phase = phase_name
        state.phases[phase_name].status = PhaseStatusEnum.RUNNING
        state.phases[phase_name].started_at = datetime.now(timezone.utc)
        self._save_state(state)

    def _update_phase_complete(
        self, state: PipelineState, phase_name: str, output_file: str = ""
    ) -> None:
        """Marca una fase como completada."""
        phase = state.phases[phase_name]
        phase.status = PhaseStatusEnum.COMPLETED
        phase.completed_at = datetime.now(timezone.utc)
        if phase.started_at:
            phase.duration_seconds = (
                phase.completed_at - phase.started_at
            ).total_seconds()
        phase.output_file = output_file
        self._save_state(state)

    def _update_phase_failed(
        self, state: PipelineState, phase_name: str, error: str
    ) -> None:
        """Marca una fase como fallida."""
        phase = state.phases[phase_name]
        phase.status = PhaseStatusEnum.FAILED
        phase.completed_at = datetime.now(timezone.utc)
        if phase.started_at:
            phase.duration_seconds = (
                phase.completed_at - phase.started_at
            ).total_seconds()
        phase.errors.append(error)
        self._save_state(state)

    def _run_phase_with_retry(
        self,
        state: PipelineState,
        phase_name: str,
        phase_func: Any,
        run_id: str,
    ) -> bool:
        """
        Ejecuta una fase con reintentos.

        Returns:
            True si la fase fue exitosa, False si fallo.
        """
        for attempt in range(1, self.max_retries + 1):
            try:
                logger.info(
                    f"{'='*60}\n"
                    f"PHASE {phase_name} - Intento {attempt}/{self.max_retries}\n"
                    f"{'='*60}"
                )

                self._update_phase_start(state, phase_name)
                output_file = phase_func(run_id)
                self._update_phase_complete(state, phase_name, output_file or "")

                logger.info(f"PHASE {phase_name}: COMPLETADA exitosamente")
                return True

            except Exception as e:
                error_msg = f"Intento {attempt}: {type(e).__name__}: {str(e)}"
                logger.error(f"PHASE {phase_name} FALLO: {error_msg}")

                if attempt < self.max_retries:
                    wait = 5 * attempt
                    logger.info(f"Reintentando en {wait}s...")
                    time.sleep(wait)
                else:
                    self._update_phase_failed(state, phase_name, error_msg)
                    return False

        return False

    # =========================================================================
    # FUNCIONES DE CADA FASE
    # =========================================================================

    def _execute_phase1(self, run_id: str) -> str:
        """Phase 1: Keyword Research."""
        from src.phase1_keywords.collector import KeywordCollector

        collector = KeywordCollector()
        result = collector.run(run_id=run_id)
        return str(
            Path(self.output_config.get("phase1_dir", "output/phase1_raw"))
            / "keywords_raw.json"
        )

    def _execute_phase2(self, run_id: str) -> str:
        """Phase 2: Keyword Ranking."""
        from src.phase2_ranking.ranker import KeywordRanker

        ranker = KeywordRanker()
        result = ranker.run(run_id=run_id)
        return str(
            Path(self.output_config.get("phase2_dir", "output/phase2_ranked"))
            / "top_keywords.json"
        )

    def _execute_phase3(self, run_id: str) -> str:
        """Phase 3: Script Writing."""
        from src.phase3_scripts.script_generator import ScriptGenerator

        generator = ScriptGenerator()
        generator.run(run_id=run_id)
        return str(self.output_config.get("phase3_dir", "output/phase3_scripts"))

    def _execute_phase4(self, run_id: str) -> str:
        """Phase 4: Design Briefs + Thumbnail Generation."""
        # Phase 4a: Design Briefs
        from src.phase4_design.brief_generator import BriefGenerator

        brief_gen = BriefGenerator()
        brief_gen.run(run_id=run_id)

        # Phase 4b: Thumbnail Generation
        from src.phase4_design.thumbnail_pipeline import ThumbnailPipeline

        thumb_gen = ThumbnailPipeline()
        thumb_gen.run()

        return str(self.output_config.get("phase4_dir", "output/phase4_designs"))

    def _execute_phase5(self, run_id: str) -> str:
        """Phase 5: Local Save + Google Drive Upload."""
        # Save locally
        from src.phase5_output.local_saver import LocalSaver

        saver = LocalSaver()
        saver.run()

        # Upload to Google Drive
        from src.phase5_output.drive_uploader import DriveUploader

        uploader = DriveUploader()
        uploader.run()

        return str(self.output_config.get("phase5_dir", "output/phase5_final"))

    # =========================================================================
    # METODOS PUBLICOS
    # =========================================================================

    def run_full(self) -> PipelineState:
        """
        Ejecuta el pipeline completo (fases 1-5).

        Returns:
            Estado final del pipeline.
        """
        run_id = get_run_id()
        state = self._init_state(run_id)

        logger.info(f"\n{'#'*60}")
        logger.info(f"PIPELINE COMPLETO INICIADO - {run_id}")
        logger.info(f"{'#'*60}\n")

        phases = [
            ("phase1", self._execute_phase1),
            ("phase2", self._execute_phase2),
            ("phase3", self._execute_phase3),
            ("phase4", self._execute_phase4),
            ("phase5", self._execute_phase5),
        ]

        for phase_name, phase_func in phases:
            success = self._run_phase_with_retry(state, phase_name, phase_func, run_id)

            if not success:
                state.status = PipelineStatusEnum.FAILED
                self._save_state(state)
                logger.error(
                    f"\nPIPELINE DETENIDO en {phase_name}. "
                    f"Ver logs para detalles."
                )
                return state

        state.status = PipelineStatusEnum.COMPLETED
        self._save_state(state)

        logger.info(f"\n{'#'*60}")
        logger.info(f"PIPELINE COMPLETADO EXITOSAMENTE - {run_id}")
        logger.info(f"{'#'*60}\n")

        return state

    def run_phase(self, phase_number: int) -> PipelineState:
        """
        Ejecuta una fase especifica del pipeline.

        Args:
            phase_number: Numero de fase (1-5).

        Returns:
            Estado del pipeline despues de ejecutar la fase.
        """
        run_id = get_run_id()

        # Cargar estado existente o crear nuevo
        state = self._load_state() or self._init_state(run_id)

        phase_map = {
            1: ("phase1", self._execute_phase1),
            2: ("phase2", self._execute_phase2),
            3: ("phase3", self._execute_phase3),
            4: ("phase4", self._execute_phase4),
            5: ("phase5", self._execute_phase5),
        }

        if phase_number not in phase_map:
            raise ValueError(f"Fase invalida: {phase_number}. Debe ser 1-5.")

        phase_name, phase_func = phase_map[phase_number]
        logger.info(f"Ejecutando fase individual: {phase_name}")

        success = self._run_phase_with_retry(state, phase_name, phase_func, run_id)

        if not success:
            logger.error(f"Fase {phase_name} fallo despues de {self.max_retries} intentos")

        return state

    def get_status(self) -> dict[str, Any]:
        """Retorna el estado actual del pipeline como diccionario."""
        state = self._load_state()
        if state:
            return state.model_dump(mode="json")
        return {"status": "no_previous_run", "message": "No hay ejecuciones previas"}
