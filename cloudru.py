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
