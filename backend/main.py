from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
import os
import fastf1
import httpx
from dotenv import load_dotenv

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
app = FastAPI(title="BoxBox Backend", version="1.0.0")
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Allowed Origins
origins_env = os.getenv("ALLOWED_ORIGINS", "http://localhost:5173")
origins = [origin.strip() for origin in origins_env.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API Key Verification Dependency
API_SECRET_KEY = os.getenv("API_SECRET_KEY", "fallback_dev_key")
async def verify_api_key(request: Request):
    """Enforce X-API-Key header on every route strictly as requested."""
    api_key = request.headers.get("X-API-Key")
    if not api_key:
        raise HTTPException(status_code=403, detail="API key is missing")
    if api_key != API_SECRET_KEY:
        raise HTTPException(status_code=403, detail="Invalid API key")
    return api_key

# Event on startup
@app.on_event("startup")
async def startup_event():
    # Support GEMINI_API_KEY (legacy) and OPENROUTER_API_KEY / OPENAI_API_KEY / AI_PROVIDER
    from ai_advisor import AI_PROVIDER, AI_ENABLED, AI_BASE_URL, DEFAULT_MODEL
    if not AI_ENABLED:
        print(f"[WARNING] AI disabled (provider={AI_PROVIDER}). Set GEMINI_API_KEY or OPENROUTER_API_KEY/OPENAI_API_KEY to enable AI features. Deterministic fallbacks will be used.")
    else:
        print(f"[INFO] AI enabled provider={AI_PROVIDER} model={DEFAULT_MODEL} base={AI_BASE_URL}")
    
    # Verify Cache structure exists
    cache_dir = os.path.join(os.path.dirname(__file__), 'cache')
    if not os.path.exists(cache_dir):
        os.makedirs(cache_dir)
        print(f"[INFO] Created FastF1 cache directory at {cache_dir}")
    else:
        print(f"[INFO] FastF1 cache directory ready at {cache_dir}")

# Models
class FantasyPicksReq(BaseModel):
    race: str
    year: int

class CareerCompareReq(BaseModel):
    driver1_id: str
    driver2_id: str

# --- API Endpoints ---

@app.get("/api/health")
@limiter.limit("60/minute")
async def health_check(request: Request):
    """Public health endpoint, no API key needed for basic check."""
    try:
        from ai_advisor import AI_PROVIDER, DEFAULT_MODEL, AI_ENABLED
        return {"status": "ok", "ai": f"{AI_PROVIDER}:{DEFAULT_MODEL}", "ai_enabled": AI_ENABLED}
    except Exception:
        return {"status": "ok", "ai": "gemini-1.5-pro"}

@app.get("/api/debug-telemetry")
async def debug_telemetry():
    """Test endpoint to diagnose telemetry backend issues."""
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
    data = get_lap_times(year, race, session)
    if not data or not data.get("drivers"):
        raise HTTPException(status_code=404, detail="No lap times data available.")
    return data

@app.get("/api/tire-strategy", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_tire_strategy_api(request: Request, year: int, race: str):
    data = get_tire_strategy(year, race)
    if not data:
        raise HTTPException(status_code=404, detail="No tire strategy available.")
    return {"data": data}

import asyncio

@app.get("/api/rivalry", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_rivalry_api(request: Request, year: int, driver1: str, driver2: str):
    try:
        stats = await asyncio.to_thread(get_rivalry_stats, year, driver1, driver2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Rivalry computation failed: {str(e)}")
    
    if not stats:
        raise HTTPException(status_code=404, detail="No rivalry data available.")
    
    try:
        ai_analysis = await asyncio.to_thread(get_rivalry_analysis, stats, driver1, driver2, year)
    except Exception:
        ai_analysis = ""
    
    return {
        "stats": stats,
        "aiAnalysis": ai_analysis
    }

@app.get("/api/telemetry", dependencies=[Depends(verify_api_key)])
@limiter.limit("10/minute")
async def fetch_telemetry_api(request: Request, year: int, race: str, driver: str, lap: int):
    print(f"[Telemetry API] year={year} race={race} driver={driver} lap={lap}")
    telemetry = await asyncio.to_thread(get_lap_telemetry, year, race, driver, lap)
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
    try:
        insight = await asyncio.to_thread(get_circuit_insight, circuit)
        return {"insight": insight}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

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
