import React, { useState, useRef, useEffect } from 'react';

export const ATMOSPHERE_THEMES = [
  {
    id: 'aurora',
    name: '🌌 Aurora Acrylic',
    desc: 'Fluent 2 Frosted Glass with Indigo, Sky & Violet animated mesh',
    preview: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 50%, #8b5cf6 100%)',
  },
  {
    id: 'sunset',
    name: '🌅 Warm Craft Sunset',
    desc: 'Warm Amber, Terracotta, and Rose Peach organic mesh',
    preview: 'linear-gradient(135deg, #9a3412 0%, #ea580c 50%, #f43f5e 100%)',
  },
  {
    id: 'emerald',
    name: '🌿 Botanical Sage',
    desc: 'Calming Forest Emerald, Mint, and Eucalyptus atmosphere',
    preview: 'linear-gradient(135deg, #065f46 0%, #10b981 55%, #0d9488 100%)',
  },
  {
    id: 'cyber',
    name: '⚡ Cyber Neon Dark',
    desc: 'Deep Obsidian Dark Glass with Electric Cyan & Magenta glow',
    preview: 'linear-gradient(135deg, #090d16 0%, #1e1b4b 50%, #06b6d4 100%)',
  },
  {
    id: 'sakura',
    name: '🌸 Sakura Rose Quartz',
    desc: 'Soft Rose, Lavender, and Pearl translucent glass',
    preview: 'linear-gradient(135deg, #831843 0%, #db2777 50%, #a855f7 100%)',
  },
  {
    id: 'royal',
    name: '💎 Executive Word 365',
    desc: 'Classic Microsoft Office Sapphire with high-contrast studio desk',
    preview: 'linear-gradient(135deg, #103f91 0%, #185abd 55%, #2563eb 100%)',
  },
];

