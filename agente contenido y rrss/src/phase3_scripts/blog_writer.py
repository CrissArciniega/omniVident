"""
Generador de articulos SEO para Blog.

Construye prompts a partir del template de Blog y genera una estructura
BlogArticle con contenido placeholder que el agente Claude Code llenara.

Uso:
    from src.phase3_scripts.blog_writer import BlogWriter
    from src.utils.json_schemas import ScoredKeyword

    writer = BlogWriter()
    article = writer.generate(keyword_data=scored_kw, prompt_template=template_str)
"""

from datetime import datetime, timezone
from pathlib import Path

from src.utils.json_schemas import (
    BlogArticle,
    BlogContent,
    InternalLink,
    Platform,
    ScriptMetadata,
    ScoredKeyword,
)
from src.utils.logger import setup_logger
from src.utils.text_utils import to_slug

logger = setup_logger(__name__, phase="phase3")

# Ruta al template de prompt
PROMPT_TEMPLATE_PATH = Path(__file__).parent.parent.parent / "config" / "prompts" / "blog_article.md"


class BlogWriter:
    """Generador de articulos SEO para Blog."""

    def __init__(self, pipeline_run_id: str = ""):
        """
        Inicializa el BlogWriter.

        Args:
            pipeline_run_id: ID de ejecucion del pipeline actual.
        """
        self.pipeline_run_id = pipeline_run_id
        self.platform = Platform.BLOG
        logger.info("BlogWriter inicializado")

    def generate(
        self,
        keyword_data: ScoredKeyword,
        prompt_template: str,
    ) -> BlogArticle:
        """
        Genera un articulo de Blog para una keyword rankeada.

        Construye el prompt llenando las variables del template y crea
        una estructura BlogArticle con contenido placeholder. El agente
        Claude Code se encargara de llenar el contenido real mediante
        _generate_with_llm().

        Args:
            keyword_data: Keyword rankeada con scores y datos de tendencia.
            prompt_template: Template de prompt cargado desde config/prompts/.

        Returns:
            BlogArticle con metadata y contenido (placeholder o generado).
        """
        keyword = keyword_data.keyword
        slug = keyword_data.slug or to_slug(keyword)

        logger.info(f"Generando articulo Blog para: '{keyword}' (rank #{keyword_data.rank})")

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

        article = BlogArticle(
            metadata=metadata,
            content=content,
        )

        logger.info(
            f"Articulo Blog generado para '{keyword}': "
            f"{content.word_count} palabras, "
            f"{len(content.headings)} headings"
        )
        return article

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
        logger.debug(f"_generate_with_llm llamado para '{context.keyword}' (Blog)")
        logger.debug(f"Prompt length: {len(prompt)} caracteres")
        return prompt

    def _build_content(
        self,
        keyword_data: ScoredKeyword,
        raw_content: str,
    ) -> BlogContent:
        """
        Construye la estructura BlogContent.

        Crea un esqueleto de contenido con placeholders descriptivos que
        indican que debe contener cada campo. Incluye meta tags SEO,
        estructura de headings, sugerencias de internal linking e imagenes.

        Args:
            keyword_data: Datos de la keyword para contextualizar placeholders.
            raw_content: Contenido crudo del LLM (o prompt si es placeholder).

        Returns:
            BlogContent con estructura completa.
        """
        keyword = keyword_data.keyword
        slug = keyword_data.slug or to_slug(keyword)

        # Headings del articulo
        headings = [
            f"# {keyword.title()} - Guia Completa 2026",
            f"## Que es {keyword.title()} y por que es tendencia",
            f"## Los mejores productos de {keyword.title()}",
            f"## Como elegir el mejor {keyword.title()}",
            f"## Donde comprar {keyword.title()} de forma segura",
            f"## Precios y comparativa",
            "## Conclusion y recomendaciones finales",
        ]

        # Sugerencias de internal linking
        internal_links = [
            InternalLink(
                anchor_text=f"mejores {keyword}",
                suggested_url_slug=f"/{slug}-mejores",
            ),
            InternalLink(
                anchor_text="productos virales de TikTok",
                suggested_url_slug="/productos-virales-tiktok",
            ),
            InternalLink(
                anchor_text="gadgets baratos de Aliexpress",
                suggested_url_slug="/gadgets-baratos-aliexpress",
            ),
        ]

        # Sugerencias de imagenes
        image_suggestions = [
            f"[IMAGEN 1 - Hero image: foto principal de '{keyword}' en uso - Alt: '{keyword} guia completa']",
            f"[IMAGEN 2 - Comparativa: tabla visual de productos de '{keyword}' - Alt: 'comparativa {keyword} precios']",
            f"[IMAGEN 3 - Infografia: pasos para comprar '{keyword}' de forma segura - Alt: 'como comprar {keyword}']",
        ]

        # Articulo en Markdown (placeholder)
        article_markdown = (
            f"# {keyword.title()} - Guia Completa 2026\n\n"
            f"[INTRODUCCION - 150-200 palabras sobre '{keyword}'\n"
            f"- Parrafo 1: Hook - Problema o necesidad del lector\n"
            f"- Parrafo 2: Contexto - Por que es relevante ahora\n"
            f"- Parrafo 3: Promesa - Que encontrara en este articulo\n"
            f"- Incluir keyword en los primeros 100 caracteres]\n\n"
            f"## Que es {keyword.title()} y por que es tendencia\n\n"
            f"[SECCION 1 - 100-250 palabras explicando '{keyword}'\n"
            f"- Definicion clara\n"
            f"- Datos de tendencia\n"
            f"- Por que es popular ahora]\n\n"
            f"## Los mejores productos de {keyword.title()}\n\n"
            f"[SECCION 2 - 200-300 palabras con lista de productos\n"
            f"- Producto 1: nombre, precio, beneficio principal\n"
            f"- Producto 2: nombre, precio, beneficio principal\n"
            f"- Producto 3: nombre, precio, beneficio principal\n"
            f"- Usar listas con vinetas]\n\n"
            f"## Como elegir el mejor {keyword.title()}\n\n"
            f"[SECCION 3 - 150-200 palabras con criterios de seleccion\n"
            f"- Criterio 1: calidad/precio\n"
            f"- Criterio 2: reviews y valoraciones\n"
            f"- Criterio 3: envio y garantia]\n\n"
            f"## Donde comprar {keyword.title()} de forma segura\n\n"
            f"[SECCION 4 - 150-200 palabras sobre tiendas recomendadas\n"
            f"- Aliexpress: pros y contras\n"
            f"- Amazon: pros y contras\n"
            f"- Tiendas locales: opciones LATAM]\n\n"
            f"## Precios y comparativa\n\n"
            f"[SECCION 5 - 100-150 palabras con tabla de precios\n"
            f"- Rango de precios\n"
            f"- Mejor relacion calidad-precio\n"
            f"- Opciones para diferentes presupuestos]\n\n"
            f"## Conclusion y recomendaciones finales\n\n"
            f"[CONCLUSION - 100-150 palabras\n"
            f"- Resumen de puntos clave\n"
            f"- Recomendacion personal\n"
            f"- CTA: visita nuestra tienda, comparte\n"
            f"- Pregunta para generar comentarios]\n"
        )

        content = BlogContent(
            meta_title=f"{keyword.title()} | Guia Completa 2026",
            meta_description=(
                f"Descubre los mejores {keyword} importados. "
                f"Guia actualizada con precios, reviews y links para comprar inteligente."
            ),
            focus_keyword=keyword,
            word_count=1000,
            article_markdown=article_markdown,
            headings=headings,
            internal_linking_suggestions=internal_links,
            image_suggestions=image_suggestions,
        )

        return content
