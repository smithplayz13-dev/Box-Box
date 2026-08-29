import os
import time
import fastf1
import pandas as pd
import numpy as np
import requests
from typing import Dict, Any, List
from datetime import datetime, timezone

OPENF1_BASE = "https://api.openf1.org/v1"

def should_use_openf1(year: int) -> bool:
    return int(year) >= 2025

RACE_NAME_MAP = {
  "Albert Park Circuit": "Australia",
  "Jeddah Corniche Circuit": "Saudi Arabia",
  "Bahrain International Circuit": "Bahrain",
  "Monaco Circuit": "Monaco",
  "Circuit de Barcelona": "Spain",
  "Silverstone Circuit": "British",
  "Monza Circuit": "Italian",
  "Suzuka Circuit": "Japanese",
  "Singapore Street Circuit": "Singapore",
  "Circuit of the Americas": "United States",
  "Interlagos Circuit": "Brazilian",
  "Yas Marina Circuit": "Abu Dhabi",
  "Hungaroring": "Hungary",
  "Spa-Francorchamps": "Belgium",
  "Zandvoort Circuit": "Netherlands",
  "Red Bull Ring": "Austria",
  "Baku City Circuit": "Azerbaijan",
  "Miami International Autodrome": "Miami",
  "Las Vegas Street Circuit": "Las Vegas",
  "Lusail International Circuit": "Qatar",
  "Mexico City Circuit": "Mexico",
  "Shanghai International Circuit": "China",
  "Imola Circuit": "Emilia Romagna",
  "Circuit Gilles-Villeneuve": "Canada"
}

# Setup Cache
CACHE_DIR = os.path.join(os.path.dirname(__file__), 'cache')
os.makedirs(CACHE_DIR, exist_ok=True)
fastf1.Cache.enable_cache(CACHE_DIR)

# Suppress warnings
pd.options.mode.chained_assignment = None

# --- In-Memory Cache with TTL ---
_mem_cache: Dict[str, Any] = {}
CACHE_TTL = 3600  # 1 hour

def _cache_get(key: str):
    """Return cached value if exists and not expired, else None."""
    if key in _mem_cache:
        data, ts = _mem_cache[key]
        if time.time() - ts < CACHE_TTL:
            return data
        del _mem_cache[key]
    return None

def _cache_set(key: str, data):
    """Store data in memory cache with current timestamp."""
    _mem_cache[key] = (data, time.time())


def get_hardcoded_calendar(year: int) -> list:
    calendars = {
        2026: [
            "Australian Grand Prix",
            "Chinese Grand Prix",
            "Japanese Grand Prix",
            "Bahrain Grand Prix",
        ],
        2025: [
            "Australian Grand Prix",
            "Chinese Grand Prix",
            "Japanese Grand Prix",
            "Bahrain Grand Prix",
            "Saudi Arabian Grand Prix",
            "Miami Grand Prix",
            "Emilia Romagna Grand Prix",
            "Monaco Grand Prix",
            "Spanish Grand Prix",
            "Canadian Grand Prix",
            "Austrian Grand Prix",
            "British Grand Prix",
            "Belgian Grand Prix",
            "Hungarian Grand Prix",
            "Dutch Grand Prix",
            "Italian Grand Prix",
            "Azerbaijan Grand Prix",
            "Singapore Grand Prix",
            "United States Grand Prix",
            "Mexico City Grand Prix",
            "São Paulo Grand Prix",
            "Las Vegas Grand Prix",
            "Qatar Grand Prix",
            "Abu Dhabi Grand Prix",
        ],
    }
    return calendars.get(int(year), calendars[2025])


def race_has_data(year: int, race_name: str) -> bool:
    """Check if a race has actually happened and has data available."""
    future_races = [
        "Abu Dhabi Grand Prix",
        "Qatar Grand Prix",
        "Las Vegas Grand Prix",
        "São Paulo Grand Prix",
        "Mexico City Grand Prix",
        "United States Grand Prix",
        "Singapore Grand Prix",
    ]

    if int(year) == 2026 and race_name in future_races:
        return False

    if not should_use_openf1(year):
        return True

    try:
        res = requests.get(
            f"{OPENF1_BASE}/sessions?year={year}&meeting_name={race_name}&session_type=Race",
            timeout=5,
        )
        data = res.json()
        return len(data) > 0
    except Exception:
        return True


