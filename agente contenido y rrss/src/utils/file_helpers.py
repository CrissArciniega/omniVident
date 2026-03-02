"""
Utilidades de manejo de archivos y directorios.

Proporciona funciones seguras para:
- Creacion de directorios
- Escritura/lectura atomica de JSON
- Escritura de Markdown
- Generacion de IDs de ejecucion del pipeline

Uso:
    from src.utils.file_helpers import ensure_dir, write_json, read_json, get_run_id

    ensure_dir("output/phase1_raw")
    write_json("output/data.json", {"key": "value"})
    data = read_json("output/data.json")
    run_id = get_run_id()  # "run_20260209_143000"
"""

import json
import os
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from src.utils.logger import setup_logger

logger = setup_logger(__name__)


def ensure_dir(path: str | Path) -> Path:
    """
    Crea un directorio y todos sus padres si no existen.

    Args:
        path: Ruta del directorio a crear.

    Returns:
        Path del directorio creado/existente.
    """
    dir_path = Path(path)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def write_json(
    path: str | Path,
    data: Any,
    atomic: bool = True,
    indent: int = 2,
) -> Path:
    """
    Escribe datos como JSON a un archivo.

    Si atomic=True, escribe primero a un archivo temporal y luego
    lo renombra, evitando archivos corruptos si el proceso se interrumpe.

    Args:
        path: Ruta del archivo destino.
        data: Datos a serializar como JSON.
        atomic: Si True, usa escritura atomica (recomendado).
        indent: Niveles de indentacion en el JSON.

    Returns:
        Path del archivo escrito.
    """
    file_path = Path(path)
    ensure_dir(file_path.parent)

    json_str = json.dumps(data, ensure_ascii=False, indent=indent, default=_json_serializer)

    if atomic:
        # Escribir a archivo temporal, luego renombrar
        fd, tmp_path = tempfile.mkstemp(
            dir=str(file_path.parent),
            suffix=".tmp",
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(json_str)
            # Renombrar atomicamente (en el mismo filesystem)
            os.replace(tmp_path, str(file_path))
        except Exception:
            # Limpiar archivo temporal si algo falla
            if os.path.exists(tmp_path):
                os.remove(tmp_path)
            raise
    else:
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(json_str)

    logger.debug(f"JSON escrito: {file_path}")
    return file_path


def read_json(path: str | Path) -> Any:
    """
    Lee y parsea un archivo JSON.

    Args:
        path: Ruta del archivo JSON.

    Returns:
        Datos deserializados del JSON.

    Raises:
        FileNotFoundError: Si el archivo no existe.
        json.JSONDecodeError: Si el JSON es invalido.
    """
    file_path = Path(path)

    if not file_path.exists():
        raise FileNotFoundError(f"Archivo no encontrado: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    logger.debug(f"JSON leido: {file_path}")
    return data


def write_markdown(
    path: str | Path,
    content: str,
) -> Path:
    """
    Escribe contenido Markdown a un archivo.

    Args:
        path: Ruta del archivo destino.
        content: Contenido Markdown.

    Returns:
        Path del archivo escrito.
    """
    file_path = Path(path)
    ensure_dir(file_path.parent)

    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)

    logger.debug(f"Markdown escrito: {file_path}")
    return file_path


def get_run_id() -> str:
    """
    Genera un ID unico para una ejecucion del pipeline.

    Formato: "run_YYYYMMDD_HHMMSS"

    Returns:
        ID de ejecucion como string.

    Examples:
        >>> get_run_id()
        'run_20260209_143000'
    """
    now = datetime.now(timezone.utc)
    return f"run_{now.strftime('%Y%m%d_%H%M%S')}"


def get_date_str() -> str:
    """
    Retorna la fecha actual formateada para nombres de carpetas.

    Returns:
        Fecha en formato YYYY-MM-DD.
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _json_serializer(obj: Any) -> Any:
    """
    Serializador custom para objetos no nativos de JSON.

    Maneja datetime, Path, sets y objetos con __dict__.
    """
    if isinstance(obj, datetime):
        return obj.isoformat()
    if isinstance(obj, Path):
        return str(obj)
    if isinstance(obj, set):
        return list(obj)
    if hasattr(obj, "__dict__"):
        return obj.__dict__
    raise TypeError(f"Objeto de tipo {type(obj)} no es serializable a JSON")


def safe_filename(name: str, max_length: int = 200) -> str:
    """
    Convierte un string a un nombre de archivo seguro.

    Args:
        name: Nombre original.
        max_length: Longitud maxima del nombre resultante.

    Returns:
        Nombre de archivo seguro.
    """
    # Reemplazar caracteres invalidos
    safe = "".join(c if c.isalnum() or c in "-_." else "_" for c in name)
    # Colapsar underscores multiples
    safe = "_".join(filter(None, safe.split("_")))
    return safe[:max_length]


def load_yaml_config(path: str | Path) -> dict[str, Any]:
    """
    Carga y retorna un archivo YAML como diccionario.

    Args:
        path: Ruta al archivo YAML.

    Returns:
        Diccionario con el contenido del YAML.

    Raises:
        FileNotFoundError: Si el archivo no existe.
    """
    import yaml

    file_path = Path(path)
    if not file_path.exists():
        raise FileNotFoundError(f"Archivo de configuracion no encontrado: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)
