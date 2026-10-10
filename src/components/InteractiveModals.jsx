import React, { useState, useEffect, useRef } from 'react';

/* ==========================================================================
   1. INTERACTIVE CHART BUILDER MODAL (Powered by Chart.js)
   ========================================================================== */
export function ChartBuilderModal({ onClose, onInsertChartHtml }) {
  const [chartType, setChartType] = useState('bar');
  const [chartTitle, setChartTitle] = useState('Quarterly Revenue & Growth ($K)');
  const [rows, setRows] = useState([
    { label: 'Q1', value: 48, color: '#2563eb' },
    { label: 'Q2', value: 65, color: '#059669' },
    { label: 'Q3', value: 82, color: '#d97706' },
    { label: 'Q4', value: 110, color: '#7c3aed' },
  ]);

  const canvasRef = useRef(null);
  const chartInstanceRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !window.Chart) return;
    if (chartInstanceRef.current) {
      chartInstanceRef.current.destroy();
    }

    const ctx = canvasRef.current.getContext('2d');
    chartInstanceRef.current = new window.Chart(ctx, {
      type: chartType,
      data: {
        labels: rows.map((r) => r.label),
        datasets: [
          {
            label: chartTitle,
            data: rows.map((r) => Number(r.value) || 0),
            backgroundColor: rows.map((r) => r.color),
            borderColor: rows.map((r) => r.color),
            borderWidth: 2,
            tension: 0.35,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        plugins: {
          legend: {
            display: chartType === 'pie' || chartType === 'doughnut',
            position: 'bottom',
          },
          title: {
            display: !!chartTitle,
            text: chartTitle,
            font: { size: 16, weight: 'bold' },
            color: '#0f172a',
          },
        },
      },
    });

    return () => {
      if (chartInstanceRef.current) {
        chartInstanceRef.current.destroy();
      }
    };
  }, [chartType, chartTitle, rows]);

  const handleAddRow = () => {
    const palette = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0284c7'];
    setRows((prev) => [
      ...prev,
      {
        label: `Item ${prev.length + 1}`,
        value: 50,
        color: palette[prev.length % palette.length],
      },
    ]);
  };

  const handleUpdateRow = (idx, field, val) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, [field]: val } : r)));
  };

  const handleRemoveRow = (idx) => {
    if (rows.length <= 2) return;
    setRows((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleInsert = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL('image/png', 1.0);
    const html = `
      <div style="text-align:center; margin:18px 0; padding:12px; border:1px solid #e2e8f0; border-radius:8px; background:#ffffff;">
        <img src="${dataUrl}" alt="${chartTitle}" style="max-width:90%; height:auto; max-height:360px;" />
        <p style="font-size:9.5pt; color:#64748b; margin-top:6px;">Chart: ${chartTitle}</p>
      </div><p><br/></p>`;
    onInsertChartHtml(html);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-chart-column" style={{ color: '#2563eb' }}></i>{' '}
            Interactive Word Chart Studio (Chart.js)
          </h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <div className="interactive-modal-split">
          {/* Left Data Editor */}
          <div className="interactive-modal-controls">
            <label className="modal-field-label">Chart Title</label>
            <input
              type="text"
              className="modal-input"
              value={chartTitle}
              onChange={(e) => setChartTitle(e.target.value)}
            />

            <label className="modal-field-label" style={{ marginTop: '10px' }}>Chart Type</label>
            <div className="chart-type-pills">
              {[
                { id: 'bar', label: 'Bar', icon: 'fa-solid fa-chart-column' },
                { id: 'line', label: 'Line', icon: 'fa-solid fa-chart-line' },
                { id: 'pie', label: 'Pie', icon: 'fa-solid fa-chart-pie' },
                { id: 'doughnut', label: 'Doughnut', icon: 'fa-solid fa-circle-notch' },
                { id: 'radar', label: 'Radar', icon: 'fa-solid fa-diagram-project' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chart-pill-btn ${chartType === t.id ? 'active' : ''}`}
                  onClick={() => setChartType(t.id)}
                >
                  <i className={t.icon}></i> {t.label}
                </button>
              ))}
            </div>

            <div className="chart-data-header">
              <label className="modal-field-label">Data Series</label>
              <button type="button" className="sm-action-btn" onClick={handleAddRow}>
                + Add Row
              </button>
            </div>

            <div className="chart-rows-list">
              {rows.map((r, idx) => (
                <div key={idx} className="chart-data-row">
                  <input
                    type="color"
                    value={r.color}
                    onChange={(e) => handleUpdateRow(idx, 'color', e.target.value)}
                    className="chart-color-swatch"
                  />
                  <input
                    type="text"
                    value={r.label}
                    onChange={(e) => handleUpdateRow(idx, 'label', e.target.value)}
                    placeholder="Label"
                    className="chart-label-input"
                  />
                  <input
                    type="number"
                    value={r.value}
                    onChange={(e) => handleUpdateRow(idx, 'value', e.target.value)}
                    placeholder="Value"
                    className="chart-val-input"
                  />
                  <button
                    type="button"
                    className="chart-del-row"
                    onClick={() => handleRemoveRow(idx)}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Right Live Preview */}
          <div className="interactive-modal-preview">
            <div style={{ width: '100%', height: '270px', position: 'relative' }}>
              <canvas ref={canvasRef} width="460" height="270"></canvas>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-primary-btn" onClick={handleInsert}>
            <i className="fa-solid fa-plus"></i> Insert Chart into Document
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   2. MATH & LATEX EQUATION STUDIO MODAL (Powered by KaTeX)
   ========================================================================== */
const LATEX_PRESETS = [
  { name: 'Quadratic Formula', latex: 'x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}' },
  { name: 'Gaussian Integral', latex: '\\int_{-\\infty}^{\\infty} e^{-x^2} \\, dx = \\sqrt{\\pi}' },
  { name: 'Euler’s Identity', latex: 'e^{i\\pi} + 1 = 0' },
  { name: 'Summation Series', latex: '\\sum_{n=1}^{\\infty} \\frac{1}{n^2} = \\frac{\\pi^2}{6}' },
  { name: '2×2 Matrix', latex: '\\mathbf{A} = \\begin{pmatrix} a_{11} & a_{12} \\\\ a_{21} & a_{22} \\end{pmatrix}' },
  { name: 'Normal Distribution', latex: 'f(x) = \\frac{1}{\\sigma\\sqrt{2\\pi}} e^{-\\frac{1}{2}\\left(\\frac{x-\\mu}{\\sigma}\\right)^2}' },
  { name: 'Bayes’ Theorem', latex: 'P(A|B) = \\frac{P(B|A)P(A)}{P(B)}' },
  { name: 'Limit Definition', latex: "f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}" },
];

export function EquationBuilderModal({ onClose, onInsertEquationHtml }) {
  const [latex, setLatex] = useState(LATEX_PRESETS[0].latex);
  const [renderedHtml, setRenderedHtml] = useState('');

  useEffect(() => {
    if (window.katex) {
      try {
        const html = window.katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true,
        });
        setRenderedHtml(html);
      } catch (e) {
        setRenderedHtml(`<span style="color:#dc2626;">Invalid LaTeX syntax</span>`);
      }
    } else {
      setRenderedHtml(`<code>${latex}</code>`);
    }
  }, [latex]);

  const handleInsert = () => {
    const html = `
      <div class="math-equation-block" style="margin: 14px 0; padding: 10px 16px; background: #f8fafc; border-radius: 6px; text-align: center; border: 1px solid #e2e8f0;">
        ${renderedHtml}
      </div><p><br/></p>`;
    onInsertEquationHtml(html);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-square-root-variable" style={{ color: '#7c3aed' }}></i>{' '}
            Microsoft Word Equation &amp; LaTeX Builder (KaTeX)
          </h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <label className="modal-field-label">Quick Formula Presets (Click to load)</label>
        <div className="preset-chips-row">
          {LATEX_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="preset-chip"
              onClick={() => setLatex(p.latex)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <label className="modal-field-label" style={{ marginTop: '12px' }}>
          LaTeX Expression
        </label>
        <textarea
          className="modal-code-textarea"
          rows={3}
          value={latex}
          onChange={(e) => setLatex(e.target.value)}
          placeholder="Type any LaTeX math expression..."
        />

        <label className="modal-field-label" style={{ marginTop: '12px' }}>
          Live Rendered Equation Preview
        </label>
        <div
          className="equation-live-preview"
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />

        <div className="modal-footer">
          <button type="button" className="modal-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-primary-btn" onClick={handleInsert}>
            <i className="fa-solid fa-plus"></i> Insert Equation into Document
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   3. MERMAID DIAGRAM & FLOWCHART BUILDER MODAL (Powered by Mermaid.js)
   ========================================================================== */
const MERMAID_PRESETS = [
  {
    name: 'Project Workflow Flowchart',
    code: `flowchart LR
    A[Ideation in Notepad] --> B[Create Tasks in To-Do]
    B --> C{Draft in Word Studio}
    C -->|Export| D[Microsoft Word .DOCX]
    C -->|Export| E[Portable Document .PDF]`,
  },
  {
    name: 'Sequence Architecture',
    code: `sequenceDiagram
    participant User
    participant WordStudio
    participant ExportEngine
    User->>WordStudio: Format Document & Tables
    User->>WordStudio: Insert To-Do Action Plan
    WordStudio->>ExportEngine: Package OpenXML & PDF
    ExportEngine-->>User: Download .DOCX & .PDF`,
  },
  {
    name: 'State Lifecycle',
    code: `stateDiagram-v2
    [*] --> Backlog
    Backlog --> InProgress: Start Task
    InProgress --> Review: Complete Draft
    Review --> Completed: Approve & Export
    Completed --> [*]`,
  },
];

export function DiagramBuilderModal({ onClose, onInsertDiagramHtml }) {
  const [code, setCode] = useState(MERMAID_PRESETS[0].code);
  const [svgOutput, setSvgOutput] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    async function renderDiagram() {
      if (!window.mermaid) {
        setErrorMsg('Mermaid library is loading...');
        return;
      }
      try {
        window.mermaid.initialize({ startOnLoad: false, theme: 'default' });
        const id = `mermaid-svg-${Date.now()}`;
        const { svg } = await window.mermaid.render(id, code);
        if (active) {
          setSvgOutput(svg);
          setErrorMsg('');
        }
      } catch (err) {
        if (active) {
          setErrorMsg('Syntax check: adjust diagram nodes/arrows above.');
        }
      }
    }
    renderDiagram();
    return () => {
      active = false;
    };
  }, [code]);

  const handleInsert = () => {
    if (!svgOutput) return;
    const html = `
      <div style="margin: 16px 0; padding: 14px; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; text-align: center;">
        ${svgOutput}
        <p style="font-size: 9pt; color: #64748b; margin-top: 6px;">Figure: System Architecture &amp; Process Flowchart</p>
      </div><p><br/></p>`;
    onInsertDiagramHtml(html);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-diagram-project" style={{ color: '#059669' }}></i>{' '}
            Flowchart &amp; Diagram Studio (Mermaid.js)
          </h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <div className="preset-chips-row">
          {MERMAID_PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className="preset-chip"
              onClick={() => setCode(p.code)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div className="interactive-modal-split" style={{ marginTop: '10px' }}>
          <div className="interactive-modal-controls">
            <label className="modal-field-label">Mermaid Diagram Definition</label>
            <textarea
              className="modal-code-textarea"
              rows={9}
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {errorMsg && <small style={{ color: '#d97706' }}>{errorMsg}</small>}
          </div>

          <div className="interactive-modal-preview">
            <div
              className="mermaid-preview-box"
              dangerouslySetInnerHTML={{ __html: svgOutput }}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-primary-btn" onClick={handleInsert}>
            <i className="fa-solid fa-plus"></i> Insert Flowchart into Document
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   4. FREEHAND DRAW, WHITEBOARD & SIGNATURE PAD MODAL (HTML5 Canvas)
   ========================================================================== */
export function DrawingCanvasModal({ onClose, onInsertDrawingHtml }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [strokeColor, setStrokeColor] = useState('#1e3a8a');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [tool, setTool] = useState('pen'); // pen | highlighter | eraser

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (tool === 'eraser') {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 20;
      ctx.globalAlpha = 1.0;
    } else if (tool === 'highlighter') {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 14;
      ctx.globalAlpha = 0.25;
    } else {
      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = strokeWidth;
      ctx.globalAlpha = 1.0;
    }

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const endDraw = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.globalAlpha = 1.0;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleInsert = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    const html = `
      <div style="text-align: center; margin: 14px 0;">
        <img src="${dataUrl}" alt="Freehand Sketch / Signature" style="max-width: 85%; border: 1px solid #cbd5e1; border-radius: 6px;" />
      </div><p><br/></p>`;
    onInsertDrawingHtml(html);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            <i className="fa-solid fa-paintbrush" style={{ color: '#db2777' }}></i>{' '}
            Microsoft Word Draw, Whiteboard &amp; Signature Pad
          </h3>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <div className="draw-toolbar">
          <button
            type="button"
            className={`chart-pill-btn ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool('pen')}
          >
            <i className="fa-solid fa-pen"></i> Ink Pen
          </button>
          <button
            type="button"
            className={`chart-pill-btn ${tool === 'highlighter' ? 'active' : ''}`}
            onClick={() => setTool('highlighter')}
          >
            <i className="fa-solid fa-highlighter"></i> Highlighter
          </button>
          <button
            type="button"
            className={`chart-pill-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
          >
            <i className="fa-solid fa-eraser"></i> Eraser
          </button>

          <div className="draw-colors">
            {['#0f172a', '#1e3a8a', '#dc2626', '#059669', '#d97706', '#7c3aed'].map(
              (c) => (
                <button
                  key={c}
                  type="button"
                  className={`note-color-dot ${strokeColor === c ? 'active' : ''}`}
                  style={{ backgroundColor: c, borderColor: c }}
                  onClick={() => setStrokeColor(c)}
                />
              )
            )}
            <input
              type="color"
              value={strokeColor}
              onChange={(e) => setStrokeColor(e.target.value)}
            />
          </div>

          <label style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            Size:
            <input
              type="range"
              min="1"
              max="12"
              value={strokeWidth}
              onChange={(e) => setStrokeWidth(Number(e.target.value))}
            />
          </label>

          <button type="button" className="sm-action-btn" onClick={clearCanvas}>
            Clear Canvas
          </button>
        </div>

        <div className="draw-canvas-wrap">
          <canvas
            ref={canvasRef}
            width={680}
            height={280}
            className="draw-canvas-surface"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
          />
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="modal-primary-btn" onClick={handleInsert}>
            <i className="fa-solid fa-plus"></i> Insert Drawing / Signature into Document
          </button>
        </div>
      </div>
    </div>
  );
}

/* ==========================================================================
   5. INTERACTIVE FEATURE GUIDE & COMMAND PALETTE MODAL (Understand All Features!)
   ========================================================================== */
export function FeatureGuideModal({ onClose, onTriggerFeature }) {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');

  const FEATURES = [
    {
      id: 'export-docx',
      category: 'Export & Share',
      title: 'Export to Microsoft Word (.DOCX)',
      icon: 'fa-solid fa-file-word',
      color: '#1d4ed8',
      desc: 'Generates a real OpenXML .docx file preserving fonts, tables, margins, orientation, headers, and checklists.',
      howTo: 'Click "Export Word (.docx)" in the top-right Ribbon bar or File tab.',
    },
    {
      id: 'export-pdf',
      category: 'Export & Share',
      title: 'Export to PDF Document (.PDF)',
      icon: 'fa-solid fa-file-pdf',
      color: '#dc2626',
      desc: 'Generates and downloads a multi-page PDF document directly in your browser using html2pdf.js.',
      howTo: 'Click "Export PDF (.pdf)" in the top-right Ribbon bar or File tab.',
    },
    {
      id: 'insert-chart',
      category: 'Visuals & Math',
      title: 'Interactive Chart Builder (Chart.js)',
      icon: 'fa-solid fa-chart-column',
      color: '#2563eb',
      desc: 'Build Bar, Line, Pie, Doughnut, and Radar charts with live spreadsheet data and embed them into your Word document.',
      howTo: 'Go to Insert Tab → Chart, edit your data series, and click Insert.',
    },
    {
      id: 'insert-equation',
      category: 'Visuals & Math',
      title: 'LaTeX & Math Equation Studio (KaTeX)',
      icon: 'fa-solid fa-square-root-variable',
      color: '#7c3aed',
      desc: 'Write publication-quality mathematical equations using preset formulas or custom LaTeX with live KaTeX rendering.',
      howTo: 'Go to Insert Tab → Equation, select a formula or type LaTeX, and click Insert.',
    },
    {
      id: 'insert-diagram',
      category: 'Visuals & Math',
      title: 'Flowchart & Diagram Studio (Mermaid.js)',
      icon: 'fa-solid fa-diagram-project',
      color: '#059669',
      desc: 'Create flowcharts, sequence diagrams, and state diagrams from simple text definitions.',
      howTo: 'Go to Insert Tab → Flowchart, customize the diagram, and click Insert.',
    },
    {
      id: 'freehand-draw',
      category: 'Visuals & Math',
      title: 'Freehand Ink, Whiteboard & Signature Pad',
      icon: 'fa-solid fa-paintbrush',
      color: '#db2777',
      desc: 'Sketch diagrams, highlight ideas, or sign your name by hand on an HTML5 canvas and drop it into your document.',
      howTo: 'Go to Insert Tab → Draw / Sign.',
    },
    {
      id: 'super-notepad',
      category: 'Super Notepad',
      title: 'Multi-Mode Developer & Writer Notepad',
      icon: 'fa-solid fa-note-sticky',
      color: '#eab308',
      desc: 'Switch between Sticky Notes, Live Markdown Preview (Marked + Highlight.js), and an interactive JavaScript Code Sandbox!',
      howTo: 'Click "Notepad" in the top mode bar or use the right-hand Productivity Dock.',
    },
    {
      id: 'notepad-powertools',
      category: 'Super Notepad',
      title: 'Notepad Text Power-Tools & Voice Dictation',
      icon: 'fa-solid fa-screwdriver-wrench',
      color: '#ea580c',
      desc: 'Sort lines A→Z, remove duplicate lines, format JSON, Base64 encode/decode, or dictate notes with your microphone.',
      howTo: 'Open Notepad mode and use the one-click Power-Tools toolbar.',
    },
    {
      id: 'todo-kanban',
      category: 'Smart To-Do',
      title: 'To-Do List, Kanban Board & Pomodoro Timer',
      icon: 'fa-solid fa-list-check',
      color: '#16a34a',
      desc: 'Manage tasks in List or Kanban Board view, run a 25-minute Pomodoro focus timer, and sync tasks directly into Word.',
      howTo: 'Click "To-Do List" in the top bar or click "Insert in Word" to embed your task table.',
    },
    {
      id: 'page-setup',
      category: 'Word Formatting',
      title: 'Page Setup, Watermarks, Columns & Borders',
      icon: 'fa-solid fa-sliders',
      color: '#0284c7',
      desc: 'Customize A4/Letter size, Portrait/Landscape orientation, 1–3 columns, CONFIDENTIAL watermarks, and page borders.',
      howTo: 'Switch to the "Design & Layout" tab on the Ribbon.',
    },
    {
      id: 'voice-read-aloud',
      category: 'Word Formatting',
      title: 'Voice Dictation (Speech-to-Text) & Read Aloud (TTS)',
      icon: 'fa-solid fa-microphone-lines',
      color: '#dc2626',
      desc: 'Dictate hands-free into your document or have the browser read your entire document aloud.',
      howTo: 'Use "Dictate" in the Home/Review tab or "Read Aloud" in the Review tab.',
    },
  ];

  const categories = ['All', 'Export & Share', 'Visuals & Math', 'Super Notepad', 'Smart To-Do', 'Word Formatting'];

  const filtered = FEATURES.filter((f) => {
    if (selectedCategory !== 'All' && f.category !== selectedCategory) return false;
    if (
      search.trim() &&
      !f.title.toLowerCase().includes(search.toLowerCase()) &&
      !f.desc.toLowerCase().includes(search.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card extra-wide" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3>
              <i className="fa-solid fa-compass" style={{ color: '#2563eb' }}></i>{' '}
              Interactive Feature Explorer &amp; Quick Command Center
            </h3>
            <p style={{ fontSize: '12px', color: '#64748b', marginTop: '3px' }}>
              Understand and launch every tool in OmniWord Studio with a single click.
            </p>
          </div>
          <button type="button" onClick={onClose}>✕</button>
        </div>

        <div className="guide-filter-row">
          <div className="preset-chips-row">
            {categories.map((cat) => (
              <button
                key={cat}
                type="button"
                className={`preset-chip ${selectedCategory === cat ? 'active' : ''}`}
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
          <input
            type="text"
            className="modal-input"
            style={{ maxWidth: '240px' }}
            placeholder="Search any tool or feature..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="feature-guide-grid">
          {filtered.map((item) => (
            <div key={item.id} className="feature-guide-card">
              <div className="feature-card-top">
                <div
                  className="feature-card-icon"
                  style={{ backgroundColor: `${item.color}15`, color: item.color }}
                >
                  <i className={item.icon}></i>
                </div>
                <span className="feature-cat-tag">{item.category}</span>
              </div>
              <h4>{item.title}</h4>
              <p className="feature-desc">{item.desc}</p>
              <div className="feature-howto">
                <strong>How to use:</strong> {item.howTo}
              </div>
              <button
                type="button"
                className="feature-try-btn"
                onClick={() => {
                  onTriggerFeature(item.id);
                  onClose();
                }}
              >
                <i className="fa-solid fa-bolt"></i> Try It Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