def _empty_telemetry_payload(error_message: str) -> dict:
    return {
        "error": error_message,
        "lap_time": "--:--.---",
        "sector1": 0,
        "sector2": 0,
        "sector3": 0,
        "max_speed": 0,
        "avg_speed": 0,
        "sector_deltas": {"s1": 0, "s2": 0, "s3": 0},
    }

def get_available_races(year: int) -> list:
    if should_use_openf1(year):
        try:
            res = requests.get(f"{OPENF1_BASE}/sessions?year={year}&session_type=Race", timeout=10)
            data = res.json()
            races = []
            seen = set()
            now = datetime.now(timezone.utc)

            for session in data:
                name = session.get('meeting_name', '')
                date_start = session.get('date_start')

                if date_start:
                    try:
                        race_date = datetime.fromisoformat(date_start.replace('Z', '+00:00'))
                        if int(year) >= now.year and race_date > now:
                            continue
                    except Exception:
                        pass

                if name and name not in seen:
                    seen.add(name)
                    races.append(name)

            if len(races) == 0:
                print(f"[OpenF1] No races found for {year}, using calendar fallback.")
                return get_hardcoded_calendar(year)

            return races
        except Exception as e:
            print(f"[OpenF1 races error] {e}")
            return get_hardcoded_calendar(year)
    else:
        try:
            events = fastf1.get_event_schedule(year)
            races = events[events['EventFormat'] != 'testing']
            return races['EventName'].tolist()
        except Exception as e:
            print(f"[FastF1 Error] get_available_races: {e}")
            return get_hardcoded_calendar(year)

def get_drivers(year: int) -> list:
    """Returns list of drivers for dropdowns."""
    if should_use_openf1(year):
        try:
            # Get drivers from the first available session of the year
            sessions_res = requests.get(f"{OPENF1_BASE}/sessions?year={year}&session_type=Race", timeout=10)
            sessions = sessions_res.json()
            if not sessions: return []
            
            session_key = sessions[0]['session_key']
            drivers_res = requests.get(f"{OPENF1_BASE}/drivers?session_key={session_key}", timeout=10)
            drivers_data = drivers_res.json()
            
            drivers = []
            for d in drivers_data:
                drivers.append({
                    "code": d.get('name_acronym', str(d['driver_number'])),
                    "name": d.get('full_name', str(d['driver_number'])),
                    "team": d.get('team_name', 'Unknown')
                })
            return drivers
        except Exception as e:
            print(f"[OpenF1 Error] get_drivers: {e}")
            return []
    else:
        try:
            events = fastf1.get_event_schedule(year)
            valid_events = events[events['EventFormat'] != 'testing']
            if valid_events.empty: return []
            first_race = valid_events.iloc[0]['EventName']
            session = fastf1.get_session(year, first_race, 'R')
            session.load(telemetry=False, weather=False, messages=False)
            
            drivers = []
            for drv in session.drivers:
                drv_info = session.get_driver(drv)
                code = drv_info.get('Abbreviation', str(drv))
                name = drv_info.get('FullName', code)
                team = drv_info.get('TeamName', 'Unknown')
                drivers.append({"code": code, "name": name, "team": team})
            return drivers
        except Exception as e:
            print(f"[FastF1 Error] get_drivers: {e}")
            return []

