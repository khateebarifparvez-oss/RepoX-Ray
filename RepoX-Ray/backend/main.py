from __future__ import annotations

import ast
import io
import os
import zipfile
from pathlib import PurePosixPath
from typing import Any
from fastapi.middleware.cors import CORSMiddleware
import networkx as nx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="RepoX-Ray API", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://repo-x-ray-tau.vercel.app",
        "http://localhost:5173",
    ],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Set FRONTEND_ORIGIN in production, e.g. https://your-app.vercel.app
origins = os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in origins if o.strip()],
    allow_credentials=False,
    allow_methods=["GET", "POST"],
    allow_headers=["*"],
)

MAX_UPLOAD_BYTES = 10 * 1024 * 1024
MAX_FILES = 500
ALLOWED_SUFFIXES = {".py", ".js", ".jsx", ".ts", ".tsx"}
SKIP_PARTS = {
    "node_modules", ".git", "dist", "build", "__pycache__", ".venv",
    "venv", "coverage", ".next"
}


def safe_path(name: str) -> str | None:
    path = PurePosixPath(name.replace("\\", "/"))
    if path.is_absolute() or ".." in path.parts:
        return None
    if any(part in SKIP_PARTS for part in path.parts):
        return None
    if path.suffix.lower() not in ALLOWED_SUFFIXES:
        return None
    return str(path)


def module_name(path: str) -> str:
    p = PurePosixPath(path)
    return str(p.with_suffix("")).replace("/", ".").replace("\\", ".")


def parse_python(path: str, source: str, graph: nx.DiGraph, symbols: dict[str, dict[str, Any]]) -> None:
    try:
        tree = ast.parse(source)
    except (SyntaxError, ValueError):
        return

    mod = module_name(path)
    graph.add_node(f"file:{path}", label=path, kind="file", path=path)
    imports: set[str] = set()
    function_nodes: list[tuple[ast.AST, str, str]] = []

    class Visitor(ast.NodeVisitor):
        def __init__(self):
            self.scope: list[str] = []

        def visit_Import(self, node: ast.Import):
            for alias in node.names:
                imports.add(alias.name)

        def visit_ImportFrom(self, node: ast.ImportFrom):
            if node.module:
                imports.add("." * node.level + node.module)

        def visit_ClassDef(self, node: ast.ClassDef):
            name = ".".join(self.scope + [node.name])
            ident = f"symbol:{path}:{name}:{node.lineno}"
            graph.add_node(ident, label=name, kind="class", path=path, line=node.lineno)
            graph.add_edge(f"file:{path}", ident, kind="contains")
            self.scope.append(node.name)
            self.generic_visit(node)
            self.scope.pop()

        def visit_FunctionDef(self, node: ast.FunctionDef):
            self._function(node)

        def visit_AsyncFunctionDef(self, node: ast.AsyncFunctionDef):
            self._function(node)

        def _function(self, node):
            name = ".".join(self.scope + [node.name])
            ident = f"symbol:{path}:{name}:{node.lineno}"
            graph.add_node(ident, label=name, kind="function", path=path, line=node.lineno)
            graph.add_edge(f"file:{path}", ident, kind="contains")
            symbols.setdefault(name, {"id": ident, "path": path, "line": node.lineno, "name": name})
            symbols.setdefault(node.name, {"id": ident, "path": path, "line": node.lineno, "name": name})
            function_nodes.append((node, ident, name))
            self.scope.append(node.name)
            # Do not treat nested function definitions as top-level peers.
            for child in node.body:
                self.visit(child)
            self.scope.pop()

    Visitor().visit(tree)

    for imported in imports:
        normalized = imported.lstrip(".").replace(".", "/")
        candidates = [p for p in source_paths if module_name(p) == imported.lstrip(".") or p.endswith(normalized + ".py")]
        for target in candidates[:1]:
            if target != path:
                graph.add_edge(f"file:{path}", f"file:{target}", kind="imports")

    for node, ident, _ in function_nodes:
        calls: set[str] = set()
        for child in ast.walk(node):
            if isinstance(child, ast.Call):
                func = child.func
                if isinstance(func, ast.Name):
                    calls.add(func.id)
                elif isinstance(func, ast.Attribute):
                    calls.add(func.attr)
        for called in calls:
            # Resolve only when a unique symbol is known; ambiguous names are skipped.
            target = symbols.get(called)
            if target and target["id"] != ident:
                graph.add_edge(ident, target["id"], kind="calls")


