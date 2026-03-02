"""
Generador de Design Briefs - Phase 4a.

Lee los scripts generados en Phase 3 y las especificaciones de plataforma,
y crea un DesignBrief completo para cada combinacion keyword/plataforma.

Uso directo:
    python -m src.phase4_design.brief_generator

Uso programatico:
    from src.phase4_design.brief_generator import BriefGenerator
    generator = BriefGenerator()
    briefs = generator.run()
"""

import hashlib
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.utils.file_helpers import (
    ensure_dir,
    load_yaml_config,
    read_json,
    write_json,
)
from src.utils.json_schemas import (
    ColorPalette,
    Composition,
    DesignBrief,
    DesignBriefMetadata,
    DesignSpec,
    Dimensions,
    Platform,
    TextOverlay,
    Typography,
)
from src.utils.logger import setup_logger

logger = setup_logger(__name__, phase="phase4")


# =============================================================================
# PALETAS DE COLORES POR CATEGORIA DE PRODUCTO
# =============================================================================

COLOR_PALETTES: dict[str, ColorPalette] = {
    "tecnologia": ColorPalette(
        primary="#1A1A2E",
        secondary="#16213E",
        accent="#0F3460",
        text_primary="#FFFFFF",
        text_secondary="#E94560",
    ),
    "belleza": ColorPalette(
        primary="#FFF0F5",
        secondary="#FFB6C1",
        accent="#FF69B4",
        text_primary="#2C0B1A",
        text_secondary="#C71585",
    ),
    "hogar": ColorPalette(
        primary="#F5F5DC",
        secondary="#DEB887",
        accent="#D2691E",
        text_primary="#2F1B0E",
        text_secondary="#8B4513",
    ),
    "cocina": ColorPalette(
        primary="#FFFBEB",
        secondary="#FEF3C7",
        accent="#F59E0B",
        text_primary="#1C1917",
        text_secondary="#D97706",
    ),
    "juguetes": ColorPalette(
        primary="#EFF6FF",
        secondary="#BFDBFE",
        accent="#3B82F6",
        text_primary="#1E1B4B",
        text_secondary="#F97316",
    ),
    "moda": ColorPalette(
        primary="#0F0F0F",
        secondary="#1A1A1A",
        accent="#C9A96E",
        text_primary="#FFFFFF",
        text_secondary="#C9A96E",
    ),
    "limpieza": ColorPalette(
        primary="#F0FDF4",
        secondary="#BBF7D0",
        accent="#22C55E",
        text_primary="#052E16",
        text_secondary="#15803D",
    ),
    "general": ColorPalette(
        primary="#1E293B",
        secondary="#334155",
        accent="#F97316",
        text_primary="#FFFFFF",
        text_secondary="#FB923C",
    ),
    "gadgets": ColorPalette(
        primary="#0D0D0D",
        secondary="#1F1F1F",
        accent="#00D4FF",
        text_primary="#FFFFFF",
        text_secondary="#00D4FF",
    ),
    "regalos": ColorPalette(
        primary="#4C1D95",
        secondary="#6D28D9",
        accent="#F59E0B",
        text_primary="#FFFFFF",
        text_secondary="#FCD34D",
    ),
}

# Palabras clave que mapean a cada categoria de paleta
CATEGORY_KEYWORDS: dict[str, list[str]] = {
    "tecnologia": [
        "tecnologia", "tech", "electronico", "celular", "telefono", "laptop",
        "computadora", "audifonos", "cable", "cargador", "usb", "bluetooth",
        "smart", "led", "sensor",
    ],
    "belleza": [
        "belleza", "beauty", "cosmetico", "maquillaje", "crema", "serum",
        "skincare", "coreano", "korean", "piel", "cabello", "unas",
    ],
    "hogar": [
        "hogar", "casa", "decoracion", "organizador", "almacenamiento",
        "mueble", "lampara", "cortina", "jardin",
    ],
    "cocina": [
        "cocina", "utensilio", "kitchen", "sarten", "olla", "cuchillo",
        "molde", "recipiente", "comida", "alimento",
    ],
    "juguetes": [
        "juguete", "juego", "nino", "kids", "diversion", "peluche",
        "educativo", "puzzle", "rompecabezas",
    ],
    "moda": [
        "moda", "fashion", "ropa", "accesorio", "bolsa", "bolso",
        "zapato", "reloj", "joyeria", "collar", "pulsera", "anillo",
    ],
    "limpieza": [
        "limpieza", "limpiar", "clean", "desinfectante", "aspiradora",
        "trapeador", "escoba", "detergente",
    ],
    "gadgets": [
        "gadget", "innovador", "novedoso", "viral", "trending", "aliexpress",
        "amazon", "barato", "util", "practico", "importado", "china",
    ],
    "regalos": [
        "regalo", "obsequio", "sorpresa", "original", "personalizado",
    ],
}

