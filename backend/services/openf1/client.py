import httpx
import time
from typing import Any, Dict, Optional

OPENF1_BASE = "https://api.openf1.org/v1"
# Short TTL cache to avoid hammering OpenF1 while still feeling live
_CACHE: Dict[str, tuple[Any, float]] = {}
TTL_SECONDS = 3.0

async def _fetch(path: str, params: Dict[str, Any] = None, ttl: float = TTL_SECONDS, retries: int = 2) -> Any:
    key = f"{path}:{str(sorted((params or {}).items()))}"
    now = time.time()
    if key in _CACHE:
        data, ts = _CACHE[key]
        if now - ts < ttl:
            return data
    last_exc = None
    for attempt in range(retries + 1):
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                r = await client.get(f"{OPENF1_BASE}{path}", params=params or {})
                if r.status_code == 429:
                    # rate limited — backoff and retry, or return stale
                    if attempt < retries:
                        await _sleep(0.5 * (attempt + 1))
                        continue
                    if key in _CACHE:
                        return _CACHE[key][0]
                r.raise_for_status()
                data = r.json()
                _CACHE[key] = (data, now)
                return data
        except Exception as e:
            last_exc = e
            if attempt < retries:
                # check if 429
                try:
                    if hasattr(e, 'response') and e.response is not None and e.response.status_code == 429:
                        await _sleep(0.7 * (attempt + 1))
                        continue
                except:
                    pass
                await _sleep(0.3)
                continue
            if key in _CACHE:
                return _CACHE[key][0]
            raise last_exc
    if key in _CACHE:
        return _CACHE[key][0]
    raise last_exc

import asyncio as _asyncio
async def _sleep(s): await _asyncio.sleep(s)

async def get_sessions(year: Optional[int] = None) -> Any:
    params = {}
    if year:
        params["year"] = year
    return await _fetch("/sessions", params, ttl=10)

async def get_drivers(session_key: int) -> Any:
    return await _fetch("/drivers", {"session_key": session_key}, ttl=30)

async def get_positions(session_key: int) -> Any:
    # Latest positions — cache very short
    return await _fetch("/position", {"session_key": session_key}, ttl=2)

async def get_intervals(session_key: int) -> Any:
    return await _fetch("/intervals", {"session_key": session_key}, ttl=2)

async def get_laps(session_key: int, driver_number: Optional[int] = None) -> Any:
    p = {"session_key": session_key}
    if driver_number:
        p["driver_number"] = driver_number
    return await _fetch("/laps", p, ttl=3)

async def get_stints(session_key: int) -> Any:
    return await _fetch("/stints", {"session_key": session_key}, ttl=5)

async def get_car_data(session_key: int) -> Any:
    return await _fetch("/car_data", {"session_key": session_key}, ttl=2)

async def get_weather(session_key: int) -> Any:
    return await _fetch("/weather", {"session_key": session_key}, ttl=10)

async def get_location(session_key: int) -> Any:
    return await _fetch("/location", {"session_key": session_key}, ttl=5)
