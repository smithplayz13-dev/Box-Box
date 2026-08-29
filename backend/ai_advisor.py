import os
import json
import re
import functools
from dotenv import load_dotenv

try:
    import google.generativeai as genai
    GENAI_AVAILABLE = True
except Exception as import_error:
    genai = None
    GENAI_AVAILABLE = False
    print(f"[WARNING] google-generativeai import failed: {import_error}. AI generation disabled for Gemini; other providers may still work.")

load_dotenv()

# --- Provider & Key Resolution (Gemini + OpenRouter/OpenAI + NVIDIA NIM) ---
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
OPENROUTER_API_KEY = os.getenv("OPENROUTER_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
NVIDIA_API_KEY = os.getenv("NVIDIA_API_KEY")
# Generic fallback: AI_API_KEY works for any OpenAI-compatible provider
GENERIC_API_KEY = os.getenv("AI_API_KEY")

AI_PROVIDER_RAW = os.getenv("AI_PROVIDER", "").strip().lower()
# Normalize aliases
if AI_PROVIDER_RAW in ("openai-compatible", "openai_compatible", "compatible"):
    AI_PROVIDER_RAW = "openai-compatible"
if AI_PROVIDER_RAW in ("nvidia", "nim", "nvidia-nim"):
    AI_PROVIDER_RAW = "nvidia"

# Auto-detect provider if not explicitly set
if not AI_PROVIDER_RAW:
    if OPENROUTER_API_KEY or (GENERIC_API_KEY and os.getenv("OPENROUTER_MODEL")):
        AI_PROVIDER = "openrouter"
    elif OPENAI_API_KEY:
        AI_PROVIDER = "openai"
    elif NVIDIA_API_KEY:
        AI_PROVIDER = "nvidia"
    elif GEMINI_API_KEY and GENAI_AVAILABLE:
        AI_PROVIDER = "gemini"
    else:
        AI_PROVIDER = "gemini"  # default, will be disabled if no key
else:
    AI_PROVIDER = AI_PROVIDER_RAW
# Normalize nvidia -> openai-compatible
if AI_PROVIDER == "nvidia":
    AI_PROVIDER = "openai-compatible"

# Resolve effective API key / base URL / default model per provider
AI_API_KEY_RESOLVED = None
AI_BASE_URL = os.getenv("AI_BASE_URL", "").strip()
AI_MODEL_ENV = os.getenv("AI_MODEL", "").strip()

if AI_PROVIDER == "openrouter":
    AI_API_KEY_RESOLVED = OPENROUTER_API_KEY or GENERIC_API_KEY or OPENAI_API_KEY
    if not AI_BASE_URL:
        AI_BASE_URL = "https://openrouter.ai/api/v1"
    DEFAULT_MODEL = AI_MODEL_ENV or os.getenv("OPENROUTER_MODEL", "").strip() or "google/gemini-2.5-flash"
    FALLBACK_MODELS = [DEFAULT_MODEL, "openai/gpt-4o-mini", "anthropic/claude-3.5-sonnet", "google/gemini-2.0-flash-001"]
elif AI_PROVIDER == "openai":
    AI_API_KEY_RESOLVED = OPENAI_API_KEY or GENERIC_API_KEY
    if not AI_BASE_URL:
        AI_BASE_URL = "https://api.openai.com/v1"
    DEFAULT_MODEL = AI_MODEL_ENV or os.getenv("OPENAI_MODEL", "").strip() or "gpt-4o-mini"
    FALLBACK_MODELS = [DEFAULT_MODEL, "gpt-4o", "gpt-4o-mini"]
elif AI_PROVIDER == "openai-compatible":
    AI_API_KEY_RESOLVED = GENERIC_API_KEY or NVIDIA_API_KEY or OPENAI_API_KEY or OPENROUTER_API_KEY
    # NVIDIA NIM hosted default; self-hosted NIM / Ollama override via AI_BASE_URL
    if not AI_BASE_URL:
        if NVIDIA_API_KEY or AI_PROVIDER_RAW in ("nvidia", "nim"):
            AI_BASE_URL = "https://integrate.api.nvidia.com/v1"
            # sensible NIM default if user didn't set AI_MODEL
            if not AI_MODEL_ENV:
                AI_MODEL_ENV = os.getenv("NVIDIA_MODEL", "").strip() or "meta/llama-3.1-405b-instruct"
        else:
            # generic compatible must set AI_BASE_URL (e.g. local Ollama http://localhost:11434/v1)
            pass
    DEFAULT_MODEL = AI_MODEL_ENV or "gpt-4o-mini"
    # Build fallback chain: env override AI_FALLBACK_MODELS (comma sep) else sensible defaults
    _fallback_env = os.getenv("AI_FALLBACK_MODELS", "").strip()
    if _fallback_env:
        FALLBACK_MODELS = [m.strip() for m in _fallback_env.split(",") if m.strip()]
        if DEFAULT_MODEL not in FALLBACK_MODELS:
            FALLBACK_MODELS = [DEFAULT_MODEL] + FALLBACK_MODELS
    else:
        is_nim = AI_BASE_URL == "https://integrate.api.nvidia.com/v1" or NVIDIA_API_KEY
        if is_nim:
            # NIM fallback chain: verified working for this account when kimi-k3 is 429
            # nano-omni passes validation (starts with driver name), nano-30b often returns meta commentary and fails
            _nim_chain = [
                DEFAULT_MODEL,
                "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
                "nvidia/nemotron-3-nano-30b-a3b",
                "nvidia/nemotron-3-super-120b-a12b",
                "meta/llama-3.2-11b-vision-instruct",
                "moonshotai/kimi-k3",
            ]
            FALLBACK_MODELS = []
            for m in _nim_chain:
                if m and m not in FALLBACK_MODELS:
                    FALLBACK_MODELS.append(m)
            # Also respect user AI_MODEL if different from chain head
            if DEFAULT_MODEL not in FALLBACK_MODELS:
                FALLBACK_MODELS.insert(0, DEFAULT_MODEL)
        else:
            # Generic OpenAI-compatible fallbacks
            FALLBACK_MODELS = []
            for m in [DEFAULT_MODEL, "gpt-4o", "gpt-4o-mini"]:
                if m and m not in FALLBACK_MODELS:
                    FALLBACK_MODELS.append(m)
else:  # gemini
    AI_API_KEY_RESOLVED = GEMINI_API_KEY
    DEFAULT_MODEL = AI_MODEL_ENV or os.getenv("GEMINI_MODEL", "").strip() or "gemini-1.5-pro"
    FALLBACK_MODELS = [DEFAULT_MODEL, "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.5-flash"]

def _is_placeholder_key(k: str) -> bool:
    if not k:
        return True
    kk = k.strip().lower()
    return kk.startswith("your_") or "xxxx" in kk or kk in ("fallback_dev_key", "your_google_gemini_api_key_here", "sk-or-v1-xxxx", "sk-xxxx")

# Determine if AI is enabled
if AI_PROVIDER in ("openrouter", "openai", "openai-compatible"):
    AI_ENABLED = bool(AI_API_KEY_RESOLVED and not _is_placeholder_key(AI_API_KEY_RESOLVED) and AI_BASE_URL)
    if AI_ENABLED:
        print(f"[AI] Provider={AI_PROVIDER} BaseURL={AI_BASE_URL} Model={DEFAULT_MODEL} (OpenAI-compatible via httpx)")
        try:
            print(f"[AI] Fallback chain: {' -> '.join(FALLBACK_MODELS)}")
        except Exception:
            pass
    else:
        print(f"[WARNING] AI_PROVIDER={AI_PROVIDER} but API key or base URL missing/placeholder. AI disabled; deterministic fallbacks will be used.")
        if AI_PROVIDER == "openrouter" and (not AI_API_KEY_RESOLVED or _is_placeholder_key(AI_API_KEY_RESOLVED)):
            print("[HINT] Set OPENROUTER_API_KEY in backend/.env (get one at https://openrouter.ai/keys)")
        if AI_PROVIDER == "openai-compatible" and not AI_BASE_URL:
            print("[HINT] Set AI_BASE_URL for openai-compatible provider")
else:
    # Gemini path
    AI_ENABLED = bool(GEMINI_API_KEY and not _is_placeholder_key(GEMINI_API_KEY) and GENAI_AVAILABLE)
    if GEMINI_API_KEY and GENAI_AVAILABLE:
        try:
            genai.configure(api_key=GEMINI_API_KEY)
        except Exception as e:
            print(f"[Gemini Configure Error] {e}")
            AI_ENABLED = False
    elif GEMINI_API_KEY and not GENAI_AVAILABLE:
        print("[WARNING] GEMINI_API_KEY is set but google-generativeai is unavailable. Falling back to deterministic analysis.")
    else:
        print("[WARNING] GEMINI_API_KEY not set. AI generation disabled; deterministic fallbacks will be used. Set GEMINI_API_KEY or switch AI_PROVIDER to openrouter/openai.")

# Gemini-specific init
generation_config = None
model = None
_MODEL_CACHE = {}

if AI_PROVIDER == "gemini" and AI_ENABLED and GENAI_AVAILABLE:
    try:
        generation_config = genai.GenerationConfig(
            temperature=0.1,
            top_p=0.8,
            top_k=20,
            max_output_tokens=250,
        )
        model = genai.GenerativeModel(
            model_name=DEFAULT_MODEL if "gemini" in DEFAULT_MODEL else "gemini-1.5-pro",
            generation_config=generation_config
        )
    except Exception as e:
        print(f"[Gemini Init Error] {e}")


def _get_model(model_name: str):
    if model_name in _MODEL_CACHE:
        return _MODEL_CACHE[model_name]
    _MODEL_CACHE[model_name] = genai.GenerativeModel(
        model_name=model_name,
        generation_config=generation_config
    )
    return _MODEL_CACHE[model_name]


def _map_generation_config_to_openai(override) -> dict:
    """Map Gemini-style generation_config to OpenAI params."""
    if override is None:
        return {}
    # override may be dict (rivalry) or GenerationConfig object
    if isinstance(override, dict):
        out = {}
        if "temperature" in override:
            out["temperature"] = override["temperature"]
        if "top_p" in override:
            out["top_p"] = override["top_p"]
        if "max_output_tokens" in override:
            out["max_tokens"] = override["max_output_tokens"]
        if "max_tokens" in override:
            out["max_tokens"] = override["max_tokens"]
        return out
    # GenerationConfig object -> try to extract attrs
    try:
        out = {}
        if hasattr(override, "temperature"):
            out["temperature"] = getattr(override, "temperature")
        if hasattr(override, "top_p"):
            out["top_p"] = getattr(override, "top_p")
        if hasattr(override, "max_output_tokens"):
            out["max_tokens"] = getattr(override, "max_output_tokens")
        return out
    except Exception:
        return {}


def _generate_openai_compatible(prompt: str, candidate_models: list, override_generation_config=None) -> str:
    """Call OpenAI-compatible / OpenRouter chat completions endpoint via httpx."""
    import httpx
    params = _map_generation_config_to_openai(override_generation_config)
    # default params if not overridden
    if "temperature" not in params:
        params["temperature"] = 0.1
    if "max_tokens" not in params:
        params["max_tokens"] = 250

    headers = {
        "Authorization": f"Bearer {AI_API_KEY_RESOLVED}",
        "Content-Type": "application/json",
    }
    # OpenRouter recommended headers (optional but helps with ranking)
    if AI_PROVIDER == "openrouter":
        referer = os.getenv("OPENROUTER_REFERER", "http://localhost:5173")
        title = os.getenv("OPENROUTER_TITLE", "BoxBox F1")
        headers["HTTP-Referer"] = referer
        headers["X-Title"] = title

    for model_name in candidate_models:
        try:
            body = {
                "model": model_name,
                "messages": [{"role": "user", "content": prompt}],
                "temperature": params.get("temperature", 0.1),
                "max_tokens": params.get("max_tokens", 250),
            }
            if "top_p" in params:
                body["top_p"] = params["top_p"]

            # OpenRouter and OpenAI both support chat/completions
            url = AI_BASE_URL.rstrip("/") + "/chat/completions"
            with httpx.Client(timeout=30.0) as client:
                resp = client.post(url, headers=headers, json=body)
                resp.raise_for_status()
                data = resp.json()
                # Standard OpenAI response shape
                text = ""
                try:
                    text = data["choices"][0]["message"]["content"] or ""
                except Exception:
                    # Some providers return slightly different shape
                    text = data.get("choices", [{}])[0].get("text", "") or ""
                text = (text or "").strip()
                if text:
                    return text
        except Exception as e:
            # httpx HTTPStatusError will include response body for debugging
            detail = ""
            try:
                detail = e.response.text[:500] if hasattr(e, "response") and e.response is not None else ""
            except Exception:
                pass
            print(f"[OpenAI-Compatible Generate Error:{model_name}] {e} {detail}")
            continue
    return ""


def _generate_text(prompt: str, override_generation_config=None, preferred_models=None) -> str:
    """Generate text with model fallbacks to avoid hard failures when one model is unavailable."""
    if not AI_ENABLED:
        return ""

    # OpenAI-compatible path (OpenRouter, OpenAI, etc.)
    if AI_PROVIDER in ("openrouter", "openai", "openai-compatible"):
        # Build candidate list
        env_preferred = DEFAULT_MODEL
        candidate_models = []
        for name in (preferred_models or [env_preferred] + FALLBACK_MODELS):
            if name and name not in candidate_models:
                candidate_models.append(name)
        return _generate_openai_compatible(prompt, candidate_models, override_generation_config)

    # Gemini path
    preferred = os.getenv("GEMINI_MODEL", DEFAULT_MODEL)
    candidate_models = []
    for name in (preferred_models or [preferred, "gemini-1.5-pro", "gemini-1.5-flash", "gemini-2.5-flash"]):
        if name not in candidate_models:
            candidate_models.append(name)

    for name in candidate_models:
        try:
            active_model = model if name == "gemini-1.5-pro" and model else _get_model(name)
            if override_generation_config is not None:
                # Handle dict config for openai-style passed to gemini (rare)
                if isinstance(override_generation_config, dict):
                    # Convert dict to GenerationConfig
                    try:
                        gc = genai.GenerationConfig(
                            temperature=override_generation_config.get("temperature", 0.05),
                            top_p=override_generation_config.get("top_p", 0.7),
                            max_output_tokens=override_generation_config.get("max_output_tokens", 120),
                        )
                        response = active_model.generate_content(prompt, generation_config=gc)
                    except Exception:
                        response = active_model.generate_content(prompt, generation_config=override_generation_config)
                else:
                    response = active_model.generate_content(prompt, generation_config=override_generation_config)
            else:
                response = active_model.generate_content(prompt)
            text = (getattr(response, "text", "") or "").strip()
            if text:
                return text
        except Exception as e:
            print(f"[Gemini Generate Error:{name}] {e}")
            continue

    return ""


def _looks_like_two_sentences(text: str) -> bool:
    sentence_count = len(re.findall(r'[.!?]+', text or ""))
    return sentence_count == 2


def is_clean_text(text: str, min_length: int = 20) -> bool:
    text = (text or "").strip()
    if not text:
        return False
    if len(text) < min_length:
        return False
    if not text[0].isupper():
        return False
    if re.search(r'(.)\1{2,}', text):
        return False

    doubled_pairs = re.findall(r'([bcdfghjklmnpqrstvwxyz])\1', text, re.IGNORECASE)
    if len(doubled_pairs) > 4:
        return False

    if re.search(r'\d+[a-z]{2,}', text, re.IGNORECASE):
        return False

    return True


def _to_int(value, default=0):
    try:
        if value is None:
            return default
        return int(value)
    except Exception:
        return default


def _to_float(value, default=0.0):
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _build_rivalry_fallback(stats: dict, d1: str, d2: str) -> str:
    qualifying = stats.get("qualifying", {}) if isinstance(stats, dict) else {}
    race_wins = stats.get("race_wins", {}) if isinstance(stats, dict) else {}
    points = stats.get("points", {}) if isinstance(stats, dict) else {}
    avg_gap = _to_float(stats.get("avg_gap", 0.0) if isinstance(stats, dict) else 0.0, 0.0)

    q1 = _to_int(qualifying.get(d1, 0), 0)
    q2 = _to_int(qualifying.get(d2, 0), 0)
    w1 = _to_int(race_wins.get(d1, 0), 0)
    w2 = _to_int(race_wins.get(d2, 0), 0)
    p1 = _to_int(points.get(d1, 0), 0)
    p2 = _to_int(points.get(d2, 0), 0)

    if p1 == p2:
        leader = d1 if (w1 > w2 or (w1 == w2 and q1 >= q2)) else d2
    else:
        leader = d1 if p1 > p2 else d2
    chaser = d2 if leader == d1 else d1

    lead_points = p1 if leader == d1 else p2
    chase_points = p2 if leader == d1 else p1
    lead_wins = w1 if leader == d1 else w2
    chase_wins = w2 if leader == d1 else w1
    lead_qualy = q1 if leader == d1 else q2
    chase_qualy = q2 if leader == d1 else q1

    sentence1 = (
        f"{leader} leads this rivalry with {lead_points} points to {chase_points}, "
        f"{lead_wins} race wins to {chase_wins}, and a {lead_qualy}-{chase_qualy} qualifying split."
    )

    if abs(avg_gap) > 0.0001:
        sentence2 = (
            f"The average pace gap is {avg_gap:+.3f}s, so {leader} currently has the stronger race trend "
            f"while {chaser} needs cleaner execution to swing momentum."
        )
    else:
        sentence2 = (
            f"With pace nearly level on average, strategy calls and consistency are likely to decide "
            f"the next chapter of this duel."
        )

    return f"{sentence1} {sentence2}"


def _build_lap_fallback(telemetry: dict, driver: str, race: str, lap: int) -> str:
    lap_time = telemetry.get("lap_time") or telemetry.get("lapTime") or telemetry.get("lapTimeStr") or "N/A"
    max_speed = telemetry.get("max_speed") or telemetry.get("maxSpeed")
    avg_speed = telemetry.get("avg_speed") or telemetry.get("avgSpeed")
    s1 = telemetry.get("sector1") or telemetry.get("sector_1") or telemetry.get("s1")
    s2 = telemetry.get("sector2") or telemetry.get("sector_2") or telemetry.get("s2")
    s3 = telemetry.get("sector3") or telemetry.get("sector_3") or telemetry.get("s3")

    max_speed_str = f"{_to_float(max_speed, 0.0):.1f} km/h" if max_speed is not None else "N/A"
    avg_speed_str = f"{_to_float(avg_speed, 0.0):.1f} km/h" if avg_speed is not None else "N/A"
    sector_str = f"S1 {s1}, S2 {s2}, S3 {s3}" if all(v is not None for v in [s1, s2, s3]) else "sector-level time split unavailable"

    return (
        f"{driver} completed lap {lap} at {race} in {lap_time} with a top speed of {max_speed_str} "
        f"and an average speed of {avg_speed_str}. The run shows {sector_str}, and the biggest gain is likely to come "
        f"from cleaner corner exits and improved traction consistency."
    )


DRIVER_META = {
    "VER": {"name": "Max Verstappen", "team": "Red Bull Racing", "price_range": "$29-31M"},
    "NOR": {"name": "Lando Norris", "team": "McLaren", "price_range": "$27-30M"},
    "LEC": {"name": "Charles Leclerc", "team": "Ferrari", "price_range": "$25-28M"},
    "PIA": {"name": "Oscar Piastri", "team": "McLaren", "price_range": "$23-26M"},
    "RUS": {"name": "George Russell", "team": "Mercedes", "price_range": "$21-24M"},
    "HAM": {"name": "Lewis Hamilton", "team": "Ferrari", "price_range": "$23-26M"},
    "SAI": {"name": "Carlos Sainz", "team": "Williams", "price_range": "$18-22M"},
    "ALO": {"name": "Fernando Alonso", "team": "Aston Martin", "price_range": "$17-21M"},
    "STR": {"name": "Lance Stroll", "team": "Aston Martin", "price_range": "$13-16M"},
    "GAS": {"name": "Pierre Gasly", "team": "Alpine", "price_range": "$12-15M"},
    "OCO": {"name": "Esteban Ocon", "team": "Haas", "price_range": "$12-15M"},
    "TSU": {"name": "Yuki Tsunoda", "team": "RB", "price_range": "$11-14M"},
    "ALB": {"name": "Alexander Albon", "team": "Williams", "price_range": "$11-14M"},
    "HUL": {"name": "Nico Hulkenberg", "team": "Kick Sauber", "price_range": "$10-13M"},
    "MAG": {"name": "Kevin Magnussen", "team": "Haas", "price_range": "$9-12M"},
    "LAW": {"name": "Liam Lawson", "team": "RB", "price_range": "$9-12M"},
    "ANT": {"name": "Andrea Kimi Antonelli", "team": "Mercedes", "price_range": "$12-16M"},
    "BEA": {"name": "Oliver Bearman", "team": "Haas", "price_range": "$8-11M"},
    "DOO": {"name": "Jack Doohan", "team": "Alpine", "price_range": "$8-11M"},
    "COL": {"name": "Franco Colapinto", "team": "Alpine", "price_range": "$8-11M"},
    "BOT": {"name": "Valtteri Bottas", "team": "Kick Sauber", "price_range": "$9-12M"},
    "ZHO": {"name": "Zhou Guanyu", "team": "Kick Sauber", "price_range": "$9-12M"},
}

DEFAULT_FANTASY_CODES = ["VER", "NOR", "LEC", "PIA", "RUS", "HAM", "SAI", "ALO"]


def _norm_code(value: str) -> str:
    return (value or "").strip().upper()


def _extract_recent_positions(form_data: dict) -> dict:
    scores = {}
    if not isinstance(form_data, dict):
        return scores

    for raw_code, entries in form_data.items():
        code = _norm_code(raw_code)
        if not code or not isinstance(entries, list):
            continue

        score = 0.0
        for idx, row in enumerate(entries[:3]):
            if not isinstance(row, dict):
                continue
            pos = _to_int(row.get("position"), 99)
            if pos <= 0:
                continue
            weight = 1.0 - (idx * 0.2)  # recent races are weighted higher
            base = max(0, 26 - pos)
            podium_bonus = 6 if pos == 1 else 4 if pos == 2 else 2 if pos == 3 else 0
            score += max(0.1, weight) * (base + podium_bonus)

        scores[code] = round(score, 3)

    return scores


def _build_fantasy_fallback(race: str, form_data: dict) -> dict:
    scores = _extract_recent_positions(form_data)

    ranked = sorted(
        [c for c in scores.keys() if c in DRIVER_META],
        key=lambda c: scores.get(c, 0),
        reverse=True
    )

    picks = []
    for code in ranked:
        if code not in picks:
            picks.append(code)
        if len(picks) == 5:
            break

    for code in DEFAULT_FANTASY_CODES:
        if len(picks) == 5:
            break
        if code not in picks and code in DRIVER_META:
            picks.append(code)

    # Team score based on selected drivers' trend scores
    team_scores = {}
    for code in picks:
        team = DRIVER_META[code]["team"]
        team_scores[team] = team_scores.get(team, 0.0) + max(scores.get(code, 0.0), 5.0)

    constructor_name = max(team_scores, key=team_scores.get) if team_scores else "McLaren"

    def _driver_reason(code: str) -> str:
        trend = scores.get(code, 0.0)
        if trend >= 55:
            return "Recent results show strong podium-level form and reliable points potential."
        if trend >= 35:
            return "Consistent finishes make this driver a stable fantasy points pick."
        return "Solid value option with upside if race strategy and clean air align."

    drivers = [
        {
            "code": code,
            "name": DRIVER_META[code]["name"],
            "team": DRIVER_META[code]["team"],
            "reasoning": _driver_reason(code),
            "price_range": DRIVER_META[code]["price_range"],
        }
        for code in picks
    ]

    # Avoid list from lowest-scoring known drivers in current form data
    avoid_pool = sorted(
        [c for c in scores.keys() if c in DRIVER_META and c not in picks],
        key=lambda c: scores.get(c, 0)
    )
    drivers_to_avoid = avoid_pool[:2] if avoid_pool else ["MAG", "ZHO"]

    key_insight = (
        f"Fallback lineup for {race}: prioritize recent consistency and team momentum while balancing risk across top constructors."
    )

    return {
        "drivers": drivers,
        "constructor": {
            "name": constructor_name,
            "reasoning": "Constructor selected from strongest aggregated driver form in recent races.",
        },
        "key_insight": key_insight,
        "drivers_to_avoid": drivers_to_avoid,
        "fallback": True,
    }

def parse_json_response(text: str) -> dict:
    try:
        clean = re.sub(r'```json|```', '', text).strip()
        parsed = json.loads(clean)
        # If parsing succeeded but the result is empty or lacks key fields, treat as failure
        if not parsed or (isinstance(parsed, dict) and not parsed.get("drivers")):
            return _safe_fallback(text)
        return parsed
    except Exception as e:
        print(f"[JSON Parse Error] {e}")
        return _safe_fallback(text)


def _safe_fallback(raw_text: str = "") -> dict:
    """Return a safe fallback structure when AI fails."""
    return {
        "error": True, 
        "message": "AI failed to generate a valid data structure.",
        "drivers": [],
        "constructor": {"name": "Unknown", "reasoning": ""},
        "key_insight": "Analysis temporarily unavailable due to formatting error.",
        "drivers_to_avoid": [],
        "raw": raw_text
    }

def _is_valid_text(text: str) -> bool:
    """Validate AI-generated text for typos and corruption."""
    text = (text or "").strip()

    if not is_clean_text(text, min_length=30):
        return False

    bad_patterns = [
        r'\b\w*([a-z])\1{2,}\w*\b',
        r'\b\w+tt[a-z]+\b',
        r'\buuber',
        r'\bbeeng\b',
        r'\bqualiff',
        r"[a-z]'[a-z]{1,2}\s+lie\b",
        r'\b\w*([a-z])\1\w*([a-z])\2\w*\b',
        r'\b[a-z]*[bcdfghjklmnpqrstvwxyz]{6,}[a-z]*\b',
    ]
    for pattern in bad_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            return False

    return True


def _has_corrupted_text_in_fantasy_payload(parsed: dict) -> bool:
    if not isinstance(parsed, dict):
        return True

    key_insight = parsed.get("key_insight", "")
    if key_insight and not is_clean_text(key_insight):
        return True

    constructor_reason = (
        (parsed.get("constructor") or {}).get("reasoning", "")
        if isinstance(parsed.get("constructor"), dict)
        else ""
    )
    if constructor_reason and not is_clean_text(constructor_reason):
        return True

    drivers = parsed.get("drivers") or []
    if isinstance(drivers, list):
        for d in drivers:
            if not isinstance(d, dict):
                continue
            reasoning = d.get("reasoning", "")
            if reasoning and not is_clean_text(reasoning):
                return True

    return False

def get_fantasy_picks(race: str, form_data: dict) -> dict:
    prompt = f"""
    You are an expert F1 Fantasy analyst.
    Upcoming race: {race}
    Recent driver performance data (last 3 races):
    {json.dumps(form_data, indent=2)}
    
    Recommend the best 5 drivers and 1 constructor.
    Consider: recent form, circuit history, price value.
    
    Respond ONLY in valid JSON, no markdown, no extra text:
    {{
      "drivers": [
        {{
          "code": "VER",
          "name": "Max Verstappen",
          "team": "Red Bull Racing",
          "reasoning": "specific reason based on data",
          "price_range": "$28-30M"
        }}
      ],
      "constructor": {{
        "name": "McLaren",
        "reasoning": "specific reason"
      }},
      "key_insight": "one sentence summary",
      "drivers_to_avoid": ["code1", "code2"]
    }}
    """
    try:
        for attempt in range(3):
            attempt_prompt = prompt
            if attempt > 0:
                attempt_prompt += "\nPREVIOUS ATTEMPT WAS INVALID OR CORRUPTED. Return only valid JSON with clear English reasoning."

            text = _generate_text(attempt_prompt)
            parsed = parse_json_response(text)
            if parsed.get("error"):
                print(f"[Fantasy Attempt {attempt + 1}] Invalid JSON payload, retrying...")
                continue

            if _has_corrupted_text_in_fantasy_payload(parsed):
                print(f"[Fantasy Attempt {attempt + 1}] Corrupted text detected, retrying...")
                continue

            return parsed

        return _build_fantasy_fallback(race, form_data)
    except Exception as e:
        print(f"[Fantasy AI Error] {e}")
        return _build_fantasy_fallback(race, form_data)

def explain_lap(telemetry: dict, driver: str, race: str, lap: int) -> str:
    prompt = f"""You are an elite F1 telemetry expert delivering a professional lap breakdown.

Driver: {driver}
Race: {race}
Lap: {lap}
Telemetry data:
{json.dumps(telemetry, indent=2)}

STRICT RULES — follow every one:
- Write in perfect English only. Zero typos. Zero broken words.
- Start DIRECTLY with the driver's name. Example: "Max Verstappen delivered..."
- NEVER start with greetings, "Alright", "Hey", "Sure", "Great", or any pleasantry.
- Be specific about sector performance and where time was gained or lost.
- Maximum 120 words. Minimum 40 words.
- Be exciting and engaging for an F1 fan audience.
- Plain text only. No JSON, no markdown, no bullet points.
"""

    try:
        for attempt in range(3):
            attempt_prompt = prompt
            if attempt > 0:
                attempt_prompt += "\n\nPREVIOUS ATTEMPT WAS INVALID. Start your response ONLY with the driver's name, e.g. 'Carlos Sainz...' or 'Lewis Hamilton...'"

            text = (_generate_text(attempt_prompt) or "").strip()
            if _is_valid_text(text):
                return text

            print(f"[Lap Attempt {attempt + 1}] Bad text detected, retrying...")

        return _build_lap_fallback(telemetry, driver, race, lap)
    except Exception as e:
        print(f"[Gemini Lap Error] {e}")
        return _build_lap_fallback(telemetry, driver, race, lap)

def _legacy_get_rivalry_analysis(stats: dict, d1: str, d2: str) -> str:
    prompt = f"""
    You are a sharp F1 analyst known for bold opinions.
    
    Head-to-head stats between {d1} and {d2}:
    {json.dumps(stats, indent=2)}
    
    Write exactly 2 sentences of expert analysis.
    Mention specific numbers from the data.
    Be direct and opinionated — take a side.
    Write in perfect English. Zero typos. Zero broken words.
    Respond as plain text only, no JSON, no markdown.
    """
    try:
        for attempt in range(3):
            attempt_prompt = prompt
            if attempt > 0:
                attempt_prompt += "\nPREVIOUS ATTEMPT HAD TYPOS. Write exactly 2 clean sentences in plain English."

            text = (_generate_text(attempt_prompt) or "").strip()
            if is_clean_text(text) and _is_valid_text(text) and _looks_like_two_sentences(text):
                return text

            print(f"[Rivalry Attempt {attempt + 1}] Bad text detected, retrying...")

        championships = stats.get('championships', {}) if isinstance(stats, dict) else {}
        d1_champs = _to_int(championships.get(d1, championships.get('d1', 0)), 0)
        d2_champs = _to_int(championships.get(d2, championships.get('d2', 0)), 0)
        leader = d1 if d1_champs >= d2_champs else d2
        trailer = d2 if leader == d1 else d1
        return (
            f"{leader} holds the statistical advantage in this head-to-head matchup based on the available data. "
            f"{trailer} remains a formidable competitor whose performances continue to define this rivalry."
        )
    except Exception as e:
        print(f"[Gemini Rivalry Error] {e}")
        return _build_rivalry_fallback(stats, d1, d2)

def get_rivalry_analysis(stats: dict, d1: str, d2: str, year: int | None = None) -> str:
    print("[Rivalry AI] Called with:")
    print(f"  d1={d1}, d2={d2}, year={year}")

    if not stats:
        return f"No statistics available for this {d1} vs {d2} matchup."

    def get_stat(key, alt_key=None):
        if not isinstance(stats, dict):
            return {}
        return stats.get(key, stats.get(alt_key, {}))

    def extract_matchup_values(stat_block):
        if not isinstance(stat_block, dict):
            return 0, 0
        return (
            _to_int(stat_block.get(d1, stat_block.get('d1', 0)), 0),
            _to_int(stat_block.get(d2, stat_block.get('d2', 0)), 0),
        )

    quali = get_stat('qualifying', 'qualifying_wins')
    wins = get_stat('race_wins', 'wins')
    points = get_stat('points', 'championship_points')

    d1_q, d2_q = extract_matchup_values(quali)
    d1_w, d2_w = extract_matchup_values(wins)
    d1_p, d2_p = extract_matchup_values(points)
    season_label = year or 2026

    prompt = f"""You are an F1 analyst.
Write exactly 2 sentences about this {d1} vs {d2} rivalry in {season_label}.

Facts:
- Qualifying: {d1} {d1_q} vs {d2} {d2_q}
- Race wins: {d1} {d1_w} vs {d2} {d2_w}
- Points: {d1} {d1_p} vs {d2} {d2_p}

Rules:
- Start sentence 1 with the leading driver's name
- Sentence 2 must predict future rivalry
- Perfect grammar, no abbreviations
- Maximum 50 words total
- Plain text only"""

    rivalry_generation_config = {
        "temperature": 0.05,
        "top_p": 0.7,
        "max_output_tokens": 120,
    }

    try:
        for attempt in range(3):
            attempt_prompt = prompt
            if attempt > 0:
                attempt_prompt += "\nPREVIOUS ATTEMPT WAS INVALID. Rewrite both sentences in perfect English with no doubled letters."

            text = _generate_text(
                attempt_prompt,
                override_generation_config=rivalry_generation_config,
                preferred_models=None,
            )
            text = " ".join((text or "").replace("  ", " ").split())

            if is_clean_text(text, min_length=20) and _looks_like_two_sentences(text):
                return text

            print(f"[Rivalry Attempt {attempt + 1}] Bad text detected, retrying...")
    except Exception as e:
        print(f"[Gemini error] {e}")

    leader = d1 if d1_q >= d2_q else d2
    trailer = d2 if leader == d1 else d1
    leader_q = d1_q if leader == d1 else d2_q
    trailer_q = d2_q if leader == d1 else d1_q

    return (
        f"{leader} leads this {season_label} rivalry with a {leader_q}-{trailer_q} qualifying advantage so far. "
        f"{trailer} will need to find more single-lap pace to challenge in the remaining races this season."
    )

@functools.lru_cache(maxsize=32)
def get_circuit_insight(circuit: str) -> str:
    prompt = f"""
    You are the head race engineer on the digital pit wall.
    Circuit: {circuit}
    
    Give exactly ONE sentence of tactical insight or strategy for this specific track.
    Sound sharp, professional, and focus on telemetry, tires, or DRS.
    Write in perfect English. Zero typos. Zero broken words.
    No hashtags, no pleasantries, just data-driven tactical advice.
    """
    try:
        text = _generate_text(prompt)
        if text and len(text) > 20 and text[0].isupper():
            return text
        text2 = _generate_text(prompt + "\nPREVIOUS ATTEMPT HAD TYPOS. Write one clean sentence in perfect English.")
        if text2 and len(text2) > 20 and text2[0].isupper():
            return text2
        return "Tactical data stream interrupted. Awaiting telemetry refresh."
    except Exception as e:
        print(f"[Gemini Circuit Insight Error] {e}")
        return "Tactical data stream interrupted. Awaiting telemetry refresh."


def get_career_comparison(driver1_name: str, driver2_name: str, stats1: dict, stats2: dict) -> str:
    """Generate an AI-powered career comparison verdict between two F1 drivers."""
    prompt = f"""Compare these two F1 drivers' careers:

{driver1_name}:
Championships: {stats1['totals']['championships']}
Wins: {stats1['totals']['wins']}
Podiums: {stats1['totals']['podiums']}
Poles: {stats1['totals'].get('poles', 0)}
Win Rate: {stats1['totals'].get('win_rate', 0)}%
Seasons: {stats1['totals']['seasons_count']}

{driver2_name}:
Championships: {stats2['totals']['championships']}
Wins: {stats2['totals']['wins']}
Podiums: {stats2['totals']['podiums']}
Poles: {stats2['totals'].get('poles', 0)}
Win Rate: {stats2['totals'].get('win_rate', 0)}%
Seasons: {stats2['totals']['seasons_count']}

Write exactly 2 sentences.
Sentence 1: Who leads statistically and by how much, citing specific numbers.
Sentence 2: Bold verdict on legacy.
Be direct and opinionated.
Perfect English only. No jargon. Zero typos. Zero broken words.
Start with a driver name, not 'The' or 'While'.
Plain text only. No markdown or formatting."""

    try:
        for attempt in range(3):
            attempt_prompt = prompt
            if attempt > 0:
                attempt_prompt += "\nPREVIOUS ATTEMPT HAD TYPOS. Rewrite both sentences in perfect English."

            text = (_generate_text(attempt_prompt) or "").strip()
            if _is_valid_text(text) and is_clean_text(text) and _looks_like_two_sentences(text):
                return text

            print(f"[Career Attempt {attempt + 1}] Bad text detected, retrying...")

        raise ValueError("Response too short or corrupted")
    except Exception as e:
        print(f"[Career Compare Error] {e}")
        # Return a real analytical fallback, not a generic error
        c1 = stats1['totals']['championships']
        c2 = stats2['totals']['championships']
        w1 = stats1['totals']['wins']
        w2 = stats2['totals']['wins']
        champ_winner = driver1_name if c1 > c2 else driver2_name
        win_winner = driver1_name if w1 > w2 else driver2_name
        return f"{champ_winner} leads on championships ({max(c1,c2)} vs {min(c1,c2)}) while {win_winner} has the edge in race wins ({max(w1,w2)} vs {min(w1,w2)}). Both represent generational talents whose legacies will be debated for decades."