def get_lap_times(year: int, race: str, session_type: str) -> dict:
    if should_use_openf1(year):
        try:
            type_map = {'R': 'Race', 'Q': 'Qualifying', 'S': 'Sprint'}
            session_name = type_map.get(session_type, 'Race')
            
            sessions = requests.get(
                f"{OPENF1_BASE}/sessions?year={year}&meeting_name={race}&session_type={session_name}",
                timeout=10
            ).json()
            if not sessions: return {}
            session_key = sessions[0]['session_key']
            
            laps_data = requests.get(f"{OPENF1_BASE}/laps?session_key={session_key}", timeout=15).json()
            drivers_data = requests.get(f"{OPENF1_BASE}/drivers?session_key={session_key}", timeout=10).json()
            
            driver_map = {d['driver_number']: d.get('name_acronym', str(d['driver_number'])) for d in drivers_data}
            lap_dict = {}
            for lap in laps_data:
                num = lap.get('driver_number')
                code = driver_map.get(num, str(num))
                duration = lap.get('lap_duration')
                if duration and duration > 0:
                    if code not in lap_dict: lap_dict[code] = []
                    lap_dict[code].append(round(duration, 3))
            
            top_drivers = sorted(lap_dict.keys(), key=lambda x: len(lap_dict[x]), reverse=True)[:10]
            return {"drivers": top_drivers, "laps": {d: lap_dict[d] for d in top_drivers}}
        except Exception as e:
            print(f"[OpenF1 lap times error] {e}")
            return {}
    else:
        try:
            race = RACE_NAME_MAP.get(race, race)
            session = fastf1.get_session(year, race, session_type)
            session.load(telemetry=False, weather=False, messages=False)
            
            laps = session.laps
            drivers_list = []
            laps_dict = {}
            
            for drv in session.drivers:
                drv_info = session.get_driver(drv)
                drv_code = drv_info.get('Abbreviation', str(drv))
                drv_laps = laps.pick_driver(drv)
                
                if drv_laps.empty:
                    continue
                    
                valid_laps = drv_laps.pick_quicklaps()
                if valid_laps.empty:
                    valid_laps = drv_laps
                    
                lap_seconds = []
                for _, lap in valid_laps.iterrows():
                    try:
                        sec = lap['LapTime'].total_seconds()
                        if pd.notna(sec):
                            lap_seconds.append(round(sec, 3))
                    except:
                        continue
                        
                if lap_seconds:
                    drivers_list.append(drv_code)
                    laps_dict[drv_code] = lap_seconds
                    
            drivers_list = drivers_list[:10]
            final_laps_dict = {d: laps_dict[d] for d in drivers_list}
            
            return {
                "drivers": drivers_list,
                "laps": final_laps_dict
            }
        except Exception as e:
            print(f"[FastF1 Error] get_lap_times: {e}")
            return {}

def get_tire_strategy(year: int, race: str) -> list:
    if should_use_openf1(year):
        try:
            sessions = requests.get(f"{OPENF1_BASE}/sessions?year={year}&meeting_name={race}&session_type=Race", timeout=10).json()
            if not sessions: return []
            session_key = sessions[0]['session_key']
            
            stints = requests.get(f"{OPENF1_BASE}/stints?session_key={session_key}", timeout=10).json()
            drivers_data = requests.get(f"{OPENF1_BASE}/drivers?session_key={session_key}", timeout=10).json()
            
            driver_map = {d['driver_number']: d.get('name_acronym', str(d['driver_number'])) for d in drivers_data}
            driver_names = {d['driver_number']: d.get('full_name', str(d['driver_number'])) for d in drivers_data}
            
            driver_stints = {}
            for stint in stints:
                num = stint.get('driver_number')
                code = driver_map.get(num, str(num))
                name = driver_names.get(num, str(num))
                
                if code not in driver_stints:
                    driver_stints[code] = {'driver': f"{code} ({name})", 'stints': [], 'pit_laps': []}
                
                compound = stint.get('compound', 'UNKNOWN').upper()
                lap_start = stint.get('lap_start', 0)
                lap_end = stint.get('lap_end', 0)
                laps = max(0, lap_end - lap_start)
                
                driver_stints[code]['stints'].append({'compound': compound, 'laps': laps})
                if lap_start > 1:
                    driver_stints[code]['pit_laps'].append(lap_start)
            
            return list(driver_stints.values())[:10]
        except Exception as e:
            print(f"[OpenF1 tire strategy error] {e}")
            return []
    else:
        try:
            race = RACE_NAME_MAP.get(race, race)
            session = fastf1.get_session(year, race, 'R')
            session.load(telemetry=False, weather=False, messages=False)
            
            laps = session.laps
            result = []
            
            for drv in session.drivers:
                drv_info = session.get_driver(drv)
                drv_code = drv_info.get('Abbreviation', str(drv))
                full_name = drv_info.get('FullName', drv_code)
                drv_laps = laps.pick_driver(drv)
                
                if drv_laps.empty:
                    continue
                    
                stints_df = drv_laps[['Stint', 'Compound', 'LapNumber']].dropna()
                if stints_df.empty:
                    continue
                    
                stints_list = []
                pit_laps = []
                
                grouped = stints_df.groupby('Stint')
                for stint_num, group in grouped:
                    stints_list.append({
                        "compound": group['Compound'].iloc[0],
                        "laps": int(len(group))
                    })
                    if stint_num > 1.0:
                        pit_laps.append(int(group['LapNumber'].min()))
                        
                result.append({
                    "driver": f"{drv_code} ({full_name})",
                    "stints": stints_list,
                    "pit_laps": pit_laps
                })
                
            return result
        except Exception as e:
            print(f"[FastF1 Error] get_tire_strategy: {e}")
            return []

