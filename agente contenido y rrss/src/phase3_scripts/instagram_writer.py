"""
Generador de captions y contenido para Instagram.

Construye prompts a partir del template de Instagram y genera una estructura
InstagramCaption con contenido placeholder que el agente Claude Code llenara.

Uso:
    from src.phase3_scripts.instagram_writer import InstagramWriter
    from src.utils.json_schemas import ScoredKeyword

    writer = InstagramWriter()
    caption = writer.generate(keyword_data=scored_kw, prompt_template=template_str)
"""

from datetime import datetime, timezone
from pathlib import Path

from src.utils.json_schemas import (
    InstagramCaption,
    InstagramContent,
    Platform,
    ScriptMetadata,
    ScoredKeyword,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase3")

# Ruta al template de prompt
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "config" / "prompts" / "instagram_caption.md"


class InstagramWriter:
    """Generador de captions y contenido para Instagram."""

    def __init__(self, pipeline_run_id: str = ""):
        """
        Inicializa el InstagramWriter.

        Args:
            pipeline_run_id: ID de ejecucion del pipeline actual.
        """
        self.pipeline_run_id = pipeline_run_id
        self.platform = Platform.INSTAGRAM
        logger.info("InstagramWriter inicializado")

    def generate(
        self,
        keyword_data: ScoredKeyword,
        prompt_template: str,
    ) -> InstagramCaption:
        """
        Genera contenido de Instagram para una keyword rankeada.

        Construye el prompt llenando las variables del template y crea
        una estructura InstagramCaption con contenido placeholder. El agente
        Claude Code se encargara de llenar el contenido real mediante
        _generate_with_llm().

        Args:
            keyword_data: Keyword rankeada con scores y datos de tendencia.
            prompt_template: Template de prompt cargado desde config/prompts/.

        Returns:
            InstagramCaption con metadata y contenido (placeholder o generado).
        """
        keyword = keyword_data.keyword
        slug = keyword_data.slug or to_slug(keyword)

        logger.info(f"Generando contenido Instagram para: '{keyword}' (rank #{keyword_data.rank})")

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

        caption = InstagramCaption(
            metadata=metadata,
            content=content,
        )

        logger.info(
            f"Contenido Instagram generado para '{keyword}': "
            f"{len(content.all_hashtags)} hashtags"
        )
        return caption

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
        logger.debug(f"_generate_with_llm llamado para '{context.keyword}' (Instagram)")
        logger.debug(f"Prompt length: {len(prompt)} caracteres")
        return prompt

    def _build_content(
        self,
        keyword_data: ScoredKeyword,
        raw_content: str,
    ) -> InstagramContent:
        """
        Construye la estructura InstagramContent.

        Crea un esqueleto de contenido con placeholders descriptivos que
        indican que debe contener cada campo. El agente Claude Code
        reemplazara estos placeholders con contenido real generado.

        Instagram requiere exactamente 30 hashtags distribuidos en 3 grupos
        de 10 (alto volumen, medio volumen, nicho).

        Args:
            keyword_data: Datos de la keyword para contextualizar placeholders.
            raw_content: Contenido crudo del LLM (o prompt si es placeholder).

        Returns:
            InstagramContent con estructura completa.
        """
        keyword = keyword_data.keyword
        kw_tag = to_slug(keyword).replace("-", "")

        # Hashtags de alto volumen (500k+ publicaciones)
        hashtags_high = [
            "#gadgets", "#tecnologia", "#shopping", "#viral", "#tendencia",
            "#ofertas", "#compras", "#novedades", "#tips", "#recomendaciones",
        ]

        # Hashtags de volumen medio (50k-500k publicaciones)
        hashtags_medium = [
            "#gadgetsbaratos", "#productosnovedosos", "#comprasinteligentes",
            "#importadosdechina", "#productosvirales", "#accesoriostech",
            "#cosasbaratas", "#hallazgos", "#productosutiles", "#techbarato",
        ]

        # Hashtags de nicho (menos de 50k publicaciones)
        hashtags_niche = [
            f"#{kw_tag}", "#gadgetsmx", "#productosvirales2026",
            "#articulosnovedosos", "#importadoslatam", "#techlatam",
            "#gadgetsutiles", "#cosasdeChina", "#findstiktok", "#novedadeschina",
        ]

        # Todos los hashtags combinados (exactamente 30)
        all_hashtags = hashtags_high + hashtags_medium + hashtags_niche

        content = InstagramContent(
            hook=f"[HOOK - Primera linea visible antes de '...mas' sobre '{keyword}' - Debe ser irresistible]",
            caption=(
                f"[CAPTION COMPLETO - Maximo 2200 caracteres sobre '{keyword}'\n"
                f"- Parrafos muy cortos (1-2 lineas)\n"
                f"- Emojis como bullet points\n"
                f"- Incluir valor real (tip, dato, consejo)\n"
                f"- Mini-historia si aplica\n"
                f"- Lenguaje LATAM coloquial\n"
                f"- CTA al final: guardado, compartir, link en bio]"
            ),
            hashtags_high_volume=hashtags_high,
            hashtags_medium_volume=hashtags_medium,
            hashtags_niche=hashtags_niche,
            all_hashtags=all_hashtags,
            carousel_outline=[
                f"[SLIDE 1 - Portada: titulo llamativo sobre '{keyword}', max 5 palabras]",
                f"[SLIDE 2 - Punto/tip 1 sobre '{keyword}']",
                f"[SLIDE 3 - Punto/tip 2 sobre '{keyword}']",
                f"[SLIDE 4 - Punto/tip 3 sobre '{keyword}']",
                f"[SLIDE 5 - Punto/tip 4 sobre '{keyword}']",
                f"[SLIDE 6 - Punto/tip 5 sobre '{keyword}']",
                f"[SLIDE 7 - Resumen rapido]",
                f"[SLIDE 8 - CTA: Guardalo, Siguenos, Link en bio]",
            ],
            reel_script=(
                f"[REEL SCRIPT - 15-30 segundos sobre '{keyword}'\n"
                f"- Hook visual en primer segundo\n"
                f"- Demostracion rapida del producto\n"
                f"- Texto overlay con puntos clave\n"
                f"- Musica trending sugerida]"
            ),
            cta=f"[CTA - Call to action para '{keyword}': guardado, compartir, link en bio]",
        )

        return content
