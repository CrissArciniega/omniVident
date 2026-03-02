"""
Subida de archivos a Google Drive para Phase 5.

Toma la estructura organizada en output/phase5_final/{date}/ y sube todos
los archivos a las carpetas correspondientes en Google Drive, usando
DriveFolderManager para la creacion de carpetas.

Registra todas las URLs de archivos subidos en upload_log.json.

Uso directo:
    python -m src.phase5_output.drive_uploader

Uso programatico:
    from src.phase5_output.drive_uploader import DriveUploader
    uploader = DriveUploader()
    result = uploader.upload_all(Path("output/phase5_final/2026-02-09"))
"""

from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.phase5_output.folder_manager import DriveFolderManager
from src.utils.file_helpers import (
    ensure_dir,
    get_date_str,
    load_yaml_config,
    read_json,
    write_json,
)
from src.utils.json_schemas import Platform
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase5")

# Plataformas esperadas
PLATFORMS = [p.value for p in Platform]

# Extensiones de archivos reconocidos para subir
UPLOAD_EXTENSIONS = {".json", ".md", ".png", ".jpg", ".jpeg", ".webp", ".txt"}


class DriveUploader:
    """
    Sube los archivos organizados del pipeline a Google Drive.

    Usa DriveFolderManager para crear/encontrar las carpetas necesarias
    y sube cada archivo a su carpeta correspondiente. Registra todas
    las URLs en un log JSON.
    """

    def __init__(self, config_path: str | Path | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        output_cfg = self.config.get("output", {})
        self.phase5_dir = Path(output_cfg.get("phase5_dir", "output/phase5_final"))

        self.folder_manager = DriveFolderManager(config_path)

    # ------------------------------------------------------------------
    # Operaciones de subida
    # ------------------------------------------------------------------

    @retry(max_attempts=3, base_delay=5.0, exceptions=(Exception,))
    def upload_file(
        self,
        local_path: Path,
        folder_id: str,
        filename: str | None = None,
    ) -> str:
        """
        Sube un archivo local a una carpeta de Google Drive.

        Args:
            local_path: Ruta al archivo local.
            folder_id: ID de la carpeta destino en Google Drive.
            filename: Nombre del archivo en Drive. Si no se proporciona,
                      se usa el nombre del archivo local.

        Returns:
            URL publica del archivo subido en Google Drive.

        Raises:
            FileNotFoundError: Si el archivo local no existe.
            RuntimeError: Si no se ha autenticado con Drive.
        """
        if not local_path.exists():
            raise FileNotFoundError(f"Archivo local no encontrado: {local_path}")

        drive = self.folder_manager._ensure_authenticated()

        if filename is None:
            filename = local_path.name

        file_metadata = {
            "title": filename,
            "parents": [{"id": folder_id}],
        }

        drive_file = drive.CreateFile(file_metadata)
        drive_file.SetContentFile(str(local_path))
        drive_file.Upload()

        file_id = drive_file["id"]
        file_url = f"https://drive.google.com/file/d/{file_id}/view"

        logger.info(f"Subido: {local_path.name} -> {file_url}")
        return file_url

    def _discover_files(self, final_dir: Path) -> list[dict[str, Any]]:
        """
        Descubre todos los archivos a subir en la estructura local.

        Recorre la estructura:
            final_dir/
                {keyword_slug}/
                    {platform}/
                        archivo.ext

        Returns:
            Lista de dicts con: keyword_slug, platform, local_path, filename.
        """
        files_to_upload: list[dict[str, Any]] = []

        if not final_dir.exists():
            logger.warning(f"Directorio final no encontrado: {final_dir}")
            return files_to_upload

        # Recorrer subdirectorios de keywords
        for keyword_dir in sorted(final_dir.iterdir()):
            if not keyword_dir.is_dir():
                continue

            keyword_slug = keyword_dir.name

            # Saltar directorios especiales que empiezan con _
            if keyword_slug.startswith("_"):
                continue

            # Recorrer subdirectorios de plataformas
            for platform_dir in sorted(keyword_dir.iterdir()):
                if not platform_dir.is_dir():
                    # Archivos sueltos en el directorio de keyword (ej: resumen.md)
                    if platform_dir.suffix.lower() in UPLOAD_EXTENSIONS:
                        files_to_upload.append({
                            "keyword_slug": keyword_slug,
                            "platform": None,
                            "local_path": platform_dir,
                            "filename": platform_dir.name,
                            "level": "keyword",
                        })
                    continue

                platform = platform_dir.name

                # Recorrer archivos de la plataforma
                for file_path in sorted(platform_dir.iterdir()):
                    if file_path.is_file() and file_path.suffix.lower() in UPLOAD_EXTENSIONS:
                        files_to_upload.append({
                            "keyword_slug": keyword_slug,
                            "platform": platform,
                            "local_path": file_path,
                            "filename": file_path.name,
                            "level": "platform",
                        })

        # Archivos en la raiz del directorio de fecha (ej: _index.md, stats.json)
        for file_path in sorted(final_dir.iterdir()):
            if file_path.is_file() and file_path.suffix.lower() in UPLOAD_EXTENSIONS:
                files_to_upload.append({
                    "keyword_slug": None,
                    "platform": None,
                    "local_path": file_path,
                    "filename": file_path.name,
                    "level": "root",
                })

        return files_to_upload

    def upload_all(self, final_dir: Path) -> dict[str, Any]:
        """
        Sube todos los archivos de la estructura local a Google Drive.

        Recorre output/phase5_final/{date}/ y sube cada archivo a la
        carpeta correspondiente en Drive, creando la estructura de
        carpetas si no existe.

        Args:
            final_dir: Path al directorio de fecha en phase5_final.
                       Ej: Path("output/phase5_final/2026-02-09")

        Returns:
            Diccionario con:
                - date_str: Fecha del directorio
                - total_files: Archivos descubiertos
                - uploaded: Numero de archivos subidos exitosamente
                - failed: Numero de archivos que fallaron
                - upload_log: Lista de dicts con info de cada archivo
        """
        date_str = final_dir.name

        logger.info(f"=== DRIVE UPLOAD START (fecha={date_str}) ===")

        # Autenticar
        self.folder_manager.authenticate()

        # Descubrir archivos
        files_to_upload = self._discover_files(final_dir)
        logger.info(f"Archivos descubiertos para subir: {len(files_to_upload)}")

        if not files_to_upload:
            logger.warning("No se encontraron archivos para subir.")
            return {
                "date_str": date_str,
                "total_files": 0,
                "uploaded": 0,
                "failed": 0,
                "upload_log": [],
            }

        # Obtener lista unica de keyword_slugs para crear estructura
        keyword_slugs = sorted(set(
            f["keyword_slug"]
            for f in files_to_upload
            if f["keyword_slug"] is not None
        ))

        # Crear estructura de carpetas en Drive
        logger.info(f"Creando estructura de carpetas para {len(keyword_slugs)} keywords...")
        folder_mapping = self.folder_manager.create_pipeline_structure(
            date_str, keyword_slugs
        )

        # Subir archivos
        upload_log: list[dict[str, Any]] = []
        uploaded_count = 0
        failed_count = 0

        for file_info in files_to_upload:
            local_path = file_info["local_path"]
            keyword_slug = file_info["keyword_slug"]
            platform = file_info["platform"]
            filename = file_info["filename"]
            level = file_info["level"]

            # Determinar carpeta destino en Drive
            if level == "root":
                # Archivos en la raiz de la fecha
                target_folder_id = folder_mapping.get("_date")
            elif level == "keyword":
                # Archivos en el directorio de keyword (ej: resumen.md)
                target_folder_id = folder_mapping.get(keyword_slug)
            elif level == "platform" and keyword_slug and platform:
                # Archivos en directorio de plataforma
                key = f"{keyword_slug}/{platform}"
                target_folder_id = folder_mapping.get(key)
            else:
                logger.warning(
                    f"No se pudo determinar carpeta destino para: {local_path}"
                )
                failed_count += 1
                upload_log.append({
                    "file": str(local_path),
                    "filename": filename,
                    "keyword_slug": keyword_slug,
                    "platform": platform,
                    "status": "error",
                    "error": "No se pudo determinar carpeta destino",
                    "url": None,
                })
                continue

            if not target_folder_id:
                logger.warning(
                    f"Carpeta destino no encontrada en mapping para: "
                    f"keyword={keyword_slug}, platform={platform}"
                )
                failed_count += 1
                upload_log.append({
                    "file": str(local_path),
                    "filename": filename,
                    "keyword_slug": keyword_slug,
                    "platform": platform,
                    "status": "error",
                    "error": "Carpeta destino no encontrada en mapping",
                    "url": None,
                })
                continue

            # Intentar subir (errores por archivo no detienen el proceso)
            try:
                file_url = self.upload_file(local_path, target_folder_id, filename)
                uploaded_count += 1
                upload_log.append({
                    "file": str(local_path),
                    "filename": filename,
                    "keyword_slug": keyword_slug,
                    "platform": platform,
                    "status": "ok",
                    "error": None,
                    "url": file_url,
                })
                logger.info(
                    f"[{uploaded_count}/{len(files_to_upload)}] "
                    f"Subido: {filename} -> {file_url}"
                )

            except Exception as e:
                failed_count += 1
                logger.error(
                    f"Error subiendo {local_path}: {e}"
                )
                upload_log.append({
                    "file": str(local_path),
                    "filename": filename,
                    "keyword_slug": keyword_slug,
                    "platform": platform,
                    "status": "error",
                    "error": str(e),
                    "url": None,
                })

        # Escribir log de subida
        result = {
            "date_str": date_str,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "total_files": len(files_to_upload),
            "uploaded": uploaded_count,
            "failed": failed_count,
            "upload_log": upload_log,
        }

        log_path = final_dir / "upload_log.json"
        write_json(log_path, result)
        logger.info(f"Upload log escrito: {log_path}")

        # Resumen de URLs
        successful_urls = [
            entry for entry in upload_log if entry["status"] == "ok"
        ]
        for entry in successful_urls:
            logger.info(f"  URL: {entry['url']} ({entry['filename']})")

        logger.info(f"=== DRIVE UPLOAD COMPLETADO ===")
        logger.info(
            f"Resultados: {uploaded_count} subidos, "
            f"{failed_count} fallidos de {len(files_to_upload)} total"
        )

        return result


# Entry point para ejecucion directa
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    uploader = DriveUploader()

    # Buscar el directorio mas reciente en phase5_final
    phase5_dir = Path(uploader.phase5_dir)

    if not phase5_dir.exists():
        print(f"Error: Directorio {phase5_dir} no existe.")
        print("Ejecuta primero: python -m src.phase5_output.local_saver")
        exit(1)

    # Encontrar el subdirectorio de fecha mas reciente
    date_dirs = sorted(
        [d for d in phase5_dir.iterdir() if d.is_dir()],
        reverse=True,
    )

    if not date_dirs:
        print(f"Error: No se encontraron directorios de fecha en {phase5_dir}")
        print("Ejecuta primero: python -m src.phase5_output.local_saver")
        exit(1)

    latest_dir = date_dirs[0]
    print(f"Subiendo desde: {latest_dir}")

    result = uploader.upload_all(latest_dir)

    print(f"\nDrive upload completado:")
    print(f"  Archivos subidos: {result['uploaded']}")
    print(f"  Archivos fallidos: {result['failed']}")
    print(f"  Total: {result['total_files']}")
    print(f"  Log: {latest_dir / 'upload_log.json'}")
