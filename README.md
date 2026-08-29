<div align="center">

# 🏎️ BoxBox

### Your F1 Intelligence Hub

**The only open-source F1 dashboard that combines real telemetry, 
AI analysis, fantasy picks, and driver career comparisons 
— built for fans who want more than just race results.**

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-box--box--raj.vercel.app-E10600?style=for-the-badge)](https://box-box-raj.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/RAJJBHALARA/Box-Box?style=for-the-badge&color=E10600)](https://github.com/RAJJBHALARA/Box-Box/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-Python_3.11-009688?style=for-the-badge&logo=fastapi)](https://fastapi.tiangolo.com)
[![Gemini](https://img.shields.io/badge/AI-Gemini_1.5_Pro-4285F4?style=for-the-badge&logo=google)](https://ai.google.dev)

<br/>

</div>

---

## 🤔 Why I Built This

I'm an F1 fan and CE student. Every race weekend I found myself 
switching between 5 different tabs — the official F1 app for 
standings, a Reddit thread for analysis, a spreadsheet for 
fantasy picks, and YouTube for race breakdowns.

None of the existing tools solved the full problem:
- Official F1 app → paywalled live data, no AI
- Existing GitHub F1 projects → Jupyter notebooks 
  or basic Streamlit apps with no design
- Fantasy tools → manual, no AI recommendations
- Telemetry tools → CLI only, not fan-friendly

So I built **BoxBox** — everything an F1 fan needs, 
in one premium dashboard, completely free and open source.

---

## ✨ What BoxBox Does

### 🏁 Race Analysis
Select any Grand Prix from 2018–2026 and instantly see:
- **Lap time evolution charts** — watch how pace changed 
  through the race, pit stop effects visible as spikes
- **Tire strategy timelines** — color-coded compound bars 
  showing exactly when each driver pitted and on what rubber
- **Circuit information** — animated SVG circuit map with 
  DRS zones highlighted, lap record, historical winners, 
  track temperature and weather conditions
- **AI Pit Wall Alert** — Gemini AI generates a tactical 
  insight for each circuit based on historical data

### ⚔️ Rivalry Tracker
Pick any two drivers from the 2025 grid and compare:
- Qualifying head-to-head record (who outqualified who)
- Race wins between teammates
- Average pace gap in milliseconds
- Championship points comparison
- **AI Rivalry Verdict** — Gemini writes a sharp 2-sentence 
  analysis of who dominated and why, with real numbers

### 🤖 AI Fantasy Picks
Stop guessing your F1 Fantasy lineup. BoxBox:
- Pulls recent form data from OpenF1 API (2025 races)
- Sends driver performance to Gemini 1.5 Pro
- Returns 5 driver picks + 1 constructor with reasoning
- Shows recent form badges (last 3 race finishing positions)
- **Share your picks** — one-click download a beautiful 
  1080x1080 card for Instagram/Reddit/WhatsApp

### 🏆 Championship Standings
Live 2025 standings updated after every race:
- Driver championship with points gap visualization
- Constructor championship with team color coding
- Position change indicators (▲▼) after each round
- Data from Jolpica API (free Ergast mirror)

### 🐐 Driver Career Timeline
The feature F1 fans spend the most time on:
- Full career stats: Championships, Wins, Podiums, 
  Poles, Fastest Laps, Seasons, Win Rate
- Season-by-season timeline with championship highlights
  (gold glow on World Championship winning years)
- Team history pills showing every team a driver raced for
- **Compare any two drivers** side by side — 
  try Hamilton (7 titles, 105 wins) vs 
  Verstappen (4 titles, 71 wins)
- AI career verdict comparing two drivers' legacies
- Covers current grid + legends: Schumacher, Senna, 
  Prost, Vettel, Räikkönen, Rosberg, Button

### 🔬 Lap Explainer
Enter any driver, race, and lap number:
- Fetches real telemetry for that specific lap
- Shows sector times, max speed, ERS charge
- Animated circuit map with racing line
- **AI Telemetry Verdict** — Gemini explains exactly 
  what happened in plain English, where time was 
  gained or lost, sector by sector

### 👋 Beginner Mode
Toggle between Expert and Beginner mode:
- **Expert**: raw telemetry, sector times, lap deltas
- **Beginner**: plain English explanations, emoji 
  indicators, F1 glossary, "What does this mean?" tooltips
- Built for the 90% of F1 fans who love the sport 
  but don't understand what "undercut" means
- Guided tutorial on first visit

### 📤 Shareable Race Cards
- One-click generate a cinematic race result card
- Square (1080x1080) for Instagram/Reddit/WhatsApp
- Story (1080x1350) for Snapchat/Instagram Stories
- Includes podium, fastest lap, team colors, circuit
- Download PNG or share directly to X/Twitter
- Fantasy picks cards also shareable

### 🔔 Race Weekend Detection
- Automatically detects if it's a race weekend
- Shows live banner: "RACE WEEKEND ACTIVE — FP1 IN PROGRESS"
- Countdown timer to next session
- Email signup for race preview notifications

## 🛠️ Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 19 + Vite | UI framework + build tool |
| Tailwind CSS | Utility-first styling |
| Framer Motion | Premium animations |
| Recharts | Data visualization |
| Axios | API communication |
| html2canvas | Share card generation |

### Backend
| Technology | Purpose |
|-----------|---------|
| FastAPI (Python 3.11) | REST API framework |
| FastF1 | Historical F1 telemetry (2018-2025) |
| Google Gemini 1.5 Pro | AI analysis + commentary |
| Pandas + NumPy | Data processing |
| Slowapi | Rate limiting |

### Data Sources
| Source | Data |
|--------|------|
| FastF1 | Lap times, telemetry, tire strategy |
| OpenF1 API | 2025 live session data |
| Jolpica API | Career stats, championship standings |
| flagcdn.com | Country flags |
| F1 Media CDN | Official driver photos |

### Deployment
| Service | Purpose |
|---------|---------|
| Vercel | Frontend hosting |
| Render | Backend hosting |

---

## 😤 Problems I Faced Building This

This project took way longer than expected. 
Here are the real challenges I hit:

### 1. FastF1 Cache Downloads (60 Second Waits)
FastF1 downloads ~80-90MB of CSV data per race session 
on first load. This caused 60-second API timeouts with no 
feedback to the user. 

**Solution:** Built a global Axios interceptor that detects 
slow responses (>5 seconds) and shows an animated 
"Building Cache..." banner so users know it's working, 
not broken.

### 2. Race Name Mismatches Between APIs
The frontend showed "Albert Park Circuit" but FastF1 
expects "Australia". Monaco is "Monaco" not "Monaco Circuit". 
This caused silent failures across Race Analysis.

**Solution:** Built a `RACE_NAME_MAP` dictionary in 
`f1_data.py` that translates between UI-friendly names 
and FastF1-compatible names.

### 3. Driver Photos Blocked by CORS in Share Cards
html2canvas can't load images from external CDNs 
(formula1.com blocks cross-origin requests).

**Solution:** Pre-load all driver images as base64 
using FileReader before rendering the share card, 
bypassing CORS entirely.

### 4. Windows Doesn't Render Flag Emojis
Flag emojis (🇬🇧 🇳🇱 🇲🇨) show as text codes on Windows 
("GB" "NL" "MC") making the app look broken.

**Solution:** Replaced all flag emojis with 
`<img>` tags from flagcdn.com which renders 
correctly on every OS.

### 5. Gemini API Returns Invalid JSON
Despite strict prompting, Gemini sometimes wraps 
JSON in markdown code fences (```json ... ```) 
or returns incomplete objects.

**Solution:** Built a `parse_json_response()` helper 
that strips markdown fences and validates structure 
before returning, with a safe hardcoded fallback.

### 6. Career Stats API Rate Limiting
Fetching Hamilton's 383 race results required 
multiple paginated Jolpica API calls. Too many 
requests triggered rate limiting.

**Solution:** Implemented session-level caching 
(`career_cache` dict) so Hamilton's data loads 
in ~3 seconds on second visit vs 60 seconds 
on first load.

### 7. Framer Motion + React Router Exit Animations
AnimatePresence wouldn't trigger exit animations 
on route changes because the key wasn't being 
updated correctly.

**Solution:** Used `useLocation()` key on the 
Routes wrapper and `mode="wait"` on AnimatePresence 
to ensure pages fully unmount before next page mounts.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- AI key: Gemini (free at ai.google.dev) **or** OpenRouter **or** NVIDIA NIM (`nvapi-...` at build.nvidia.com) — any one works, fallback to deterministic if missing

### Backend Setup
```bash
git clone https://github.com/smithplayz13-dev/Box-Box.git
cd Box-Box/backend

python -m venv venv
# Windows:
venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

pip install -r requirements.txt

# Create .env file:
cp .env.example .env
# Edit .env — see Environment Variables below

uvicorn main:app --reload
# Backend running at http://localhost:8000
# API docs at http://localhost:8000/docs
# Health at http://localhost:8000/api/health
```

### Frontend Setup
```bash
cd ../frontend
npm install

# Create .env.local:
cp .env.example .env.local
# Set VITE_API_URL and VITE_API_KEY to match backend

npm run dev
# Frontend running at http://localhost:5173
```

### Environment Variables

**backend/.env**
```ini
API_SECRET_KEY=any_random_32_char_string  # must match frontend VITE_API_KEY
ALLOWED_ORIGINS=http://localhost:5173     # comma-separated for prod

# Pick ONE AI provider (fallbacks are deterministic if none set):
GEMINI_API_KEY=your_gemini_key
# or OpenRouter:
# AI_PROVIDER=openrouter
# OPENROUTER_API_KEY=sk-or-v1-...
# OPENROUTER_MODEL=google/gemini-2.5-flash
# or NVIDIA NIM (hosted or self-hosted):
# AI_PROVIDER=nvidia
# NVIDIA_API_KEY=nvapi-...
# AI_MODEL=moonshotai/kimi-k3
# AI_FALLBACK_MODELS=nvidia/nemotron-3-nano-omni-30b-a3b-reasoning,nvidia/nemotron-3-nano-30b-a3b

# Generic OpenAI-compatible (Ollama/Together):
# AI_PROVIDER=openai-compatible
# AI_API_KEY=...
# AI_BASE_URL=http://localhost:11434/v1
```

**frontend/.env.local** (or `.env.example`)
```ini
VITE_API_URL=http://localhost:8000
VITE_API_KEY=same_as_API_SECRET_KEY_above
```

### Production Deployment

**Render (Backend)**
1. Create Web Service from `smithplayz13-dev/Box-Box`, Root Directory `backend`, `render.yaml` is pre-configured.
2. Set Environment Variables in Render Dashboard (all `sync: false`):
   `API_SECRET_KEY` (generate `openssl rand -hex 16`), `ALLOWED_ORIGINS=https://your-frontend.vercel.app,https://your-preview-*.vercel.app,http://localhost:5173`, plus one AI key (`GEMINI_API_KEY` **or** `NVIDIA_API_KEY`/`OPENROUTER_API_KEY`).
3. Deploy. `healthCheckPath: /api/health` verifies. FastF1 disk cache is ephemeral — first request after deploy re-downloads ~80MB and shows “Building Cache…” banner (expected).

**Vercel (Frontend)**
1. Import `smithplayz13-dev/Box-Box`, Framework `Vite`, Root Directory `frontend`, Build `npm run build`, Output `dist`.
2. Add Environment Variables: `VITE_API_URL=https://your-backend.onrender.com`, `VITE_API_KEY=same_as_backend_API_SECRET_KEY`.
3. Deploy. `vercel.json` handles SPA rewrites (`/* → /index.html`) so refreshing `/race-analysis` etc. never 404, and caches `assets/*` immutable.

**API URL Configuration**
- Frontend reads `VITE_API_URL` at build time (`src/services/api.js:9`). Changing it requires rebuild/redeploy.
- Backend `ALLOWED_ORIGINS` must include the exact Vercel URL (including `https://`). For preview deploys, add `https://your-project-*.vercel.app`.
- Never put `GEMINI_API_KEY`/`NVIDIA_API_KEY` in `VITE_*` — they stay server-only.

**Troubleshooting**
- `AUTH_ERROR`/`403 Invalid API key` → `VITE_API_KEY` ≠ `API_SECRET_KEY`.
- `CORS blocked` → check `ALLOWED_ORIGINS` includes frontend origin (no trailing slash, comma-separated, no `*` with credentials).
- `REQUEST_TIMEOUT`/`Building Cache...` → Render free cold start + FastF1 download (60s). Wait, retry, or check `/api/health`.
- Telemetry `500`/`NaN` → fixed in `f1_data.py` (sector NaN → `0`). Update to latest.
- `429 Too Many Requests` (NIM/OpenRouter) → automatic fallback chain (`kimi-k3` → `nvidia/nemotron-3-nano-omni` → … → deterministic). Override via `AI_FALLBACK_MODELS`.
- `/api/debug-telemetry` now requires `X-API-Key` and is rate-limited (10/min).
- `npm run build` fails → check `vite.config.js` (no proxy needed), ensure `VITE_API_URL` set.

---

## 📁 Project Structure
boxbox/
├── backend/
│   ├── main.py          # FastAPI app + all endpoints
│   ├── f1_data.py       # FastF1 data functions
│   ├── ai_advisor.py    # Gemini AI integration
│   ├── requirements.txt
│   ├── render.yaml      # Render deployment config
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/  # Reusable UI components
│   │   ├── pages/       # Route pages
│   │   ├── services/    # API layer (api.js)
│   │   ├── utils/       # Helpers + constants
│   │   └── context/     # React context (ModeContext)
│   ├── vercel.json      # Vercel deployment config
│   └── .env.example
└── screenshots/

---

## 🗺️ Roadmap

- [x] Race Analysis with lap time charts
- [x] Tire strategy visualization
- [x] Rivalry Tracker with AI analysis
- [x] AI Fantasy Picks (Gemini powered)
- [x] Championship Standings (2025 live)
- [x] Driver Career Timeline
- [x] Career comparison (any two drivers)
- [x] Lap Explainer with AI commentary
- [x] Circuit info with SVG maps
- [x] Shareable race cards (PNG download)
- [x] Beginner Mode with guided tutorial
- [x] Race weekend detection banner
- [x] Email notifications signup
- [x] Mobile responsive + bottom navigation
- [ ] Live timing during sessions
- [ ] Push notifications via service worker
- [ ] User accounts + saved fantasy teams
- [ ] More circuit SVG maps
- [ ] 2026 season data integration

---

## 🤝 Contributing

Contributions are welcome! This project is 
built for the F1 community.

1. Fork the repo
2. Create a branch: `git checkout -b feat/your-feature`
3. Commit: `git commit -m "feat: add your feature"`
4. Push: `git push origin feat/your-feature`
5. Open a Pull Request

Good first issues:
- Add more circuit SVG maps
- Add more F1 legend drivers to Career page
- Improve Beginner Mode explanations
- Add more historical race data

---

## ⚡ API Reference

Once running, full API docs available at:
`http://localhost:8000/docs`

Key endpoints:
GET  /api/health              Health check
GET  /api/races?year=2025     Race calendar
GET  /api/lap-times           Lap time data
GET  /api/tire-strategy       Tire strategies
GET  /api/rivalry             Head-to-head stats
GET  /api/telemetry           Lap telemetry
GET  /api/career?driver=      Career stats
GET  /api/standings           Championship
POST /api/fantasy-picks       AI fantasy picks
POST /api/career-compare      Career comparison

---

## 📝 License

MIT License — free to use, modify, and distribute.
See [LICENSE](LICENSE) for details.

---

## 🙏 Credits

- F1 telemetry data: [FastF1](https://github.com/theOehrly/Fast-F1)
- Historical stats: [Jolpica API](https://jolpi.ca)
- 2025 live data: [OpenF1](https://openf1.org)
- AI analysis: [Google Gemini](https://ai.google.dev)
- Driver photos: [Formula1.com Media CDN](https://formula1.com)
- Country flags: [flagcdn.com](https://flagcdn.com)

---

<div align="center">

**Built with ❤️ for F1 fans everywhere**

If BoxBox helped you dominate F1 Fantasy or 
win a pub quiz about Hamilton vs Schumacher,
consider giving it a ⭐

[![Star History](https://img.shields.io/github/stars/RAJJBHALARA/Box-Box?style=social)](https://github.com/RAJJBHALARA/Box-Box)

</div>
