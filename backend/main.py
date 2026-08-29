from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import re
import time
import fastf1
import httpx
from dotenv import load_dotenv
from contextlib import asynccontextmanager

from f1_data import (
    get_available_races,
    get_drivers,
    get_lap_times,
    get_tire_strategy,
    get_rivalry_stats,
    get_recent_form,
    get_lap_telemetry,
    get_career_stats
)
from ai_advisor import get_fantasy_picks, explain_lap, get_rivalry_analysis, get_circuit_insight, get_career_comparison

load_dotenv()

# Setup Rate Limiting
limiter = Limiter(key_func=get_remote_address)
APP_VERSION = os.getenv("APP_VERSION", "1.0.0")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    from ai_advisor import AI_PROVIDER, AI_ENABLED, AI_BASE_URL, DEFAULT_MODEL
    if not AI_ENABLED:
        print(f"[WARNING] AI disabled (provider={AI_PROVIDER}). Set GEMINI_API_KEY or OPENROUTER_API_KEY/OPENAI_API_KEY/NVIDIA_API_KEY to enable AI features. Deterministic fallbacks will be used.")
    else:
        print(f"[INFO] AI enabled provider={AI_PROVIDER} model={DEFAULT_MODEL} base={AI_BASE_URL}")
    if os.getenv("API_SECRET_KEY", "fallback_dev_key") == "fallback_dev_key" and os.getenv("RENDER") == "true":
        print("[WARNING] API_SECRET_KEY is still fallback_dev_key in production! Set a strong random key via Render envVars.")
    cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
    try:
        os.makedirs(cache_dir, exist_ok=True)
        print(f"[INFO] FastF1 cache directory ready at {cache_dir}")
    except Exception as e:
        print(f"[WARNING] Could not create cache dir {cache_dir}: {e} (cache failures will not crash API)")
    yield
    # Shutdown (no-op)

app = FastAPI(title="BoxBox Backend", version=APP_VERSION, lifespan=lifespan)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed Origins — production-safe: filter empties, warn on wildcard
origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [o.strip() for o in origins_env.split(",") if o.strip()]
if not origins:
    origins = ["http://localhost:5173"]
    print("[WARNING] ALLOWED_ORIGINS empty after parsing, falling back to http://localhost:5173")
if "*" in origins:
    print("[WARNING] ALLOWED_ORIGINS contains '*'. This disables credentialed CORS security. Prefer explicit origins.")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key Verification Dependency
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "fallback_dev_key")
if len(API_SECRET_KEY) < 16 and os.getenv("RENDER") == "true":
    print("[WARNING] API_SECRET_KEY is weak (<16 chars) in production.")

def _sanitize_text_input(value: str, max_len: int = 100) -> str:
    """Strip control chars and limit length to prevent prompt injection."""
    if not isinstance(value, str):
        return ""
    v = re.sub(r"[\x00-\x1f\x7f]", "", value).strip()
    if len(v) > max_len:
        v = v[:max_len]
    # Remove obvious prompt-injection markers
    v = re.sub(r"(?i)(system:|assistant:|user:)", "", v)
    return v
async def verify_api_key(request: Request):
    """Enforce X-API-Key header on every route strictly as requested."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=403, detail="API key is missing")
    if api_key != API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key

# Models
class FantasyPicksReq(BaseModel):
    race: str
    year: int

    @field_validator("race")
    @classmethod
    def validate_race(cls, v):
        v = _sanitize_text_input(v, 80)
        if len(v) < 3:
            raise ValueError("race must be >=3 chars")
        return v

class CareerCompareReq(BaseModel):
    driver1_id: str
    driver2_id: str

    @field_validator("driver1_id", "driver2_id")
    @classmethod
    def validate_driver(cls, v):
        v = _sanitize_text_input(v, 20).upper()
        if not re.match(r"^[A-Z0-9]{2,10}$", v):
            raise ValueError("invalid driver id")
        return v

# --- API Endpoints ---

@app.get("/api/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Public health endpoint, no API key needed for basic check."""
    import datetime
    try:
        from ai_advisor import AI_PROVIDER, DEFAULT_MODEL, AI_ENABLED, AI_BASE_URL
        # Probe data services (lightweight, no heavy FastF1 load)
        services = {}
        try:
            import requests
            r = requests.get("https://api.openf1.org/v1/sessions?year=2025&session_type=Race", timeout=3)
            services["openf1"] = "ok" if r.ok else f"error:{r.status_code}"
        except Exception as e:
            services["openf1"] = f"unavailable:{str(e)[:80]}"
        try:
            import fastf1
            services["fastf1"] = "ok"
        except Exception as e:
            services["fastf1"] = str(e)[:80]
        try:
            import httpx
            async def _probe_jolpica():
                try:
                    async with httpx.AsyncClient(timeout=3) as c:
                        rr = await c.get("https://api.jolpi.ca/ergast/f1/2025/driverStandings.json")
                        return "ok" if rr.status_code == 200 else f"error:{rr.status_code}"
                except Exception as ee:
                    return f"unavailable:{str(ee)[:60]}"
            # Avoid blocking health on slow external call in sync context; probe quickly
            services["jolpica"] = "probe_skipped"
        except Exception:
            services["jolpica"] = "unknown"
        return {
            "status": "ok",
            "version": APP_VERSION,
            "ai": f"{AI_PROVIDER}:{DEFAULT_MODEL}",
            "ai_enabled": AI_ENABLED,
            "ai_base_url": AI_BASE_URL,
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat(),
            "services": services,
        }
    except Exception as e:
        return {"status": "ok", "version": APP_VERSION, "ai": "gemini-1.5-pro", "error": str(e)[:200]}