def _load_season_results(year: int) -> dict:
    """Load all race + quali results for an entire season ONCE and cache them.
    Returns dict: { race_name: { "R": results_df, "Q": results_df } }
    """
    cache_key = f"season_results_{year}"
    cached = _cache_get(cache_key)
    if cached is not None:
        return cached

    print(f"[FastF1] Loading full season results for {year} (first time — may take a while)...")
    all_results = {}
    events = fastf1.get_event_schedule(year)
    completed = events[events['EventDate'] < pd.Timestamp.now()]
    
    for _, event in completed.iterrows():
        if event['EventFormat'] == 'testing':
            continue
        race_name = event['EventName']
        all_results[race_name] = {}
        
        # Load Race
        try:
            r_session = fastf1.get_session(year, race_name, 'R')
            r_session.load(telemetry=False, weather=False, messages=False, laps=False)
            all_results[race_name]["R"] = r_session.results
        except:
            all_results[race_name]["R"] = pd.DataFrame()
        
        # Load Quali
        try:
            q_session = fastf1.get_session(year, race_name, 'Q')
            q_session.load(telemetry=False, weather=False, messages=False, laps=False)
            all_results[race_name]["Q"] = q_session.results
        except:
            all_results[race_name]["Q"] = pd.DataFrame()
    
    _cache_set(cache_key, all_results)
    print(f"[FastF1] Season {year} results cached in memory.")
    return all_results


def get_rivalry_stats(year: int, driver1: str, driver2: str) -> dict:
    """Get head-to-head rivalry stats. Uses cached season results."""
    # Note: OpenF1 doesn't have a simple aggregate results API, so we still rely on FastF1
    # for historical. For 2025/2026, FastF1 might lag but should eventually support results.
    # If the user wants 2025/2026 rivalry, we'll try FastF1 but return empty if it fails.
    cache_key = f"rivalry_{year}_{driver1}_{driver2}"
    cached = _cache_get(cache_key)
    if cached is not None:
        print(f"[Cache HIT] rivalry {driver1} vs {driver2} ({year})")
        return cached

    try:
        season_data = _load_season_results(year)

        d1_q_wins = 0
        d2_q_wins = 0
        d1_r_wins = 0
        d2_r_wins = 0
        d1_pts = 0
        d2_pts = 0

        for race_name, sessions in season_data.items():
            res = sessions.get("R", pd.DataFrame())
            if not res.empty:
                d1_res = res[res['Abbreviation'] == driver1]
                d2_res = res[res['Abbreviation'] == driver2]
                
                if not d1_res.empty:
                    d1_pts += float(d1_res.iloc[0].get('Points', 0))
                if not d2_res.empty:
                    d2_pts += float(d2_res.iloc[0].get('Points', 0))
                
                if not d1_res.empty and not d2_res.empty:
                    try:
                        p1 = int(d1_res.iloc[0]['Position'])
                        p2 = int(d2_res.iloc[0]['Position'])
                        if p1 < p2: d1_r_wins += 1
                        if p2 < p1: d2_r_wins += 1
                    except: pass

            q_res = sessions.get("Q", pd.DataFrame())
            if not q_res.empty:
                d1_q = q_res[q_res['Abbreviation'] == driver1]
                d2_q = q_res[q_res['Abbreviation'] == driver2]
                if not d1_q.empty and not d2_q.empty:
                    try:
                        p1 = int(d1_q.iloc[0]['Position'])
                        p2 = int(d2_q.iloc[0]['Position'])
                        if p1 < p2: d1_q_wins += 1
                        if p2 < p1: d2_q_wins += 1
                    except: pass

        result = {
            "qualifying": {driver1: d1_q_wins, driver2: d2_q_wins},
            "race_wins": {driver1: d1_r_wins, driver2: d2_r_wins},
            "points": {driver1: int(d1_pts), driver2: int(d2_pts)},
            "avg_gap": "+0.000s"
        }
        _cache_set(cache_key, result)
        return result
    except Exception as e:
        print(f"[FastF1 Error] get_rivalry_stats: {e}")
        return {}

