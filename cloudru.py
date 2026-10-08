"""Cloud.ru credentials live in server memory only; never exposed to browser or disk."""
import json
from threading import Lock
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

MODEL = "deepseek-ai/DeepSeek-V4-Flash"
ENDPOINT = "https://foundation-models.api.cloud.ru/v1/models"
_key = None
_lock = Lock()

def connect(key):
    global _key
    if not isinstance(key,str) or not (8 <= len(key.strip()) <= 4096):
        raise ValueError("Введите корректный API-ключ Cloud.ru")
    with _lock:
        _key = key.strip()
    return status()

def disconnect():
    global _key
    with _lock:
        _key = None
    return status()

def status():
    with _lock:
        return {"connected": bool(_key), "model": MODEL, "storage": "memory_only"}

def test_connection():
    with _lock:
        key = _key
    if not key:
        raise ValueError("Сначала введите ключ")
    request = Request(ENDPOINT,headers={"Authorization":"Bearer "+key,"Accept":"application/json","User-Agent":"AETHERRA/0.2"})
    try:
        with urlopen(request,timeout=15) as response:
            models=json.load(response)
    except HTTPError as err:
        if err.code in (401,403):
            raise ValueError("Ключ отклонён Cloud.ru (401/403)") from None
        raise ValueError("Cloud.ru вернул HTTP "+str(err.code)) from None
    except (URLError,TimeoutError) as err:
        raise ValueError("Нет соединения с Cloud.ru") from None
    items=models.get("data",[])
    available=any(item.get("id")==MODEL for item in items if isinstance(item,dict))
    return {"authenticated":True,"model_available":available,"model":MODEL,
            "message":"Ключ принят. Модель доступна." if available else "Ключ принят, но модель не найдена в списке доступных."}

CHAT_ENDPOINT = "https://foundation-models.api.cloud.ru/v1/chat/completions"

def ask_world_advice(question, world=None):
    """One user-triggered, capped request; advisory text only, no world actions."""
    with _lock:
        key = _key
    if not key:
        raise ValueError("Сначала подключите ключ Cloud.ru")
    if not isinstance(question, str) or not 1 <= len(question.strip()) <= 600:
        raise ValueError("Введите запрос до 600 символов")
    if world is not None:
        if not isinstance(world, dict) or set(world) - {"day","population","hungry","homes","wood","food"} or any(type(v) not in (int, float) or not (0 <= v <= 10000000) for v in world.values()):
            raise ValueError("Некорректная сводка мира")
    snapshot = "\nСостояние мира: " + json.dumps(world, ensure_ascii=False) if world else ""
    payload = json.dumps({
        "model": MODEL,
        "messages": [
            {"role": "system", "content": "Ты наблюдатель игры AETHERRA. Дай краткий план развития деревни на русском языке. Не утверждай, что действия уже выполнены."},
            {"role": "user", "content": question.strip() + snapshot}
        ],
        "max_completion_tokens": 240,
        "stream": False
    }).encode("utf-8")
    request = Request(CHAT_ENDPOINT, data=payload, headers={
        "Authorization": "Bearer " + key, "Content-Type": "application/json",
        "Accept": "application/json", "User-Agent": "AETHERRA/0.2"
    }, method="POST")
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
    return {"answer": answer[:4000], "model": MODEL,
            "tokens": usage.get("total_tokens") if isinstance(usage, dict) else None}
