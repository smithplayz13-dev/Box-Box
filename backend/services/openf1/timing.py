from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
import time

TEAM_COLORS = {
    "Red Bull Racing": "#0600EF",
    "McLaren": "#FF8700",
    "Ferrari": "#DC0000",
    "Mercedes": "#00D2BE",
    "Aston Martin": "#006F62",
    "Alpine": "#0090FF",
    "Williams": "#005AFF",
    "RB": "#2B4562",
    "Kick Sauber": "#900000",
    "Haas F1 Team": "#FFFFFF",
    "Haas": "#FFFFFF",
    "RB F1 Team": "#2B4562",
}

def _team_color(team: str) -> str:
    return TEAM_COLORS.get(team, "#666666")

def _format_gap(gap: Optional[float]) -> str:
    if gap is None or gap == 0:
        return "—"
    return f"+{gap:.3f}"

def _format_time(sec: Optional[float]) -> str:
    if not sec or sec <= 0:
        return "—"
    m = int(sec // 60)
    s = sec % 60
    if m > 0:
        return f"{m}:{s:06.3f}"
    return f"{s:.3f}"

async def build_timing(session_key: int) -> Dict[str, Any]:
    from .client import get_drivers, get_positions, get_intervals, get_laps, get_stints, get_sessions, get_weather, get_car_data
    # Fetch in parallel where possible — resilient to partial 429s
    import asyncio
    async def _safe(coro, default):
        try:
            return await coro
        except Exception:
            return default
    drivers, intervals, laps, stints, sessions = await asyncio.gather(
        _safe(get_drivers(session_key), []),
        _safe(get_intervals(session_key), []),
        _safe(get_laps(session_key), []),
        _safe(get_stints(session_key), []),
        _safe(get_sessions(), []),
    )
    if not drivers:
        raise RuntimeError("OpenF1 drivers unavailable (rate limited or no data)")

    # Find session meta
    session_meta = None
    for s in sessions:
        if s.get("session_key") == session_key:
            session_meta = s
            break
    if not session_meta:
        # try to infer via any driver session
        session_meta = {"session_key": session_key, "session_name": "Unknown", "session_type": "Unknown", "meeting_name": "Unknown", "location": "Unknown", "country_name": "Unknown", "circuit_short_name": "Unknown"}

    # Build lookup maps
    driver_map = {str(d["driver_number"]): d for d in drivers}
    # intervals: latest gap/interval per driver
    interval_map = {}
    for it in intervals:
        dn = str(it.get("driver_number"))
        # keep latest by date
        prev = interval_map.get(dn)
        if not prev or it.get("date", "") > prev.get("date", ""):
            interval_map[dn] = it
    # positions: latest position per driver
    from .client import get_positions
    try:
        positions = await get_positions(session_key)
    except Exception:
        positions = []
    pos_map = {}
    for p in positions:
        dn = str(p.get("driver_number"))
        prev = pos_map.get(dn)
        if not prev or p.get("date", "") > prev.get("date", ""):
            pos_map[dn] = p

    # laps: group by driver, find best/last/current
    laps_by_driver: Dict[str, List[Dict]] = {}
    for l in laps:
        dn = str(l.get("driver_number"))
        laps_by_driver.setdefault(dn, []).append(l)
    # stints: tyre per driver (current stint)
    stint_map = {}
    for st in stints:
        dn = str(st.get("driver_number"))
        ls = st.get("lap_start")
        try:
            ls_val = int(ls) if ls not in (None, "") else -1
        except:
            ls_val = -1
        prev = stint_map.get(dn)
        prev_val = -1
        if prev:
            try:
                prev_val = int(prev.get("lap_start")) if prev.get("lap_start") not in (None, "") else -1
            except:
                prev_val = -1
        if dn not in stint_map or ls_val > prev_val:
            stint_map[dn] = st

    # car_data: latest speed
    try:
        car_data = await get_car_data(session_key)
        speed_map = {}
        for cd in car_data[-200:]:  # last 200 entries enough
            dn = str(cd.get("driver_number"))
            speed_map[dn] = cd.get("speed", 0)
    except Exception:
        speed_map = {}

    # Determine session best lap
    best_times = []
    for dn, llist in laps_by_driver.items():
        for l in llist:
            d = l.get("lap_duration")
            if d and d > 0:
                best_times.append(d)
    session_best = min(best_times) if best_times else None

    rows = []
    for dn, drv in driver_map.items():
        pos_entry = pos_map.get(dn, {})
        int_entry = interval_map.get(dn, {})
        lap_list = laps_by_driver.get(dn, [])
        # sort laps by lap_number
        lap_list_sorted = sorted(lap_list, key=lambda x: x.get("lap_number", 0))
        last_lap = lap_list_sorted[-1] if lap_list_sorted else None

        # best lap for driver
        best_lap_sec = None
        best_lap_data = None
        for l in lap_list:
            d = l.get("lap_duration")
            if d and (best_lap_sec is None or d < best_lap_sec):
                best_lap_sec = d
                best_lap_data = l
        # current lap number
        current_lap = None
        if last_lap:
            current_lap = last_lap.get("lap_number")

        # gaps
        gap = int_entry.get("gap_to_leader")
        interval = int_entry.get("interval")
        # OpenF1 gap/interval can be None or string
        try:
            gap_val = float(gap) if gap not in (None, "") else None
        except:
            gap_val = None
        try:
            interval_val = float(interval) if interval not in (None, "") else None
        except:
            interval_val = None

        position = pos_entry.get("position")
        try:
            position_int = int(position) if position not in (None, "") else 99
        except:
            position_int = 99

        # tyre
        st = stint_map.get(dn, {})
        compound = (st.get("compound") or "UNKNOWN").upper()
        tyre_age = None
        if st:
            lap_start = st.get("lap_start")
            lap_end = st.get("lap_end")
            # if lap_end is None -> ongoing
            if current_lap and lap_start:
                tyre_age = current_lap - lap_start + 1

        # sectors
        s1 = last_lap.get("duration_sector_1") if last_lap else None
        s2 = last_lap.get("duration_sector_2") if last_lap else None
        s3 = last_lap.get("duration_sector_3") if last_lap else None

        # is personal best?
        is_pb = False
        if best_lap_data and last_lap and best_lap_data.get("lap_number") == last_lap.get("lap_number") and last_lap.get("lap_duration"):
            # check if this lap is best for driver and not session best
            if best_lap_sec and best_lap_sec == last_lap.get("lap_duration") and session_best != best_lap_sec:
                is_pb = True
        is_sb = False
        if best_lap_sec and session_best and abs(best_lap_sec - session_best) < 0.001:
            is_sb = True
            is_pb = False  # SB overrides PB

        # is pit?
        is_pit = False
        if last_lap and last_lap.get("is_pit_out_lap"):
            is_pit = True

        rows.append({
            "position": position_int,
            "driver_number": drv.get("driver_number"),
            "abbr": drv.get("name_acronym", str(dn)),
            "full_name": drv.get("full_name", drv.get("name_acronym", "")),
            "team": drv.get("team_name", "Unknown"),
            "team_color": _team_color(drv.get("team_name", "")),
            "gap": gap_val,
            "gap_text": _format_gap(gap_val) if position_int != 1 else "—",
            "interval": interval_val,
            "interval_text": _format_gap(interval_val) if position_int != 1 else "—",
            "last_lap": _format_time(last_lap.get("lap_duration") if last_lap else None),
            "last_lap_sec": last_lap.get("lap_duration") if last_lap else None,
            "best_lap": _format_time(best_lap_sec),
            "best_lap_sec": best_lap_sec,
            "is_pb": is_pb,
            "is_sb": is_sb,
            "current_lap": current_lap,
            "s1": s1,
            "s2": s2,
            "s3": s3,
            "speed": speed_map.get(dn, 0),
            "compound": compound,
            "tyre_age": tyre_age,
            "is_pit": is_pit,
            "in_pit": bool(pos_entry.get("in_pit") or int_entry.get("in_pit")),
        })

    # Sort by position (race) — for quali, position is qualifying order so same
    rows_sorted = sorted(rows, key=lambda r: (r["position"], r["abbr"]))

    # Build session info
    now = datetime.now(timezone.utc).isoformat()
    # Parse session times
    date_start = session_meta.get("date_start")
    date_end = session_meta.get("date_end")
    status = "Unknown"
    try:
        if date_start and date_end:
            ds = datetime.fromisoformat(date_start.replace("Z", "+00:00"))
            de = datetime.fromisoformat(date_end.replace("Z", "+00:00"))
            n = datetime.now(timezone.utc)
            if ds <= n <= de:
                status = "Live"
            elif n < ds:
                status = "Upcoming"
            else:
                status = "Completed"
    except Exception:
        pass

    # total laps: for Race try to get from session
    total_laps = session_meta.get("total_laps") or None

    return {
        "session_key": session_key,
        "meeting_name": session_meta.get("meeting_name") or session_meta.get("location") or "Unknown GP",
        "location": session_meta.get("location"),
        "country": session_meta.get("country_name"),
        "circuit": session_meta.get("circuit_short_name") or session_meta.get("location"),
        "session_name": session_meta.get("session_name"),
        "session_type": session_meta.get("session_type"),
        "date_start": date_start,
        "date_end": date_end,
        "status": status,
        "total_laps": total_laps,
        "timestamp": now,
        "session_best": _format_time(session_best) if session_best else "—",
        "session_best_sec": session_best,
        "drivers": rows_sorted,
    }

async def discover_sessions(year: Optional[int] = None) -> Dict[str, Any]:
    from .client import get_sessions
    sessions = await get_sessions(year)
    # sort by date_start
    def _parse(s):
        try:
            return datetime.fromisoformat(s.get("date_start", "").replace("Z", "+00:00"))
        except:
            return datetime.min.replace(tzinfo=timezone.utc)
    sessions_sorted = sorted(sessions, key=_parse)
    now = datetime.now(timezone.utc)
    live = None
    nxt = None
    for s in sessions_sorted:
        try:
            ds = datetime.fromisoformat(s.get("date_start", "").replace("Z", "+00:00"))
            de = datetime.fromisoformat(s.get("date_end", "").replace("Z", "+00:00"))
            if ds <= now <= de:
                live = s
                break
            if ds > now and not nxt:
                nxt = s
        except:
            continue
    # If no live, next is first upcoming
    return {"live": live, "next": nxt, "all": sessions_sorted, "timestamp": now.isoformat()}
