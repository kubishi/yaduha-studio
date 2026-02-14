"""
Validation script run inside Pyodide.
Loaded by the Web Worker to validate a language package from source files.
"""

import json
import sys


def validate_language(repo_path: str) -> str:
    """Validate a language package at the given path. Returns JSON string."""
    sys.path.insert(0, repo_path)

    try:
        from yaduha.loader import LanguageLoader

        language = LanguageLoader.load_language_from_source(repo_path)
        result = {
            "valid": True,
            "language": language.code,
            "name": language.name,
            "sentence_types": [st.__name__ for st in language.sentence_types],
        }
    except Exception as e:
        result = {
            "valid": False,
            "error": str(e),
            "error_type": type(e).__name__,
        }

    return json.dumps(result)
