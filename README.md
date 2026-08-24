# Vintage Piece Searcher

A personal tool that continuously searches Vinted for vintage pieces you're hunting for. Upload a reference image + brand, and the tool uses CLIP visual matching to find the most similar listings on Vinted.

## How it works

1. **Add a piece** — upload a reference photo and brand name (+ optional category, material, description)
2. **Automatic search** — the tool searches Vinted by brand, then uses CLIP to rank results by visual similarity to your reference photo
3. **Browse results** — see the top 10 most visually similar Vinted listings per piece, click through to buy

Searches run automatically at 9:00, 12:00, 15:00, and 20:00, plus you can hit "Resync" anytime.

## Setup

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

The CLIP model (~600MB) downloads automatically on first use.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Tech stack

- **Backend**: Python / FastAPI / SQLite / APScheduler
- **Vinted search**: vinted-api-kit
- **Visual matching**: CLIP (sentence-transformers)
- **Frontend**: React / Vite / Tailwind CSS / TanStack Query