def parse_javascript(path: str, source: str, graph: nx.DiGraph, symbols: dict[str, dict[str, Any]]) -> None:
    # Lightweight regex parser: deliberately heuristic, not a full JS/TS compiler.
    import re
    graph.add_node(f"file:{path}", label=path, kind="file", path=path)
    patterns = [
        re.compile(r"\bfunction\s+([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{"),
        re.compile(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>"),
        re.compile(r"\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?[A-Za-z_$][\w$]*\s*=>"),
    ]
    found = []
    for pattern in patterns:
        for match in pattern.finditer(source):
            name = match.group(1)
            line = source.count("\n", 0, match.start()) + 1
            ident = f"symbol:{path}:{name}:{line}"
            if not graph.has_node(ident):
                graph.add_node(ident, label=name, kind="function", path=path, line=line)
                graph.add_edge(f"file:{path}", ident, kind="contains")
                symbols.setdefault(name, {"id": ident, "path": path, "line": line, "name": name})
                found.append((name, ident))
    import re
    for name, ident in found:
        # Heuristic calls: name(...) appearances anywhere in file, excluding self-call.
        for called in set(re.findall(r"\b([A-Za-z_$][\w$]*)\s*\(", source)):
            target = symbols.get(called)
            if target and target["id"] != ident:
                graph.add_edge(ident, target["id"], kind="calls")
    for match in re.finditer(r"\b(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['\"`]([^'\"`]+)", source):
        method, route = match.groups()
        ident = f"endpoint:{method.upper()} {route}:{path}"
        graph.add_node(ident, label=f"{method.upper()} {route}", kind="endpoint", path=path)
        graph.add_edge(f"file:{path}", ident, kind="defines")


def analyze_files(file_map: dict[str, str]) -> dict[str, Any]:
    global source_paths
    source_paths = list(file_map.keys())
    graph = nx.DiGraph()
    symbols: dict[str, dict[str, Any]] = {}
    for path, source in file_map.items():
        if path.endswith(".py"):
            parse_python(path, source, graph, symbols)
        else:
            parse_javascript(path, source, graph, symbols)

    # Second pass resolves calls discovered before their target was parsed.
    for node, data in list(graph.nodes(data=True)):
        if data.get("kind") != "function":
            continue
        path = data.get("path", "")
        if not path.endswith(".py"):
            continue
        source = file_map.get(path, "")
        try:
            tree = ast.parse(source)
        except SyntaxError:
            continue
        function_name = data.get("label", "")
        target_ast = None
        for item in ast.walk(tree):
            if isinstance(item, (ast.FunctionDef, ast.AsyncFunctionDef)) and item.name == function_name.split(".")[-1] and item.lineno == data.get("line"):
                target_ast = item
                break
        if not target_ast:
            continue
        for child in ast.walk(target_ast):
            if isinstance(child, ast.Call):
                called = child.func.id if isinstance(child.func, ast.Name) else child.func.attr if isinstance(child.func, ast.Attribute) else None
                target = symbols.get(called) if called else None
                if target and target["id"] != node:
                    graph.add_edge(node, target["id"], kind="calls")

    nodes = []
    for node_id, data in graph.nodes(data=True):
        nodes.append({"id": node_id, **data})
    edges = [{"source": u, "target": v, **data} for u, v, data in graph.edges(data=True)]

    # Degree-based risk score is a heuristic, not a security vulnerability score.
    risk = {}
    max_degree = max((graph.in_degree(n) + graph.out_degree(n) for n in graph.nodes), default=1) or 1
    for n, data in graph.nodes(data=True):
        if data.get("kind") in {"file", "function", "class"}:
            degree = graph.in_degree(n) + graph.out_degree(n)
            risk[n] = round(100 * degree / max_degree)
    risky = sorted(
        [{"id": n, "label": graph.nodes[n].get("label", n), "path": graph.nodes[n].get("path", ""), "score": score,
          "connections": graph.in_degree(n) + graph.out_degree(n)}
         for n, score in risk.items()],
        key=lambda x: (x["score"], x["connections"]), reverse=True
    )[:12]

    endpoints = [n for n in nodes if n.get("kind") == "endpoint"]
    return {
        "summary": {
            "files": sum(1 for n in nodes if n.get("kind") == "file"),
            "functions": sum(1 for n in nodes if n.get("kind") == "function"),
            "classes": sum(1 for n in nodes if n.get("kind") == "class"),
            "endpoints": len(endpoints),
            "edges": len(edges),
        },
        "nodes": nodes,
        "edges": edges,
        "riskyModules": risky,
        "endpoints": endpoints,
        "notice": "Python uses AST parsing. JavaScript/TypeScript parsing is heuristic. Risk scores reflect graph connectivity, not confirmed bugs or security vulnerabilities."
    }


@app.get("/")
def root():
    return {"name": "RepoX-Ray API", "status": "ok", "docs": "/docs"}


@app.post("/api/analyze")
async def analyze_repository(file: UploadFile = File(...)):
    if not file.filename or not file.filename.lower().endswith(".zip"):
        raise HTTPException(status_code=400, detail="Upload a .zip file containing your repository.")
    raw = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="ZIP upload exceeds 10 MB.")
    file_map: dict[str, str] = {}
    try:
        with zipfile.ZipFile(io.BytesIO(raw)) as archive:
            for info in archive.infolist():
                if info.is_dir():
                    continue
                path = safe_path(info.filename)
                if not path:
                    continue
                if len(file_map) >= MAX_FILES:
                    break
                # Limit each source file and avoid huge/binary entries.
                if info.file_size > 500_000:
                    continue
                try:
                    source = archive.read(info).decode("utf-8")
                except (UnicodeDecodeError, RuntimeError):
                    continue
                file_map[path] = source
    except zipfile.BadZipFile:
        raise HTTPException(status_code=400, detail="That file is not a valid ZIP archive.")

    if not file_map:
        raise HTTPException(status_code=400, detail="No supported .py, .js, .jsx, .ts or .tsx files found.")
    return analyze_files(file_map)
