from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import re

CATEGORY_MAP = {
    "Flag": "flag",
    "Drs": "drs",
    "SafetyCar": "safety",
    "Other": "other",
}

FLAG_PRIORITY = {
    "RED": 5,
    "DOUBLE YELLOW": 4,
    "YELLOW": 3,
    "SAFETY CAR": 4,
    "VIRTUAL SAFETY CAR": 3,
    "GREEN": 1,
    "CHEQUERED": 2,
}

def _parse_time(s: str) -> Optional[datetime]:
    try:
        return datetime.fromisoformat(s.replace("Z", "+00:00"))
    except:
        return None

def _classify(msg: Dict[str, Any]) -> Dict[str, Any]:
    category = (msg.get("category") or "").strip()
    flag = (msg.get("flag") or "").strip().upper()
    message = (msg.get("message") or "").strip()
    upper_msg = message.upper()
    scope = msg.get("scope")
    sector = msg.get("sector")
    # Determine type
    event_type = "other"
    severity = "info"
    icon = "ℹ️"
    title = message[:60] if message else "Race Control"

    # Flags
    if category == "Flag":
        if flag == "RED":
            event_type = "red_flag"; severity = "critical"; icon = "🔴"; title = "RED FLAG"
        elif flag == "YELLOW":
            # check double yellow via message
            if "DOUBLE" in upper_msg or sector == 0:
                event_type = "double_yellow"; severity = "warning"; icon = "🟡"; title = "DOUBLE YELLOW"
            else:
                event_type = "yellow_flag"; severity = "warning"; icon = "🟡"; title = "YELLOW FLAG"
        elif flag == "GREEN":
            event_type = "green_flag"; severity = "info"; icon = "🟢"; title = "GREEN FLAG"
        elif flag == "CHEQUERED":
            event_type = "chequered"; severity = "info"; icon = "🏁"; title = "CHEQUERED FLAG"
        else:
            event_type = "flag"; title = f"{flag} FLAG" if flag else "FLAG"
    elif category == "Drs":
        if "ENABLED" in upper_msg:
            event_type = "drs_enabled"; severity = "info"; icon = "🟢"; title = "DRS ENABLED"
        elif "DISABLED" in upper_msg:
            event_type = "drs_disabled"; severity = "info"; icon = "⚪"; title = "DRS DISABLED"
        else:
            event_type = "drs"; title = "DRS"
    elif category == "SafetyCar":
        if "VIRTUAL" in upper_msg:
            event_type = "virtual_safety_car"; severity = "warning"; icon = "🟡"; title = "VIRTUAL SAFETY CAR"
        else:
            event_type = "safety_car"; severity = "warning"; icon = "🟡"; title = "SAFETY CAR"
        # more specific
        if "DEPLOYED" in upper_msg:
            title = "SAFETY CAR DEPLOYED"
        elif "ENDING" in upper_msg or "IN THIS LAP" in upper_msg:
            title = "SAFETY CAR IN THIS LAP"
    elif category == "Other":
        if "SAFETY CAR" in upper_msg:
            event_type = "safety_car"; severity = "warning"; icon = "🟡"; title = "SAFETY CAR"
        elif "VIRTUAL SAFETY CAR" in upper_msg or "VSC" in upper_msg:
            event_type = "virtual_safety_car"; severity = "warning"; icon = "🟡"; title = "VIRTUAL SAFETY CAR"
        elif "RED FLAG" in upper_msg:
            event_type = "red_flag"; severity = "critical"; icon = "🔴"; title = "RED FLAG"
        elif "YELLOW" in upper_msg:
            event_type = "yellow_flag"; severity = "warning"; icon = "🟡"; title = "YELLOW FLAG"
        elif "GREEN FLAG" in upper_msg or "GREEN LIGHT" in upper_msg:
            event_type = "green_flag"; severity = "info"; icon = "🟢"; title = "GREEN FLAG"
        elif "PENALTY" in upper_msg or "PENALISED" in upper_msg:
            event_type = "penalty"; severity = "warning"; icon = "⚠️"; title = "PENALTY"
        elif "PIT" in upper_msg and ("ENTRY" in upper_msg or "EXIT" in upper_msg):
            event_type = "pit_lane"; severity = "info"; icon = "🔧"; title = "PIT LANE"
        elif "SESSION" in upper_msg and "START" in upper_msg:
            event_type = "session_start"; severity = "info"; icon = "🏁"; title = "SESSION START"
        elif "SESSION" in upper_msg and ("PAUSE" in upper_msg or "SUSPENDED" in upper_msg):
            event_type = "session_pause"; severity = "warning"; icon = "⏸️"; title = "SESSION PAUSE"
        elif "RESTART" in upper_msg:
            event_type = "session_restart"; severity = "info"; icon = "▶️"; title = "SESSION RESTART"

    return {
        "event_type": event_type,
        "severity": severity,
        "icon": icon,
        "title": title,
        "category": category,
        "flag": flag,
        "scope": scope,
        "sector": sector,
    }

