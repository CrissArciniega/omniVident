"""
Gestor de carpetas en Google Drive para Phase 5.

Crea y gestiona la estructura de carpetas del pipeline en Google Drive
usando PyDrive2 con autenticacion de Service Account.

Estructura creada:
    Content Pipeline/
        {date_str}/
            {keyword_slug}/
                tiktok/
                facebook/
                instagram/
                youtube/
                blog/

Uso programatico:
    from src.phase5_output.folder_manager import DriveFolderManager
    manager = DriveFolderManager()
    manager.authenticate()
    mapping = manager.create_pipeline_structure("2026-02-09", ["gadgets-baratos", "tech-viral"])
"""

import json
import os
from pathlib import Path
from typing import Any

from pydrive2.auth import GoogleAuth, ServiceAccountCredentials
from pydrive2.drive import GoogleDrive

from src.utils.file_helpers import load_yaml_config
from src.utils.json_schemas import Platform
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase5")

# Plataformas esperadas
PLATFORMS = [p.value for p in Platform]


class DriveFolderManager:
    """
    Gestiona la estructura de carpetas del pipeline en Google Drive.

    Usa PyDrive2 con ServiceAccountCredentials para autenticacion
    sin intervencion del usuario. Evita crear carpetas duplicadas
    buscando primero si ya existe una con el mismo nombre en el padre.
    """

    def __init__(self, config_path: str | Path | None = None):
        if config_path is None:
            config_path = Path(__file__).parent.parent.parent / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        drive_cfg = self.config.get("google_drive", {})

        self.root_folder_name = drive_cfg.get("root_folder_name", "Content Pipeline")
        self.service_account_file = drive_cfg.get(
            "service_account_file", "credentials/service_account.json"
        )

        self.drive: GoogleDrive | None = None
        self._folder_cache: dict[str, str] = {}

    # ------------------------------------------------------------------
    # Autenticacion
    # ------------------------------------------------------------------

    def authenticate(self) -> None:
        """
        Autentica con Google Drive usando credenciales de Service Account.

        Las credenciales se buscan en este orden:
        1. Variable de entorno GOOGLE_SERVICE_ACCOUNT_JSON (JSON inline)
        2. Variable de entorno GOOGLE_SERVICE_ACCOUNT_FILE (ruta a archivo)
        3. Ruta configurada en config.yaml (service_account_file)

        Raises:
            FileNotFoundError: Si no se encuentra el archivo de credenciales.
            ValueError: Si no se pueden obtener credenciales de ninguna fuente.
        """
        logger.info("Autenticando con Google Drive (Service Account)...")

        gauth = GoogleAuth()

        # Opcion 1: JSON inline desde variable de entorno
        sa_json = os.environ.get("GOOGLE_SERVICE_ACCOUNT_JSON")
        if sa_json:
            logger.info("Usando credenciales desde GOOGLE_SERVICE_ACCOUNT_JSON")
            sa_info = json.loads(sa_json)
            credentials = ServiceAccountCredentials.from_json_keyfile_dict(
                sa_info,
                scopes=["https://www.googleapis.com/auth/drive"],
            )
            gauth.credentials = credentials
            self.drive = GoogleDrive(gauth)
            logger.info("Autenticacion exitosa (JSON inline)")
            return

        # Opcion 2: Ruta desde variable de entorno
        sa_file_env = os.environ.get("GOOGLE_SERVICE_ACCOUNT_FILE")
        if sa_file_env:
            sa_path = Path(sa_file_env)
        else:
            # Opcion 3: Ruta desde config.yaml
            sa_path = Path(self.service_account_file)

        if not sa_path.exists():
            # Intentar ruta relativa al proyecto
            project_root = Path(__file__).parent.parent.parent
            sa_path = project_root / self.service_account_file

        if not sa_path.exists():
            raise FileNotFoundError(
                f"Archivo de credenciales de Service Account no encontrado. "
                f"Buscado en: {sa_path}. Configura GOOGLE_SERVICE_ACCOUNT_JSON "
                f"(env), GOOGLE_SERVICE_ACCOUNT_FILE (env), o la ruta en config.yaml."
            )

        logger.info(f"Usando credenciales desde archivo: {sa_path}")
        credentials = ServiceAccountCredentials.from_json_keyfile_name(
            str(sa_path),
            scopes=["https://www.googleapis.com/auth/drive"],
        )
        gauth.credentials = credentials
        self.drive = GoogleDrive(gauth)
        logger.info("Autenticacion exitosa (archivo)")

    def _ensure_authenticated(self) -> GoogleDrive:
        """Verifica que el cliente de Drive esta autenticado."""
        if self.drive is None:
            raise RuntimeError(
                "No autenticado con Google Drive. Llama a authenticate() primero."
            )
        return self.drive

    # ------------------------------------------------------------------
    # Operaciones de carpetas
    # ------------------------------------------------------------------

    @retry(max_attempts=3, base_delay=2.0, exceptions=(Exception,))
    def _list_children(self, parent_id: str | None, name: str) -> list[Any]:
        """
        Lista carpetas hijas que coincidan con un nombre dentro de un padre.

        Args:
            parent_id: ID de la carpeta padre. None para raiz.
            name: Nombre exacto de la carpeta a buscar.

        Returns:
            Lista de archivos que coinciden.
        """
        drive = self._ensure_authenticated()

        escaped_name = name.replace("'", "\\'")

        if parent_id:
            query = (
                f"title='{escaped_name}' and "
                f"'{parent_id}' in parents and "
                f"mimeType='application/vnd.google-apps.folder' and "
                f"trashed=false"
            )
        else:
            query = (
                f"title='{escaped_name}' and "
                f"'root' in parents and "
                f"mimeType='application/vnd.google-apps.folder' and "
                f"trashed=false"
            )

        file_list = drive.ListFile({"q": query}).GetList()
        return file_list

    @retry(max_attempts=3, base_delay=2.0, exceptions=(Exception,))
    def _create_folder_api(self, name: str, parent_id: str | None) -> str:
        """
        Crea una carpeta en Google Drive via API.

        Args:
            name: Nombre de la carpeta.
            parent_id: ID de la carpeta padre. None para raiz.

        Returns:
            ID de la carpeta creada.
        """
        drive = self._ensure_authenticated()

        metadata: dict[str, Any] = {
            "title": name,
            "mimeType": "application/vnd.google-apps.folder",
        }

        if parent_id:
            metadata["parents"] = [{"id": parent_id}]

        folder = drive.CreateFile(metadata)
        folder.Upload()

        folder_id = folder["id"]
        logger.info(f"Carpeta creada: '{name}' (id={folder_id})")
        return folder_id

    def find_or_create_folder(self, name: str, parent_id: str | None = None) -> str:
        """
        Busca una carpeta por nombre dentro de un padre. Si no existe, la crea.

        Mantiene un cache interno para evitar llamadas redundantes a la API.

        Args:
            name: Nombre de la carpeta.
            parent_id: ID de la carpeta padre. None para buscar en raiz.

        Returns:
            ID de la carpeta encontrada o creada.
        """
        cache_key = f"{parent_id or 'root'}/{name}"

        if cache_key in self._folder_cache:
            logger.debug(f"Cache hit para carpeta: {cache_key}")
            return self._folder_cache[cache_key]

        # Buscar si ya existe
        existing = self._list_children(parent_id, name)
        if existing:
            folder_id = existing[0]["id"]
            logger.debug(f"Carpeta existente encontrada: '{name}' (id={folder_id})")
            self._folder_cache[cache_key] = folder_id
            return folder_id

        # Crear nueva
        folder_id = self._create_folder_api(name, parent_id)
        self._folder_cache[cache_key] = folder_id
        return folder_id

    def create_pipeline_structure(
        self,
        date_str: str,
        keyword_slugs: list[str],
    ) -> dict[str, str]:
        """
        Crea la estructura completa de carpetas del pipeline en Google Drive.

        Estructura:
            {root_folder_name}/
                {date_str}/
                    {keyword_slug}/
                        tiktok/
                        facebook/
                        instagram/
                        youtube/
                        blog/

        Args:
            date_str: Fecha de la ejecucion (ej: "2026-02-09").
            keyword_slugs: Lista de slugs de keywords a crear.

        Returns:
            Diccionario mapeando "{keyword_slug}/{platform}" -> folder_id.
            Tambien incluye claves especiales:
                "_root" -> ID de la carpeta raiz del pipeline
                "_date" -> ID de la carpeta de la fecha
                "{keyword_slug}" -> ID de la carpeta de la keyword
        """
        logger.info(
            f"Creando estructura de carpetas: {len(keyword_slugs)} keywords, "
            f"fecha={date_str}"
        )

        mapping: dict[str, str] = {}

        # Carpeta raiz del pipeline
        root_id = self.find_or_create_folder(self.root_folder_name, parent_id=None)
        mapping["_root"] = root_id

        # Carpeta de la fecha
        date_id = self.find_or_create_folder(date_str, parent_id=root_id)
        mapping["_date"] = date_id

        # Carpetas por keyword y plataforma
        for slug in keyword_slugs:
            keyword_id = self.find_or_create_folder(slug, parent_id=date_id)
            mapping[slug] = keyword_id

            for platform in PLATFORMS:
                platform_id = self.find_or_create_folder(platform, parent_id=keyword_id)
                key = f"{slug}/{platform}"
                mapping[key] = platform_id
                logger.debug(f"Carpeta mapeada: {key} -> {platform_id}")

        logger.info(
            f"Estructura de carpetas creada: {len(mapping)} carpetas total"
        )
        return mapping