@app.get("/api/debug-telemetry", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def debug_telemetry(request: Request):
    """Test endpoint to diagnose telemetry backend issues. Requires X-API-Key."""
    results = {}

    try:
        import fastf1  # noqa: F401
        results["fastf1"] = "ok"
    except Exception as e:
        results["fastf1"] = str(e)

    try:
        import requests
        response = requests.get(
            "https://api.openf1.org/v1/sessions?year=2026&session_type=Race",
            timeout=5,
        )
        data = response.json()
        results["openf1_2026"] = {
            "status": "ok",
            "count": len(data),
            "latest": data[-1].get("meeting_name") if data else None,
        }
    except Exception as e:
        results["openf1_2026"] = str(e)

    try:
        import google.generativeai as genai  # noqa: F401
        results["gemini"] = "imported ok"
    except Exception as e:
        results["gemini"] = str(e)

    try:
        from ai_advisor import AI_PROVIDER, AI_ENABLED, DEFAULT_MODEL, AI_BASE_URL
        results["ai_provider"] = AI_PROVIDER
        results["ai_model"] = DEFAULT_MODEL
        results["ai_base_url"] = AI_BASE_URL
        results["ai_enabled"] = AI_ENABLED
    except Exception as e:
        results["ai_provider"] = f"error: {e}"

    results["env"] = {
        "GEMINI_API_KEY": "set" if os.getenv("GEMINI_API_KEY") else "MISSING",
        "OPENROUTER_API_KEY": "set" if os.getenv("OPENROUTER_API_KEY") else "MISSING",
        "OPENAI_API_KEY": "set" if os.getenv("OPENAI_API_KEY") else "MISSING",
        "NVIDIA_API_KEY": "set" if os.getenv("NVIDIA_API_KEY") else "MISSING",
        "AI_PROVIDER": os.getenv("AI_PROVIDER") or "auto",
        "AI_MODEL": os.getenv("AI_MODEL") or os.getenv("OPENROUTER_MODEL") or os.getenv("NVIDIA_MODEL") or os.getenv("GEMINI_MODEL") or "default",
        "AI_BASE_URL": os.getenv("AI_BASE_URL") or "auto",
        "API_SECRET_KEY": "set" if os.getenv("API_SECRET_KEY") else "MISSING",
    }

    return results

@app.get("/api/races", dependencies=[Depends(verify_api_key)])
@limiter.limit("20/minute")
async def fetch_races(request: Request, year: int = 2024):
    races = get_available_races(year)
    if not races:
        raise HTTPException(status_code=404, detail="No races found.")
    return {"races": races}

@app.get("/api/drivers", dependencies=[Depends(verify_api_key)])
@limiter.limit("20/minute")
async def fetch_drivers(request: Request, year: int = 2024):
    drivers = get_drivers(year)
    if not drivers:
        raise HTTPException(status_code=404, detail="Drivers not found.")
    return {"drivers": drivers}

@app.get("/api/lap-times", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_lap_times_api(request: Request, year: int, race: str, session: str):
    race = _sanitize_text_input(race, 80)
    session = _sanitize_text_input(session, 10).upper()
    if session not in ("R", "Q", "S", "RACE", "QUALIFYING", "SPRINT"):
        raise HTTPException(status_code=400, detail="Invalid session. Use R, Q, or S.")
    if year < 2018 or year > 2027:
        raise HTTPException(status_code=400, detail="Year out of range (2018-2027)")
    try:
        data = get_lap_times(year, race, session[0])
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream lap-times failure: {str(e)[:200]}")
    if not data or not data.get("drivers"):
        raise HTTPException(status_code=404, detail="No lap times data available.")
    return data

@app.get("/api/tire-strategy", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_tire_strategy_api(request: Request, year: int, race: str):
    race = _sanitize_text_input(race, 80)
    if year < 2018 or year > 2027:
        raise HTTPException(status_code=400, detail="Year out of range")
    try:
        data = get_tire_strategy(year, race)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Upstream tire-strategy failure: {str(e)[:200]}")
    if not data:
        raise HTTPException(status_code=404, detail="No tire strategy available.")
    return {"data": data}

import asyncio

@app.get("/api/rivalry", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_rivalry_api(request: Request, year: int, driver1: str, driver2: str):
    driver1 = _sanitize_text_input(driver1, 10).upper()
    driver2 = _sanitize_text_input(driver2, 10).upper()
    if not re.match(r"^[A-Z]{2,3}$", driver1) or not re.match(r"^[A-Z]{2,3}$", driver2):
        raise HTTPException(status_code=400, detail="Invalid driver code")
    if year < 2018 or year > 2027:
        raise HTTPException(status_code=400, detail="Year out of range")
    try:
        stats = await asyncio.to_thread(get_rivalry_stats, year, driver1, driver2)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Rivalry computation failed upstream: {str(e)[:200]}")
    
    if not stats:
        raise HTTPException(status_code=404, detail="No rivalry data available.")
    
    try:
        ai_analysis = await asyncio.to_thread(get_rivalry_analysis, stats, driver1, driver2, year)
    except Exception as e:
        print(f"[Rivalry AI fallback] {e}")
        ai_analysis = ""
    
    return {
        "stats": stats,
        "aiAnalysis": ai_analysis
    }

@app.get("/api/telemetry", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_telemetry_api(request: Request, year: int, race: str, driver: str, lap: int):
    race = _sanitize_text_input(race, 80)
    driver = _sanitize_text_input(driver, 10).upper()
    if not re.match(r"^[A-Z]{2,3}$", driver):
        raise HTTPException(status_code=400, detail="Invalid driver code")
    if year < 2018 or year > 2027 or lap < 1 or lap > 100:
        raise HTTPException(status_code=400, detail="Invalid year/lap range")
    print(f"[Telemetry API] year={year} race={race} driver={driver} lap={lap}")
    try:
        telemetry = await asyncio.to_thread(get_lap_telemetry, year, race, driver, lap)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Telemetry upstream failure: {str(e)[:200]}")
    if not telemetry:
        raise HTTPException(status_code=404, detail="No telemetry available for this lap.")

    if telemetry.get("error"):
        telemetry["aiAnalysis"] = ""
        return telemetry

    try:
        ai_analysis = await asyncio.to_thread(explain_lap, telemetry, driver, race, lap)
    except Exception as e:
        print(f"[Telemetry AI Error] {e}")
        ai_analysis = ""

    telemetry["aiAnalysis"] = ai_analysis
    return telemetry

@app.get("/api/pitwall-alert", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_pitwall_alert(request: Request, circuit: str):
    circuit = _sanitize_text_input(circuit, 80)
    if len(circuit) < 3:
        raise HTTPException(status_code=400, detail="Invalid circuit")
    try:
        insight = await asyncio.to_thread(get_circuit_insight, circuit)
        return {"insight": insight}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Pitwall upstream failure: {str(e)[:200]}")

@app.post("/api/fantasy-picks", dependencies=[Depends(verify_api_key)])
@limiter.limit("5/minute")
async def fetch_fantasy_picks_api(request: Request, req: FantasyPicksReq):
    """Fetch AI-powered fantasy picks. Runs heavy computation in background thread."""
    try:
        # Run the heavy form data collection (uses OpenF1 primarily with fastf1 fallback)
        form_data_response = await get_current_form_data()
        form_data = form_data_response["form_data"]
        # Run AI picks generation in a thread  
        picks = await asyncio.to_thread(get_fantasy_picks, req.race, form_data)
        picks["form_data"] = form_data
        picks["source"] = form_data_response.get("source", "")
        return picks
    except Exception as e:
        print(f"[Fantasy Error] {e}")
        return {
            "error": True,
            "message": f"Fantasy picks generation failed: {str(e)}",
            "drivers": [],
            "constructor": {"name": "Unknown", "reasoning": ""},
            "key_insight": "Analysis temporarily unavailable.",
            "drivers_to_avoid": [],
            "form_data": {},
            "source": ""
        }


def _collect_form_data() -> dict:
    """Collect recent form data for top drivers. Called in a thread. (Fallback)"""
    top_drivers = ["VER", "LEC", "NOR", "SAI", "PIA", "HAM", "RUS", "ALO"]
    form_data = {}
    for drv in top_drivers:
        try:
            form = get_recent_form(drv, n=3)
            if form:
                form_data[drv] = form.get("recent", [])
        except:
            continue
    return form_data

async def get_current_form_data() -> dict:
    """Helper to fetch current season form data from OpenF1 (2026 → 2025 fallback → FastF1 2024)."""
    for year in [2026, 2025]:
        try:
            async with httpx.AsyncClient(timeout=15.0) as client:
                sess_resp = await client.get(f"https://api.openf1.org/v1/sessions?year={year}")
                sess_resp.raise_for_status()
                sessions = sess_resp.json()
                
                completed_races = [s for s in sessions if s.get("session_type") == "Race" and s.get("session_key")]
                if not completed_races:
                    print(f"[OpenF1] No completed {year} races found, trying next year...")
                    continue
                    
                last_3 = sorted(completed_races, key=lambda x: x["date_start"], reverse=True)[:3]
                
                form_data = {}
                drivers_resp = await client.get(f"https://api.openf1.org/v1/drivers?session_key={last_3[0]['session_key']}")
                drivers_resp.raise_for_status()
                drivers = drivers_resp.json()
                
                driver_codes = {str(d["driver_number"]): d.get("name_acronym", "UNK") for d in drivers}
                
                for s in last_3:
                    pos_resp = await client.get(f"https://api.openf1.org/v1/position?session_key={s['session_key']}")
                    pos_resp.raise_for_status()
                    pos_data = pos_resp.json()
                    
                    final_pos = {}
                    for p in pos_data:
                        drv_num = str(p.get("driver_number"))
                        final_pos[drv_num] = p.get("position")
                    
                    for drv_num, pos in final_pos.items():
                        code = driver_codes.get(drv_num, "UNK")
                        if code not in form_data:
                            form_data[code] = []
                        form_data[code].append({
                            "race": s.get("location", "Unknown GP"),
                            "position": pos,
                            "points": 0
                        })
                
                print(f"[OpenF1] Successfully loaded {year} form data ({len(last_3)} races)")
                return {"form_data": form_data, "source": f"OpenF1 {year}"}
                
        except Exception as e:
            print(f"[OpenF1 {year} Error] {e}")
    
    # Final fallback: FastF1 2024 cached data
    print("[Form Data] Falling back to FastF1 2024")
    form_data = await asyncio.to_thread(_collect_form_data)
    return {"form_data": form_data, "source": "FastF1 2024"}

@app.get("/api/current-form", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_current_form(request: Request):
    return await get_current_form_data()


# --- Standings Endpoints (via Jolpica API) ---

@app.get("/api/standings/drivers", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def fetch_driver_standings(request: Request, year: int = 2025):
    """Fetch current driver championship standings from Jolpica (Ergast) API."""
    url = f"https://api.jolpi.ca/ergast/f1/{year}/driverStandings.json"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not standings_list:
            raise HTTPException(status_code=404, detail="No standings data found.")
        standings = standings_list[0]["DriverStandings"]
        result = []
        for entry in standings:
            result.append({
                "position": int(entry["position"]),
                "points": float(entry["points"]),
                "wins": int(entry["wins"]),
                "code": entry["Driver"].get("code", entry["Driver"]["driverId"].upper()[:3]),
                "name": f"{entry['Driver']['givenName']} {entry['Driver']['familyName']}",
                "nationality": entry["Driver"]["nationality"],
                "team": entry["Constructors"][0]["name"] if entry["Constructors"] else "Unknown",
                "positionChange": 0,
            })
        return {"standings": result, "season": year, "round": standings_list[0].get("round", "N/A")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch standings: {str(e)}")


@app.get("/api/standings/constructors", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def fetch_constructor_standings(request: Request, year: int = 2025):
    """Fetch current constructor championship standings from Jolpica (Ergast) API."""
    url = f"https://api.jolpi.ca/ergast/f1/{year}/constructorStandings.json"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            data = resp.json()
        standings_list = data["MRData"]["StandingsTable"]["StandingsLists"]
        if not standings_list:
            raise HTTPException(status_code=404, detail="No constructor standings found.")
        standings = standings_list[0]["ConstructorStandings"]
        result = []
        for entry in standings:
            result.append({
                "position": int(entry["position"]),
                "points": float(entry["points"]),
                "wins": int(entry["wins"]),
                "name": entry["Constructor"]["name"],
                "nationality": entry["Constructor"]["nationality"],
                "positionChange": 0,
            })
        return {"standings": result, "season": year, "round": standings_list[0].get("round", "N/A")}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Failed to fetch constructor standings: {str(e)}")


# --- Career Timeline Endpoint ---

@app.get("/api/career", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_career_stats(request: Request, driver: str):
    """Fetch complete career stats for a driver from Jolpica Ergast API."""
    if not driver:
        raise HTTPException(status_code=400, detail="Missing 'driver' query parameter.")
    try:
        data = await asyncio.to_thread(get_career_stats, driver)
        if not data:
            raise HTTPException(status_code=404, detail=f"No career data found for driver: {driver}")
        return data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Career data fetch failed: {str(e)}")


@app.post("/api/career-compare", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_career_compare(request: Request, req: CareerCompareReq):
    """Compare two drivers' careers with AI-powered verdict."""
    try:
        stats1 = await asyncio.to_thread(get_career_stats, req.driver1_id)
        stats2 = await asyncio.to_thread(get_career_stats, req.driver2_id)
        if not stats1 or not stats2:
            raise HTTPException(status_code=404, detail="Career data not found for one or both drivers.")
        d1_name = f"{stats1['driver_info']['givenName']} {stats1['driver_info']['familyName']}"
        d2_name = f"{stats2['driver_info']['givenName']} {stats2['driver_info']['familyName']}"
        verdict = await asyncio.to_thread(get_career_comparison, d1_name, d2_name, stats1, stats2)
        return {"verdict": verdict}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Career comparison failed: {str(e)}")


# --- Live Timing Endpoints (OpenF1) ---

@app.get("/api/live/sessions", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def live_sessions(request: Request, year: int = 2025):
    """List OpenF1 sessions for a year."""
    if year < 2023 or year > 2027:
        raise HTTPException(status_code=400, detail="Year out of range")
    try:
        from services.openf1.client import get_sessions
        data = await get_sessions(year)
        return {"sessions": data, "year": year}
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"OpenF1 sessions unavailable: {str(e)[:200]}")

@app.get("/api/live/discover", dependencies=[Depends(verify_api_key)])
@limiter.limit("30/minute")
async def live_discover(request: Request, year: int = None):
    """Auto-discover current live and next session."""
    try:
        from services.openf1.timing import discover_sessions
        result = await discover_sessions(year)
        return result
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Discover failed: {str(e)[:200]}")

@app.get("/api/live/timing", dependencies=[Depends(verify_api_key)])
@limiter.limit("60/minute")
async def live_timing(request: Request, session_key: int = None, year: int = None, meeting_name: str = None, session_type: str = None):
    """Full timing tower for a session. Provide session_key or year+meeting_name+session_type."""
    try:
        from services.openf1.client import get_sessions
        from services.openf1.timing import build_timing
        if not session_key:
            if not (year and meeting_name and session_type):
                raise HTTPException(status_code=400, detail="Provide session_key or year+meeting_name+session_type")
            meeting_name = _sanitize_text_input(meeting_name, 80)
            session_type = _sanitize_text_input(session_type, 30)
            sessions = await get_sessions(year)
            # find matching
            target = None
            for s in sessions:
                if s.get("meeting_name", "").lower() == meeting_name.lower() and s.get("session_name", "").lower() == session_type.lower():
                    target = s
                    break
                if s.get("meeting_name", "").lower() in meeting_name.lower() or meeting_name.lower() in s.get("meeting_name", "").lower():
                    if s.get("session_type", "").lower() == session_type.lower() or s.get("session_name", "").lower() == session_type.lower():
                        target = s
            if not target:
                raise HTTPException(status_code=404, detail="Session not found")
            session_key = target.get("session_key")
        result = await build_timing(int(session_key))
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Live timing unavailable: {str(e)[:300]}")

@app.get("/api/live/stream", dependencies=[Depends(verify_api_key)])
async def live_stream(request: Request, session_key: int):
    """SSE stream for live timing (polls OpenF1 every 3s, pushes JSON)."""
    from fastapi.responses import StreamingResponse
    import json, asyncio
    from services.openf1.timing import build_timing

    async def event_gen():
        while True:
            if await request.is_disconnected():
                break
            try:
                data = await build_timing(int(session_key))
                payload = json.dumps(data)
                yield f"data: {payload}\n\n"
            except Exception as e:
                yield f"data: {json.dumps({'error': str(e)[:200]})}\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(event_gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache", "Connection": "keep-alive"})
