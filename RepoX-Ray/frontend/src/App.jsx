
import React, { useCallback, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  MarkerType
} from 'reactflow';
import {
  Activity,
  ArrowUpRight,
  Boxes,
  Braces,
  ChevronRight,
  FileCode2,
  GitBranch,
  Github,
  Network,
  Search,
  ShieldAlert,
  Upload,
  Waypoints,
  Zap
} from 'lucide-react';

const API = import.meta.env.VITE_API_URL || 'https://repox-ray.onrender.com/';

const sample = {
  summary: { files: 6, functions: 9, classes: 2, endpoints: 2, edges: 15 },
  nodes: [
    { id: 'file:app.py', label: 'app.py', kind: 'file', path: 'app.py' },
    { id: 'file:routes.py', label: 'routes.py', kind: 'file', path: 'routes.py' },
    { id: 'file:services/user_service.py', label: 'user_service.py', kind: 'file', path: 'services/user_service.py' },
    { id: 'file:repositories/user_repo.py', label: 'user_repo.py', kind: 'file', path: 'repositories/user_repo.py' },
    { id: 'file:models/user.py', label: 'user.py', kind: 'file', path: 'models/user.py' },
    { id: 'file:db.py', label: 'db.py', kind: 'file', path: 'db.py' },

    { id: 'symbol:app.py:create_app:4', label: 'create_app', kind: 'function', path: 'app.py', line: 4 },
    { id: 'symbol:routes.py:get_user:12', label: 'get_user', kind: 'function', path: 'routes.py', line: 12 },
    { id: 'symbol:services/user_service.py:fetch_user:8', label: 'fetch_user', kind: 'function', path: 'services/user_service.py', line: 8 },
    { id: 'symbol:repositories/user_repo.py:find_by_id:6', label: 'find_by_id', kind: 'function', path: 'repositories/user_repo.py', line: 6 },
    { id: 'symbol:db.py:get_connection:3', label: 'get_connection', kind: 'function', path: 'db.py', line: 3 },
    { id: 'symbol:models/user.py:User:2', label: 'User', kind: 'class', path: 'models/user.py', line: 2 },

    { id: 'endpoint:GET /users/{id}:routes.py', label: 'GET /users/{id}', kind: 'endpoint', path: 'routes.py' }
  ],

  edges: [
    ['file:app.py', 'symbol:app.py:create_app:4', 'contains'],
    ['file:routes.py', 'symbol:routes.py:get_user:12', 'contains'],
    ['file:services/user_service.py', 'symbol:services/user_service.py:fetch_user:8', 'contains'],
    ['file:repositories/user_repo.py', 'symbol:repositories/user_repo.py:find_by_id:6', 'contains'],
    ['file:db.py', 'symbol:db.py:get_connection:3', 'contains'],
    ['file:models/user.py', 'symbol:models/user.py:User:2', 'contains'],

    ['file:routes.py', 'file:services/user_service.py', 'imports'],
    ['file:services/user_service.py', 'file:repositories/user_repo.py', 'imports'],
    ['file:repositories/user_repo.py', 'file:db.py', 'imports'],
    ['file:repositories/user_repo.py', 'file:models/user.py', 'imports'],

    ['symbol:routes.py:get_user:12', 'symbol:services/user_service.py:fetch_user:8', 'calls'],
    ['symbol:services/user_service.py:fetch_user:8', 'symbol:repositories/user_repo.py:find_by_id:6', 'calls'],
    ['symbol:repositories/user_repo.py:find_by_id:6', 'symbol:db.py:get_connection:3', 'calls'],

    ['file:routes.py', 'endpoint:GET /users/{id}:routes.py', 'defines'],
    ['symbol:app.py:create_app:4', 'symbol:routes.py:get_user:12', 'calls']
  ].map(([source, target, kind]) => ({ source, target, kind })),

  riskyModules: [
    { id: 'file:routes.py', label: 'routes.py', path: 'routes.py', score: 88, connections: 8 },
    { id: 'file:repositories/user_repo.py', label: 'user_repo.py', path: 'repositories/user_repo.py', score: 72, connections: 6 },
    { id: 'symbol:services/user_service.py:fetch_user:8', label: 'fetch_user', path: 'services/user_service.py', score: 60, connections: 5 }
  ],

  endpoints: [
    { id: 'endpoint:GET /users/{id}:routes.py', label: 'GET /users/{id}', kind: 'endpoint', path: 'routes.py' }
  ],

  notice: 'Sample graph is illustrative. Upload a ZIP to analyze a real repository.'
};

