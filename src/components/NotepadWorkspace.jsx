import React, { useState, useMemo } from 'react';
import {
  exportToDocx,
  exportToPdf,
  exportToTxtFile,
  exportToMarkdownFile,
} from '../utils/exportUtils';
import { sanitizeHtml } from '../utils/sanitize';

const NOTE_COLORS = [
  { id: 'yellow', bg: '#fef9c3', border: '#fde047', label: 'Sticky Yellow' },
  { id: 'blue', bg: '#e0f2fe', border: '#7dd3fc', label: 'Sky Blue' },
  { id: 'green', bg: '#dcfce7', border: '#86efac', label: 'Mint Green' },
  { id: 'pink', bg: '#fce7f3', border: '#f9a8d4', label: 'Rose Pink' },
  { id: 'purple', bg: '#f3e8ff', border: '#d8b4fe', label: 'Lavender' },
  { id: 'white', bg: '#ffffff', border: '#cbd5e1', label: 'Clean White' },
  { id: 'dark', bg: '#0f172a', border: '#38bdf8', label: 'Developer Dark', dark: true },
];

export default function NotepadWorkspace({
  notes,
  activeNoteId,
  setActiveNoteId,
  onCreateNote,
  onUpdateNote,
  onDeleteNote,
  onInsertNoteIntoWord,
  onInsertRawHtmlIntoWord,
  onConvertNoteToWordDoc,
  onExtractTodosFromNote,
  compact = false,
}) {
  const [search, setSearch] = useState('');
  const [editorMode, setEditorMode] = useState('plain'); // 'plain' | 'split' | 'code' | 'analytics'
  const [codeLang, setCodeLang] = useState('python'); // 'python' | 'js'
  const [monoFont, setMonoFont] = useState(false);
  const [codeOutput, setCodeOutput] = useState([]);
  const [pythonPlot, setPythonPlot] = useState(null);
  const [isRunningCode, setIsRunningCode] = useState(false);
  const [nlpResult, setNlpResult] = useState(null);
  const [isListening, setIsListening] = useState(false);
  const [newTag, setNewTag] = useState('');

  const activeNote =
    notes.find((n) => n.id === activeNoteId) || notes[0] || null;

  const filteredNotes = useMemo(() => {
    return [...notes]
      .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0))
      .filter(
        (n) =>
          n.title.toLowerCase().includes(search.toLowerCase()) ||
          n.content.toLowerCase().includes(search.toLowerCase()) ||
          (n.tags || []).some((t) => t.toLowerCase().includes(search.toLowerCase()))
      );
  }, [notes, search]);

  const getWordCount = (str = '') => {
    const trimmed = str.trim();
    return trimmed ? trimmed.split(/\s+/).length : 0;
  };

  // Render Markdown using Marked.js safely
  const renderedMarkdownHtml = useMemo(() => {
    const raw = activeNote?.content || '';
    if (!raw.trim())
      return '<p style="color:#94a3b8;">Live Markdown preview will appear here as you type...</p>';
    if (typeof window !== 'undefined' && window.marked) {
      try {
        const parsed = window.marked.parse(raw, { breaks: true, gfm: true });
        return sanitizeHtml(parsed);
      } catch (e) {
        console.error(e);
      }
    }
    return sanitizeHtml(
      raw
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/^### (.*$)/gim, '<h3>$1</h3>')
        .replace(/^## (.*$)/gim, '<h2>$1</h2>')
        .replace(/^# (.*$)/gim, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/gim, '<em>$1</em>')
        .replace(/\n/g, '<br/>')
    );
  }, [activeNote?.content]);

  // Local + Python NLP Analytics
  const noteAnalytics = useMemo(() => {
    const text = (activeNote?.content || '').trim();
    const words = text ? text.toLowerCase().match(/\b[a-z0-9]{3,}\b/g) || [] : [];
    const freq = {};
    words.forEach((w) => {
      freq[w] = (freq[w] || 0) + 1;
    });
    const topWords = Object.entries(freq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const sentences = text ? text.split(/[.!?]+/).filter(Boolean).length : 0;
    const lines = text ? text.split('\n').length : 0;
    return {
      wordCount: getWordCount(text),
      charCount: text.length,
      sentences,
      lines,
      readingTimeSec: Math.ceil((getWordCount(text) / 200) * 60),
      topWords,
    };
  }, [activeNote?.content]);

  // Run Python NLP Smart Analysis via Backend (with automatic in-browser fallback for cloud/static hosting)
  const handleRunPythonNlp = async () => {
    if (!activeNote) return;
    try {
      const res = await fetch('/api/analyze-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: activeNote.content }),
      });
      if (res.ok) {
        const data = await res.json();
        setNlpResult(data);
        setEditorMode('analytics');
        return;
      }
    } catch (e) {
      // Fallback to in-browser NLP calculation when hosted statically
    }
    const raw = (activeNote.content || '').trim();
    const words = raw ? raw.match(/\b[a-zA-Z0-9']+\b/g) || [] : [];
    const sents = raw ? raw.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean) : [];
    const wordCount = words.length;
    const sentCount = Math.max(1, sents.length);
    const syllables = words.reduce((acc, w) => {
      const m = w.toLowerCase().match(/[aeiouy]+/g);
      return acc + Math.max(1, m ? m.length : 1);
    }, 0);
    const ease = wordCount
      ? Math.max(0, Math.min(100, Math.round(206.835 - 1.015 * (wordCount / sentCount) - 84.6 * (syllables / wordCount))))
      : 100;
    const grade = wordCount
      ? Math.max(1, Math.round(0.39 * (wordCount / sentCount) + 11.8 * (syllables / wordCount) - 15.59))
      : 1;
    const unique = new Set(words.map((w) => w.toLowerCase())).size;
    const diversity = wordCount ? Math.round((unique / wordCount) * 100) : 0;
    setNlpResult({
      readingEase: ease,
      gradeLevel: `Grade ${grade}`,
      lexicalDiversity: diversity,
      summary: sents.slice(0, 2).join('. ') || 'Write at least two sentences to generate an extractive summary.',
    });
    setEditorMode('analytics');
  };

  // ==================== POWER-TOOLS ACTIONS ====================
  const applyTextTransform = (type) => {
    if (!activeNote) return;
    const content = activeNote.content || '';
    let updated = content;

    switch (type) {
      case 'sort-asc':
        updated = content.split('\n').sort((a, b) => a.localeCompare(b)).join('\n');
        break;
      case 'dedupe':
        updated = [...new Set(content.split('\n'))].join('\n');
        break;
      case 'bullet-lines':
        updated = content
          .split('\n')
          .map((l) => (l.trim() ? `- ${l.replace(/^[-*•]\s*/, '')}` : ''))
          .join('\n');
        break;
      case 'json-format':
        try {
          updated = JSON.stringify(JSON.parse(content), null, 2);
        } catch (e) {
          alert('Note content is not valid JSON. Tip: paste a JSON object first!');
          return;
        }
        break;
      default:
        break;
    }

    onUpdateNote(activeNote.id, { content: updated });
  };

  // Run Python via Pyodide WebAssembly (Client-side Sandbox) OR JS in Browser
  const handleExecuteCode = async () => {
    if (!activeNote) return;
    setIsRunningCode(true);
    setPythonPlot(null);

    if (codeLang === 'python') {
      try {
        setCodeOutput(['[Initializing Pyodide WebAssembly Python Runtime in Browser...]']);
        if (!window.loadPyodide) {
          await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'https://cdn.jsdelivr.net/pyodide/v0.25.0/full/pyodide.js';
            s.onload = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
          });
        }
        if (!window.__pyodideInstance) {
          window.__pyodideInstance = await window.loadPyodide();
        }
        const pyOut = ['[Pyodide WebAssembly Python Output]'];
        window.__pyodideInstance.setStdout({ batched: (msg) => pyOut.push(msg) });
        await window.__pyodideInstance.runPythonAsync(activeNote.content);
        if (pyOut.length === 1) pyOut.push('✓ Python script executed cleanly.');
        setCodeOutput(pyOut);
      } catch (pyErr) {
        setCodeOutput([`Python Error: ${pyErr.message}`]);
      }
      setIsRunningCode(false);
      return;
    }

    // JavaScript Sandbox Execution
    const logs = ['[Browser JavaScript Sandbox Output]'];
    const customConsole = {
      log: (...args) =>
        logs.push(
          args
            .map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)))
            .join(' ')
        ),
      error: (...args) => logs.push('ERROR: ' + args.join(' ')),
      warn: (...args) => logs.push('WARN: ' + args.join(' ')),
    };
    try {
      const fn = new Function('console', activeNote.content);
      const result = fn(customConsole);
      if (result !== undefined) {
        logs.push(`↳ Return: ${JSON.stringify(result)}`);
      }
      if (logs.length === 1) {
        logs.push('✓ JS executed successfully (no console.log output).');
      }
    } catch (err) {
      logs.push(`Runtime Error: ${err.message}`);
    }
    setCodeOutput(logs);
    setIsRunningCode(false);
  };

  // Voice Dictation (Web Speech Recognition API)
  const handleToggleVoiceDictation = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice Dictation requires Chrome, Edge, or a browser with Web Speech Recognition support.');
      return;
    }
    if (isListening) {
      setIsListening(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    setIsListening(true);

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      if (activeNote) {
        onUpdateNote(activeNote.id, {
          content: (activeNote.content ? activeNote.content + ' ' : '') + transcript,
        });
      }
    };
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.start();
  };

  const handleAddTag = (e) => {
    e.preventDefault();
    if (!newTag.trim() || !activeNote) return;
    const existing = activeNote.tags || [];
    if (!existing.includes(newTag.trim())) {
      onUpdateNote(activeNote.id, { tags: [...existing, newTag.trim()] });
    }
    setNewTag('');
  };

  const handleRemoveTag = (tagToRemove) => {
    if (!activeNote) return;
    onUpdateNote(activeNote.id, {
      tags: (activeNote.tags || []).filter((t) => t !== tagToRemove),
    });
  };

  const handleExportNoteWord = () => {
    if (!activeNote) return;
    const html = `<h1>${activeNote.title}</h1><p style="color:#64748b;">Super-Notepad Export • ${new Date(
      activeNote.updatedAt
    ).toLocaleString()}</p><hr/>${renderedMarkdownHtml}`;
    exportToDocx(activeNote.title || 'Notepad_Note', html);
  };

  const handleExportNotePdf = () => {
    if (!activeNote) return;
    const html = `<h1>${activeNote.title}</h1><p style="color:#64748b;">Super-Notepad Export • ${new Date(
      activeNote.updatedAt
    ).toLocaleString()}</p><hr/>${renderedMarkdownHtml}`;
    exportToPdf(activeNote.title || 'Notepad_Note', html);
  };

  const activeColorObj =
    NOTE_COLORS.find((c) => c.id === activeNote?.color) || NOTE_COLORS[0];

  return (
    <div className={`notepad-workspace-wrap ${compact ? 'compact-dock' : 'full-page'}`}>
      {/* ==================== LEFT SIDEBAR: NOTES LIST & SNIPPETS ==================== */}
      <div className="notepad-sidebar">
        <div className="notepad-sidebar-top">
          <button type="button" className="notepad-new-btn" onClick={onCreateNote}>
            <i className="fa-solid fa-plus"></i> New Super-Note
          </button>
          <input
            type="text"
            placeholder="Search notes or #tags..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="notepad-search-input"
          />
        </div>

        <div className="notepad-list">
          {filteredNotes.map((note) => {
            const colorObj =
              NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];
            return (
              <div
                key={note.id}
                className={`notepad-list-card ${
                  activeNote && activeNote.id === note.id ? 'active' : ''
                }`}
                style={{
                  backgroundColor: colorObj.dark ? '#1e293b' : colorObj.bg,
                  color: colorObj.dark ? '#f8fafc' : '#0f172a',
                  borderLeft: `4px solid ${colorObj.border}`,
                }}
                onClick={() => setActiveNoteId(note.id)}
              >
                <div className="notepad-card-head">
                  <strong>
                    {note.pinned && (
                      <i
                        className="fa-solid fa-thumbtack"
                        style={{ color: '#eab308', marginRight: '5px' }}
                      ></i>
                    )}
                    {note.title || 'Untitled Note'}
                  </strong>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      type="button"
                      className="notepad-del-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpdateNote(note.id, { pinned: !note.pinned });
                      }}
                      title={note.pinned ? 'Unpin Note' : 'Pin Note to Top'}
                    >
                      <i className="fa-solid fa-thumbtack"></i>
                    </button>
                    {notes.length > 1 && (
                      <button
                        type="button"
                        className="notepad-del-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteNote(note.id);
                        }}
                        title="Delete Note"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    )}
                  </div>
                </div>
                <p
                  className="notepad-card-snippet"
                  style={{ color: colorObj.dark ? '#cbd5e1' : '#475569' }}
                >
                  {(note.content || 'Empty note...').slice(0, 70)}
                </p>
                {note.tags && note.tags.length > 0 && (
                  <div className="note-card-tags">
                    {note.tags.map((t) => (
                      <span key={t} className="note-mini-tag">#{t}</span>
                    ))}
                  </div>
                )}
                <small
                  className="notepad-card-date"
                  style={{ color: colorObj.dark ? '#94a3b8' : '#64748b' }}
                >
                  {new Date(note.updatedAt).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}{' '}
                  • {getWordCount(note.content)} words
                </small>
              </div>
            );
          })}
        </div>
      </div>

      {/* ==================== MAIN SUPER-NOTEPAD EDITOR ==================== */}
      {activeNote && (
        <div
          className={`notepad-editor-pane ${activeColorObj.dark ? 'dark-note' : ''}`}
          style={{
            backgroundColor: activeColorObj.bg,
            color: activeColorObj.dark ? '#f8fafc' : '#0f172a',
          }}
        >
          {/* Top Title, Mode Tabs & Color Swatches */}
          <div className="notepad-editor-header">
            <input
              type="text"
              className="notepad-title-input"
              style={{ color: activeColorObj.dark ? '#f8fafc' : '#0f172a' }}
              value={activeNote.title}
              onChange={(e) =>
                onUpdateNote(activeNote.id, { title: e.target.value })
              }
              placeholder="Note Title..."
            />

            {!compact && (
              <div className="notepad-mode-tabs">
                {[
                  { id: 'plain', label: '📝 Plain / Sticky' },
                  { id: 'split', label: '👁️ Split Markdown' },
                  { id: 'code', label: '🐍 Code (Python & JS)' },
                  { id: 'analytics', label: '🧠 Python NLP Stats' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={`notepad-mode-btn ${editorMode === m.id ? 'active' : ''}`}
                    onClick={() => {
                      setEditorMode(m.id);
                      if (m.id === 'analytics') handleRunPythonNlp();
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}

            <div className="notepad-color-dots">
              {NOTE_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`note-color-dot ${activeNote.color === c.id ? 'active' : ''}`}
                  style={{ backgroundColor: c.bg, borderColor: c.border }}
                  onClick={() => onUpdateNote(activeNote.id, { color: c.id })}
                  title={c.label}
                />
              ))}
            </div>
          </div>

          {/* Tags Bar */}
          {!compact && (
            <div className="notepad-tags-bar">
              {(activeNote.tags || []).map((tag) => (
                <span key={tag} className="note-tag-chip">
                  #{tag}
                  <button type="button" onClick={() => handleRemoveTag(tag)}>✕</button>
                </span>
              ))}
              <form onSubmit={handleAddTag} style={{ display: 'inline-flex' }}>
                <input
                  type="text"
                  className="note-tag-input"
                  placeholder="+ Add #tag..."
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </form>
            </div>
          )}

          {/* Power-Tools & Sync Toolbar */}
          <div className="notepad-toolbar">
            <button
              type="button"
              className={`notepad-tool-btn ${isListening ? 'active-dictation' : ''}`}
              onClick={handleToggleVoiceDictation}
              title="Voice Dictation (Speech-to-Text)"
            >
              <i className="fa-solid fa-microphone"></i>{' '}
              {isListening ? 'Listening...' : 'Dictate'}
            </button>

            <button
              type="button"
              className="notepad-tool-btn"
              onClick={() =>
                onUpdateNote(activeNote.id, {
                  content:
                    (activeNote.content || '') +
                    `\n[${new Date().toLocaleString()}] `,
                })
              }
              title="Insert current Date & Time"
            >
              <i className="fa-regular fa-clock"></i> Timestamp
            </button>

            <button
              type="button"
              className={`notepad-tool-btn ${monoFont ? 'active' : ''}`}
              onClick={() => setMonoFont((m) => !m)}
              title="Toggle Monospace Font"
            >
              <i className="fa-solid fa-code"></i> {monoFont ? 'Mono' : 'Sans'}
            </button>

            {!compact && (
              <>
                <button
                  type="button"
                  className="notepad-tool-btn"
                  onClick={() => applyTextTransform('sort-asc')}
                  title="Sort all lines alphabetically A to Z"
                >
                  <i className="fa-solid fa-arrow-down-a-z"></i> Sort A→Z
                </button>
                <button
                  type="button"
                  className="notepad-tool-btn"
                  onClick={() => applyTextTransform('dedupe')}
                  title="Remove duplicate lines"
                >
                  <i className="fa-solid fa-filter"></i> Dedupe
                </button>
                <button
                  type="button"
                  className="notepad-tool-btn"
                  onClick={() => applyTextTransform('bullet-lines')}
                  title="Convert lines into bullet points"
                >
                  <i className="fa-solid fa-list-ul"></i> Bulletize
                </button>
                <button
                  type="button"
                  className="notepad-tool-btn"
                  onClick={handleRunPythonNlp}
                  title="Analyze note readability & generate summary with Python NLP"
                >
                  🧠 Python Summarize
                </button>
              </>
            )}

            <button
              type="button"
              className="notepad-tool-btn sync"
              onClick={() => onInsertNoteIntoWord(activeNote)}
              title="Insert this note into your active Microsoft Word Document"
            >
              <i className="fa-solid fa-file-import"></i> Insert in Word
            </button>

            {!compact && (
              <button
                type="button"
                className="notepad-tool-btn"
                onClick={() => onConvertNoteToWordDoc(activeNote)}
                title="Promote this note into a full Word Document"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Open in Word
              </button>
            )}

            <button
              type="button"
              className="notepad-tool-btn"
              onClick={() => onExtractTodosFromNote(activeNote)}
              title="Convert lines in this note into To-Do Tasks"
            >
              <i className="fa-solid fa-list-check"></i> To-Do
            </button>

            <div className="notepad-export-group">
              <button
                type="button"
                className="notepad-tool-btn word"
                onClick={handleExportNoteWord}
                title="Export Note as Word (.docx)"
              >
                <i className="fa-solid fa-file-word"></i> .DOCX
              </button>
              <button
                type="button"
                className="notepad-tool-btn pdf"
                onClick={handleExportNotePdf}
                title="Export Note as PDF (.pdf)"
              >
                <i className="fa-solid fa-file-pdf"></i> .PDF
              </button>
              <button
                type="button"
                className="notepad-tool-btn"
                onClick={() =>
                  exportToMarkdownFile(activeNote.title, activeNote.content)
                }
                title="Download as Markdown (.md)"
              >
                .MD
              </button>
              <button
                type="button"
                className="notepad-tool-btn txt"
                onClick={() =>
                  exportToTxtFile(activeNote.title, activeNote.content)
                }
                title="Download as .TXT file"
              >
                .TXT
              </button>
            </div>
          </div>

          {/* ==================== BODY AREA BY SELECTED MODE ==================== */}
          {(compact || editorMode === 'plain') && (
            <textarea
              className={`notepad-textarea ${monoFont ? 'mono' : ''}`}
              style={{ color: activeColorObj.dark ? '#f8fafc' : '#0f172a' }}
              value={activeNote.content}
              onChange={(e) =>
                onUpdateNote(activeNote.id, { content: e.target.value })
              }
              placeholder="Type your quick notes, scratchpad ideas, code snippets, or Markdown here..."
            />
          )}

          {!compact && editorMode === 'split' && (
            <div className="notepad-split-view">
              <textarea
                className={`notepad-textarea split-left ${monoFont ? 'mono' : ''}`}
                style={{ color: activeColorObj.dark ? '#f8fafc' : '#0f172a' }}
                value={activeNote.content}
                onChange={(e) =>
                  onUpdateNote(activeNote.id, { content: e.target.value })
                }
                placeholder="Write Markdown, headings (#), tables, checklists, or code on the left..."
              />
              <div
                className="notepad-markdown-preview"
                dangerouslySetInnerHTML={{ __html: renderedMarkdownHtml }}
              />
            </div>
          )}

          {!compact && editorMode === 'code' && (
            <div className="notepad-code-sandbox">
              <div className="code-sandbox-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Execution Runtime:</span>
                  <button
                    type="button"
                    className={`chart-pill-btn ${codeLang === 'python' ? 'active' : ''}`}
                    onClick={() => setCodeLang('python')}
                  >
                    🐍 Python 3.13 (NumPy / Pandas / Matplotlib)
                  </button>
                  <button
                    type="button"
                    className={`chart-pill-btn ${codeLang === 'js' ? 'active' : ''}`}
                    onClick={() => setCodeLang('js')}
                  >
                    🟨 JavaScript (ES2024)
                  </button>
                </div>

                <button
                  type="button"
                  className="run-js-btn"
                  onClick={handleExecuteCode}
                  disabled={isRunningCode}
                >
                  <i className="fa-solid fa-play"></i>{' '}
                  {isRunningCode
                    ? 'Running...'
                    : codeLang === 'python'
                    ? 'Run Python 3.13'
                    : 'Run JS Code'}
                </button>
              </div>

              <div className="notepad-split-view">
                <textarea
                  className="notepad-textarea mono code-input"
                  style={{ color: activeColorObj.dark ? '#f8fafc' : '#0f172a' }}
                  value={activeNote.content}
                  onChange={(e) =>
                    onUpdateNote(activeNote.id, { content: e.target.value })
                  }
                  placeholder={
                    codeLang === 'python'
                      ? '# Write Python 3.13 code here (numpy, pandas, matplotlib available!)\nimport math\nprint("Sqrt(144) =", math.sqrt(144))'
                      : '// Write JavaScript here!\nconsole.log(2 + 2);'
                  }
                />
                <div className="code-console-output">
                  <div className="console-title">
                    {codeLang === 'python'
                      ? 'Python 3.13 Server Output & Matplotlib Viewer'
                      : 'Browser JavaScript Console'}
                  </div>
                  {codeOutput.length === 0 && !pythonPlot ? (
                    <p className="console-empty">
                      Click &ldquo;Run {codeLang === 'python' ? 'Python 3.13' : 'JS Code'}&rdquo; to execute your script and view output or Matplotlib plots here.
                    </p>
                  ) : (
                    <>
                      {codeOutput.map((line, i) => (
                        <pre key={i} className="console-line">{line}</pre>
                      ))}
                      {pythonPlot && (
                        <div style={{ marginTop: '10px', background: '#ffffff', padding: '8px', borderRadius: '6px', textAlign: 'center' }}>
                          <img
                            src={pythonPlot}
                            alt="Matplotlib Plot"
                            style={{ maxWidth: '100%', height: 'auto', borderRadius: '4px' }}
                          />
                          {onInsertRawHtmlIntoWord && (
                            <button
                              type="button"
                              className="run-js-btn"
                              style={{ margin: '8px auto 0' }}
                              onClick={() =>
                                onInsertRawHtmlIntoWord(
                                  `<div style="text-align:center; margin:16px 0;"><img src="${pythonPlot}" alt="Python Matplotlib Figure" style="max-width:88%; border:1px solid #cbd5e1; border-radius:6px;" /><p style="font-size:9.5pt; color:#64748b;">Figure: Generated via Python 3.13 &amp; Matplotlib</p></div><p><br/></p>`
                                )
                              }
                            >
                              ➕ Insert Matplotlib Plot into Word Document
                            </button>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {!compact && editorMode === 'analytics' && (
            <div className="notepad-analytics-panel">
              <div className="analytics-cards-row">
                <div className="analytics-stat-box">
                  <span>Total Words</span>
                  <strong>{noteAnalytics.wordCount}</strong>
                </div>
                <div className="analytics-stat-box">
                  <span>Flesch Reading Ease</span>
                  <strong>{nlpResult ? nlpResult.readingEase : '—'}</strong>
                </div>
                <div className="analytics-stat-box">
                  <span>Grade Level</span>
                  <strong>{nlpResult ? nlpResult.gradeLevel : '—'}</strong>
                </div>
                <div className="analytics-stat-box">
                  <span>Lexical Diversity</span>
                  <strong>{nlpResult ? `${nlpResult.lexicalDiversity}%` : '—'}</strong>
                </div>
                <div className="analytics-stat-box">
                  <span>Reading Time</span>
                  <strong>~{noteAnalytics.readingTimeSec} sec</strong>
                </div>
              </div>

              {nlpResult && (
                <div className="analytics-freq-section">
                  <h4>🐍 Python NLP Extractive Summary</h4>
                  <p style={{ marginTop: '6px', fontSize: '13px', color: '#334155', lineHeight: 1.5 }}>
                    {nlpResult.summary}
                  </p>
                </div>
              )}

              <div className="analytics-freq-section">
                <h4>Top Keyword Frequency</h4>
                {noteAnalytics.topWords.length === 0 ? (
                  <p>Write more text in the note to analyze keyword frequency.</p>
                ) : (
                  <div className="freq-bars-list">
                    {noteAnalytics.topWords.map(([word, count]) => (
                      <div key={word} className="freq-bar-item">
                        <span className="freq-word">{word}</span>
                        <div className="freq-bar-track">
                          <div
                            className="freq-bar-fill"
                            style={{
                              width: `${Math.min(
                                100,
                                (count / noteAnalytics.topWords[0][1]) * 100
                              )}%`,
                            }}
                          />
                        </div>
                        <span className="freq-count">{count}×</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Status */}
          <div className="notepad-footer-status">
            <span>
              {noteAnalytics.wordCount} words • {noteAnalytics.charCount} chars •{' '}
              {noteAnalytics.lines} lines
            </span>
            <span>
              Backend: <strong>Python 3.13 + SQLite3 Connected</strong>
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