def get_recent_form(driver_code: str, n: int = 3) -> dict:
    """Get recent form using cached season results."""
    try:
        # We'll use 2024 as the default for form if current season isn't available
        year = 2024
        season_data = _load_season_results(year)
        
        race_names = list(season_data.keys())
        recent_races = race_names[-n:] if len(race_names) >= n else race_names
        
        results = []
        for race_name in recent_races:
            res = season_data[race_name].get("R", pd.DataFrame())
            if res.empty:
                continue
            drv_res = res[res['Abbreviation'] == driver_code]
            if not drv_res.empty:
                results.append({
                    "race": race_name,
                    "position": int(drv_res.iloc[0].get('Position', 0)),
                    "points": float(drv_res.iloc[0].get('Points', 0))
                })
        
        return {
            "driverCode": driver_code,
            "recent": results
        }
    except Exception as e:
        print(f"[FastF1 Error] get_recent_form: {e}")
        return {}

def get_lap_telemetry(year: int, race: str, driver: str, lap: int) -> dict:
    """
    Get lap telemetry. Tries OpenF1 for 2025+,
    FastF1 for 2024 and below.
    Always returns a valid dict, never crashes.
    """
    print(
        f"[Telemetry] Request: year={year} race={race} driver={driver} lap={lap}"
    )

    def telemetry_error(message: str) -> dict:
        return _empty_telemetry_payload(message)

    def normalize_race_name(name: str) -> str:
        return (
            str(name or "")
            .lower()
            .replace(" grand prix", "")
            .replace(" gp", "")
            .strip()
        )

    # ==========================================
    # OPENF1 PATH (2025 and newer)
    # ==========================================
    if int(year) >= 2025:
        try:
            print("[Telemetry] Using OpenF1")
            sessions = requests.get(
                f"{OPENF1_BASE}/sessions?year={year}&session_type=Race",
                timeout=10,
            ).json()

            print(f"[Telemetry] Sessions: {len(sessions)}")

            if not sessions:
                return telemetry_error(
                    f"No {year} race sessions in OpenF1 yet. Try 2024."
                )

            session_key = None
            race_clean = normalize_race_name(race)

            for session_info in sessions:
                meeting_name = normalize_race_name(session_info.get("meeting_name", ""))
                location_name = normalize_race_name(session_info.get("location", ""))
                country_name = normalize_race_name(session_info.get("country_name", ""))
                if (
                    race_clean in meeting_name
                    or meeting_name in race_clean
                    or race_clean in location_name
                    or location_name in race_clean
                    or race_clean in country_name
                    or country_name in race_clean
                ):
                    session_key = session_info.get("session_key")
                    print(f"[Telemetry] Session: {session_key}")
                    break

            if not session_key:
                session_key = sessions[-1].get("session_key")
                print(f"[Telemetry] Using latest session: {session_key}")

            drivers = requests.get(
                f"{OPENF1_BASE}/drivers?session_key={session_key}",
                timeout=10,
            ).json()

            driver_num = None
            for driver_info in drivers:
                if driver_info.get("name_acronym", "").upper() == driver.upper():
                    driver_num = driver_info.get("driver_number")
                    break

            if not driver_num:
                available = [d.get("name_acronym") for d in drivers]
                print(
                    f"[Telemetry] Driver {driver} not found, available: {available}"
                )
                return telemetry_error(
                    f"Driver {driver} not in this race session."
                )

            laps = requests.get(
                f"{OPENF1_BASE}/laps?session_key={session_key}"
                f"&driver_number={driver_num}&lap_number={lap}",
                timeout=10,
            ).json()

            print(f"[Telemetry] Laps: {len(laps)}")

            if not laps:
                return telemetry_error(
                    f"No data for {driver} Lap {lap}. Try laps 1-20."
                )

            lap_data = laps[0]
            duration = lap_data.get("lap_duration") or 0

            if duration and float(duration) > 0:
                total_seconds = float(duration)
                mins = int(total_seconds // 60)
                secs = total_seconds % 60
                lap_time = f"{mins}:{secs:06.3f}"
            else:
                lap_time = "--:--.---"

            s1 = float(lap_data.get("duration_sector_1") or 0)
            s2 = float(lap_data.get("duration_sector_2") or 0)
            s3 = float(lap_data.get("duration_sector_3") or 0)

            max_speed = 0
            avg_speed = 0
            try:
                car = requests.get(
                    f"{OPENF1_BASE}/car_data?session_key={session_key}"
                    f"&driver_number={driver_num}&lap_number={lap}",
                    timeout=8,
                ).json()
                if car:
                    speeds = [
                        entry["speed"]
                        for entry in car
                        if entry.get("speed", 0) > 50
                    ]
                    if speeds:
                        max_speed = max(speeds)
                        avg_speed = int(sum(speeds) / len(speeds))
            except Exception as speed_error:
                print(f"[Speed optional] {speed_error}")

            def _clean(v):
                try:
                    if isinstance(v, float) and np.isnan(v): return 0
                    if pd.isna(v): return 0
                except Exception:
                    pass
                return v
            return {
                "lap_time": _clean(lap_time) if isinstance(lap_time, (int,float)) else lap_time,
                "sector1": _clean(round(float(s1 or 0), 3)),
                "sector2": _clean(round(float(s2 or 0), 3)),
                "sector3": _clean(round(float(s3 or 0), 3)),
                "max_speed": _clean(max_speed),
                "avg_speed": _clean(avg_speed),
                "sector_deltas": {"s1": 0, "s2": 0, "s3": 0},
            }

        except Exception as e:
            print(f"[OpenF1 Error] {e}")
            import traceback

            traceback.print_exc()
            return telemetry_error(f"OpenF1: {str(e)}")

    # ==========================================
    # FASTF1 PATH (2024 and older)
    # ==========================================
    try:
        print(f"[Telemetry] Using FastF1 for {year}")

        fastf1.Cache.enable_cache(CACHE_DIR)

        mapped_race = RACE_NAME_MAP.get(race, race)
        session = fastf1.get_session(int(year), mapped_race, "R")
        session.load(
            telemetry=True,
            weather=False,
            messages=False,
        )

        driver_laps = session.laps.pick_driver(driver.upper())

        if driver_laps.empty:
            return telemetry_error(f"No laps for {driver}")

        try:
            target_lap = driver_laps[driver_laps["LapNumber"] == int(lap)].iloc[0]
        except IndexError:
            target_lap = driver_laps.pick_fastest()
            print(f"[FastF1] Lap {lap} not found, using fastest")

        telemetry = target_lap.get_telemetry()

        lap_time_raw = target_lap.get("LapTime")
        if pd.notna(lap_time_raw):
            lap_time = str(lap_time_raw).split(".")[0].replace("0 days 00:", "")
        else:
            lap_time = "--:--.---"

        s1 = target_lap.get("Sector1Time", pd.NaT)
        s2 = target_lap.get("Sector2Time", pd.NaT)
        s3 = target_lap.get("Sector3Time", pd.NaT)

        def to_seconds(value):
            try:
                if value is None or (isinstance(value, float) and np.isnan(value)):
                    return 0
                if pd.isna(value):
                    return 0
                # timedelta / Timedelta
                secs = value.total_seconds()
                if pd.isna(secs) or (isinstance(secs, float) and np.isnan(secs)):
                    return 0
                return round(float(secs), 3)
            except Exception:
                try:
                    v = float(value)
                    if np.isnan(v):
                        return 0
                    return round(v, 3)
                except Exception:
                    return 0

        max_speed = 0
        avg_speed = 0
        if not telemetry.empty and "Speed" in telemetry:
            speeds = telemetry["Speed"].dropna()
            if len(speeds) > 0:
                try:
                    max_speed = int(speeds.max()) if not pd.isna(speeds.max()) else 0
                    avg_speed = int(speeds.mean()) if not pd.isna(speeds.mean()) else 0
                    if np.isnan(max_speed): max_speed = 0
                    if np.isnan(avg_speed): avg_speed = 0
                except Exception:
                    max_speed = 0
                    avg_speed = 0

        def _san(v):
            try:
                if isinstance(v, float) and np.isnan(v):
                    return 0
                if pd.isna(v):
                    return 0
            except Exception:
                pass
            return v

        return {
            "lap_time": lap_time if not (isinstance(lap_time, float) and np.isnan(lap_time)) else "--:--.---",
            "sector1": _san(to_seconds(s1)),
            "sector2": _san(to_seconds(s2)),
            "sector3": _san(to_seconds(s3)),
            "max_speed": _san(max_speed),
            "avg_speed": _san(avg_speed),
            "sector_deltas": {"s1": 0, "s2": 0, "s3": 0},
        }

    except Exception as e:
        print(f"[FastF1 Error] {e}")
        import traceback

        traceback.print_exc()
        return telemetry_error(f"FastF1: {str(e)}")


# ── Career Stats (Jolpica API) ────────────────────────────────────────────────

import requests as sync_requests

career_cache: Dict[str, Any] = {}

def get_career_stats(driver_id: str) -> dict:
    """Fetch complete career stats for a driver from Jolpica Ergast API."""
    # Check cache
    if driver_id in career_cache:
        print(f"[Career] Returning cached data for {driver_id}")
        return career_cache[driver_id]

    try:
        base = "https://api.jolpi.ca/ergast/f1"
        print(f"[Career] Fetching data for {driver_id}...")

        # Get all race results with pagination (API returns max 100 per call)
        races = []
        offset = 0
        page_limit = 100
        while True:
            results_resp = sync_requests.get(
                f"{base}/drivers/{driver_id}/results.json?limit={page_limit}&offset={offset}",
                timeout=30
            )
            results_resp.raise_for_status()
            results_data = results_resp.json()
            page_races = results_data.get('MRData', {}).get('RaceTable', {}).get('Races', [])
            total = int(results_data.get('MRData', {}).get('total', '0'))
            races.extend(page_races)
            offset += page_limit
            if offset >= total or not page_races:
                break
            time.sleep(0.15)  # Be nice to API

        print(f"[Career] Fetched {len(races)} races for {driver_id}")

        if not races:
            print(f"[Career] No race data found for {driver_id}")
            return {}

        # Get driver info from first race
        first_result = races[0]['Results'][0]
        driver_info = {
            'driverId': first_result['Driver']['driverId'],
            'givenName': first_result['Driver'].get('givenName', ''),
            'familyName': first_result['Driver'].get('familyName', ''),
            'nationality': first_result['Driver'].get('nationality', ''),
            'permanentNumber': first_result['Driver'].get('permanentNumber', ''),
            'code': first_result['Driver'].get('code', driver_id[:3].upper()),
        }

        # Process by season
        seasons = {}
        total_fastest_laps = 0

        for race in races:
            year = race['season']
            if year not in seasons:
                seasons[year] = {
                    'wins': 0,
                    'podiums': 0,
                    'points': 0.0,
                    'races': 0,
                    'team': '',
                    'teamId': '',
                    'championship_pos': None,
                    'fastest_laps': 0,
                    'dnfs': 0,
                    'best_finish': 99,
                    'results': [],  # position per race for mini chart
                }

            result = race['Results'][0]
            pos_str = result.get('position', '99')
            pos = int(pos_str) if pos_str.isdigit() else 99
            status = result.get('status', 'Finished')
            pts = float(result.get('points', 0))

            seasons[year]['races'] += 1
            seasons[year]['points'] += pts
            seasons[year]['team'] = result['Constructor']['name']
            seasons[year]['teamId'] = result['Constructor']['constructorId']

            if pos == 1:
                seasons[year]['wins'] += 1
            if pos <= 3:
                seasons[year]['podiums'] += 1
            if pos < seasons[year]['best_finish']:
                seasons[year]['best_finish'] = pos

            # Check fastest lap
            if result.get('FastestLap', {}).get('rank') == '1':
                seasons[year]['fastest_laps'] += 1
                total_fastest_laps += 1

            # Check DNF
            if status not in ['Finished', '+1 Lap', '+2 Laps', '+3 Laps'] and not status.startswith('+'):
                seasons[year]['dnfs'] += 1

            # Store result for mini chart (race position)
            seasons[year]['results'].append({
                'round': race.get('round', ''),
                'raceName': race.get('raceName', ''),
                'position': pos,
                'points': pts,
            })

        # Fetch championship positions per year (batch)
        sorted_years = sorted(seasons.keys())
        for year in sorted_years:
            try:
                standing_resp = sync_requests.get(
                    f"{base}/{year}/drivers/{driver_id}/driverStandings.json",
                    timeout=15
                )
                if standing_resp.status_code == 200:
                    standing_data = standing_resp.json()
                    lists = standing_data.get('MRData', {}).get('StandingsTable', {}).get('StandingsLists', [])
                    if lists and lists[0].get('DriverStandings'):
                        pos = lists[0]['DriverStandings'][0].get('position', '99')
                        seasons[year]['championship_pos'] = int(pos)
                        # Also get total points from standings (more accurate)
                        standing_pts = lists[0]['DriverStandings'][0].get('points', None)
                        if standing_pts:
                            seasons[year]['points'] = float(standing_pts)
            except Exception as e:
                print(f"[Career] Standing fetch failed for {driver_id}/{year}: {e}")

            # Small delay to be respectful to API
            time.sleep(0.1)

        # Build team history
        team_history = []
        current_team = None
        for year in sorted_years:
            team = seasons[year]['team']
            team_id = seasons[year]['teamId']
            if current_team and current_team['team'] == team:
                current_team['endYear'] = year
            else:
                if current_team:
                    team_history.append(current_team)
                current_team = {
                    'team': team,
                    'teamId': team_id,
                    'startYear': year,
                    'endYear': year,
                }
        if current_team:
            team_history.append(current_team)

        # Calculate totals
        all_seasons = list(seasons.values())
        total_races = sum(s['races'] for s in all_seasons)
        total_wins = sum(s['wins'] for s in all_seasons)
        total_podiums = sum(s['podiums'] for s in all_seasons)
        total_points = sum(s['points'] for s in all_seasons)
        championships = sum(1 for s in all_seasons if s['championship_pos'] == 1)

        # Find peak season (most wins, then most points)
        peak_year = max(sorted_years, key=lambda y: (seasons[y]['wins'], seasons[y]['points']))

        # Poles — try to get from qualifying
        total_poles = 0
        try:
            quali_races = []
            q_offset = 0
            while True:
                quali_resp = sync_requests.get(
                    f"{base}/drivers/{driver_id}/qualifying.json?limit=100&offset={q_offset}",
                    timeout=30
                )
                if quali_resp.status_code != 200:
                    break
                quali_data = quali_resp.json()
                q_page = quali_data.get('MRData', {}).get('RaceTable', {}).get('Races', [])
                q_total = int(quali_data.get('MRData', {}).get('total', '0'))
                quali_races.extend(q_page)
                q_offset += 100
                if q_offset >= q_total or not q_page:
                    break
                time.sleep(0.15)

            for qr in quali_races:
                if qr.get('QualifyingResults'):
                    if qr['QualifyingResults'][0].get('position') == '1':
                        total_poles += 1
            print(f"[Career] Poles counted: {total_poles} from {len(quali_races)} qualifying sessions")
        except Exception as e:
            print(f"[Career] Qualifying fetch failed for {driver_id}: {e}")

        # Clean up results from seasons dict for JSON response (remove heavy data)
        seasons_clean = {}
        for year, data in seasons.items():
            seasons_clean[year] = {
                'wins': data['wins'],
                'podiums': data['podiums'],
                'points': round(data['points'], 1),
                'races': data['races'],
                'team': data['team'],
                'teamId': data['teamId'],
                'championship_pos': data['championship_pos'],
                'fastest_laps': data['fastest_laps'],
                'dnfs': data['dnfs'],
                'best_finish': data['best_finish'],
                'win_positions': [r['position'] for r in data['results']],
            }

        career_data = {
            'driver_id': driver_id,
            'driver_info': driver_info,
            'seasons': seasons_clean,
            'team_history': team_history,
            'totals': {
                'championships': championships,
                'wins': total_wins,
                'podiums': total_podiums,
                'poles': total_poles,
                'fastest_laps': total_fastest_laps,
                'total_points': round(total_points, 1),
                'total_races': total_races,
                'seasons_count': len(seasons),
                'win_rate': round(total_wins / max(total_races, 1) * 100, 1),
                'podium_rate': round(total_podiums / max(total_races, 1) * 100, 1),
                'peak_season': peak_year,
            },
        }

        # Cache result
        career_cache[driver_id] = career_data
        print(f"[Career] Successfully fetched {driver_id}: {len(seasons)} seasons, {total_wins} wins")
        return career_data

    except Exception as e:
        print(f"[Career Error] {driver_id}: {e}")
        return {}
