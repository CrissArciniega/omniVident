"""
Dispatcher principal de Phase 3 - Generacion de scripts y contenido.

Orquesta la generacion de contenido para todas las plataformas (TikTok,
Facebook, Instagram, YouTube, Blog) para cada keyword del top 10.

Lee top_keywords.json de output/phase2_ranked/, carga los templates de
prompt desde config/prompts/, invoca cada platform writer, y guarda los
resultados en output/phase3_scripts/{keyword_slug}/{platform}.json.

Uso directo:
    python -m src.phase3_scripts.script_generator

Uso programatico:
    from src.phase3_scripts.script_generator import ScriptGenerator
    generator = ScriptGenerator()
    results = generator.run()
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.phase3_scripts.blog_writer import BlogWriter
from src.phase3_scripts.facebook_writer import FacebookWriter
from src.phase3_scripts.instagram_writer import InstagramWriter
from src.phase3_scripts.tiktok_writer import TikTokWriter
from src.phase3_scripts.youtube_writer import YouTubeWriter
from src.utils.file_helpers import (
    ensure_dir,
    get_run_id,
    load_yaml_config,
    read_json,
    write_json,
)
from src.utils.json_schemas import (
    Platform,
    ScoredKeyword,
    TopKeywordsCollection,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase3")

# Rutas base del proyecto
PROJECT_ROOT = Path(__file__).parent.parent.parent
CONFIG_DIR = PROJECT_ROOT / "config"
PROMPTS_DIR = CONFIG_DIR / "prompts"

# Mapeo de plataformas a sus archivos de template
PLATFORM_TEMPLATES = {
    Platform.TIKTOK: "tiktok_script.md",
    Platform.FACEBOOK: "facebook_post.md",
    Platform.INSTAGRAM: "instagram_caption.md",
    Platform.YOUTUBE: "youtube_script.md",
    Platform.BLOG: "blog_article.md",
}

# Mapeo de plataformas a nombres de archivo de salida
PLATFORM_OUTPUT_FILENAMES = {
    Platform.TIKTOK: "tiktok.json",
    Platform.FACEBOOK: "facebook.json",
    Platform.INSTAGRAM: "instagram.json",
    Platform.YOUTUBE: "youtube.json",
    Platform.BLOG: "blog.json",
}


class ScriptGenerator:
    """
    Orquestador de Phase 3 que genera contenido para todas las plataformas.

    Para cada keyword del top 10, invoca los 5 platform writers y guarda
    los resultados estructurados como JSON.
    """

    def __init__(self, config_path: str | Path | None = None):
        """
        Inicializa el ScriptGenerator.

        Args:
            config_path: Ruta al archivo config.yaml. Si no se proporciona,
                         usa config/config.yaml relativo a la raiz del proyecto.
        """
        if config_path is None:
            config_path = CONFIG_DIR / "config.yaml"

        self.config = load_yaml_config(config_path)
        self.output_dir = Path(
            self.config.get("output", {}).get("phase3_dir", "output/phase3_scripts")
        )
        self.input_dir = Path(
            self.config.get("output", {}).get("phase2_dir", "output/phase2_ranked")
        )

        # Cargar templates de prompts
        self.prompt_templates: dict[Platform, str] = {}
        self._load_prompt_templates()

        logger.info("ScriptGenerator inicializado")
        logger.info(f"Input dir: {self.input_dir}")
        logger.info(f"Output dir: {self.output_dir}")

    def _load_prompt_templates(self) -> None:
        """
        Carga todos los templates de prompt desde config/prompts/.

        Lee cada archivo .md correspondiente a cada plataforma y lo
        almacena en self.prompt_templates.
        """
        for platform, filename in PLATFORM_TEMPLATES.items():
            template_path = PROMPTS_DIR / filename

            if not template_path.exists():
                logger.warning(
                    f"Template no encontrado para {platform.value}: {template_path}"
                )
                continue

            try:
                with open(template_path, "r", encoding="utf-8") as f:
                    self.prompt_templates[platform] = f.read()
                logger.debug(f"Template cargado: {platform.value} ({len(self.prompt_templates[platform])} chars)")
            except Exception as e:
                logger.error(f"Error cargando template {filename}: {e}")

        logger.info(f"Templates cargados: {len(self.prompt_templates)}/{len(PLATFORM_TEMPLATES)}")

    def _load_top_keywords(self) -> list[ScoredKeyword]:
        """
        Lee y valida las top keywords desde output/phase2_ranked/top_keywords.json.

        Returns:
            Lista de ScoredKeyword ordenadas por rank.

        Raises:
            FileNotFoundError: Si el archivo top_keywords.json no existe.
        """
        input_file = self.input_dir / "top_keywords.json"

        logger.info(f"Cargando top keywords desde: {input_file}")

        raw_data = read_json(input_file)
        collection = TopKeywordsCollection.model_validate(raw_data)

        keywords = collection.top_keywords
        logger.info(
            f"Top keywords cargadas: {len(keywords)} keywords "
            f"(run: {collection.metadata.pipeline_run_id})"
        )

        return keywords

    def _generate_with_llm(self, prompt: str, context: dict[str, Any]) -> str:
        """
        Placeholder para generacion con LLM a nivel de dispatcher.

        Este metodo centralizado puede ser utilizado por el agente Claude
        Code para intercambiar la logica de generacion. Cada writer
        tiene su propio _generate_with_llm, pero este metodo permite
        un override global si es necesario.

        Args:
            prompt: Prompt completo con variables llenadas.
            context: Diccionario con contexto adicional (keyword, platform, etc.).

        Returns:
            El prompt construido (el agente reemplazara esto con contenido real).
        """
        logger.debug(
            f"_generate_with_llm dispatcher llamado: "
            f"keyword='{context.get('keyword', 'N/A')}', "
            f"platform='{context.get('platform', 'N/A')}'"
        )
        return prompt

    def run(
        self,
        run_id: str | None = None,
        platforms: list[Platform] | None = None,
        keyword_slugs: list[str] | None = None,
    ) -> dict[str, dict[str, Any]]:
        """
        Ejecuta la generacion de contenido para todas las keywords y plataformas.

        Para cada keyword del top 10, genera contenido para cada plataforma
        habilitada y guarda los resultados como JSON.

        Args:
            run_id: ID de ejecucion del pipeline. Si no se proporciona, se genera uno.
            platforms: Lista de plataformas a generar. Si None, genera para todas.
            keyword_slugs: Lista de slugs especificos a procesar. Si None, procesa todos.

        Returns:
            Diccionario con estructura:
            {
                "keyword_slug": {
                    "tiktok": {TikTokScript como dict},
                    "facebook": {FacebookPost como dict},
                    ...
                }
            }
        """
        if run_id is None:
            run_id = get_run_id()

        if platforms is None:
            platforms = list(Platform)

        logger.info(f"=== PHASE 3: Script Generation START (run={run_id}) ===")
        logger.info(f"Plataformas: {[p.value for p in platforms]}")

        # Cargar top keywords
        try:
            top_keywords = self._load_top_keywords()
        except FileNotFoundError as e:
            logger.error(f"No se encontro el archivo de top keywords: {e}")
            raise
        except Exception as e:
            logger.error(f"Error cargando top keywords: {e}")
            raise

        # Filtrar por slugs si se especificaron
        if keyword_slugs:
            top_keywords = [
                kw for kw in top_keywords
                if (kw.slug or to_slug(kw.keyword)) in keyword_slugs
            ]
            logger.info(f"Filtrado a {len(top_keywords)} keywords por slug")

        # Inicializar writers
        writers = self._init_writers(run_id)

        # Generar contenido para cada keyword
        all_results: dict[str, dict[str, Any]] = {}
        total_generated = 0
        total_errors = 0

        for kw_data in top_keywords:
            slug = kw_data.slug or to_slug(kw_data.keyword)
            keyword_dir = self.output_dir / slug
            ensure_dir(keyword_dir)

            logger.info(
                f"--- Procesando keyword #{kw_data.rank}: "
                f"'{kw_data.keyword}' ({slug}) ---"
            )

            keyword_results: dict[str, Any] = {}

            for platform in platforms:
                if platform not in self.prompt_templates:
                    logger.warning(
                        f"Sin template para {platform.value}, saltando"
                    )
                    continue

                try:
                    result = self._generate_for_platform(
                        keyword_data=kw_data,
                        platform=platform,
                        writers=writers,
                    )

                    # Serializar y guardar
                    output_filename = PLATFORM_OUTPUT_FILENAMES[platform]
                    output_path = keyword_dir / output_filename
                    result_dict = result.model_dump(mode="json")

                    write_json(output_path, result_dict)

                    keyword_results[platform.value] = result_dict
                    total_generated += 1

                    logger.info(
                        f"  {platform.value}: OK -> {output_path}"
                    )

                except Exception as e:
                    total_errors += 1
                    logger.error(
                        f"  {platform.value}: ERROR para '{kw_data.keyword}': {e}",
                        exc_info=True,
                    )
                    keyword_results[platform.value] = {"error": str(e)}

            all_results[slug] = keyword_results

        # Guardar resumen de la ejecucion
        summary = {
            "pipeline_run_id": run_id,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "total_keywords": len(top_keywords),
            "total_platforms": len(platforms),
            "total_generated": total_generated,
            "total_errors": total_errors,
            "keywords_processed": list(all_results.keys()),
            "platforms": [p.value for p in platforms],
        }
        summary_path = self.output_dir / "phase3_summary.json"
        write_json(summary_path, summary)

        logger.info(f"=== PHASE 3: COMPLETADA ===")
        logger.info(f"Keywords procesadas: {len(top_keywords)}")
        logger.info(f"Scripts generados: {total_generated}")
        logger.info(f"Errores: {total_errors}")
        logger.info(f"Output dir: {self.output_dir}")
        logger.info(f"Resumen: {summary_path}")

        return all_results

    def _init_writers(
        self,
        run_id: str,
    ) -> dict[Platform, Any]:
        """
        Inicializa todos los platform writers.

        Args:
            run_id: ID de ejecucion del pipeline.

        Returns:
            Diccionario mapeando Platform a su writer instanciado.
        """
        writers = {
            Platform.TIKTOK: TikTokWriter(pipeline_run_id=run_id),
            Platform.FACEBOOK: FacebookWriter(pipeline_run_id=run_id),
            Platform.INSTAGRAM: InstagramWriter(pipeline_run_id=run_id),
            Platform.YOUTUBE: YouTubeWriter(pipeline_run_id=run_id),
            Platform.BLOG: BlogWriter(pipeline_run_id=run_id),
        }
        logger.debug(f"Writers inicializados: {len(writers)}")
        return writers

    def _generate_for_platform(
        self,
        keyword_data: ScoredKeyword,
        platform: Platform,
        writers: dict[Platform, Any],
    ) -> Any:
        """
        Genera contenido para una keyword en una plataforma especifica.

        Args:
            keyword_data: Datos de la keyword rankeada.
            platform: Plataforma destino.
            writers: Diccionario de writers inicializados.

        Returns:
            Modelo Pydantic del contenido generado (TikTokScript, FacebookPost, etc.).

        Raises:
            KeyError: Si no hay writer o template para la plataforma.
            Exception: Cualquier error durante la generacion.
        """
        writer = writers[platform]
        template = self.prompt_templates[platform]

        return writer.generate(
            keyword_data=keyword_data,
            prompt_template=template,
        )

    def run_single_keyword(
        self,
        keyword: str,
        rank: int = 1,
        run_id: str | None = None,
        platforms: list[Platform] | None = None,
    ) -> dict[str, Any]:
        """
        Genera contenido para una unica keyword (util para testing).

        Crea un ScoredKeyword minimo y genera contenido para las
        plataformas especificadas.

        Args:
            keyword: Texto de la keyword.
            rank: Posicion en el ranking (default 1).
            run_id: ID de ejecucion.
            platforms: Plataformas a generar.

        Returns:
            Diccionario con resultados por plataforma.
        """
        from src.utils.json_schemas import KeywordScores, TrendData, TrendDirection

        if run_id is None:
            run_id = get_run_id()

        if platforms is None:
            platforms = list(Platform)

        # Crear ScoredKeyword minimo para testing
        kw_data = ScoredKeyword(
            rank=rank,
            keyword=keyword,
            slug=to_slug(keyword),
            scores=KeywordScores(
                volume_estimate=50.0,
                trend_direction=50.0,
                competition_level=50.0,
                commercial_intent=50.0,
                virality_potential=50.0,
            ),
            weighted_total=50.0,
            sources_found_in=["manual_input"],
            source_count=1,
            trend_data=TrendData(direction=TrendDirection.STABLE),
        )

        writers = self._init_writers(run_id)
        slug = kw_data.slug
        keyword_dir = self.output_dir / slug
        ensure_dir(keyword_dir)

        results: dict[str, Any] = {}

        for platform in platforms:
            if platform not in self.prompt_templates:
                logger.warning(f"Sin template para {platform.value}, saltando")
                continue

            try:
                result = self._generate_for_platform(
                    keyword_data=kw_data,
                    platform=platform,
                    writers=writers,
                )

                output_filename = PLATFORM_OUTPUT_FILENAMES[platform]
                output_path = keyword_dir / output_filename
                result_dict = result.model_dump(mode="json")

                write_json(output_path, result_dict)
                results[platform.value] = result_dict

                logger.info(f"  {platform.value}: OK -> {output_path}")

            except Exception as e:
                logger.error(f"  {platform.value}: ERROR: {e}", exc_info=True)
                results[platform.value] = {"error": str(e)}

        return results


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    generator = ScriptGenerator()
    results = generator.run()

    total_keywords = len(results)
    total_scripts = sum(
        1
        for kw_results in results.values()
        for platform_result in kw_results.values()
        if "error" not in platform_result
    )

    print(f"\nPhase 3 completada:")
    print(f"  Keywords procesadas: {total_keywords}")
    print(f"  Scripts generados: {total_scripts}")
    print(f"  Output: output/phase3_scripts/")
