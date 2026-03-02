"""
Organizador local de archivos de Phase 5.

Lee todos los outputs de las fases anteriores (phase1_raw, phase2_ranked,
phase3_scripts, phase4_designs) y los organiza en una estructura limpia
bajo output/phase5_final/{date}/{keyword_slug}/{platform}/.

Tambien genera resumenes Markdown por keyword y un indice general.

Uso directo:
    python -m src.phase5_output.local_saver

Uso programatico:
    from src.phase5_output.local_saver import LocalSaver
    saver = LocalSaver()
    result = saver.run()
"""

import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.utils.file_helpers import (
    ensure_dir,
    get_date_str,
    load_yaml_config,
    read_json,
    write_json,
    write_markdown,
)
from src.utils.json_schemas import Platform
from src.utils.logger import setup_logger

logger = setup_logger(__name__, phase="phase5")

# Plataformas esperadas (en el orden de presentacion)
PLATFORMS = [p.value for p in Platform]


class LocalSaver:
    """
    Organiza los outputs del pipeline en una estructura final limpia.

    Estructura generada:
        output/phase5_final/{date}/
            _index.md                        # Resumen general
            {keyword_slug}/
                resumen.md                   # Resumen de la keyword
                tiktok/
                    script.json
                    design_brief.json
                    thumbnail.png
                facebook/
                    script.json
                    design_brief.json
                    thumbnail.png
                ... (demas plataformas)
    """

    def __init__(self, config_path: str | Path | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        output_cfg = self.config.get("output", {})

        self.phase1_dir = Path(output_cfg.get("phase1_dir", "output/phase1_raw"))
        self.phase2_dir = Path(output_cfg.get("phase2_dir", "output/phase2_ranked"))
        self.phase3_dir = Path(output_cfg.get("phase3_dir", "output/phase3_scripts"))
        self.phase4_dir = Path(output_cfg.get("phase4_dir", "output/phase4_designs"))
        self.phase5_dir = Path(output_cfg.get("phase5_dir", "output/phase5_final"))

    # ------------------------------------------------------------------
    # Lectura de datos de fases anteriores
    # ------------------------------------------------------------------

    def _load_ranked_keywords(self) -> list[dict[str, Any]]:
        """Carga las top keywords rankeadas de Phase 2."""
        ranked_file = self.phase2_dir / "top_keywords.json"
        if not ranked_file.exists():
            logger.warning(f"Archivo de keywords rankeadas no encontrado: {ranked_file}")
            return []

        data = read_json(ranked_file)
        return data.get("top_keywords", [])

    def _find_script(self, keyword_slug: str, platform: str) -> Path | None:
        """Busca el archivo de script de Phase 3 para una keyword/plataforma."""
        pattern = f"{keyword_slug}_{platform}*.json"
        matches = list(self.phase3_dir.glob(pattern))
        if matches:
            return matches[0]

        # Busqueda alternativa: subdirectorio por keyword
        alt_dir = self.phase3_dir / keyword_slug
        if alt_dir.is_dir():
            matches = list(alt_dir.glob(f"{platform}*.json"))
            if matches:
                return matches[0]

        return None

    def _find_design_brief(self, keyword_slug: str, platform: str) -> Path | None:
        """Busca el archivo de design brief de Phase 4 para una keyword/plataforma."""
        pattern = f"{keyword_slug}_{platform}*brief*.json"
        matches = list(self.phase4_dir.glob(pattern))
        if matches:
            return matches[0]

        # Busqueda alternativa sin "brief" en el nombre
        pattern_alt = f"{keyword_slug}_{platform}*.json"
        matches = list(self.phase4_dir.glob(pattern_alt))
        if matches:
            return matches[0]

        # Busqueda en subdirectorio
        alt_dir = self.phase4_dir / keyword_slug
        if alt_dir.is_dir():
            matches = list(alt_dir.glob(f"{platform}*brief*.json"))
            if not matches:
                matches = list(alt_dir.glob(f"{platform}*.json"))
            if matches:
                return matches[0]

        return None

    def _find_thumbnail(self, keyword_slug: str, platform: str) -> Path | None:
        """Busca el archivo de thumbnail de Phase 4 para una keyword/plataforma."""
        for ext in ("png", "jpg", "jpeg", "webp"):
            pattern = f"{keyword_slug}_{platform}*.{ext}"
            matches = list(self.phase4_dir.glob(pattern))
            if matches:
                return matches[0]

            # Subdirectorio
            alt_dir = self.phase4_dir / keyword_slug
            if alt_dir.is_dir():
                matches = list(alt_dir.glob(f"{platform}*.{ext}"))
                if matches:
                    return matches[0]

        return None

    # ------------------------------------------------------------------
    # Copia de archivos a estructura final
    # ------------------------------------------------------------------

    def _copy_file(self, src: Path, dest: Path) -> bool:
        """Copia un archivo de src a dest, creando directorios necesarios."""
        try:
            ensure_dir(dest.parent)
            shutil.copy2(str(src), str(dest))
            logger.debug(f"Copiado: {src} -> {dest}")
            return True
        except Exception as e:
            logger.error(f"Error copiando {src} -> {dest}: {e}")
            return False

    def _organize_keyword(
        self,
        keyword_data: dict[str, Any],
        date_dir: Path,
    ) -> dict[str, Any]:
        """
        Organiza todos los archivos de una keyword en la estructura final.

        Returns:
            Diccionario con estadisticas de la keyword procesada.
        """
        keyword = keyword_data.get("keyword", "desconocido")
        slug = keyword_data.get("slug", keyword.replace(" ", "-").lower())
        keyword_dir = date_dir / slug

        stats: dict[str, Any] = {
            "keyword": keyword,
            "slug": slug,
            "platforms": {},
        }

        for platform in PLATFORMS:
            platform_dir = keyword_dir / platform
            platform_stats: dict[str, Any] = {
                "script": False,
                "design_brief": False,
                "thumbnail": False,
            }

            # Script JSON
            script_src = self._find_script(slug, platform)
            if script_src:
                dest = platform_dir / "script.json"
                if self._copy_file(script_src, dest):
                    platform_stats["script"] = True
                    platform_stats["script_path"] = str(dest)

            # Design brief JSON
            brief_src = self._find_design_brief(slug, platform)
            if brief_src:
                dest = platform_dir / "design_brief.json"
                if self._copy_file(brief_src, dest):
                    platform_stats["design_brief"] = True
                    platform_stats["design_brief_path"] = str(dest)

            # Thumbnail
            thumb_src = self._find_thumbnail(slug, platform)
            if thumb_src:
                ext = thumb_src.suffix
                dest = platform_dir / f"thumbnail{ext}"
                if self._copy_file(thumb_src, dest):
                    platform_stats["thumbnail"] = True
                    platform_stats["thumbnail_path"] = str(dest)

            stats["platforms"][platform] = platform_stats

        return stats

    # ------------------------------------------------------------------
    # Generacion de reportes Markdown
    # ------------------------------------------------------------------

    def _generate_keyword_summary(
        self,
        keyword_data: dict[str, Any],
        stats: dict[str, Any],
        date_dir: Path,
    ) -> Path:
        """
        Genera un resumen Markdown para una keyword con todo su contenido.

        Returns:
            Path al archivo Markdown generado.
        """
        keyword = stats["keyword"]
        slug = stats["slug"]
        keyword_dir = date_dir / slug

        lines: list[str] = []
        lines.append(f"# {keyword}")
        lines.append("")
        lines.append(f"**Slug:** `{slug}`")

        # Datos de ranking si estan disponibles
        if "weighted_total" in keyword_data:
            lines.append(f"**Score total:** {keyword_data['weighted_total']:.1f}")
        if "rank" in keyword_data:
            lines.append(f"**Ranking:** #{keyword_data['rank']}")
        if "source_count" in keyword_data:
            lines.append(f"**Fuentes encontrada en:** {keyword_data['source_count']}")
        if "sources_found_in" in keyword_data:
            sources = ", ".join(keyword_data["sources_found_in"])
            lines.append(f"**Fuentes:** {sources}")

        lines.append("")
        lines.append("---")
        lines.append("")

        # Detalle por plataforma
        for platform in PLATFORMS:
            p_stats = stats["platforms"].get(platform, {})
            has_content = any([
                p_stats.get("script"),
                p_stats.get("design_brief"),
                p_stats.get("thumbnail"),
            ])

            lines.append(f"## {platform.upper()}")
            lines.append("")

            if not has_content:
                lines.append("_Sin contenido generado para esta plataforma._")
                lines.append("")
                continue

            # Intentar extraer info del script para el resumen
            script_path = keyword_dir / platform / "script.json"
            if script_path.exists():
                try:
                    script_data = read_json(script_path)
                    content = script_data.get("content", {})

                    # Mostrar hook si existe
                    hook = content.get("hook", "")
                    if hook:
                        lines.append(f"**Hook:** {hook}")
                        lines.append("")

                    # Mostrar hashtags si existen
                    hashtags = content.get("hashtags", content.get("all_hashtags", []))
                    if hashtags:
                        lines.append(f"**Hashtags:** {' '.join(hashtags[:10])}")
                        lines.append("")

                    # Mostrar titulo si existe (YouTube/Blog)
                    title = content.get("title", content.get("meta_title", ""))
                    if title:
                        lines.append(f"**Titulo:** {title}")
                        lines.append("")

                except Exception as e:
                    logger.debug(f"No se pudo leer script para resumen: {e}")

            # Estado de archivos
            archivos: list[str] = []
            if p_stats.get("script"):
                archivos.append("script.json")
            if p_stats.get("design_brief"):
                archivos.append("design_brief.json")
            if p_stats.get("thumbnail"):
                archivos.append("thumbnail.png")
            lines.append(f"**Archivos:** {', '.join(archivos)}")
            lines.append("")

        md_content = "\n".join(lines)
        md_path = keyword_dir / "resumen.md"
        write_markdown(md_path, md_content)

        logger.info(f"Resumen Markdown generado: {md_path}")
        return md_path

    def _generate_index_report(
        self,
        all_stats: list[dict[str, Any]],
        date_str: str,
        date_dir: Path,
    ) -> Path:
        """
        Genera un reporte indice general con todas las keywords y estadisticas.

        Returns:
            Path al archivo _index.md generado.
        """
        lines: list[str] = []
        lines.append("# Content Pipeline - Reporte de Ejecucion")
        lines.append("")
        lines.append(f"**Fecha:** {date_str}")
        lines.append(f"**Total keywords procesadas:** {len(all_stats)}")
        lines.append(f"**Plataformas:** {', '.join(PLATFORMS)}")
        lines.append("")

        # Estadisticas globales
        total_scripts = 0
        total_briefs = 0
        total_thumbnails = 0
        total_files = 0

        for kw_stats in all_stats:
            for platform, p_stats in kw_stats.get("platforms", {}).items():
                if p_stats.get("script"):
                    total_scripts += 1
                    total_files += 1
                if p_stats.get("design_brief"):
                    total_briefs += 1
                    total_files += 1
                if p_stats.get("thumbnail"):
                    total_thumbnails += 1
                    total_files += 1

        lines.append("## Estadisticas Globales")
        lines.append("")
        lines.append(f"| Metrica | Valor |")
        lines.append(f"|---------|-------|")
        lines.append(f"| Keywords | {len(all_stats)} |")
        lines.append(f"| Scripts generados | {total_scripts} |")
        lines.append(f"| Design briefs generados | {total_briefs} |")
        lines.append(f"| Thumbnails generados | {total_thumbnails} |")
        lines.append(f"| Total archivos | {total_files} |")
        lines.append("")
        lines.append("---")
        lines.append("")

        # Tabla de keywords
        lines.append("## Keywords Procesadas")
        lines.append("")
        lines.append("| # | Keyword | Slug | Scripts | Briefs | Thumbs |")
        lines.append("|---|---------|------|---------|--------|--------|")

        for idx, kw_stats in enumerate(all_stats, 1):
            keyword = kw_stats.get("keyword", "?")
            slug = kw_stats.get("slug", "?")

            kw_scripts = sum(
                1 for p in kw_stats.get("platforms", {}).values() if p.get("script")
            )
            kw_briefs = sum(
                1 for p in kw_stats.get("platforms", {}).values() if p.get("design_brief")
            )
            kw_thumbs = sum(
                1 for p in kw_stats.get("platforms", {}).values() if p.get("thumbnail")
            )

            lines.append(
                f"| {idx} | {keyword} | `{slug}` | "
                f"{kw_scripts}/{len(PLATFORMS)} | "
                f"{kw_briefs}/{len(PLATFORMS)} | "
                f"{kw_thumbs}/{len(PLATFORMS)} |"
            )

        lines.append("")
        lines.append("---")
        lines.append("")

        # Detalle por keyword con links
        lines.append("## Detalle por Keyword")
        lines.append("")
        for kw_stats in all_stats:
            slug = kw_stats.get("slug", "?")
            keyword = kw_stats.get("keyword", "?")
            lines.append(f"### {keyword}")
            lines.append(f"Directorio: `{slug}/`")
            lines.append("")

            for platform in PLATFORMS:
                p_stats = kw_stats.get("platforms", {}).get(platform, {})
                has_any = any([
                    p_stats.get("script"),
                    p_stats.get("design_brief"),
                    p_stats.get("thumbnail"),
                ])
                status = "OK" if has_any else "---"
                lines.append(f"- **{platform}**: {status}")

            lines.append("")

        lines.append("---")
        lines.append(f"_Generado automaticamente el {datetime.now(timezone.utc).isoformat()}_")

        md_content = "\n".join(lines)
        index_path = date_dir / "_index.md"
        write_markdown(index_path, md_content)

        logger.info(f"Reporte indice generado: {index_path}")
        return index_path

    # ------------------------------------------------------------------
    # Ejecucion principal
    # ------------------------------------------------------------------

    def run(self, date_str: str | None = None) -> dict[str, Any]:
        """
        Ejecuta la organizacion completa de archivos.

        Args:
            date_str: Fecha a usar para el directorio. Si no se proporciona,
                      se usa la fecha actual UTC.

        Returns:
            Diccionario con:
                - date_str: Fecha usada
                - final_dir: Path del directorio final
                - keywords_processed: Numero de keywords procesadas
                - all_stats: Lista de estadisticas por keyword
        """
        if date_str is None:
            date_str = get_date_str()

        logger.info(f"=== PHASE 5: Organizacion local START (fecha={date_str}) ===")

        date_dir = self.phase5_dir / date_str
        ensure_dir(date_dir)

        # Cargar keywords rankeadas
        ranked_keywords = self._load_ranked_keywords()
        if not ranked_keywords:
            logger.warning("No se encontraron keywords rankeadas. Nada que organizar.")
            return {
                "date_str": date_str,
                "final_dir": str(date_dir),
                "keywords_processed": 0,
                "all_stats": [],
            }

        logger.info(f"Keywords rankeadas encontradas: {len(ranked_keywords)}")

        # Procesar cada keyword
        all_stats: list[dict[str, Any]] = []

        for kw_data in ranked_keywords:
            keyword = kw_data.get("keyword", "desconocido")
            slug = kw_data.get("slug", "")

            logger.info(f"Organizando keyword: '{keyword}' (slug={slug})")

            try:
                stats = self._organize_keyword(kw_data, date_dir)
                all_stats.append(stats)

                # Generar resumen Markdown para esta keyword
                self._generate_keyword_summary(kw_data, stats, date_dir)

            except Exception as e:
                logger.error(f"Error organizando keyword '{keyword}': {e}")
                all_stats.append({
                    "keyword": keyword,
                    "slug": slug,
                    "platforms": {},
                    "error": str(e),
                })

        # Generar reporte indice general
        self._generate_index_report(all_stats, date_str, date_dir)

        # Guardar estadisticas como JSON
        stats_output = {
            "date_str": date_str,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "keywords_processed": len(all_stats),
            "stats": all_stats,
        }
        write_json(date_dir / "stats.json", stats_output)

        logger.info(f"=== PHASE 5: Organizacion local COMPLETADA ===")
        logger.info(f"Keywords procesadas: {len(all_stats)}")
        logger.info(f"Directorio final: {date_dir}")

        return {
            "date_str": date_str,
            "final_dir": str(date_dir),
            "keywords_processed": len(all_stats),
            "all_stats": all_stats,
        }


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    saver = LocalSaver()
    result = saver.run()
    print(f"\nPhase 5 (local) completada: {result['keywords_processed']} keywords organizadas")
    print(f"Directorio: {result['final_dir']}")
