"""
Utilidades de procesamiento de texto en espanol.

Funciones para normalizacion, generacion de slugs, eliminacion de
stopwords y similitud de texto. Optimizado para texto en espanol LATAM.

Uso:
    from src.utils.text_utils import normalize_keyword, to_slug, similarity_score

    normalized = normalize_keyword("  Gadgets Baratos!! ")
    slug = to_slug("Productos Novedosos de China")
    score = similarity_score("gadgets baratos", "gadget barato")
"""

import re
import unicodedata

from rapidfuzz import fuzz

# Stopwords comunes en espanol (para filtrado de keywords)
SPANISH_STOPWORDS = frozenset([
    "a", "al", "algo", "algunas", "algunos", "ante", "antes", "como",
    "con", "contra", "cual", "cuando", "de", "del", "desde", "donde",
    "durante", "e", "el", "ella", "ellas", "ellos", "en", "entre",
    "era", "esa", "esas", "ese", "eso", "esos", "esta", "estaba",
    "estado", "estar", "estas", "este", "esto", "estos", "fue",
    "ha", "hace", "hacia", "hasta", "hay", "la", "las", "le", "les",
    "lo", "los", "mas", "me", "mi", "muy", "nada", "ni", "no", "nos",
    "nosotros", "o", "otra", "otras", "otro", "otros", "para", "pero",
    "por", "que", "quien", "se", "ser", "si", "sin", "sobre", "somos",
    "son", "su", "sus", "tambien", "te", "ti", "tiene", "toda", "todas",
    "todo", "todos", "tu", "tus", "un", "una", "unas", "uno", "unos",
    "usted", "ustedes", "va", "vamos", "y", "ya", "yo",
])


def normalize_keyword(text: str) -> str:
    """
    Normaliza una keyword para comparacion y deduplicacion.

    Proceso:
    1. Convierte a minusculas
    2. Elimina acentos/diacriticos
    3. Elimina caracteres especiales (solo deja alfanumericos y espacios)
    4. Colapsa espacios multiples a uno solo
    5. Elimina espacios al inicio y final

    Args:
        text: Texto a normalizar.

    Returns:
        Texto normalizado.

    Examples:
        >>> normalize_keyword("  Gadgets Baratos!! ")
        'gadgets baratos'
        >>> normalize_keyword("Productos de Tecnologia")
        'productos de tecnologia'
    """
    if not text:
        return ""

    # Minusculas
    text = text.lower().strip()

    # Eliminar acentos usando descomposicion Unicode
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")

    # Solo alfanumericos y espacios
    text = re.sub(r"[^a-z0-9\s]", " ", text)

    # Colapsar espacios
    text = re.sub(r"\s+", " ", text).strip()

    return text


def to_slug(text: str) -> str:
    """
    Convierte texto en espanol a un slug URL-safe.

    Args:
        text: Texto a convertir (puede contener acentos, espacios, etc.).

    Returns:
        Slug en formato kebab-case sin acentos.

    Examples:
        >>> to_slug("Productos Novedosos de China")
        'productos-novedosos-de-china'
        >>> to_slug("Gadgets Baratos $5!")
        'gadgets-baratos-5'
    """
    if not text:
        return ""

    normalized = normalize_keyword(text)
    slug = re.sub(r"\s+", "-", normalized)
    slug = re.sub(r"-+", "-", slug)
    slug = slug.strip("-")

    return slug


def remove_spanish_stopwords(text: str) -> str:
    """
    Elimina stopwords en espanol de un texto.

    Args:
        text: Texto del cual eliminar stopwords.

    Returns:
        Texto sin stopwords, normalizado.

    Examples:
        >>> remove_spanish_stopwords("los mejores gadgets de la casa")
        'mejores gadgets casa'
    """
    if not text:
        return ""

    words = normalize_keyword(text).split()
    filtered = [w for w in words if w not in SPANISH_STOPWORDS]
    return " ".join(filtered)


def similarity_score(text_a: str, text_b: str) -> float:
    """
    Calcula la similitud entre dos textos usando fuzzy matching.

    Usa rapidfuzz.fuzz.ratio que retorna un valor entre 0.0 y 100.0.

    Args:
        text_a: Primer texto.
        text_b: Segundo texto.

    Returns:
        Score de similitud entre 0.0 y 100.0.

    Examples:
        >>> similarity_score("gadgets baratos", "gadget barato")
        > 80.0
    """
    norm_a = normalize_keyword(text_a)
    norm_b = normalize_keyword(text_b)
    return fuzz.ratio(norm_a, norm_b)


def extract_potential_keywords(text: str, min_length: int = 3) -> list[str]:
    """
    Extrae posibles keywords de un texto largo eliminando stopwords.

    Args:
        text: Texto fuente.
        min_length: Longitud minima de palabra para incluir.

    Returns:
        Lista de palabras potencialmente utiles como keywords.
    """
    if not text:
        return []

    words = normalize_keyword(text).split()
    return [
        w for w in words
        if w not in SPANISH_STOPWORDS and len(w) >= min_length
    ]


def truncate_text(text: str, max_length: int, suffix: str = "...") -> str:
    """
    Trunca texto a una longitud maxima, agregando sufijo si se corta.

    Args:
        text: Texto a truncar.
        max_length: Longitud maxima permitida (incluyendo sufijo).
        suffix: Sufijo a agregar si se trunca.

    Returns:
        Texto truncado.
    """
    if not text or len(text) <= max_length:
        return text or ""

    return text[: max_length - len(suffix)].rstrip() + suffix


def count_words(text: str) -> int:
    """
    Cuenta las palabras en un texto.

    Args:
        text: Texto a contar.

    Returns:
        Numero de palabras.
    """
    if not text:
        return 0
    return len(text.split())


def calculate_keyword_density(text: str, keyword: str) -> float:
    """
    Calcula la densidad de una keyword en un texto (porcentaje).

    Args:
        text: Texto completo.
        keyword: Keyword a buscar.

    Returns:
        Densidad como porcentaje (ej: 1.5 = 1.5%).
    """
    if not text or not keyword:
        return 0.0

    text_lower = text.lower()
    keyword_lower = keyword.lower()
    total_words = count_words(text)

    if total_words == 0:
        return 0.0

    keyword_words = count_words(keyword)
    occurrences = text_lower.count(keyword_lower)

    return (occurrences * keyword_words / total_words) * 100
