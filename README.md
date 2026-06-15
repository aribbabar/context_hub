# Context Hub

Context Hub is a local wrapper around `docs-mcp-server` for indexing documentation from friendlier inputs.

The wrapper keeps `docs-mcp-server` as the indexing/search engine, uses `crawl4ai` for higher-quality web crawling, and exposes a frontend flow that can turn user selections into backend indexing jobs.

## Repository Layout

- `backend/` - FastAPI service, job orchestration, local source registry, and adapters around external tools.
- `frontend/` - React/Vite UI.
- `backend/data/` - local runtime state owned by the wrapper. Contents are ignored by git.
- `docs-mcp-server/` - local reference clone, ignored by this repo.

## Architecture Direction

The backend should normalize every source into an indexable artifact or location, then call the existing docs indexing path rather than inventing a second search store.

- Local folders: the frontend asks the user for a folder, then the backend registers that folder as a local source and invokes `docs-mcp-server` with a `file:///...` URL internally.
- Web docs: the backend crawls with `crawl4ai`, stores the cleaned crawl output under `backend/data/indexed-docs/`, then submits that stored content to `docs-mcp-server`.
- Source registry: the wrapper stores stable source metadata, job state, and generated artifact paths under `backend/data/`.

Browser folder selection has security limits: a normal web page generally cannot send an absolute local folder path to the backend. For this same-machine local app, the Capture screen's Add folder and Add files buttons call backend native picker endpoints.

## Development

Backend:

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
fastapi dev
```

Crawl4AI is installed through `backend/requirements.txt`; no separate Crawl4AI clone or setup commands are needed for normal use. If a web crawl fails because Playwright cannot find Chromium, install the browser once:

```powershell
python -m playwright install chromium
```

Frontend:

```powershell
cd frontend
npm install
npm run dev
```
