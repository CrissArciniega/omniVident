"""
Pipeline de generacion de thumbnails - Phase 4b.

Orquesta la lectura de design briefs y la generacion de thumbnails
con IA para cada combinacion keyword/plataforma.

Uso directo:
    python -m src.phase4_design.thumbnail_pipeline

Uso programatico:
    from src.phase4_design.thumbnail_pipeline import ThumbnailPipeline
    pipeline = ThumbnailPipeline()
    results = pipeline.run()
"""

import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from src.phase4_design.image_generator import ImageGenerator
from src.utils.file_helpers import ensure_dir, load_yaml_config, read_json
from src.utils.json_schemas import DesignBrief, Platform
from src.utils.logger import setup_logger

logger = setup_logger(__name__, phase="phase4")


@dataclass
class ThumbnailResult:
    """Resultado de la generacion de un thumbnail individual."""

    keyword_slug: str
    platform: str
    success: bool
    output_path: str | None = None
    error: str | None = None
    duration_seconds: float = 0.0


@dataclass
class PipelineResults:
    """Resultados agregados de toda la ejecucion del pipeline."""

    total_briefs: int = 0
    thumbnails_generated: int = 0
    thumbnails_failed: int = 0
    total_duration_seconds: float = 0.0
    results: list[ThumbnailResult] = field(default_factory=list)

    @property
    def success_rate(self) -> float:
        """Porcentaje de exito de generacion de thumbnails."""
        if self.total_briefs == 0:
            return 0.0
        return (self.thumbnails_generated / self.total_briefs) * 100.0


