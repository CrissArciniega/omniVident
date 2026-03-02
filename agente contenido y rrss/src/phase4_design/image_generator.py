"""
Generador de imagenes con IA - Phase 4b.

Wrapper sobre APIs de generacion de imagenes (Together AI y Pixazo)
con fallback automatico, reintentos y redimensionamiento con Pillow.

Uso directo:
    python -m src.phase4_design.image_generator

Uso programatico:
    from src.phase4_design.image_generator import ImageGenerator
    generator = ImageGenerator()
    image_bytes = generator.generate("a product photo of gadgets", 1080, 1080)
    generator.save_image(image_bytes, Path("output/thumbnail.png"))
"""

import base64
import io
import os
from pathlib import Path
from typing import Any

from PIL import Image

from src.utils.file_helpers import ensure_dir, load_yaml_config
from src.utils.http_client import HttpClient
from src.utils.logger import setup_logger
from src.utils.retry import retry

logger = setup_logger(__name__, phase="phase4")


class ImageGenerator:
    """
    Generador de imagenes con IA usando Together AI (primaria) y Pixazo (fallback).

    Realiza llamadas a las APIs de generacion de imagenes, maneja reintentos
    y redimensiona/recorta las imagenes resultantes a las dimensiones exactas
    requeridas por cada plataforma.

    Args:
        config_path: Ruta al config.yaml principal (opcional).
    """

    def __init__(self, config_path: str | Path | None = None):
        project_root = Path(__file__).parent.parent.parent

        if config_path is None:
            config_path = project_root / "config" / "config.yaml"

        self.config = load_yaml_config(config_path)
        self.img_config = self.config.get("image_generation", {})

        # Configuracion Together AI
        self.together_config = self.img_config.get("together_ai", {})
        self.together_url = self.together_config.get(
            "base_url", "https://api.together.xyz/v1/images/generations"
        )
        self.together_model = self.together_config.get(
            "model", "black-forest-labs/FLUX.1-schnell-Free"
        )
        self.together_steps = self.together_config.get("steps", 4)
        self.together_default_width = self.together_config.get("default_width", 1024)
        self.together_default_height = self.together_config.get("default_height", 1024)

        # Configuracion Pixazo
        self.pixazo_config = self.img_config.get("pixazo", {})
        self.pixazo_url = self.pixazo_config.get(
            "base_url", "https://api.pixazo.com/v1/generate"
        )
        self.pixazo_model = self.pixazo_config.get("model", "stable-diffusion")
        self.pixazo_default_width = self.pixazo_config.get("default_width", 1024)
        self.pixazo_default_height = self.pixazo_config.get("default_height", 1024)

        # Retry config
        self.max_retries = self.img_config.get("max_retries", 3)
        self.retry_delay = self.img_config.get("retry_delay", 2.0)

        # API keys desde variables de entorno
        self.together_api_key = os.environ.get("TOGETHER_AI_API_KEY", "")
        self.pixazo_api_key = os.environ.get("PIXAZO_API_KEY", "")

        # Cliente HTTP compartido
        self.http_client = HttpClient(delay=0.5, timeout=(15, 120))

    def _snap_to_multiple_of_8(self, value: int) -> int:
        """
        Redondea un valor al multiplo de 8 mas cercano.

        Muchos modelos de generacion de imagen requieren dimensiones
        que sean multiplos de 8.

        Args:
            value: Valor a redondear.

        Returns:
            Valor redondeado al multiplo de 8 mas cercano.
        """
        return max(8, round(value / 8) * 8)

    def _compute_generation_dims(
        self, target_width: int, target_height: int
    ) -> tuple[int, int]:
        """
        Calcula dimensiones de generacion optimas.

        Las APIs de generacion tienen limites (tipicamente 1024x1024 max).
        Genera a un tamano que mantenga la relacion de aspecto y sea
        compatible con el modelo, luego se redimensiona en post-proceso.

        Args:
            target_width: Ancho final deseado.
            target_height: Alto final deseado.

        Returns:
            Tupla (gen_width, gen_height) para la API.
        """
        max_gen_dim = 1024
        min_gen_dim = 256

        aspect_ratio = target_width / target_height

        if aspect_ratio >= 1.0:
            # Landscape o cuadrado
            gen_width = max_gen_dim
            gen_height = max(min_gen_dim, int(max_gen_dim / aspect_ratio))
        else:
            # Portrait
            gen_height = max_gen_dim
            gen_width = max(min_gen_dim, int(max_gen_dim * aspect_ratio))

        gen_width = self._snap_to_multiple_of_8(gen_width)
        gen_height = self._snap_to_multiple_of_8(gen_height)

        return gen_width, gen_height

    @retry(max_attempts=3, base_delay=2.0, exceptions=(Exception,))
    def _generate_together_ai(
        self, prompt: str, gen_width: int, gen_height: int
    ) -> bytes:
        """
        Genera una imagen usando Together AI FLUX.1-schnell-Free.

        Args:
            prompt: Prompt de generacion de imagen.
            gen_width: Ancho de la imagen a generar.
            gen_height: Alto de la imagen a generar.

        Returns:
            Bytes de la imagen generada.

        Raises:
            RuntimeError: Si la API no retorna datos de imagen validos.
            requests.RequestException: Si la peticion HTTP falla.
        """
        if not self.together_api_key:
            raise RuntimeError(
                "TOGETHER_AI_API_KEY no configurada en variables de entorno"
            )

        logger.info(
            f"Together AI: generando imagen {gen_width}x{gen_height} "
            f"con modelo {self.together_model}"
        )

        payload: dict[str, Any] = {
            "model": self.together_model,
            "prompt": prompt,
            "width": gen_width,
            "height": gen_height,
            "steps": self.together_steps,
            "n": 1,
            "response_format": "b64_json",
        }

        headers = {
            "Authorization": f"Bearer {self.together_api_key}",
            "Content-Type": "application/json",
        }

        response = self.http_client.post(
            self.together_url,
            json=payload,
            headers=headers,
        )

        response_data = response.json()

        # Extraer imagen del response
        data_list = response_data.get("data", [])
        if not data_list:
            raise RuntimeError(
                f"Together AI no retorno datos de imagen. Response: {response_data}"
            )

        # La imagen puede venir como b64_json o como URL
        image_item = data_list[0]

        if "b64_json" in image_item:
            image_bytes = base64.b64decode(image_item["b64_json"])
            logger.info("Together AI: imagen recibida (b64_json)")
            return image_bytes

        if "url" in image_item:
            image_url = image_item["url"]
            logger.info(f"Together AI: descargando imagen desde URL")
            image_bytes = self.http_client.download_bytes(image_url)
            return image_bytes

        raise RuntimeError(
            f"Together AI: formato de respuesta no reconocido. Keys: {list(image_item.keys())}"
        )

    @retry(max_attempts=3, base_delay=2.0, exceptions=(Exception,))
    def _generate_pixazo(
        self, prompt: str, gen_width: int, gen_height: int
    ) -> bytes:
        """
        Genera una imagen usando Pixazo como API de fallback.

        Args:
            prompt: Prompt de generacion de imagen.
            gen_width: Ancho de la imagen a generar.
            gen_height: Alto de la imagen a generar.

        Returns:
            Bytes de la imagen generada.

        Raises:
            RuntimeError: Si la API no retorna datos de imagen validos.
            requests.RequestException: Si la peticion HTTP falla.
        """
        if not self.pixazo_api_key:
            raise RuntimeError(
                "PIXAZO_API_KEY no configurada en variables de entorno"
            )

        logger.info(
            f"Pixazo: generando imagen {gen_width}x{gen_height} "
            f"con modelo {self.pixazo_model}"
        )

        payload: dict[str, Any] = {
            "model": self.pixazo_model,
            "prompt": prompt,
            "width": gen_width,
            "height": gen_height,
            "num_images": 1,
        }

        headers = {
            "Authorization": f"Bearer {self.pixazo_api_key}",
            "Content-Type": "application/json",
        }

        response = self.http_client.post(
            self.pixazo_url,
            json=payload,
            headers=headers,
        )

        response_data = response.json()

        # Intentar extraer imagen: Pixazo puede devolver b64 o URL
        # Formato comun: {"images": [{"url": "..."} | {"b64": "..."}]}
        images = response_data.get("images", response_data.get("data", []))

        if not images:
            raise RuntimeError(
                f"Pixazo no retorno datos de imagen. Response: {response_data}"
            )

        image_item = images[0]

        # Intentar b64 primero
        for b64_key in ["b64", "b64_json", "base64", "image"]:
            if b64_key in image_item and isinstance(image_item[b64_key], str):
                image_bytes = base64.b64decode(image_item[b64_key])
                logger.info(f"Pixazo: imagen recibida ({b64_key})")
                return image_bytes

        # Intentar URL
        if "url" in image_item:
            image_url = image_item["url"]
            logger.info("Pixazo: descargando imagen desde URL")
            image_bytes = self.http_client.download_bytes(image_url)
            return image_bytes

        raise RuntimeError(
            f"Pixazo: formato de respuesta no reconocido. Keys: {list(image_item.keys())}"
        )

    def _resize_and_crop(
        self, image_bytes: bytes, target_width: int, target_height: int
    ) -> bytes:
        """
        Redimensiona y recorta la imagen a las dimensiones exactas.

        Usa un approach de 'cover crop': redimensiona manteniendo la
        relacion de aspecto para cubrir las dimensiones objetivo, luego
        recorta el exceso desde el centro.

        Args:
            image_bytes: Bytes de la imagen original.
            target_width: Ancho final deseado en pixeles.
            target_height: Alto final deseado en pixeles.

        Returns:
            Bytes de la imagen redimensionada en formato PNG.
        """
        img = Image.open(io.BytesIO(image_bytes))

        # Convertir a RGB si es necesario (para PNG con alpha, CMYK, etc.)
        if img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")

        orig_width, orig_height = img.size
        target_ratio = target_width / target_height
        orig_ratio = orig_width / orig_height

        if abs(orig_ratio - target_ratio) < 0.01:
            # Misma relacion de aspecto: redimensionar directamente
            img = img.resize((target_width, target_height), Image.Resampling.LANCZOS)
        elif orig_ratio > target_ratio:
            # Imagen original es mas ancha: escalar por alto, recortar ancho
            scale_height = target_height
            scale_width = int(orig_width * (target_height / orig_height))
            img = img.resize((scale_width, scale_height), Image.Resampling.LANCZOS)

            # Recortar desde el centro
            left = (scale_width - target_width) // 2
            img = img.crop((left, 0, left + target_width, target_height))
        else:
            # Imagen original es mas alta: escalar por ancho, recortar alto
            scale_width = target_width
            scale_height = int(orig_height * (target_width / orig_width))
            img = img.resize((scale_width, scale_height), Image.Resampling.LANCZOS)

            # Recortar desde el centro
            top = (scale_height - target_height) // 2
            img = img.crop((0, top, target_width, top + target_height))

        # Convertir a bytes PNG
        output_buffer = io.BytesIO()
        img.save(output_buffer, format="PNG", optimize=True)
        output_buffer.seek(0)

        logger.debug(
            f"Imagen redimensionada: {orig_width}x{orig_height} -> {target_width}x{target_height}"
        )

        return output_buffer.read()

    def generate(self, prompt: str, width: int, height: int) -> bytes:
        """
        Genera una imagen usando las APIs disponibles (primaria con fallback).

        Intenta primero Together AI. Si falla, intenta Pixazo como fallback.
        La imagen se redimensiona/recorta a las dimensiones exactas solicitadas.

        Args:
            prompt: Prompt de generacion de imagen en ingles.
            width: Ancho final deseado en pixeles.
            height: Alto final deseado en pixeles.

        Returns:
            Bytes de la imagen final en formato PNG con dimensiones exactas.

        Raises:
            RuntimeError: Si ambas APIs fallan.
        """
        gen_width, gen_height = self._compute_generation_dims(width, height)

        logger.info(
            f"Generando imagen: target={width}x{height}, "
            f"gen={gen_width}x{gen_height}"
        )

        raw_image_bytes: bytes | None = None
        last_error: Exception | None = None

        # Intento 1: Together AI (primaria)
        if self.together_api_key:
            try:
                raw_image_bytes = self._generate_together_ai(
                    prompt, gen_width, gen_height
                )
                logger.info("Imagen generada exitosamente con Together AI")
            except Exception as e:
                logger.warning(f"Together AI fallo: {e}. Intentando fallback...")
                last_error = e
        else:
            logger.warning("TOGETHER_AI_API_KEY no disponible. Saltando a fallback.")

        # Intento 2: Pixazo (fallback)
        if raw_image_bytes is None and self.pixazo_api_key:
            try:
                raw_image_bytes = self._generate_pixazo(
                    prompt, gen_width, gen_height
                )
                logger.info("Imagen generada exitosamente con Pixazo (fallback)")
            except Exception as e:
                logger.error(f"Pixazo (fallback) tambien fallo: {e}")
                last_error = e

        if raw_image_bytes is None:
            error_msg = (
                f"Ambas APIs de generacion de imagen fallaron. "
                f"Ultimo error: {last_error}"
            )
            logger.error(error_msg)
            raise RuntimeError(error_msg)

        # Post-proceso: redimensionar y recortar a dimensiones exactas
        final_bytes = self._resize_and_crop(raw_image_bytes, width, height)

        logger.info(f"Imagen final: {width}x{height} ({len(final_bytes)} bytes)")
        return final_bytes

    def save_image(self, image_bytes: bytes, path: Path) -> Path:
        """
        Guarda bytes de imagen a un archivo PNG.

        Args:
            image_bytes: Bytes de la imagen a guardar.
            path: Ruta destino del archivo.

        Returns:
            Path del archivo guardado.
        """
        ensure_dir(path.parent)
        path = path.with_suffix(".png")

        with open(path, "wb") as f:
            f.write(image_bytes)

        logger.info(f"Imagen guardada: {path} ({len(image_bytes)} bytes)")
        return path

    def close(self) -> None:
        """Cierra el cliente HTTP."""
        self.http_client.close()

    def __enter__(self) -> "ImageGenerator":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()


# Entry point para ejecucion directa (prueba rapida)
if __name__ == "__main__":
    from dotenv import load_dotenv

    load_dotenv()

    print("ImageGenerator - Prueba rapida")
    print("=" * 50)

    with ImageGenerator() as gen:
        test_prompt = (
            "professional product photography, modern gadgets, "
            "clean white background, studio lighting, 4k, high quality"
        )

        try:
            image_data = gen.generate(test_prompt, width=1080, height=1080)
            output_path = Path("output/phase4_designs/_test/test_thumbnail.png")
            saved = gen.save_image(image_data, output_path)
            print(f"\nPrueba exitosa! Imagen guardada en: {saved}")
        except RuntimeError as e:
            print(f"\nError en la prueba: {e}")
            print("Verifica que TOGETHER_AI_API_KEY o PIXAZO_API_KEY estan configuradas en .env")
