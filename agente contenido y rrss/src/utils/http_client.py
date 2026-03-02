"""
Cliente HTTP con reintentos, rate limiting y rotacion de User-Agent.

Wrapper sobre requests.Session que proporciona:
- Pool de User-Agents rotados aleatoriamente
- Reintentos automaticos con backoff (3x por defecto)
- Rate limiting configurable (delay entre requests)
- Timeout management
- Metodos de conveniencia para JSON y BeautifulSoup

Uso:
    from src.utils.http_client import HttpClient

    client = HttpClient(delay=1.5)
    data = client.get_json("https://api.example.com/data", params={"q": "test"})
    soup = client.get_soup("https://example.com/page")
"""

import random
import time
from typing import Any

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from src.utils.logger import setup_logger

logger = setup_logger(__name__)

# Pool de User-Agents para rotacion
USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Ubuntu; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:120.0) Gecko/20100101 Firefox/120.0",
]


class HttpClient:
    """
    Cliente HTTP con reintentos, rate limiting y rotacion de User-Agent.

    Args:
        delay: Segundos de espera entre peticiones (rate limiting).
        max_retries: Numero maximo de reintentos por peticion.
        backoff_factor: Factor de backoff exponencial entre reintentos.
        timeout: Tupla (connect_timeout, read_timeout) en segundos.
        retry_status_codes: Codigos HTTP que disparan reintento.
    """

    def __init__(
        self,
        delay: float = 1.5,
        max_retries: int = 3,
        backoff_factor: float = 1.0,
        timeout: tuple[int, int] = (10, 30),
        retry_status_codes: tuple[int, ...] = (429, 500, 502, 503, 504),
    ):
        self.delay = delay
        self.timeout = timeout
        self._last_request_time: float = 0.0

        # Configurar session con reintentos
        self.session = requests.Session()
        retry_strategy = Retry(
            total=max_retries,
            backoff_factor=backoff_factor,
            status_forcelist=list(retry_status_codes),
            allowed_methods=["GET", "POST", "HEAD"],
        )
        adapter = HTTPAdapter(max_retries=retry_strategy)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)

    def _get_random_ua(self) -> str:
        """Retorna un User-Agent aleatorio del pool."""
        return random.choice(USER_AGENTS)

    def _rate_limit(self) -> None:
        """Aplica rate limiting esperando si es necesario."""
        if self.delay > 0:
            elapsed = time.time() - self._last_request_time
            if elapsed < self.delay:
                wait_time = self.delay - elapsed
                logger.debug(f"Rate limit: esperando {wait_time:.2f}s")
                time.sleep(wait_time)

    def _prepare_headers(self, extra_headers: dict[str, str] | None = None) -> dict[str, str]:
        """Prepara headers con User-Agent rotado."""
        headers = {
            "User-Agent": self._get_random_ua(),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "es-MX,es;q=0.9,en;q=0.5",
            "Accept-Encoding": "gzip, deflate",
            "Connection": "keep-alive",
        }
        if extra_headers:
            headers.update(extra_headers)
        return headers

    def get(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> requests.Response:
        """
        Realiza una peticion GET con rate limiting y reintentos.

        Args:
            url: URL destino.
            params: Query parameters.
            headers: Headers adicionales (se mergen con los defaults).
            **kwargs: Argumentos adicionales para requests.get().

        Returns:
            Response de requests.

        Raises:
            requests.RequestException: Si la peticion falla despues de todos los reintentos.
        """
        self._rate_limit()
        merged_headers = self._prepare_headers(headers)

        logger.debug(f"GET {url} params={params}")
        try:
            response = self.session.get(
                url,
                params=params,
                headers=merged_headers,
                timeout=self.timeout,
                **kwargs,
            )
            self._last_request_time = time.time()
            response.raise_for_status()
            logger.debug(f"GET {url} -> {response.status_code}")
            return response
        except requests.RequestException as e:
            logger.error(f"Error GET {url}: {e}")
            self._last_request_time = time.time()
            raise

    def post(
        self,
        url: str,
        json: dict[str, Any] | None = None,
        data: Any = None,
        headers: dict[str, str] | None = None,
        **kwargs: Any,
    ) -> requests.Response:
        """
        Realiza una peticion POST con rate limiting y reintentos.

        Args:
            url: URL destino.
            json: Payload JSON.
            data: Payload de datos.
            headers: Headers adicionales.
            **kwargs: Argumentos adicionales para requests.post().

        Returns:
            Response de requests.
        """
        self._rate_limit()
        merged_headers = self._prepare_headers(headers)

        logger.debug(f"POST {url}")
        try:
            response = self.session.post(
                url,
                json=json,
                data=data,
                headers=merged_headers,
                timeout=self.timeout,
                **kwargs,
            )
            self._last_request_time = time.time()
            response.raise_for_status()
            logger.debug(f"POST {url} -> {response.status_code}")
            return response
        except requests.RequestException as e:
            logger.error(f"Error POST {url}: {e}")
            self._last_request_time = time.time()
            raise

    def get_json(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> Any:
        """
        GET que retorna el response parseado como JSON.

        Args:
            url: URL destino.
            params: Query parameters.
            headers: Headers adicionales.

        Returns:
            Datos JSON parseados.
        """
        response = self.get(url, params=params, headers=headers)
        return response.json()

    def get_soup(
        self,
        url: str,
        params: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
        parser: str = "lxml",
    ) -> BeautifulSoup:
        """
        GET que retorna un objeto BeautifulSoup del HTML.

        Args:
            url: URL destino.
            params: Query parameters.
            headers: Headers adicionales.
            parser: Parser de BeautifulSoup (default: lxml).

        Returns:
            Objeto BeautifulSoup parseado.
        """
        response = self.get(url, params=params, headers=headers)
        return BeautifulSoup(response.text, parser)

    def download_bytes(
        self,
        url: str,
        headers: dict[str, str] | None = None,
    ) -> bytes:
        """
        Descarga contenido binario (imagenes, archivos).

        Args:
            url: URL del recurso.
            headers: Headers adicionales.

        Returns:
            Contenido en bytes.
        """
        response = self.get(url, headers=headers)
        return response.content

    def close(self) -> None:
        """Cierra la session HTTP."""
        self.session.close()

    def __enter__(self) -> "HttpClient":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