# =============================================================================
# TIPOGRAFIAS POR PLATAFORMA
# =============================================================================

PLATFORM_TYPOGRAPHY: dict[str, Typography] = {
    "tiktok": Typography(
        headline_font="Montserrat Black",
        body_font="Inter SemiBold",
        headline_size="72px",
        body_size="36px",
    ),
    "facebook": Typography(
        headline_font="Poppins Bold",
        body_font="Open Sans Regular",
        headline_size="48px",
        body_size="24px",
    ),
    "instagram": Typography(
        headline_font="Playfair Display Bold",
        body_font="Lato Regular",
        headline_size="56px",
        body_size="28px",
    ),
    "youtube": Typography(
        headline_font="Roboto Black",
        body_font="Roboto Medium",
        headline_size="64px",
        body_size="32px",
    ),
    "blog": Typography(
        headline_font="Merriweather Bold",
        body_font="Source Sans Pro Regular",
        headline_size="48px",
        body_size="20px",
    ),
}

# =============================================================================
# COMPOSICIONES POR PLATAFORMA
# =============================================================================

PLATFORM_COMPOSITIONS: dict[str, Composition] = {
    "tiktok": Composition(
        layout="vertical_center_stack",
        focal_point="center_upper_third",
        background_style="gradient_dark_overlay",
    ),
    "facebook": Composition(
        layout="horizontal_split",
        focal_point="left_center",
        background_style="solid_with_accent_border",
    ),
    "instagram": Composition(
        layout="centered_square",
        focal_point="center",
        background_style="gradient_subtle",
    ),
    "youtube": Composition(
        layout="rule_of_thirds",
        focal_point="right_third",
        background_style="high_contrast_split",
    ),
    "blog": Composition(
        layout="hero_with_text_overlay",
        focal_point="center",
        background_style="blurred_background_with_overlay",
    ),
}


