"""
Generador de posts para Facebook.

Construye prompts a partir del template de Facebook y genera una estructura
FacebookPost con contenido placeholder que el agente Claude Code llenara.

Uso:
    from src.phase3_scripts.facebook_writer import FacebookWriter
    from src.utils.json_schemas import ScoredKeyword

    writer = FacebookWriter()
    post = writer.generate(keyword_data=scored_kw, prompt_template=template_str)
"""

from datetime import datetime, timezone
from pathlib import Path

from src.utils.json_schemas import (
    FacebookContent,
    FacebookPost,
    Platform,
    ScriptMetadata,
    ScoredKeyword,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase3")

# Ruta al template de prompt
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "config" / "prompts" / "facebook_post.md"


class FacebookWriter:
    """Generador de posts para Facebook."""

    def __init__(self, pipeline_run_id: str = ""):
        """
        Inicializa el FacebookWriter.

        Args:
            pipeline_run_id: ID de ejecucion del pipeline actual.
        """
        self.pipeline_run_id = pipeline_run_id
        self.platform = Platform.FACEBOOK
        logger.info("FacebookWriter inicializado")

    def generate(
        self,
        keyword_data: ScoredKeyword,
        prompt_template: str,
    ) -> FacebookPost:
        """
        Genera un post de Facebook para una keyword rankeada.

        Construye el prompt llenando las variables del template y crea
        una estructura FacebookPost con contenido placeholder. El agente
        Claude Code se encargara de llenar el contenido real mediante
        _generate_with_llm().

        Args:
            keyword_data: Keyword rankeada con scores y datos de tendencia.
            prompt_template: Template de prompt cargado desde config/prompts/.

        Returns:
            FacebookPost con metadata y contenido (placeholder o generado).
        """
        keyword = keyword_data.keyword
        slug = keyword_data.slug or to_slug(keyword)

        logger.info(f"Generando post Facebook para: '{keyword}' (rank #{keyword_data.rank})")

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

        post = FacebookPost(
            metadata=metadata,
            content=content,
        )

        logger.info(f"Post Facebook generado para '{keyword}'")
        return post

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
        logger.debug(f"_generate_with_llm llamado para '{context.keyword}' (Facebook)")
        logger.debug(f"Prompt length: {len(prompt)} caracteres")
        return prompt

    def _build_content(
        self,
        keyword_data: ScoredKeyword,
        raw_content: str,
    ) -> FacebookContent:
        """
        Construye la estructura FacebookContent.

        Crea un esqueleto de contenido con placeholders descriptivos que
        indican que debe contener cada campo. El agente Claude Code
        reemplazara estos placeholders con contenido real generado.

        Args:
            keyword_data: Datos de la keyword para contextualizar placeholders.
            raw_content: Contenido crudo del LLM (o prompt si es placeholder).

        Returns:
            FacebookContent con estructura completa.
        """
        keyword = keyword_data.keyword

        content = FacebookContent(
            hook=f"[GANCHO INICIAL - Primera linea visible antes del 'Ver mas' sobre '{keyword}' - Debe ser irresistible]",
            body=f"[CUERPO DEL POST - 150-300 palabras sobre '{keyword}' - Parrafos cortos, emojis como separadores, mini-historia, beneficios concretos]",
            engagement_hooks=[
                f"[ENGAGEMENT HOOK 1 - Pregunta abierta sobre '{keyword}']",
                f"[ENGAGEMENT HOOK 2 - 'Etiqueta a alguien que...' o 'Comenta si...']",
            ],
            cta=f"[CTA - Call to action orientado a compra/seguimiento para '{keyword}']",
            full_post=f"[POST COMPLETO - Texto integrado de gancho + cuerpo + engagement hooks + CTA sobre '{keyword}']",
            hashtags=[
                f"#{to_slug(keyword).replace('-', '')}",
                "#productosvirales",
                "#gadgets",
            ],
            suggested_image_description=f"[DESCRIPCION DE IMAGEN - Sugerencia visual para acompanar post sobre '{keyword}']",
        )

        return content