async def build_race_control(session_key: int) -> List[Dict[str, Any]]:
    from .client import get_drivers, _fetch
    # also need laps for fastest, stints for pit
    import asyncio

    # Fetch race_control + auxiliary for enrichment
    try:
        rc = await _fetch("/race_control", {"session_key": session_key}, ttl=5)
    except Exception:
        rc = []

    # Get drivers for mapping
    try:
        drivers = await _fetch("/drivers", {"session_key": session_key}, ttl=30)
    except:
        drivers = []
    dmap = {str(d["driver_number"]): d.get("name_acronym", str(d["driver_number"])) for d in drivers}
    dname_map = {str(d["driver_number"]): d.get("full_name", d.get("name_acronym","")) for d in drivers}

    events: List[Dict[str, Any]] = []
    seen = set()

    # Base race_control events (dedup by date+message+driver)
    for msg in rc:
        key = f"{msg.get('date')}|{msg.get('message')}|{msg.get('driver_number')}"
        if key in seen:
            continue
        seen.add(key)
        meta = _classify(msg)
        dn = msg.get("driver_number")
        abbr = dmap.get(str(dn)) if dn else None
        # timestamp
        dt = _parse_time(msg.get("date",""))
        events.append({
            "id": f"rc-{msg.get('date')}-{dn or '0'}",
            "timestamp": msg.get("date"),
            "time_label": dt.strftime("%H:%M:%S") if dt else msg.get("date","")[11:19] if msg.get("date") else "",
            "type": meta["event_type"],
            "severity": meta["severity"],
            "icon": meta["icon"],
            "title": meta["title"],
            "message": msg.get("message"),
            "category": meta["category"],
            "flag": meta["flag"],
            "scope": meta["scope"],
            "sector": msg.get("sector"),
            "driver_number": dn,
            "abbr": abbr,
            "driver": dname_map.get(str(dn)) if dn else None,
            "lap": msg.get("lap_number"),
            "qualifying_phase": msg.get("qualifying_phase"),
        })

    # Derived: pit stops via stints/pit
    try:
        stints = await _fetch("/stints", {"session_key": session_key}, ttl=5)
        pit = await _fetch("/pit", {"session_key": session_key}, ttl=5)
        # Use pit lane_duration as pit stop events
        for p in pit[-20:]:  # last 20 pits to avoid flooding
            dn = p.get("driver_number")
            key = f"pit-{p.get('date')}-{dn}"
            if key in seen:
                continue
            seen.add(key)
            dt = _parse_time(p.get("date",""))
            abbr = dmap.get(str(dn))
            # try to get compound from stint at that lap
            events.append({
                "id": key,
                "timestamp": p.get("date"),
                "time_label": dt.strftime("%H:%M:%S") if dt else "",
                "type": "pit_stop",
                "severity": "info",
                "icon": "🔧",
                "title": "PIT STOP",
                "message": f"{abbr or dn} pit {p.get('pit_duration', '') and f'{p.get('pit_duration'):.1f}s' or 'stop'}",
                "category": "Pit",
                "driver_number": dn,
                "abbr": abbr,
                "driver": dname_map.get(str(dn)),
                "lap": p.get("lap_number"),
                "sector": None,
            })
    except Exception:
        pass

    # Derived: fastest lap via laps
    try:
        laps = await _fetch("/laps", {"session_key": session_key}, ttl=5)
        # find session best
        best = None
        best_entry = None
        for l in laps:
            d = l.get("lap_duration")
            if d and (best is None or d < best):
                best = d
                best_entry = l
        if best_entry:
            dn = best_entry.get("driver_number")
            key = f"fastest-{best_entry.get('date')}-{dn}"
            if key not in seen:
                dt = _parse_time(best_entry.get("date",""))
                # format lap time
                sec = best
                m = int(sec//60); s = sec%60
                time_str = f"{m}:{s:06.3f}" if m>0 else f"{s:.3f}"
                events.append({
                    "id": key,
                    "timestamp": best_entry.get("date"),
                    "time_label": dt.strftime("%H:%M:%S") if dt else "",
                    "type": "fastest_lap",
                    "severity": "info",
                    "icon": "⚡",
                    "title": "FASTEST LAP",
                    "message": f"{dmap.get(str(dn), dn)} — {time_str}",
                    "category": "Lap",
                    "driver_number": dn,
                    "abbr": dmap.get(str(dn)),
                    "driver": dname_map.get(str(dn)),
                    "lap": best_entry.get("lap_number"),
                    "sector": None,
                })
    except Exception:
        pass

    # Sort newest first
    def _sort_key(e):
        try:
            return _parse_time(e["timestamp"]) or datetime.min.replace(tzinfo=timezone.utc)
        except:
            return datetime.min.replace(tzinfo=timezone.utc)
    events_sorted = sorted(events, key=_sort_key, reverse=True)

    # Deduplicate
    deduped = []
    last_keys = set()
    for e in events_sorted:
        dedup_key = f"{e['type']}|{e['abbr']}|{e['lap']}"
        if dedup_key in last_keys and e["type"] in ("pit_stop","fastest_lap"):
            continue
        deduped.append(e)
        last_keys.add(dedup_key)
        if len(deduped) > 200:
            break

    return deduped