class ThumbnailPipeline:
    """
    Pipeline que orquesta la generacion de thumbnails desde briefs de diseno.

    Lee todos los briefs generados en Phase 4a, llama a ImageGenerator
    para crear cada thumbnail, y guarda los archivos PNG resultantes.
    Los errores individuales no detienen el resto del pipeline.

    Args:
        config_path: Ruta al config.yaml principal (opcional).
    """

    def __init__(self, config_path: str | Path | None = None):
        project_root = Path(__file__).parent.parent.parent

        if config_path is None:
            config_path = project_root / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        self.designs_dir = Path(
            self.config.get("output", {}).get("phase4_dir", "output/phase4_designs")
        )
        self.image_generator = ImageGenerator(config_path=config_path)

    def _discover_briefs(self) -> list[dict[str, Any]]:
        """
        Descubre todos los design briefs generados en Phase 4a.

        Busca archivos *_brief.json en output/phase4_designs/{keyword_slug}/
        y retorna informacion sobre cada uno.

        Returns:
            Lista de dicts con claves: keyword_slug, platform, brief_path.
        """
        briefs_found: list[dict[str, Any]] = []

        if not self.designs_dir.exists():
            logger.warning(f"Directorio de disenos no encontrado: {self.designs_dir}")
            return briefs_found

        # Iterar por carpetas de keyword
        for keyword_dir in sorted(self.designs_dir.iterdir()):
            if not keyword_dir.is_dir():
                continue

            # Ignorar carpetas de test
            if keyword_dir.name.startswith("_"):
                continue

            keyword_slug = keyword_dir.name

            # Buscar archivos de brief
            for brief_file in sorted(keyword_dir.glob("*_brief.json")):
                # Extraer nombre de plataforma del nombre de archivo
                # Formato: {platform}_brief.json -> platform
                platform_name = brief_file.stem.replace("_brief", "")

                # Validar que es una plataforma conocida
                try:
                    Platform(platform_name)
                except ValueError:
                    logger.debug(
                        f"Brief ignorado (plataforma no reconocida): {brief_file}"
                    )
                    continue

                # Verificar si ya existe el thumbnail
                thumbnail_path = keyword_dir / f"{platform_name}_thumbnail.png"
                already_exists = thumbnail_path.exists()

                briefs_found.append({
                    "keyword_slug": keyword_slug,
                    "platform": platform_name,
                    "brief_path": brief_file,
                    "thumbnail_path": thumbnail_path,
                    "already_exists": already_exists,
                })

        logger.info(f"Briefs descubiertos: {len(briefs_found)}")
        return briefs_found

    def _process_single_brief(
        self, brief_info: dict[str, Any], skip_existing: bool = True
    ) -> ThumbnailResult:
        """
        Procesa un brief individual: lee el brief, genera la imagen, guarda el PNG.

        Args:
            brief_info: Diccionario con informacion del brief.
            skip_existing: Si True, salta thumbnails que ya existen.

        Returns:
            ThumbnailResult con el resultado de la operacion.
        """
        keyword_slug = brief_info["keyword_slug"]
        platform_name = brief_info["platform"]
        brief_path = brief_info["brief_path"]
        thumbnail_path = brief_info["thumbnail_path"]

        start_time = time.time()

        # Verificar si ya existe
        if skip_existing and brief_info.get("already_exists", False):
            logger.info(
                f"Thumbnail ya existe, saltando: {keyword_slug}/{platform_name}"
            )
            return ThumbnailResult(
                keyword_slug=keyword_slug,
                platform=platform_name,
                success=True,
                output_path=str(thumbnail_path),
                duration_seconds=time.time() - start_time,
            )

        try:
            # Leer el brief
            logger.info(f"Procesando brief: {keyword_slug}/{platform_name}")
            brief_data = read_json(brief_path)

            # Validar con Pydantic
            brief = DesignBrief.model_validate(brief_data)

            # Extraer dimensiones y prompt
            dimensions = brief.design_brief.dimensions
            prompt = brief.design_brief.image_generation_prompt
            width = dimensions.width
            height = dimensions.height

            logger.info(
                f"Generando thumbnail {width}x{height} para "
                f"{keyword_slug}/{platform_name}"
            )

            # Generar la imagen
            image_bytes = self.image_generator.generate(
                prompt=prompt,
                width=width,
                height=height,
            )

            # Guardar la imagen
            ensure_dir(thumbnail_path.parent)
            saved_path = self.image_generator.save_image(image_bytes, thumbnail_path)

            duration = time.time() - start_time
            logger.info(
                f"Thumbnail generado OK: {keyword_slug}/{platform_name} "
                f"({duration:.1f}s)"
            )

            return ThumbnailResult(
                keyword_slug=keyword_slug,
                platform=platform_name,
                success=True,
                output_path=str(saved_path),
                duration_seconds=duration,
            )

        except Exception as e:
            duration = time.time() - start_time
            error_msg = (
                f"Error generando thumbnail {keyword_slug}/{platform_name}: {e}"
            )
            logger.error(error_msg)

            return ThumbnailResult(
                keyword_slug=keyword_slug,
                platform=platform_name,
                success=False,
                error=str(e),
                duration_seconds=duration,
            )

    def run(self, skip_existing: bool = True) -> PipelineResults:
        """
        Ejecuta el pipeline completo de generacion de thumbnails.

        Lee todos los briefs disponibles y genera un thumbnail para cada uno.
        Los errores individuales se registran pero no detienen el pipeline.

        Args:
            skip_existing: Si True, salta thumbnails que ya existen en disco.

        Returns:
            PipelineResults con estadisticas y resultados por brief.
        """
        pipeline_start = time.time()
        logger.info("=== PHASE 4b: Thumbnail Generation START ===")

        briefs = self._discover_briefs()
        results = PipelineResults(total_briefs=len(briefs))

        if not briefs:
            logger.warning("No se encontraron briefs de diseno. Abortando Phase 4b.")
            return results

        existing_count = sum(1 for b in briefs if b.get("already_exists", False))
        if skip_existing and existing_count > 0:
            logger.info(f"Thumbnails existentes (seran saltados): {existing_count}")

        logger.info(
            f"Procesando {len(briefs)} briefs "
            f"({len(briefs) - existing_count} nuevos)"
        )

        # Procesar cada brief individualmente
        for idx, brief_info in enumerate(briefs, start=1):
            keyword_slug = brief_info["keyword_slug"]
            platform_name = brief_info["platform"]

            logger.info(
                f"--- [{idx}/{len(briefs)}] {keyword_slug}/{platform_name} ---"
            )

            result = self._process_single_brief(brief_info, skip_existing=skip_existing)
            results.results.append(result)

            if result.success:
                results.thumbnails_generated += 1
            else:
                results.thumbnails_failed += 1

        results.total_duration_seconds = time.time() - pipeline_start

        # Resumen final
        logger.info("=== PHASE 4b: Thumbnail Generation COMPLETADA ===")
        logger.info(f"Total briefs procesados: {results.total_briefs}")
        logger.info(f"Thumbnails generados OK: {results.thumbnails_generated}")
        logger.info(f"Thumbnails fallidos: {results.thumbnails_failed}")
        logger.info(f"Tasa de exito: {results.success_rate:.1f}%")
        logger.info(f"Duracion total: {results.total_duration_seconds:.1f}s")

        # Listar errores si hubo
        failed = [r for r in results.results if not r.success]
        if failed:
            logger.warning(f"Thumbnails fallidos ({len(failed)}):")
            for fail in failed:
                logger.warning(
                    f"  - {fail.keyword_slug}/{fail.platform}: {fail.error}"
                )

        return results

    def close(self) -> None:
        """Cierra recursos del pipeline (ImageGenerator, HttpClient)."""
        self.image_generator.close()

    def __enter__(self) -> "ThumbnailPipeline":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    print("Phase 4b: Generacion de Thumbnails")
    print("=" * 50)

    with ThumbnailPipeline() as pipeline:
        results = pipeline.run(skip_existing=True)

        print(f"\nResumen:")
        print(f"  Briefs procesados: {results.total_briefs}")
        print(f"  Thumbnails generados: {results.thumbnails_generated}")
        print(f"  Thumbnails fallidos: {results.thumbnails_failed}")
        print(f"  Tasa de exito: {results.success_rate:.1f}%")
        print(f"  Duracion: {results.total_duration_seconds:.1f}s")

        if results.thumbnails_failed > 0:
            print(f"\nErrores:")
            for r in results.results:
                if not r.success:
                    print(f"  - {r.keyword_slug}/{r.platform}: {r.error}")
