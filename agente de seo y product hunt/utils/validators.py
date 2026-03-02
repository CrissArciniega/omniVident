"""Validación de datos contra schemas Pydantic."""

from pydantic import BaseModel, ValidationError
from typing import Type

from .logger import get_logger

logger = get_logger("validators")


def validate_data(data: dict, schema_class: Type[BaseModel]) -> BaseModel | None:
    """Valida un diccionario contra un schema Pydantic.

    Args:
        data: Diccionario con los datos a validar
        schema_class: Clase Pydantic para validar contra

    Returns:
        Instancia validada del modelo, o None si falla la validación.
    """
    try:
        return schema_class.model_validate(data)
    except ValidationError as e:
        logger.error(f"Validación fallida para {schema_class.__name__}: {e.error_count()} errores")
        for error in e.errors():
            logger.error(f"  - {error['loc']}: {error['msg']}")
        return None


def validate_batch(data_list: list[dict], schema_class: Type[BaseModel]) -> tuple[list[BaseModel], list[dict]]:
    """Valida una lista de diccionarios, separando válidos de inválidos.

    Returns:
        Tupla de (válidos, inválidos con errores)
    """
    valid = []
    invalid = []

    for i, item in enumerate(data_list):
        try:
            validated = schema_class.model_validate(item)
            valid.append(validated)
        except ValidationError as e:
            invalid.append({"index": i, "data": item, "errors": e.errors()})
            logger.warning(f"Item {i} inválido: {e.error_count()} errores")

    logger.info(f"Validación batch: {len(valid)} válidos, {len(invalid)} inválidos de {len(data_list)} total")
    return valid, invalid