class BriefGenerator:
    """
    Generador de Design Briefs para Phase 4a.

    Lee los scripts de Phase 3 y las especificaciones de plataforma,
    generando un brief de diseno completo para cada combinacion.

    Args:
        config_path: Ruta al config.yaml principal.
        platforms_path: Ruta a platforms.yaml.
    """

    def __init__(
        self,
        config_path: str | Path | None = None,
        platforms_path: str | Path | None = None,
    ):
        project_root = Path(__file__).parent.parent.parent

        if config_path is None:
            config_path = project_root / "config" / "config.yaml"
        if platforms_path is None:
            platforms_path = project_root / "config" / "platforms.yaml"

        self.config = load_yaml_config(config_path)
        self.platforms_config = load_yaml_config(platforms_path)

        self.scripts_dir = Path(
            self.config.get("output", {}).get("phase3_dir", "output/phase3_scripts")
        )
        self.output_dir = Path(
            self.config.get("output", {}).get("phase4_dir", "output/phase4_designs")
        )
        self.platform_specs = self.platforms_config.get("platforms", {})

    def _detect_category(self, keyword: str) -> str:
        """
        Detecta la categoria del producto a partir de la keyword.

        Busca coincidencias entre palabras de la keyword y las palabras
        clave de cada categoria. Si no hay coincidencia, retorna 'general'.

        Args:
            keyword: Keyword del contenido.

        Returns:
            Nombre de la categoria detectada.
        """
        keyword_lower = keyword.lower()

        best_category = "general"
        best_score = 0

        for category, cat_keywords in CATEGORY_KEYWORDS.items():
            score = sum(1 for ck in cat_keywords if ck in keyword_lower)
            if score > best_score:
                best_score = score
                best_category = category

        logger.debug(f"Keyword '{keyword}' -> categoria '{best_category}' (score={best_score})")
        return best_category

    def _get_color_palette(self, keyword: str) -> ColorPalette:
        """
        Obtiene la paleta de colores basada en la categoria del producto.

        Args:
            keyword: Keyword del contenido.

        Returns:
            ColorPalette correspondiente a la categoria detectada.
        """
        category = self._detect_category(keyword)
        return COLOR_PALETTES.get(category, COLOR_PALETTES["general"])

    def _get_dimensions(self, platform_name: str) -> Dimensions:
        """
        Extrae las dimensiones del thumbnail desde platforms.yaml.

        Args:
            platform_name: Nombre de la plataforma (ej: 'tiktok').

        Returns:
            Dimensions con width y height de la plataforma.
        """
        plat = self.platform_specs.get(platform_name, {})
        thumb = plat.get("thumbnail", {})

        return Dimensions(
            width=thumb.get("width", 1080),
            height=thumb.get("height", 1080),
            unit="px",
        )

    def _extract_text_content(
        self, script_data: dict[str, Any], platform_name: str
    ) -> dict[str, str]:
        """
        Extrae los textos relevantes del script para crear overlays.

        Busca campos como hook, title, cta, caption en el contenido
        del script, adaptandose a la estructura de cada plataforma.

        Args:
            script_data: Datos JSON del script de Phase 3.
            platform_name: Nombre de la plataforma.

        Returns:
            Diccionario con claves 'title', 'hook', 'cta' y sus textos.
        """
        content = script_data.get("content", {})
        texts: dict[str, str] = {}

        # Extraer titulo (YouTube, Blog) o hook (TikTok, Facebook, Instagram)
        if "title" in content:
            texts["title"] = content["title"]
        if "meta_title" in content:
            texts["title"] = content["meta_title"]

        if "hook" in content:
            texts["hook"] = content["hook"]

        if "cta" in content:
            texts["cta"] = content["cta"]

        # Si no encontramos titulo, usar el hook truncado
        if "title" not in texts and "hook" in texts:
            hook = texts["hook"]
            texts["title"] = hook[:80] + ("..." if len(hook) > 80 else "")

        # Fallback: usar keyword como titulo
        metadata = script_data.get("metadata", {})
        if "title" not in texts:
            texts["title"] = metadata.get("keyword", "Producto Novedoso")

        return texts

    def _build_text_overlays(
        self,
        texts: dict[str, str],
        platform_name: str,
    ) -> list[TextOverlay]:
        """
        Crea la lista de TextOverlay basada en los textos extraidos
        y la plataforma destino.

        Args:
            texts: Diccionario con textos extraidos del script.
            platform_name: Nombre de la plataforma.

        Returns:
            Lista de TextOverlay posicionados segun la plataforma.
        """
        overlays: list[TextOverlay] = []

        # Configuraciones de posicion y estilo por plataforma
        overlay_configs: dict[str, dict[str, Any]] = {
            "tiktok": {
                "title": {"position": "center_top", "style": "bold_shadow", "max_width_percent": 85},
                "hook": {"position": "center_middle", "style": "outlined_white", "max_width_percent": 90},
                "cta": {"position": "center_bottom", "style": "pill_button", "max_width_percent": 70},
            },
            "facebook": {
                "title": {"position": "left_center", "style": "bold_dark", "max_width_percent": 60},
                "hook": {"position": "left_upper", "style": "subtitle_dark", "max_width_percent": 55},
                "cta": {"position": "right_bottom", "style": "accent_button", "max_width_percent": 40},
            },
            "instagram": {
                "title": {"position": "center", "style": "elegant_centered", "max_width_percent": 80},
                "hook": {"position": "center_upper", "style": "light_subtitle", "max_width_percent": 75},
                "cta": {"position": "center_bottom", "style": "minimal_pill", "max_width_percent": 60},
            },
            "youtube": {
                "title": {"position": "left_center", "style": "youtube_bold", "max_width_percent": 65},
                "hook": {"position": "right_upper", "style": "accent_badge", "max_width_percent": 35},
                "cta": {"position": "left_bottom", "style": "subscribe_style", "max_width_percent": 40},
            },
            "blog": {
                "title": {"position": "center", "style": "hero_title", "max_width_percent": 80},
                "hook": {"position": "center_below_title", "style": "meta_subtitle", "max_width_percent": 70},
                "cta": {"position": "bottom_right", "style": "read_more_link", "max_width_percent": 30},
            },
        }

        platform_cfg = overlay_configs.get(platform_name, overlay_configs["instagram"])

        for text_key in ["title", "hook", "cta"]:
            if text_key in texts and texts[text_key]:
                cfg = platform_cfg.get(text_key, {})
                overlays.append(
                    TextOverlay(
                        text=texts[text_key],
                        position=cfg.get("position", "center"),
                        style=cfg.get("style", "default"),
                        max_width_percent=cfg.get("max_width_percent", 80),
                    )
                )

        return overlays

    def _build_image_prompt(
        self,
        keyword: str,
        platform_name: str,
        texts: dict[str, str],
    ) -> str:
        """
        Construye el prompt para generacion de imagen con IA.

        Combina la keyword, plataforma y contexto del contenido
        en un prompt optimizado para modelos text-to-image.

        Args:
            keyword: Keyword del contenido.
            platform_name: Nombre de la plataforma.
            texts: Textos extraidos del script.

        Returns:
            Prompt en ingles optimizado para generacion de imagen.
        """
        category = self._detect_category(keyword)

        # Mapeo de estilo visual por plataforma
        platform_visual_style: dict[str, str] = {
            "tiktok": "vibrant vertical social media thumbnail, eye-catching, bold colors, dynamic composition, Gen-Z aesthetic",
            "facebook": "professional social media banner, clean layout, engaging, shareable content imagery",
            "instagram": "aesthetic Instagram post, visually stunning, lifestyle photography style, cohesive feed aesthetic",
            "youtube": "YouTube thumbnail, high contrast, expressive, click-worthy, professional video thumbnail",
            "blog": "professional blog hero image, clean, editorial style, high quality stock photo feel",
        }

        # Mapeo de estilo visual por categoria
        category_visual_context: dict[str, str] = {
            "tecnologia": "modern technology, gadgets, circuits, sleek devices, futuristic glow",
            "belleza": "beauty products, soft lighting, elegant cosmetics, korean skincare aesthetic",
            "hogar": "cozy home interior, organized space, modern home decor, warm tones",
            "cocina": "kitchen accessories, food preparation, modern cooking utensils, appetizing setup",
            "juguetes": "colorful toys, playful arrangement, fun and creative, child-friendly",
            "moda": "fashion accessories, stylish arrangement, luxury feel, editorial fashion",
            "limpieza": "clean sparkling surfaces, organized home, cleaning products, fresh and bright",
            "gadgets": "innovative gadgets, unboxing style, product showcase, modern technology",
            "regalos": "gift boxes, surprise reveal, festive arrangement, celebration mood",
            "general": "product showcase, clean background, professional product photography",
        }

        visual_style = platform_visual_style.get(platform_name, platform_visual_style["instagram"])
        category_context = category_visual_context.get(category, category_visual_context["general"])

        # Construir prompt
        title_context = texts.get("title", keyword)

        prompt = (
            f"{visual_style}, {category_context}, "
            f"product related to '{keyword}', "
            f"theme: {title_context}, "
            f"high quality, 4k, professional photography, studio lighting, "
            f"no text, no words, no letters, no watermarks, "
            f"clean composition, commercially appealing"
        )

        return prompt

    def _determine_visual_style(self, keyword: str, platform_name: str) -> str:
        """
        Determina el estilo visual general para el brief.

        Args:
            keyword: Keyword del contenido.
            platform_name: Nombre de la plataforma.

        Returns:
            Descripcion del estilo visual.
        """
        category = self._detect_category(keyword)

        style_map: dict[str, str] = {
            "tecnologia": "dark_futuristic",
            "belleza": "soft_elegant",
            "hogar": "warm_cozy",
            "cocina": "bright_appetizing",
            "juguetes": "colorful_playful",
            "moda": "luxury_minimal",
            "limpieza": "fresh_clean",
            "gadgets": "tech_modern",
            "regalos": "festive_vibrant",
            "general": "professional_clean",
        }

        return style_map.get(category, "professional_clean")

    def generate_brief(
        self,
        keyword: str,
        keyword_slug: str,
        platform_name: str,
        script_data: dict[str, Any],
    ) -> DesignBrief:
        """
        Genera un DesignBrief completo para una combinacion keyword/plataforma.

        Args:
            keyword: Keyword original del contenido.
            keyword_slug: Slug URL-safe de la keyword.
            platform_name: Nombre de la plataforma (ej: 'tiktok').
            script_data: Datos JSON del script de Phase 3.

        Returns:
            DesignBrief completo con todas las especificaciones.
        """
        logger.debug(f"Generando brief: {keyword_slug}/{platform_name}")

        # Obtener componentes del brief
        dimensions = self._get_dimensions(platform_name)
        color_palette = self._get_color_palette(keyword)
        typography = PLATFORM_TYPOGRAPHY.get(
            platform_name,
            PLATFORM_TYPOGRAPHY["instagram"],
        )
        composition = PLATFORM_COMPOSITIONS.get(
            platform_name,
            PLATFORM_COMPOSITIONS["instagram"],
        )

        # Extraer textos del script
        texts = self._extract_text_content(script_data, platform_name)

        # Construir overlays y prompt
        text_overlays = self._build_text_overlays(texts, platform_name)
        image_prompt = self._build_image_prompt(keyword, platform_name, texts)
        visual_style = self._determine_visual_style(keyword, platform_name)

        # Construir el brief
        design_spec = DesignSpec(
            dimensions=dimensions,
            color_palette=color_palette,
            typography=typography,
            composition=composition,
            text_overlays=text_overlays,
            image_generation_prompt=image_prompt,
            visual_style=visual_style,
        )

        # Mapear nombre de plataforma a enum
        platform_enum = Platform(platform_name)

        metadata = DesignBriefMetadata(
            keyword=keyword,
            keyword_slug=keyword_slug,
            platform=platform_enum,
            generated_at=datetime.now(timezone.utc),
        )

        return DesignBrief(
            metadata=metadata,
            design_brief=design_spec,
        )

    def _discover_scripts(self) -> list[dict[str, Any]]:
        """
        Descubre todos los scripts generados en Phase 3.

        Busca archivos JSON en output/phase3_scripts/{keyword_slug}/{platform}.json
        y retorna una lista de diccionarios con la informacion necesaria.

        Returns:
            Lista de dicts con claves: keyword, keyword_slug, platform, script_path.
        """
        scripts_found: list[dict[str, Any]] = []

        if not self.scripts_dir.exists():
            logger.warning(f"Directorio de scripts no encontrado: {self.scripts_dir}")
            return scripts_found

        # Iterar por carpetas de keyword
        for keyword_dir in sorted(self.scripts_dir.iterdir()):
            if not keyword_dir.is_dir():
                continue

            keyword_slug = keyword_dir.name

            # Iterar por archivos de plataforma
            for script_file in sorted(keyword_dir.glob("*.json")):
                platform_name = script_file.stem  # tiktok, facebook, etc.

                # Validar que es una plataforma valida
                try:
                    Platform(platform_name)
                except ValueError:
                    logger.debug(f"Archivo ignorado (no es plataforma valida): {script_file}")
                    continue

                scripts_found.append({
                    "keyword_slug": keyword_slug,
                    "platform": platform_name,
                    "script_path": script_file,
                })

        logger.info(f"Scripts descubiertos: {len(scripts_found)}")
        return scripts_found

    def run(self) -> list[DesignBrief]:
        """
        Ejecuta la generacion de briefs para todos los scripts de Phase 3.

        Returns:
            Lista de todos los DesignBrief generados.
        """
        logger.info("=== PHASE 4a: Design Brief Generation START ===")

        scripts = self._discover_scripts()

        if not scripts:
            logger.warning("No se encontraron scripts de Phase 3. Abortando.")
            return []

        briefs_generated: list[DesignBrief] = []
        errors: list[str] = []

        for script_info in scripts:
            keyword_slug = script_info["keyword_slug"]
            platform_name = script_info["platform"]
            script_path = script_info["script_path"]

            try:
                # Leer el script
                script_data = read_json(script_path)

                # Extraer keyword del metadata del script
                keyword = script_data.get("metadata", {}).get("keyword", keyword_slug)

                # Generar el brief
                brief = self.generate_brief(
                    keyword=keyword,
                    keyword_slug=keyword_slug,
                    platform_name=platform_name,
                    script_data=script_data,
                )

                # Guardar el brief
                output_path = self.output_dir / keyword_slug / f"{platform_name}_brief.json"
                ensure_dir(output_path.parent)
                write_json(output_path, brief.model_dump(mode="json"))

                briefs_generated.append(brief)
                logger.info(f"Brief generado: {keyword_slug}/{platform_name}_brief.json")

            except Exception as e:
                error_msg = f"Error generando brief {keyword_slug}/{platform_name}: {e}"
                logger.error(error_msg)
                errors.append(error_msg)

        logger.info("=== PHASE 4a: Design Brief Generation COMPLETADA ===")
        logger.info(f"Briefs generados: {len(briefs_generated)}")
        logger.info(f"Errores: {len(errors)}")

        if errors:
            for err in errors:
                logger.warning(f"  - {err}")

        return briefs_generated


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    generator = BriefGenerator()
    briefs = generator.run()
    print(f"\nPhase 4a completada: {len(briefs)} design briefs generados")
