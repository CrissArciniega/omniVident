"""
Decorator de reintentos con backoff exponencial.

Proporciona un decorator @retry para funciones que pueden fallar
transitoriamente (peticiones de red, APIs con rate limiting, etc.)

Uso:
    from src.utils.retry import retry

    @retry(max_attempts=3, base_delay=1.0)
    def fetch_data():
        return requests.get("https://api.example.com/data")

    @retry(max_attempts=5, exceptions=(ConnectionError, TimeoutError))
    def connect_to_service():
        ...
"""

import functools
import random
import time
from typing import Any, Callable, TypeVar

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

F = TypeVar("F", bound=Callable[..., Any])


def retry(
    max_attempts: int = 3,
    base_delay: float = 1.0,
    max_delay: float = 60.0,
    exceptions: tuple[type[Exception], ...] = (Exception,),
    jitter: bool = True,
) -> Callable[[F], F]:
    """
    Decorator que reintenta una funcion con backoff exponencial.

    Args:
        max_attempts: Numero maximo de intentos (incluyendo el primero).
        base_delay: Delay base en segundos para el primer reintento.
        max_delay: Delay maximo en segundos (cap del backoff).
        exceptions: Tupla de tipos de excepcion que disparan reintento.
        jitter: Si True, agrega jitter aleatorio al delay (0-1s).

    Returns:
        Funcion decorada con logica de reintentos.

    Examples:
        @retry(max_attempts=3, base_delay=2.0)
        def call_api():
            return http_client.get("https://api.example.com")

        @retry(exceptions=(ConnectionError,), max_attempts=5)
        def connect():
            ...
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        def wrapper(*args: Any, **kwargs: Any) -> Any:
            last_exception: Exception | None = None

            for attempt in range(1, max_attempts + 1):
                try:
                    return func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e

                    if attempt == max_attempts:
                        logger.error(
                            f"{func.__name__}: Fallo despues de {max_attempts} "
                            f"intentos. Ultimo error: {e}"
                        )
                        raise

                    # Calcular delay con backoff exponencial
                    delay = min(base_delay * (2 ** (attempt - 1)), max_delay)

                    # Agregar jitter aleatorio
                    if jitter:
                        delay += random.uniform(0, 1.0)

                    logger.warning(
                        f"{func.__name__}: Intento {attempt}/{max_attempts} "
                        f"fallo ({type(e).__name__}: {e}). "
                        f"Reintentando en {delay:.2f}s..."
                    )
                    time.sleep(delay)

            # Este punto no deberia alcanzarse, pero por seguridad:
            if last_exception:
                raise last_exception

        return wrapper  # type: ignore[return-value]

    return decorator
