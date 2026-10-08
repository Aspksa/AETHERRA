"""Cloud.ru configuration for AETHERRA.

The API key is stored only in the local .env file (gitignored) and server memory.
The browser never receives the key back from the server.
"""
import json
import os
from pathlib import Path
from threading import Lock
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

ROOT = Path(__file__).resolve().parent
ENV_FILE = ROOT / ".env"
DEFAULT_MODEL = "deepseek-ai/DeepSeek-V4-Flash"
MODELS_ENDPOINT = "https://foundation-models.api.cloud.ru/v1/models"
CHAT_ENDPOINT = "https://foundation-models.api.cloud.ru/v1/chat/completions"
_key = None
_model = DEFAULT_MODEL
_lock = Lock()


def _read_env():
    values = {}
    if not ENV_FILE.exists():
        return values
    try:
        for raw in ENV_FILE.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            name, value = line.split("=", 1)
            values[name.strip()] = value.strip().strip('"').strip("'")
    except OSError:
        return {}
    return values


def _write_env(key, model):
    # Keep this file intentionally minimal so secrets cannot be mixed with
    # unrelated settings and accidentally exposed by diagnostics.
    content = (
        "# Local AETHERRA Cloud.ru settings. Never commit this file.\n"
        f"CLOUDRU_API_KEY={key}\n"
        f"CLOUDRU_MODEL={model}\n"
    )
    ENV_FILE.write_text(content, encoding="utf-8")


def _valid_model(model):
    if not isinstance(model, str):
        return False
    model = model.strip()
    if not 1 <= len(model) <= 200:
        return False
    allowed = set("abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-._/")
    return all(ch in allowed for ch in model)


def _load_local_config():
    global _key, _model
    env = _read_env()
    key = os.environ.get("CLOUDRU_API_KEY") or env.get("CLOUDRU_API_KEY")
    model = os.environ.get("CLOUDRU_MODEL") or env.get("CLOUDRU_MODEL") or DEFAULT_MODEL
    if isinstance(key, str) and key.strip():
        _key = key.strip()
    if _valid_model(model):
        _model = model.strip()


_load_local_config()


def connect(key, model=None):
    global _key, _model
    if not isinstance(key, str) or not (8 <= len(key.strip()) <= 4096):
        raise ValueError("Введите корректный API-ключ Cloud.ru")
    if model is None or not str(model).strip():
        model = _model
    if not _valid_model(model):
        raise ValueError("Некорректный CLOUDRU_MODEL")
    key = key.strip()
    model = model.strip()
    try:
        _write_env(key, model)
    except OSError as exc:
        raise ValueError("Не удалось сохранить локальный .env: " + str(exc)) from None
    with _lock:
        _key = key
        _model = model
    return status()


def disconnect():
    global _key
    with _lock:
        _key = None
    # Remove only the secret from the persistent file; retain the chosen model.
    try:
        model = status()["model"]
        ENV_FILE.write_text(
            "# Local AETHERRA Cloud.ru settings. Never commit this file.\n"
            "CLOUDRU_API_KEY=\n"
            f"CLOUDRU_MODEL={model}\n",
            encoding="utf-8",
        )
    except OSError:
        pass
    return status()


def status():
    with _lock:
        return {
            "connected": bool(_key),
            "model": _model,
            "storage": "local_env",
            "has_saved_key": bool(_key),
        }


def test_connection():
    with _lock:
        key = _key
        model = _model
    if not key:
        raise ValueError("Сначала введите ключ")
    request = Request(
        MODELS_ENDPOINT,
        headers={"Authorization": "Bearer " + key, "Accept": "application/json", "User-Agent": "AETHERRA/0.4"},
    )
    try:
        with urlopen(request, timeout=15) as response:
            models = json.load(response)
    except HTTPError as err:
        if err.code in (401, 403):
            raise ValueError("Ключ отклонён Cloud.ru (401/403)") from None
        raise ValueError("Cloud.ru вернул HTTP " + str(err.code)) from None
    except (URLError, TimeoutError):
        raise ValueError("Нет соединения с Cloud.ru") from None
    items = models.get("data", [])
    available = any(item.get("id") == model for item in items if isinstance(item, dict))
    return {
        "authenticated": True,
        "model_available": available,
        "model": model,
        "message": "Ключ принят. Модель доступна." if available else "Ключ принят, но указанная модель не найдена в списке доступных.",
    }


def ask_world_advice(question, world=None):
    """One user-triggered, capped request; advisory text only, no world actions."""
    with _lock:
        key = _key
        model = _model
    if not key:
        raise ValueError("Сначала подключите ключ Cloud.ru")
    if not isinstance(question, str) or not 1 <= len(question.strip()) <= 600:
        raise ValueError("Введите запрос до 600 символов")
    if world is not None:
        if (
            not isinstance(world, dict)
            or set(world) - {"day", "population", "hungry", "homes", "wood", "food"}
            or any(type(v) not in (int, float) or not (0 <= v <= 10000000) for v in world.values())
        ):
            raise ValueError("Некорректная сводка мира")
    snapshot = "\nСостояние мира: " + json.dumps(world, ensure_ascii=False) if world else ""
    payload = json.dumps(
        {
            "model": model,
            "messages": [
                {
                    "role": "system",
                    "content": "Ты наблюдатель игры AETHERRA. Дай краткий план развития деревни на русском языке. Не утверждай, что действия уже выполнены.",
                },
                {"role": "user", "content": question.strip() + snapshot},
            ],
            "max_completion_tokens": 240,
            "stream": False,
        }
    ).encode("utf-8")
    request = Request(
        CHAT_ENDPOINT,
        data=payload,
        headers={
            "Authorization": "Bearer " + key,
            "Content-Type": "application/json",
            "Accept": "application/json",
            "User-Agent": "AETHERRA/0.4",
        },
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            result = json.load(response)
    except HTTPError as err:
        if err.code in (401, 403):
            raise ValueError("Cloud.ru отклонил API-ключ (401/403)") from None
        if err.code == 429:
            raise ValueError("Лимит запросов Cloud.ru (429)") from None
        raise ValueError("Ошибка Cloud.ru HTTP " + str(err.code)) from None
    except (URLError, TimeoutError):
        raise ValueError("Cloud.ru не отвечает. Проверьте соединение.") from None
    try:
        answer = result["choices"][0]["message"]["content"]
        if not isinstance(answer, str) or not answer.strip():
            raise ValueError("Пустой ответ модели")
    except (KeyError, IndexError, TypeError):
        raise ValueError("Cloud.ru вернул неожиданный формат") from None
    usage = result.get("usage", {})
    return {
        "answer": answer[:4000],
        "model": model,
        "tokens": usage.get("total_tokens") if isinstance(usage, dict) else None,
    }
