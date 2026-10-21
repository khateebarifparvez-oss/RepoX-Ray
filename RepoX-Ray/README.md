# RepoX-Ray — See how any codebase works

RepoX-Ray is a portfolio-ready MVP that uploads a ZIP of a repository and builds an interactive map of files, functions, classes, API endpoints, imports, and detected calls.

## Features

- Interactive graph (zoom, pan, drag nodes, inspect nodes)
- Python source parsing with Python's `ast` module
- Lightweight heuristic parser for JavaScript / TypeScript declarations and Express-style endpoints
- NetworkX dependency graph
- Connectivity-based hotspot score (heuristic, not a security scan)
- Connected-node / change-impact exploration
- ZIP safety basics: upload size cap, source-file cap, path traversal filtering, ignored dependency/build directories

## Requirements

- Python 3.10+
- Node.js 20+ recommended
- npm

## Run locally

### 1. Start the backend

Windows PowerShell:

BACKEND EXECUTION:
py -0p
where.exe python
py -3.12 -m venv backend\.venv
backend\.venv\Scripts\activate
python -m pip install --upgrade pip
python -m pip install -r backend\requirements.txt
cd backend
python -m uvicorn main:app --reload --port 8000


API docs: http://localhost:8000/docs

### 2. Start the frontend in another terminal

```bash
cd repox-ray/frontend
npm install
npm run dev
```

Open the URL Vite prints, normally http://localhost:5173.

### 3. Analyze a repository

In GitHub, choose **Code → Download ZIP**, then in RepoX-Ray click **Analyze repository** and select the ZIP. The demo graph appears initially so you can explore the interface before uploading a project.

## Deploy

### Backend: Render

1. Push this folder to a GitHub repository.
2. In Render, create **New → Web Service** and connect the repository.
3. Set **Root Directory** to `backend`.
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn main:app --host 0.0.0.0 --port $PORT`
6. Deploy. Copy the service URL, e.g. `https://repox-ray-api.onrender.com`.

### Frontend: Vercel

1. Import the same GitHub repository in Vercel.
2. Set **Root Directory** to `frontend`.
3. Set environment variable `VITE_API_URL` to the Render backend URL (no trailing slash), e.g. `https://repox-ray-api.onrender.com`.
4. Deploy.
5. In Render, set `FRONTEND_ORIGIN` to the deployed Vercel origin, e.g. `https://repox-ray.vercel.app`. If you use a custom domain, include that origin too, comma-separated.
6. Redeploy the backend after setting the environment variable.

## Important limitations

- This is a functional MVP, not a complete language-server-grade parser.
- Python uses AST; JavaScript/TypeScript extraction is regex-based and can miss calls, overloads, decorators, dynamic imports, aliasing, and framework-specific routing.
- Import resolution is intentionally lightweight and may miss relative imports or package aliases.
- Change impact means graph-connected nodes, not a compiler-proven blast radius.
- Hotspot scores use connectivity only. They are not vulnerability or defect predictions.
- ZIPs are processed in memory and not saved. For a public deployment, add authentication, rate limiting, request timeouts, stronger archive-bomb defenses, and isolated analysis workers before inviting arbitrary users.
- Keep uploads to repositories you have permission to analyze. The current app does not clone private GitHub repositories or call an LLM.

## Suggested next improvements

1. Use tree-sitter for robust Python/JS/TS parsing.
2. Resolve imports through language-specific module rules.
3. Add call-path tracing between a chosen API endpoint and database layer.
4. Add tests, auth, async background jobs, and export to SVG/JSON.
5. Add a GitHub App integration with explicit repo permissions.
