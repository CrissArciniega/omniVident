"""
Generador de scripts para YouTube.

Construye prompts a partir del template de YouTube y genera una estructura
YouTubeScript con contenido placeholder que el agente Claude Code llenara.

Uso:
    from src.phase3_scripts.youtube_writer import YouTubeWriter
    from src.utils.json_schemas import ScoredKeyword

    writer = YouTubeWriter()
    script = writer.generate(keyword_data=scored_kw, prompt_template=template_str)
"""

from datetime import datetime, timezone
from pathlib import Path

from src.utils.json_schemas import (
    Platform,
    ScriptMetadata,
    ScoredKeyword,
    YouTubeContent,
    YouTubeScript,
    YouTubeSection,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase3")

# Ruta al template de prompt
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "config" / "prompts" / "youtube_script.md"


class YouTubeWriter:
    """Generador de scripts para videos de YouTube."""

    def __init__(self, pipeline_run_id: str = ""):
        """
        Inicializa el YouTubeWriter.

        Args:
            pipeline_run_id: ID de ejecucion del pipeline actual.
        """
        self.pipeline_run_id = pipeline_run_id
        self.platform = Platform.YOUTUBE
        logger.info("YouTubeWriter inicializado")

    def generate(
        self,
        keyword_data: ScoredKeyword,
        prompt_template: str,
    ) -> YouTubeScript:
        """
        Genera un script de YouTube para una keyword rankeada.

        Construye el prompt llenando las variables del template y crea
        una estructura YouTubeScript con contenido placeholder. El agente
        Claude Code se encargara de llenar el contenido real mediante
        _generate_with_llm().

        Args:
            keyword_data: Keyword rankeada con scores y datos de tendencia.
            prompt_template: Template de prompt cargado desde config/prompts/.

        Returns:
            YouTubeScript con metadata y contenido (placeholder o generado).
        """
        keyword = keyword_data.keyword
        slug = keyword_data.slug or to_slug(keyword)

        logger.info(f"Generando script YouTube para: '{keyword}' (rank #{keyword_data.rank})")

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

        script = YouTubeScript(
            metadata=metadata,
            content=content,
        )

        logger.info(
            f"Script YouTube generado para '{keyword}': "
            f"{len(content.body_sections)} secciones, "
            f"{len(content.tags)} tags"
        )
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
        logger.debug(f"_generate_with_llm llamado para '{context.keyword}' (YouTube)")
        logger.debug(f"Prompt length: {len(prompt)} caracteres")
        return prompt

    def _build_content(
        self,
        keyword_data: ScoredKeyword,
        raw_content: str,
    ) -> YouTubeContent:
        """
        Construye la estructura YouTubeContent.

        Crea un esqueleto de contenido con placeholders descriptivos que
        indican que debe contener cada campo. Incluye secciones de body
        con timestamps, descripcion SEO, y tags.

        Args:
            keyword_data: Datos de la keyword para contextualizar placeholders.
            raw_content: Contenido crudo del LLM (o prompt si es placeholder).

        Returns:
            YouTubeContent con estructura completa.
        """
        keyword = keyword_data.keyword

        # Secciones del cuerpo del video con timestamps
        body_sections = [
            YouTubeSection(
                timestamp="0:30",
                title=f"Que es {keyword}",
                script=(
                    f"[SECCION 1 - Introduccion al tema '{keyword}'\n"
                    f"- Contexto general\n"
                    f"- Por que es relevante ahora\n"
                    f"- Que vamos a ver en este video]"
                ),
            ),
            YouTubeSection(
                timestamp="2:00",
                title=f"Top productos de {keyword}",
                script=(
                    f"[SECCION 2 - Productos principales de '{keyword}'\n"
                    f"- Producto 1: descripcion, precio, donde comprar\n"
                    f"- Producto 2: descripcion, precio, donde comprar\n"
                    f"- Producto 3: descripcion, precio, donde comprar]"
                ),
            ),
            YouTubeSection(
                timestamp="5:00",
                title="Comparativa y recomendaciones",
                script=(
                    f"[SECCION 3 - Comparativa de productos de '{keyword}'\n"
                    f"- Pros y contras de cada uno\n"
                    f"- Valoracion personal\n"
                    f"- Cual comprar segun tu presupuesto]"
                ),
            ),
            YouTubeSection(
                timestamp="7:00",
                title="Tips para comprar inteligente",
                script=(
                    f"[SECCION 4 - Consejos de compra para '{keyword}'\n"
                    f"- Como evitar estafas\n"
                    f"- Mejores tiendas/plataformas\n"
                    f"- Tiempos de envio y aduanas]"
                ),
            ),
            YouTubeSection(
                timestamp="9:00",
                title="Veredicto final",
                script=(
                    f"[SECCION 5 - Conclusion sobre '{keyword}'\n"
                    f"- Resumen de hallazgos\n"
                    f"- Recomendacion personal\n"
                    f"- Adelanto del siguiente video]"
                ),
            ),
        ]

        # Timestamps como texto formateado
        timestamps_lines = ["0:00 - Hook", "0:10 - Intro"]
        for section in body_sections:
            timestamps_lines.append(f"{section.timestamp} - {section.title}")
        timestamps_lines.append("10:00 - CTA y despedida")
        timestamps_text = "\n".join(timestamps_lines)

        content = YouTubeContent(
            title=f"[TITULO - Max 100 chars con '{keyword}' - Numeros + curiosidad]",
            hook=(
                f"[HOOK 0:00-0:10 - Gancho inicial sobre '{keyword}'\n"
                f"- Mostrar resultado final o producto mas impactante\n"
                f"- Frase que genere curiosidad inmediata\n"
                f"- NO presentarse primero, ir directo al gancho]"
            ),
            intro=(
                f"[INTRO 0:10-0:30 - Presentacion breve sobre '{keyword}'\n"
                f"- Quien soy, que vamos a ver\n"
                f"- Pedido de suscripcion rapido\n"
                f"- Anticipar lo mejor del video]"
            ),
            body_sections=body_sections,
            cta=(
                f"[CTA FINAL - Cierre del video sobre '{keyword}'\n"
                f"- Resumen de lo visto\n"
                f"- Producto favorito\n"
                f"- Like, suscripcion, campanita\n"
                f"- Pregunta para comentarios\n"
                f"- Links en descripcion\n"
                f"- Preview del siguiente video]"
            ),
            full_script=f"[SCRIPT COMPLETO - Guion integrado de todas las secciones sobre '{keyword}']",
            description=(
                f"[DESCRIPCION SEO - Max 5000 chars sobre '{keyword}'\n"
                f"- Parrafo intro con keyword principal\n"
                f"- Timestamps\n"
                f"- Links de productos\n"
                f"- Redes sociales\n"
                f"- Parrafo descriptivo con keywords secundarias\n"
                f"- Disclaimer de afiliados]"
            ),
            tags=[
                keyword,
                f"{keyword} 2026",
                "gadgets baratos",
                "productos importados china",
                "productos virales tiktok",
                "gadgets utiles",
                "accesorios tecnologicos",
                "productos novedosos",
                "compras aliexpress",
                "review productos",
                "unboxing gadgets",
                "mejores gadgets",
                "productos baratos",
                "tech barato",
                "gadgets latam",
            ],
            timestamps_text=timestamps_text,
        )

        return content