const kindColors = {
  file: '#8291ad',
  function: '#9b8cff',
  class: '#f4b860',
  endpoint: '#42d6b0'
};

/* Build the React Flow visualization. */
function toFlow(data, selected, pathFilter) {
  const visible = data.nodes.filter(node =>
    !pathFilter ||
    (node.path || '').toLowerCase().includes(pathFilter.toLowerCase()) ||
    node.label.toLowerCase().includes(pathFilter.toLowerCase())
  );

  const visibleIds = new Set(visible.map(node => node.id));

  const nodes = visible.map(node => {
    const column =
      node.kind === 'file' ? 0 :
      node.kind === 'endpoint' ? 3 :
      node.kind === 'class' ? 2 : 1;

    const sameKindIndex = visible
      .filter(item => item.kind === node.kind)
      .findIndex(item => item.id === node.id);

    const isSelected = selected === node.id;

    return {
      id: node.id,
      position: {
        x: column * 255 + 24,
        y: (sameKindIndex % 8) * 94 + 32
      },
      data: {
        label: (
          <div className="node-inner">
            <span
              className="node-kind"
              style={{ background: kindColors[node.kind] }}
            />
            <span className="node-text">{node.label}</span>
            <small>
              {node.kind}{node.line ? ` · L${node.line}` : ''}
            </small>
          </div>
        )
      },
      className: `rx-node ${isSelected ? 'selected' : ''} kind-${node.kind}`,
      style: {
        width: 205,
        ...(isSelected
          ? {
              border: '2px solid #ffb86b',
              boxShadow: '0 0 0 4px #ffb86b2b'
            }
          : {})
      }
    };
  });

  const edges = data.edges
    .filter(edge => visibleIds.has(edge.source) && visibleIds.has(edge.target))
    .map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.source,
      target: edge.target,
      label: edge.kind === 'contains' ? '' : edge.kind,
      animated: edge.kind === 'calls',
      type: 'smoothstep',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: edge.kind === 'calls' ? '#9b8cff' : '#46516a'
      },
      style: {
        stroke:
          edge.kind === 'calls' ? '#9b8cff' :
          edge.kind === 'imports' ? '#65748f' : '#46516a',
        strokeWidth: edge.kind === 'calls' ? 2 : 1.2
      },
      labelStyle: { fill: '#8996b2', fontSize: 9 },
      labelBgStyle: { fill: '#0f1729', fillOpacity: 0.95 }
    }));

  return { nodes, edges };
}

