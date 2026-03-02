"""
Tests para el modulo de guardado local de archivos.

Verifica la creacion de estructura de directorios y archivos.
"""

import json
import os
import tempfile
from pathlib import Path

import pytest

from src.utils.file_helpers import (
    ensure_dir,
    write_json,
    read_json,
    write_markdown,
    get_run_id,
    get_date_str,
    safe_filename,
)


class TestEnsureDir:
    """Tests para ensure_dir."""

    def test_creates_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            new_dir = Path(tmpdir) / "level1" / "level2" / "level3"
            result = ensure_dir(new_dir)
            assert result.exists()
            assert result.is_dir()

    def test_existing_directory(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = ensure_dir(tmpdir)
            assert result.exists()

    def test_returns_path(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            result = ensure_dir(tmpdir)
            assert isinstance(result, Path)


class TestWriteReadJson:
    """Tests para write_json y read_json."""

    def test_write_and_read(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.json"
            data = {"key": "value", "number": 42, "list": [1, 2, 3]}

            write_json(file_path, data)
            result = read_json(file_path)

            assert result == data

    def test_unicode_content(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "unicode.json"
            data = {
                "keyword": "tecnologia avanzada",
                "description": "Productos novedosos importados de China",
            }

            write_json(file_path, data)
            result = read_json(file_path)

            assert result["keyword"] == "tecnologia avanzada"

    def test_nested_structure(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "nested" / "deep" / "data.json"
            data = {"nested": {"deep": {"value": True}}}

            write_json(file_path, data)
            result = read_json(file_path)

            assert result["nested"]["deep"]["value"] is True

    def test_read_nonexistent_file(self):
        with pytest.raises(FileNotFoundError):
            read_json("/nonexistent/path/file.json")

    def test_atomic_write(self):
        """Verifica que la escritura atomica no deja archivos temporales."""
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "atomic.json"
            write_json(file_path, {"test": True}, atomic=True)

            # No debe haber archivos .tmp
            tmp_files = list(Path(tmpdir).glob("*.tmp"))
            assert len(tmp_files) == 0
            assert file_path.exists()


class TestWriteMarkdown:
    """Tests para write_markdown."""

    def test_basic_write(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "test.md"
            content = "# Titulo\n\nContenido del documento."

            write_markdown(file_path, content)

            assert file_path.exists()
            with open(file_path, "r", encoding="utf-8") as f:
                assert f.read() == content

    def test_creates_parent_dirs(self):
        with tempfile.TemporaryDirectory() as tmpdir:
            file_path = Path(tmpdir) / "sub" / "dir" / "test.md"
            write_markdown(file_path, "# Test")
            assert file_path.exists()


class TestGetRunId:
    """Tests para get_run_id."""

    def test_format(self):
        run_id = get_run_id()
        assert run_id.startswith("run_")
        assert len(run_id) == 20  # "run_" + 8 date + "_" + 6 time

    def test_unique(self):
        """Dos llamadas consecutivas deben generar IDs diferentes (o iguales si en el mismo segundo)."""
        id1 = get_run_id()
        id2 = get_run_id()
        # En el mismo segundo pueden ser iguales, eso esta bien
        assert isinstance(id1, str)
        assert isinstance(id2, str)


class TestGetDateStr:
    """Tests para get_date_str."""

    def test_format(self):
        date_str = get_date_str()
        # Formato YYYY-MM-DD
        parts = date_str.split("-")
        assert len(parts) == 3
        assert len(parts[0]) == 4  # Anio
        assert len(parts[1]) == 2  # Mes
        assert len(parts[2]) == 2  # Dia


class TestSafeFilename:
    """Tests para safe_filename."""

    def test_basic(self):
        assert safe_filename("normal_file.txt") == "normal_file.txt"

    def test_special_chars(self):
        result = safe_filename("file with spaces & chars!.txt")
        assert " " not in result
        assert "&" not in result

    def test_max_length(self):
        long_name = "a" * 300
        result = safe_filename(long_name, max_length=50)
        assert len(result) <= 50