export default function BentoDashboard({
  documents,
  todos,
  notes,
  atmosphere,
  setAtmosphere,
  onSelectWorkspace,
  onOpenDocument,
  onCreateBlankDoc,
  onOpenTemplates,
  onToggleTodo,
  onExportDocx,
  onExportPdf,
}) {
  // Web Audio API Ambient Focus Soundscape Synthesizer
  const [activeSound, setActiveSound] = useState(null); // null | 'rain' | 'brown' | 'binaural'
  const [volume, setVolume] = useState(0.25);
  const audioCtxRef = useRef(null);
  const gainNodeRef = useRef(null);

  const stopAmbientAudio = () => {
    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close();
      } catch (e) {
        console.error(e);
      }
      audioCtxRef.current = null;
      gainNodeRef.current = null;
    }
    setActiveSound(null);
  };

  useEffect(() => {
    return () => {
      if (audioCtxRef.current) {
        try {
          audioCtxRef.current.close();
        } catch (e) {}
      }
    };
  }, []);

  const toggleSoundscape = (type) => {
    if (activeSound === type) {
      stopAmbientAudio();
      return;
    }
    stopAmbientAudio();

    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      const masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);

      if (type === 'rain' || type === 'brown') {
        const bufferSize = 2 * ctx.sampleRate;
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0.0;
        for (let i = 0; i < bufferSize; i++) {
          const white = Math.random() * 2 - 1;
          if (type === 'brown') {
            output[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = output[i];
            output[i] *= 3.2;
          } else {
            // Soft Rain filtered noise
            output[i] = white * 0.35;
          }
        }
        const whiteNoise = ctx.createBufferSource();
        whiteNoise.buffer = noiseBuffer;
        whiteNoise.loop = true;

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = type === 'brown' ? 420 : 1100;

        whiteNoise.connect(filter);
        filter.connect(masterGain);
        whiteNoise.start(0);
      } else if (type === 'binaural') {
        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        osc1.type = 'sine';
        osc2.type = 'sine';
        osc1.frequency.value = 200;
        osc2.frequency.value = 214; // 14Hz Alpha/Beta focus beat
        osc1.connect(masterGain);
        osc2.connect(masterGain);
        osc1.start();
        osc2.start();
      }

      audioCtxRef.current = ctx;
      gainNodeRef.current = masterGain;
      setActiveSound(type);
    } catch (e) {
      console.error('Web Audio API error:', e);
    }
  };

  const handleVolumeChange = (val) => {
    setVolume(val);
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = val;
    }
  };

  const completedTasks = todos.filter((t) => t.completed).length;
  const pct = todos.length ? Math.round((completedTasks / todos.length) * 100) : 0;

  // Total words across all Word documents
  const totalWords = documents.reduce((acc, doc) => {
    const plain = (doc.content || '').replace(/<[^>]+>/g, ' ').trim();
    return acc + (plain ? plain.split(/\s+/).length : 0);
  }, 0);

  const hour = new Date().getHours();
  const greeting =
    hour < 12 ? 'Good Morning' : hour < 18 ? 'Good Afternoon' : 'Good Evening';

  return (
    <div className="bento-dashboard-wrapper">
      <div className="bento-grid-container">
        {/* ==================== 1. HERO WELCOME BENTO CARD ==================== */}
        <div className="bento-card hero-bento">
          <div className="hero-bento-top">
            <span className="hero-pill-badge">
              <i className="fa-solid fa-sparkles"></i> Fluent 2 Glassmorphism • Full-Stack Python + React Suite
            </span>
            <h1>{greeting}, Creator ✨</h1>
            <p>
              Your unified <strong>Microsoft Word Studio</strong>, <strong>Developer Super-Notepad</strong>, and{' '}
              <strong>Kanban Task Hub</strong>—complete with animated atmospheres, Python 3.13 execution, and 1-click{' '}
              <strong>.DOCX</strong> &amp; <strong>.PDF</strong> exports.
            </p>
          </div>

          <div className="hero-quick-launchers">
            <button
              type="button"
              className="hero-launch-btn primary"
              onClick={() => onSelectWorkspace('word')}
            >
              <i className="fa-solid fa-file-word"></i> Launch Word Studio
            </button>
            <button
              type="button"
              className="hero-launch-btn"
              onClick={() => onSelectWorkspace('notepad')}
            >
              <i className="fa-solid fa-note-sticky"></i> Open Super-Notepad
            </button>
            <button
              type="button"
              className="hero-launch-btn"
              onClick={() => onSelectWorkspace('todo')}
            >
              <i className="fa-solid fa-list-check"></i> Kanban &amp; To-Do
            </button>
            <button
              type="button"
              className="hero-launch-btn"
              onClick={() => onSelectWorkspace('split')}
            >
              <i className="fa-solid fa-table-columns"></i> Split Studio
            </button>
          </div>
        </div>

        {/* ==================== 2. PRODUCTIVITY RING & METRICS CARD ==================== */}
        <div className="bento-card metrics-bento">
          <div className="bento-card-header">
            <h3>
              <i className="fa-solid fa-chart-pie" style={{ color: '#3b82f6' }}></i> Workspace Pulse
            </h3>
            <span className="bento-sub-badge">Live Sync</span>
          </div>

          <div className="metrics-ring-row">
            <div className="svg-ring-wrap">
              <svg viewBox="0 0 36 36" className="circular-chart">
                <path
                  className="circle-bg"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="circle-progress"
                  strokeDasharray={`${pct}, 100`}
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <text x="18" y="20.5" className="percentage-text">
                  {pct}%
                </text>
              </svg>
            </div>

            <div className="metrics-kpi-grid">
              <div className="kpi-mini-box">
                <strong>{documents.length}</strong>
                <span>Word Docs</span>
              </div>
              <div className="kpi-mini-box">
                <strong>{totalWords}</strong>
                <span>Total Words</span>
              </div>
              <div className="kpi-mini-box">
                <strong>
                  {completedTasks}/{todos.length}
                </strong>
                <span>Tasks Done</span>
              </div>
              <div className="kpi-mini-box">
                <strong>{notes.length}</strong>
                <span>Super-Notes</span>
              </div>
            </div>
          </div>
        </div>

        {/* ==================== 3. ATMOSPHERE & COLOR THEME STUDIO CARD ==================== */}
        <div className="bento-card theme-bento">
          <div className="bento-card-header">
            <h3>
              <i className="fa-solid fa-palette" style={{ color: '#ec4899' }}></i> Animated Atmosphere &amp; Color Studio
            </h3>
            <span className="bento-sub-badge">6 Mesh Palettes</span>
          </div>
          <p className="bento-desc">
            Select a dynamic mesh gradient and frosted glass palette for your entire workspace:
          </p>
          <div className="atmosphere-swatches-grid">
            {ATMOSPHERE_THEMES.map((th) => (
              <button
                key={th.id}
                type="button"
                className={`atmosphere-card-btn ${atmosphere === th.id ? 'active' : ''}`}
                onClick={() => setAtmosphere(th.id)}
              >
                <span
                  className="atmosphere-swatch-preview"
                  style={{ background: th.preview }}
                />
                <div className="atmosphere-card-info">
                  <strong>{th.name}</strong>
                  <small>{th.desc}</small>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* ==================== 4. AMBIENT FOCUS SOUNDSCAPE SYNTHESIZER ==================== */}
        <div className="bento-card sound-bento">
          <div className="bento-card-header">
            <h3>
              <i className="fa-solid fa-headphones-simple" style={{ color: '#10b981' }}></i>{' '}
              Ambient Focus Soundscape
            </h3>
            {activeSound && <span className="sound-wave-badge">● Playing</span>}
          </div>
          <p className="bento-desc">
            Pure Web Audio API procedural sound generator for deep writing &amp; coding focus:
          </p>
          <div className="sound-buttons-row">
            {[
              { id: 'rain', label: '🌧️ Gentle Rain', sub: 'Warm Pink Noise' },
              { id: 'brown', label: '🌊 Deep Ocean', sub: 'Soothing Brown Noise' },
              { id: 'binaural', label: '🧠 Alpha Drone', sub: '14Hz Focus Hum' },
            ].map((s) => (
              <button
                key={s.id}
                type="button"
                className={`sound-tile-btn ${activeSound === s.id ? 'active' : ''}`}
                onClick={() => toggleSoundscape(s.id)}
              >
                <strong>{s.label}</strong>
                <small>{s.sub}</small>
              </button>
            ))}
          </div>
          <div className="sound-volume-row">
            <i className="fa-solid fa-volume-low"></i>
            <input
              type="range"
              min="0.02"
              max="0.7"
              step="0.02"
              value={volume}
              onChange={(e) => handleVolumeChange(Number(e.target.value))}
            />
            <i className="fa-solid fa-volume-high"></i>
          </div>
        </div>

        {/* ==================== 5. WORD DOCUMENTS PORTFOLIO CARD ==================== */}
        <div className="bento-card docs-bento">
          <div className="bento-card-header">
            <h3>
              <i className="fa-solid fa-file-word" style={{ color: '#2563eb' }}></i> Word Documents
            </h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button type="button" className="sm-action-btn" onClick={onCreateBlankDoc}>
                + Blank Doc
              </button>
              <button type="button" className="sm-action-btn" onClick={onOpenTemplates}>
                Templates
              </button>
            </div>
          </div>

          <div className="bento-docs-list">
            {documents.map((doc) => (
              <div key={doc.id} className="bento-doc-row">
                <div
                  className="bento-doc-info"
                  onClick={() => {
                    onOpenDocument(doc.id);
                    onSelectWorkspace('word');
                  }}
                >
                  <i className="fa-solid fa-file-word"></i>
                  <div>
                    <strong>{doc.title}</strong>
                    <small>
                      Updated {new Date(doc.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </small>
                  </div>
                </div>
                <div className="bento-doc-actions">
                  <button
                    type="button"
                    className="bento-mini-export docx"
                    onClick={() => onExportDocx(doc)}
                    title="Export as Word (.docx)"
                  >
                    .DOCX
                  </button>
                  <button
                    type="button"
                    className="bento-mini-export pdf"
                    onClick={() => onExportPdf(doc)}
                    title="Export as PDF (.pdf)"
                  >
                    .PDF
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ==================== 6. QUICK PRIORITY TASKS BENTO CARD ==================== */}
        <div className="bento-card tasks-bento">
          <div className="bento-card-header">
            <h3>
              <i className="fa-solid fa-bolt" style={{ color: '#f59e0b' }}></i> Priority Action Queue
            </h3>
            <button
              type="button"
              className="sm-action-btn"
              onClick={() => onSelectWorkspace('todo')}
            >
              Open Full Board →
            </button>
          </div>

          <div className="bento-tasks-list">
            {todos.slice(0, 4).map((t) => (
              <div
                key={t.id}
                className={`bento-task-item ${t.completed ? 'done' : ''}`}
                onClick={() => onToggleTodo(t.id)}
              >
                <input
                  type="checkbox"
                  checked={!!t.completed}
                  onChange={() => {}}
                />
                <span>{t.text}</span>
                <small className={`priority-badge ${t.priority || 'medium'}`}>
                  {t.priority || 'medium'}
                </small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