export default function App() {
  const [data, setData] = useState(sample);
  const [selected, setSelected] = useState('');
  const [filter, setFilter] = useState('');
  const [tab, setTab] = useState('overview');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(
    'Showing a sample codebase. Upload a repository ZIP to explore your own.'
  );
  const [real, setReal] = useState(false);

  /*
   * CHANGE IMPACT LOGIC
   *
   * Edges are directed:
   * caller/importer -> function/module it depends on.
   *
   * Therefore, when the selected node changes, traverse incoming
   * edges to find callers/importers that may be affected.
   */
  const impactIds = useMemo(() => {
    if (!selected) return new Set();

    const visited = new Set([selected]);
    const queue = [selected];

    while (queue.length > 0) {
      const current = queue.shift();

      data.edges
        .filter(edge => edge.target === current)
        .forEach(edge => {
          if (!visited.has(edge.source)) {
            visited.add(edge.source);
            queue.push(edge.source);
          }
        });
    }

    return visited;
  }, [selected, data]);

  /*
   * Display only the selected node and its upstream callers/importers.
   * If no incoming relationships exist, show its outgoing dependencies
   * as context instead of leaving the graph empty.
   */
  const impactData = useMemo(() => {
    if (!selected) {
      return { nodes: [], edges: [] };
    }

    const ids = new Set(impactIds);

    if (ids.size === 1) {
      data.edges
        .filter(edge => edge.source === selected)
        .forEach(edge => ids.add(edge.target));
    }

    return {
      nodes: data.nodes.filter(node => ids.has(node.id)),
      edges: data.edges.filter(
        edge => ids.has(edge.source) && ids.has(edge.target)
      )
    };
  }, [data, selected, impactIds]);

  const graphData =
    tab === 'impact' && selected ? impactData : data;

  const flow = useMemo(
    () => toFlow(graphData, selected, filter),
    [graphData, selected, filter]
  );

  const onNodesChange = useCallback(() => {}, []);
  const onEdgesChange = useCallback(() => {}, []);

  const chosen = data.nodes.find(node => node.id === selected);

  const changeImpact = useMemo(
    () => impactData.nodes.filter(node => node.id !== selected),
    [impactData, selected]
  );

  async function uploadRepo(file) {
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.zip')) {
      setMessage('Please choose a .zip file.');
      return;
    }

    setUploading(true);
    setMessage('Scanning files and building the dependency graph…');

    const body = new FormData();
    body.append('file', file);

    try {
      const response = await fetch(`${API}/api/analyze`, {
        method: 'POST',
        body
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.detail || 'Analysis failed.');
      }

      setData(result);
      setSelected('');
      setFilter('');
      setReal(true);

      setMessage(
        `Analysis complete: ${result.summary.files} files mapped. ${result.notice}`
      );
    } catch (error) {
      setMessage(
        `${error.message}. Check that the backend is running and VITE_API_URL is correct.`
      );
    } finally {
      setUploading(false);
    }
  }

  const selectNode = node => setSelected(node.id);

  function openImpact() {
    setTab('impact');
    setFilter('');
    if (!selected) {
      setMessage('Select a function or module in the graph to analyze its potential change impact.');
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark"><Network size={20} /></div>
          <div>
            <strong>RepoX-Ray</strong>
            <small>CODEBASE INTELLIGENCE</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <button
          className={`nav-item ${tab === 'overview' ? 'active' : ''}`}
          onClick={() => setTab('overview')}
        >
          <Boxes size={17} /> Overview
        </button>

        <button
          className={`nav-item ${tab === 'graph' ? 'active' : ''}`}
          onClick={() => setTab('graph')}
        >
          <GitBranch size={17} /> Dependency graph
        </button>

        <button
          className={`nav-item ${tab === 'impact' ? 'active' : ''}`}
          onClick={openImpact}
        >
          <Waypoints size={17} /> Change impact
        </button>

        <button
          className={`nav-item ${tab === 'risk' ? 'active' : ''}`}
          onClick={() => setTab('risk')}
        >
          <ShieldAlert size={17} />
          Risk hotspots
          <span className="nav-count">{data.riskyModules.length}</span>
        </button>

        <div className="sidebar-bottom">
          <div className="status-dot" />
          <div>
            <b>{real ? 'Repository analyzed' : 'Demo workspace'}</b>
            <small>{real ? 'Local analysis complete' : 'Ready to scan a repo'}</small>
          </div>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <b>{real ? 'Uploaded repository' : 'Untitled repository'}</b>
          </div>

          <div className="top-actions">
            <span className="privacy"><span /> Runs in your session</span>
            <a
              href="https://github.com/"
              target="_blank"
              rel="noreferrer"
              className="icon-link"
            >
              <Github size={17} />
            </a>
          </div>
        </header>

        <section className="content">
          <div className="hero">
            <div>
              <div className="eyebrow">
                <Zap size={13} /> UNDERSTAND THE UNKNOWN
              </div>
              <h1>See how your codebase <span>really works.</span></h1>
              <p>
                Map dependencies, trace execution paths, and find high-impact
                modules before you touch a line of code.
              </p>
            </div>

            <label className={`upload-button ${uploading ? 'disabled' : ''}`}>
              <Upload size={17} />
              {uploading ? 'Analyzing…' : 'Analyze repository'}
              <input
                type="file"
                accept=".zip,application/zip"
                disabled={uploading}
                onChange={event => uploadRepo(event.target.files?.[0])}
              />
            </label>
          </div>

          <div className="notice">
            <Activity size={15} />
            <span>{message}</span>
          </div>

          <div className="stats">
            <Stat
              icon={<FileCode2 />}
              label="SOURCE FILES"
              value={data.summary.files}
              color="blue"
            />
            <Stat
              icon={<Braces />}
              label="FUNCTIONS"
              value={data.summary.functions}
              color="purple"
            />
            <Stat
              icon={<Network />}
              label="CONNECTIONS"
              value={data.summary.edges}
              color="teal"
            />
            <Stat
              icon={<ShieldAlert />}
              label="RISK HOTSPOTS"
              value={data.riskyModules.length}
              color="orange"
            />
          </div>

          <div className="section-heading">
            <div>
              <h2>
                {tab === 'overview' ? 'Dependency overview' :
                 tab === 'graph' ? 'Explore dependency graph' :
                 tab === 'impact' ? 'Change impact explorer' :
                 'Risk hotspots'}
              </h2>

              <p>
                {tab === 'impact'
                  ? 'Select a node to trace callers and importers that may be affected by changing it.'
                  : tab === 'risk'
                    ? 'Highly connected nodes deserve extra review when making changes.'
                    : 'Follow the connections between files, functions, classes, and endpoints.'}
              </p>
            </div>

            <div className="graph-tools">
              <div className="searchbox">
                <Search size={15} />
                <input
                  value={filter}
                  onChange={event => setFilter(event.target.value)}
                  placeholder="Filter files or symbols…"
                />
              </div>

              <button
                className="secondary-btn"
                onClick={() => {
                  setFilter('');
                  setSelected('');
                }}
              >
                Reset view
              </button>
            </div>
          </div>

          {tab === 'risk' ? (
            <div className="panel risk-list">
              {data.riskyModules.map((risk, index) => (
                <button
                  className="risk-row"
                  key={risk.id}
                  onClick={() => {
                    setSelected(risk.id);
                    setTab('graph');
                  }}
                >
                  <span className="risk-rank">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  <span className="risk-name">
                    <b>{risk.label}</b>
                    <small>
                      {risk.path || 'symbol'} · {risk.connections} connections
                    </small>
                  </span>

                  <span className="risk-meter">
                    <i style={{ width: `${risk.score}%` }} />
                  </span>

                  <strong>
                    {risk.score}<small>/100</small>
                  </strong>

                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          ) : (
            <div className="work-grid">
              <div className="panel graph-panel">
                <div className="panel-top">
                  <div className="panel-title">
                    <span className="live-dot" />
                    <b>
                      {tab === 'impact'
                        ? 'POTENTIAL IMPACT PATH'
                        : 'CODE RELATIONSHIP MAP'}
                    </b>
                    <small>
                      {flow.nodes.length} nodes · {flow.edges.length} edges
                    </small>
                  </div>

                  <div className="legend">
                    <span><i className="legend-file" />File</span>
                    <span><i className="legend-function" />Function</span>
                    <span><i className="legend-class" />Class</span>
                    <span><i className="legend-endpoint" />Endpoint</span>
                  </div>
                </div>

                <div className="graph-canvas">
                  <ReactFlow
                    nodes={flow.nodes}
                    edges={flow.edges}
                    onNodesChange={onNodesChange}
                    onEdgesChange={onEdgesChange}
                    onNodeClick={(_, node) =>
                      selectNode(data.nodes.find(item => item.id === node.id) || node)
                    }
                    fitView
                    fitViewOptions={{ padding: 0.16 }}
                    minZoom={0.15}
                    maxZoom={1.6}
                    nodesDraggable
                    nodesConnectable={false}
                    proOptions={{ hideAttribution: true }}
                  >
                    <Background color="#25304a" gap={20} size={1} />
                    <MiniMap
                      nodeColor={node =>
                        kindColors[data.nodes.find(item => item.id === node.id)?.kind] || '#59657e'
                      }
                      maskColor="rgba(7,12,24,.7)"
                    />
                    <Controls />
                  </ReactFlow>

                  {flow.nodes.length === 0 && (
                    <div className="empty-filter">
                      {tab === 'impact' && !selected
                        ? 'Click a function or module in the graph first, then open Change Impact.'
                        : 'No matching nodes. Try another search.'}
                    </div>
                  )}
                </div>

                <div className="graph-footer">
                  <span><i className="edge-key" /> Calls</span>
                  <span><i className="edge-key import" /> Imports</span>
                  <span>
                    {tab === 'impact'
                      ? 'Selected node and its potential upstream impact'
                      : 'Drag nodes · scroll to zoom · click a node for details'}
                  </span>
                </div>
              </div>

              <aside className="panel inspector">
                <div className="inspector-head">
                  <div>
                    <div className="eyebrow">INSPECTOR</div>
                    <h3>{chosen ? chosen.label : 'Select a node'}</h3>
                  </div>
                  <span className="inspector-icon"><Search size={17} /></span>
                </div>

                {chosen ? (
                  <>
                    <div
                      className="type-pill"
                      style={{
                        color: kindColors[chosen.kind],
                        borderColor: `${kindColors[chosen.kind]}55`
                      }}
                    >
                      {chosen.kind.toUpperCase()}
                    </div>

                    <div className="detail-block">
                      <label>LOCATION</label>
                      <p>
                        {chosen.path || '—'}
                        {chosen.line ? ` : ${chosen.line}` : ''}
                      </p>
                    </div>

                    <div className="detail-block">
                      <label>DIRECT CONNECTIONS</label>
                      <p>
                        {data.edges.filter(
                          edge => edge.source === chosen.id || edge.target === chosen.id
                        ).length} linked relationships
                      </p>
                    </div>

                    <div className="detail-block">
                      <label>CONNECTED NODES</label>
                      <div className="connected-list">
                        {data.edges
                          .filter(
                            edge => edge.source === chosen.id || edge.target === chosen.id
                          )
                          .slice(0, 8)
                          .map((edge, index) => {
                            const id = edge.source === chosen.id
                              ? edge.target
                              : edge.source;

                            const node = data.nodes.find(item => item.id === id);

                            return node && (
                              <button key={index} onClick={() => setSelected(node.id)}>
                                <span
                                  className="tiny-dot"
                                  style={{ background: kindColors[node.kind] }}
                                />
                                {node.label}
                                <small>{edge.kind}</small>
                              </button>
                            );
                          })}
                      </div>
                    </div>

                    <button className="full-btn" onClick={openImpact}>
                      Explore change impact <ArrowUpRight size={15} />
                    </button>
                  </>
                ) : (
                  <div className="inspector-empty">
                    <Network size={28} />
                    <p>
                      Click any node on the map to inspect its location,
                      connections, and nearby dependencies.
                    </p>
                    <small>
                      Tip: choose a route or function to start tracing a request.
                    </small>
                  </div>
                )}
              </aside>
            </div>
          )}

          {tab === 'impact' && (
            <div className="panel impact-panel">
              <div className="impact-title">
                <Waypoints size={18} />
                <div>
                  <b>Potential change blast radius</b>
                  <p>
                    {chosen
                      ? `Potential callers/importers upstream of ${chosen.label}. Review these components and add relevant tests before changing it. Results depend on detected graph relationships.`
                      : 'Select a node in the graph first.'}
                  </p>
                </div>
              </div>

              {chosen && (
                <div className="impact-chips">
                  {changeImpact.slice(0, 30).map(node => (
                    <button key={node.id} onClick={() => setSelected(node.id)}>
                      <span style={{ background: kindColors[node.kind] }} />
                      {node.label}
                      <small>{node.kind}</small>
                    </button>
                  ))}

                  {changeImpact.length === 0 && (
                    <p>No incoming callers or importers were detected.</p>
                  )}
                </div>
              )}
            </div>
          )}

          <footer>
            <span>
              RepoX-Ray <span className="footer-muted">· Codebase clarity, without the guesswork.</span>
            </span>
            <span>Python AST · NetworkX · React Flow</span>
          </footer>
        </section>
      </main>
    </div>
  );
}

function Stat({ icon, label, value, color }) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${color}`}>{icon}</div>
      <div>
        <small>{label}</small>
        <strong>{value}</strong>
      </div>
      <span className="stat-spark">
        {label === 'CONNECTIONS' ? '↗' :
         label === 'RISK HOTSPOTS' ? '⌁' : '·'}
      </span>
    </div>
  );
}
