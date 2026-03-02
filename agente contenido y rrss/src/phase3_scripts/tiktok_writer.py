"""
Generador de guiones para TikTok.

Construye prompts a partir del template de TikTok y genera una estructura
TikTokScript con contenido placeholder que el agente Claude Code llenara.

Uso:
    from src.phase3_scripts.tiktok_writer import TikTokWriter
    from src.utils.json_schemas import ScoredKeyword

    writer = TikTokWriter()
    script = writer.generate(keyword_data=scored_kw, prompt_template=template_str)
"""

from datetime import datetime, timezone
from pathlib import Path

from src.utils.json_schemas import (
    Platform,
    ScriptMetadata,
    ScoredKeyword,
    TikTokContent,
    TikTokScript,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase3")

# Ruta al template de prompt
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "config" / "prompts" / "tiktok_script.md"


class TikTokWriter:
    """Generador de guiones para videos de TikTok."""

    def __init__(self, pipeline_run_id: str = ""):
        """
        Inicializa el TikTokWriter.

        Args:
            pipeline_run_id: ID de ejecucion del pipeline actual.
        """
        self.pipeline_run_id = pipeline_run_id
        self.platform = Platform.TIKTOK
        logger.info("TikTokWriter inicializado")

    def generate(
        self,
        keyword_data: ScoredKeyword,
        prompt_template: str,
    ) -> TikTokScript:
        """
        Genera un guion de TikTok para una keyword rankeada.

        Construye el prompt llenando las variables del template y crea
        una estructura TikTokScript con contenido placeholder. El agente
        Claude Code se encargara de llenar el contenido real mediante
        _generate_with_llm().

        Args:
            keyword_data: Keyword rankeada con scores y datos de tendencia.
            prompt_template: Template de prompt cargado desde config/prompts/.

        Returns:
            TikTokScript con metadata y contenido (placeholder o generado).
        """
        keyword = keyword_data.keyword
        slug = keyword_data.slug or to_slug(keyword)

        logger.info(f"Generando guion TikTok para: '{keyword}' (rank #{keyword_data.rank})")

        # Construir el prompt llenando variables del template
        filled_prompt = self._fill_template(prompt_template, keyword_data)

        # Generar contenido via LLM (placeholder para el agente)
        raw_content = self._generate_with_llm(filled_prompt, keyword_data)

        # Construir la estructura de contenido
        content = self._build_content(keyword_data, raw_content)

        # Construir metadata
        metadata = ScriptMetadata(
            keyword=keyword,
            keyword_slug=slug,
            platform=self.platform,
            generated_at=datetime.now(timezone.utc),
            pipeline_run_id=self.pipeline_run_id,
        )

        script = TikTokScript(
            metadata=metadata,
            content=content,
        )

        logger.info(f"Guion TikTok generado para '{keyword}': duracion={content.duration_seconds}s")
        return script

    def _fill_template(
        self,
        template: str,
        keyword_data: ScoredKeyword,
    ) -> str:
        """
        Llena las variables del template con datos de la keyword.

        Args:
            template: Template de prompt con placeholders.
            keyword_data: Datos de la keyword rankeada.

        Returns:
            Prompt completo con variables reemplazadas.
        """
        trend_direction = "N/A"
        if keyword_data.trend_data:
            trend_direction = keyword_data.trend_data.direction.value
            if keyword_data.trend_data.growth_percentage is not None:
                trend_direction += f" ({keyword_data.trend_data.growth_percentage:+.1f}%)"

        sources = ", ".join(keyword_data.sources_found_in)

        filled = template.replace("{keyword}", keyword_data.keyword)
        filled = filled.replace("{rank}", str(keyword_data.rank))
        filled = filled.replace("{weighted_total}", f"{keyword_data.weighted_total:.1f}")
        filled = filled.replace("{trend_direction}", trend_direction)
        filled = filled.replace("{sources}", sources)

        return filled

    def _generate_with_llm(
        self,
        prompt: str,
        context: ScoredKeyword,
    ) -> str:
        """
        Placeholder para generacion con LLM.

        Este metodo sera invocado por el agente Claude Code, quien se
        encargara de la generacion real de contenido. Por ahora retorna
        el prompt construido para que el agente lo utilice.

        Args:
            prompt: Prompt completo con todas las variables llenadas.
            context: Datos de la keyword para contexto adicional.

        Returns:
            El prompt construido (el agente reemplazara esto con contenido real).
        """
        logger.debug(f"_generate_with_llm llamado para '{context.keyword}' (TikTok)")
        logger.debug(f"Prompt length: {len(prompt)} caracteres")
        return prompt

    def _build_content(
        self,
        keyword_data: ScoredKeyword,
        raw_content: str,
    ) -> TikTokContent:
        """
        Construye la estructura TikTokContent.

        Crea un esqueleto de contenido con placeholders descriptivos que
        indican que debe contener cada campo. El agente Claude Code
        reemplazara estos placeholders con contenido real generado.

        Args:
            keyword_data: Datos de la keyword para contextualizar placeholders.
            raw_content: Contenido crudo del LLM (o prompt si es placeholder).

        Returns:
            TikTokContent con estructura completa.
        """
        keyword = keyword_data.keyword

        content = TikTokContent(
            hook=f"[HOOK - Primeros 3 segundos para '{keyword}' - Debe detener el scroll]",
            script_body=f"[CUERPO DEL GUION - Desarrollo del contenido sobre '{keyword}' - Mostrar producto en accion, beneficio principal, momento wow]",
            cta=f"[CTA - Call to action final para '{keyword}' - Maximo 5 segundos]",
            full_script=f"[GUION COMPLETO - Script integrado de hook + cuerpo + CTA sobre '{keyword}']",
            duration_seconds=30,
            format_suggestion=f"[FORMATO SUGERIDO - Tipo de video recomendado para '{keyword}': POV, unboxing, storytime, etc.]",
            trending_sound_suggestion=f"[SONIDO TRENDING - Sugerencia de musica/audio para '{keyword}']",
            hashtags=[
                f"#{to_slug(keyword).replace('-', '')}",
                "#gadgetsbaratos",
                "#productosvirales",
                "#tiktokfinds",
                "#importadosdechina",
            ],
            caption=f"[CAPTION - Texto corto para acompanar el video sobre '{keyword}']",
        )

        return content
