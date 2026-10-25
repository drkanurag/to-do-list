import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import RibbonToolbar from './components/RibbonToolbar';
import TodoManager from './components/TodoManager';
import NotepadWorkspace from './components/NotepadWorkspace';
import BentoDashboard, { ATMOSPHERE_THEMES } from './components/BentoDashboard';
import {
  ChartBuilderModal,
  EquationBuilderModal,
  DiagramBuilderModal,
  DrawingCanvasModal,
  FeatureGuideModal,
} from './components/InteractiveModals';
import { DOCUMENT_TEMPLATES } from './utils/templates';
import {
  exportToDocx,
  exportToDoc,
  exportToPdf,
  exportToHtmlFile,
  exportToTxtFile,
  exportToMarkdownFile,
  printDocument,
  convertTodosToHtml,
} from './utils/exportUtils';
import { escapeHtml, sanitizeUrl, sanitizeHtml } from './utils/sanitize';
import { usePersistence } from './hooks/usePersistence';
import { useTodoState } from './hooks/useTodoState';
import { useNotepadState } from './hooks/useNotepadState';

function fireCelebrationConfetti() {
  if (typeof window !== 'undefined' && window.confetti) {
    window.confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.65 },
    });
  }
}

export default function App() {
  // Primary Workspace Mode: 'bento' | 'word' | 'todo' | 'notepad' | 'split'
  const [workspaceMode, setWorkspaceMode] = useState('word');
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [darkChrome, setDarkChrome] = useState(false);
  const [atmosphere, setAtmosphere] = useState(() => {
    try {
      return localStorage.getItem('omniword_atmosphere') || 'aurora';
    } catch {
      return 'aurora';
    }
  });

  const [toast, setToast] = useState(null);
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3400);
  }, []);

  // Documents State
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem('omniword_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading documents:', e);
    }
    return [
      {
        id: 'doc-1',
        title: 'Untitled Document',
        content: '<p><br/></p>',
        updatedAt: Date.now(),
        comments: [],
      },
    ];
  });

  const [activeDocId, setActiveDocId] = useState(() => {
    return documents[0]?.id || 'doc-1';
  });

  // Page Setup & Formatting State
  const [pageSettings, setPageSettings] = useState(() => {
    try {
      const saved = localStorage.getItem('omniword_page_settings');
      if (saved) return JSON.parse(saved);
    } catch (e) {
      console.error('Error loading page settings:', e);
    }
    return {
      fontFamily: 'Calibri, Candara, Segoe, Optima, Arial, sans-serif',
      fontSize: '11pt',
      lineSpacing: '1.5',
      margins: 'normal',
      orientation: 'portrait',
      pageSize: 'a4',
      columns: 1,
      pageColor: '#ffffff',
      pageBorder: 'none',
      watermark: '',
      headerText: '',
      footerText: '',
    };
  });

  // View Settings
  const [viewSettings, setViewSettings] = useState({
    layoutMode: 'print',
    focusMode: false,
    showRuler: true,
    showGridlines: false,
    showOutline: true,
    showProductivityDock: true,
    zoom: 100,
    spellCheck: true,
  });

  // Docked Right Panel Active Tab ('todo' | 'notepad')
  const [dockTab, setDockTab] = useState('todo');

  // Custom Hooks for Modularized Task and Notepad State
  const {
    todos,
    setTodos,
    handleAddTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleUpdateTodo,
    handleClearCompletedTodos,
  } = useTodoState(fireCelebrationConfetti);

  const {
    notes,
    setNotes,
    activeNoteId,
    setActiveNoteId,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
  } = useNotepadState();

  // State Persistence & Backend Sync Hook (Debounced & Quota-Protected)
  const stateData = useMemo(
    () => ({ documents, todos, notes, pageSettings }),
    [documents, todos, notes, pageSettings]
  );
  const { isBackendAvailable } = usePersistence(stateData, showToast);

  // UI Modals & Interactive Studios
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [showWordCountModal, setShowWordCountModal] = useState(false);
  const [showChartModal, setShowChartModal] = useState(false);
  const [showEquationModal, setShowEquationModal] = useState(false);
  const [showDiagramModal, setShowDiagramModal] = useState(false);
  const [showDrawingModal, setShowDrawingModal] = useState(false);
  const [showFeatureGuide, setShowFeatureGuide] = useState(false);
  const [showQuickBanner, setShowQuickBanner] = useState(true);

  const [showFindReplace, setShowFindReplace] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [formatPainterActive, setFormatPainterActive] = useState(false);
  const [copiedStyle, setCopiedStyle] = useState(null);
  const [outlineHeadings, setOutlineHeadings] = useState([]);

  const editorRef = useRef(null);
  const editorInputTimerRef = useRef(null);

  const activeDoc = useMemo(
    () => documents.find((d) => d.id === activeDocId) || documents[0],
    [documents, activeDocId]
  );

  // Global Keyboard Shortcut Ctrl+K for Interactive Feature Explorer
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowFeatureGuide((s) => !s);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Extract headings for live Navigation Pane Outline
  const refreshOutline = useCallback(() => {
    if (!editorRef.current) return;
    const nodes = editorRef.current.querySelectorAll('h1, h2, h3');
    const extracted = Array.from(nodes).map((node, index) => ({
      id: `heading-${index}`,
      tag: node.tagName.toLowerCase(),
      text: (node.innerText || 'Untitled Section').trim(),
      index,
    }));
    setOutlineHeadings(extracted);
  }, []);

  // Sync active document content to DOM editor on document switch
  useEffect(() => {
    if (editorRef.current && activeDoc) {
      if (editorRef.current.innerHTML !== activeDoc.content) {
        editorRef.current.innerHTML = activeDoc.content;
      }
      refreshOutline();
    }
  }, [activeDocId, workspaceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounced input handler (350ms) to prevent full-tree re-renders on every keystroke
  const handleEditorInput = useCallback(() => {
    refreshOutline();
    if (editorInputTimerRef.current) {
      clearTimeout(editorInputTimerRef.current);
    }
    editorInputTimerRef.current = setTimeout(() => {
      if (!editorRef.current) return;
      const html = editorRef.current.innerHTML;
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id ? { ...d, content: html, updatedAt: Date.now() } : d
        )
      );
    }, 350);
  }, [activeDoc.id, refreshOutline]);

  // Synchronously flush any pending debounced editor input
  const flushEditorInput = useCallback(() => {
    if (editorInputTimerRef.current) {
      clearTimeout(editorInputTimerRef.current);
      editorInputTimerRef.current = null;
    }
    if (editorRef.current) {
      const html = editorRef.current.innerHTML;
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id ? { ...d, content: html, updatedAt: Date.now() } : d
        )
      );
    }
  }, [activeDoc.id]);

  const handleEditorClick = (e) => {
    if (e.target && e.target.tagName === 'INPUT' && e.target.type === 'checkbox') {
      if (e.target.checked) {
        e.target.setAttribute('checked', 'checked');
      } else {
        e.target.removeAttribute('checked');
      }
      handleEditorInput();
    }

    if (formatPainterActive && copiedStyle) {
      const sel = window.getSelection();
      if (sel && !sel.isCollapsed) {
        if (copiedStyle.color) document.execCommand('foreColor', false, copiedStyle.color);
        if (copiedStyle.backgroundColor && copiedStyle.backgroundColor !== 'rgba(0, 0, 0, 0)') {
          document.execCommand('hiliteColor', false, copiedStyle.backgroundColor);
        }
        if (copiedStyle.fontWeight && Number(copiedStyle.fontWeight) >= 600) {
          document.execCommand('bold', false, null);
        }
        if (copiedStyle.fontStyle === 'italic') {
          document.execCommand('italic', false, null);
        }
        setFormatPainterActive(false);
        setCopiedStyle(null);
        handleEditorInput();
        showToast('Applied copied formatting');
      }
    }
  };

  const execWordCommand = (command, value = null) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    document.execCommand(command, false, value);
    handleEditorInput();
  };

  const insertHtmlAtCursor = (htmlSnippet) => {
    const cleanSnippet = sanitizeHtml(htmlSnippet);
    if (!editorRef.current) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id
            ? { ...d, content: d.content + cleanSnippet, updatedAt: Date.now() }
            : d
        )
      );
      return;
    }
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      document.execCommand('insertHTML', false, cleanSnippet);
    } else {
      editorRef.current.innerHTML += cleanSnippet;
    }
    handleEditorInput();
  };

  const handleApplyFontSizePt = (sizeAction) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      if (sizeAction !== 'increase' && sizeAction !== 'decrease') {
        setPageSettings((prev) => ({ ...prev, fontSize: sizeAction }));
        showToast(`Default document font size set to ${sizeAction}`);
      }
      return;
    }
    const cleanText = escapeHtml(sel.toString());
    let ptValue = sizeAction;
    if (sizeAction === 'increase') ptValue = '14pt';
    if (sizeAction === 'decrease') ptValue = '10pt';
    document.execCommand(
      'insertHTML',
      false,
      `<span style="font-size: ${ptValue};">${cleanText}</span>`
    );
    handleEditorInput();
  };

  const handleApplyStylePreset = (styleId) => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    switch (styleId) {
      case 'normal':
        document.execCommand('formatBlock', false, 'P');
        break;
      case 'title':
      case 'h1':
        document.execCommand('formatBlock', false, 'H1');
        break;
      case 'h2':
        document.execCommand('formatBlock', false, 'H2');
        break;
      case 'h3':
        document.execCommand('formatBlock', false, 'H3');
        break;
      case 'quote':
        document.execCommand('formatBlock', false, 'BLOCKQUOTE');
        break;
      case 'code':
        document.execCommand('formatBlock', false, 'PRE');
        break;
      default:
        break;
    }
    handleEditorInput();
  };

  const handleChangeCase = (mode) => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      showToast('Select some text in the document first to change its case');
      return;
    }
    const text = sel.toString();
    let transformed = text;
    if (mode === 'UPPER') transformed = text.toUpperCase();
    else if (mode === 'lower') transformed = text.toLowerCase();
    else if (mode === 'Title') {
      transformed = text.replace(
        /\w\S*/g,
        (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
      );
    } else if (mode === 'Sentence') {
      transformed = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    document.execCommand('insertText', false, transformed);
    handleEditorInput();
  };

  const handleInsertTable = (rows, cols) => {
    let headerCells = '';
    for (let c = 0; c < cols; c++) {
      headerCells += `<th style="background-color:#dbeafe; color:#1e3a8a; padding:8px; border:1px solid #94a3b8;">Header ${
        c + 1
      }</th>`;
    }
    let bodyRows = '';
    for (let r = 0; r < rows - 1; r++) {
      let cells = '';
      for (let c = 0; c < cols; c++) {
        cells += `<td style="padding:8px; border:1px solid #cbd5e1;">Cell ${r + 1},${c + 1}</td>`;
      }
      bodyRows += `<tr>${cells}</tr>`;
    }
    const tableHtml = `
      <table style="width:100%; border-collapse:collapse; margin:14px 0;">
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${bodyRows || `<tr>${'<td style="padding:8px; border:1px solid #cbd5e1;">Data</td>'.repeat(cols)}</tr>`}</tbody>
      </table><p><br/></p>`;
    insertHtmlAtCursor(tableHtml);
    showToast(`Inserted ${rows}×${cols} table`);
  };

  const handleInsertCallout = (type) => {
    const styles = {
      info: {
        bg: '#eff6ff',
        border: '#2563eb',
        title: 'ℹ️ Information Note',
        color: '#1e3a8a',
      },
      warning: {
        bg: '#fffbeb',
        border: '#d97706',
        title: '⚠️ Important Warning',
        color: '#92400e',
      },
      success: {
        bg: '#f0fdf4',
        border: '#16a34a',
        title: '✅ Best Practice / Tip',
        color: '#166534',
      },
    };
    const cfg = styles[type] || styles.info;
    const html = `
      <div style="background-color:${cfg.bg}; border-left:4px solid ${cfg.border}; padding:12px 16px; border-radius:6px; margin:14px 0; color:${cfg.color};">
        <strong>${cfg.title}:</strong> Type your callout details here...
      </div><p><br/></p>`;
    insertHtmlAtCursor(html);
  };

  const handleInsertChecklist = () => {
    const html = `<div style="margin: 6px 0;"><input type="checkbox" /> <span>Action item or task...</span></div>`;
    insertHtmlAtCursor(html);
  };

  const handleInsertImage = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const cleanFileName = escapeHtml(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = `<div style="text-align:center; margin:14px 0;"><img src="${ev.target.result}" alt="${cleanFileName}" style="max-width:85%; height:auto; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.1);" /><p style="font-size:9.5pt; color:#64748b; margin-top:4px;">Figure: ${cleanFileName}</p></div><p><br/></p>`;
      insertHtmlAtCursor(html);
      showToast(`Inserted image "${file.name}"`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertLink = () => {
    const rawUrl = window.prompt('Enter URL (e.g. https://example.com):', 'https://');
    if (!rawUrl) return;
    const cleanUrl = sanitizeUrl(rawUrl);
    if (cleanUrl === '#') {
      showToast('Invalid URL. Only http:, https:, and mailto: protocols are allowed.', 'warning');
      return;
    }
    const rawLabel = window.prompt('Enter link display text:', rawUrl) || rawUrl;
    const cleanLabel = escapeHtml(rawLabel);
    insertHtmlAtCursor(
      `<a href="${cleanUrl}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline;">${cleanLabel}</a> `
    );
  };

  const handleInsertSymbol = (sym) => {
    insertHtmlAtCursor(`<span>${escapeHtml(sym)}</span>`);
  };

  const handleInsertDateTime = () => {
    const now = new Date().toLocaleString([], {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    insertHtmlAtCursor(`<span>${escapeHtml(now)}</span> `);
  };

  const handleInsertPageBreak = () => {
    insertHtmlAtCursor(
      `<div class="page-break" style="page-break-after: always; border-top: 2px dashed #94a3b8; margin: 28px 0; text-align: center; position: relative;"><span class="no-export" style="background: #f1f5f9; color: #64748b; font-size: 9pt; padding: 2px 10px; border-radius: 10px; position: relative; top: -10px;">--- PAGE BREAK ---</span></div><p><br/></p>`
    );
    showToast('Page Break inserted');
  };

  const handleInsertCoverPage = () => {
    const safeTitle = escapeHtml(activeDoc.title);
    const coverHtml = `
      <div style="padding: 48px 24px; text-align: center; border: 2px solid #1e3a8a; border-radius: 8px; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); margin-bottom: 28px; page-break-after: always;">
        <p style="letter-spacing: 3px; text-transform: uppercase; color: #2563eb; font-weight: 700; font-size: 10pt;">OFFICIAL DOCUMENT</p>
        <h1 style="font-size: 28pt; color: #0f172a; margin: 16px 0;">${safeTitle}</h1>
        <p style="font-size: 13pt; color: #475569; max-width: 520px; margin: 0 auto 32px;">Comprehensive Documentation, Action Plan &amp; Executive Summary</p>
        <hr style="width: 120px; margin: 24px auto; border-top: 3px solid #2563eb;" />
        <p style="font-size: 11pt; color: #334155; margin-top: 32px;"><strong>Prepared Date:</strong> ${new Date().toLocaleDateString()}</p>
      </div><p><br/></p>`;
    if (editorRef.current) {
      editorRef.current.innerHTML = coverHtml + editorRef.current.innerHTML;
      handleEditorInput();
      showToast('Cover Page added to the top of your document');
    }
  };

  const handleInsertTableOfContents = () => {
    if (!editorRef.current) return;
    const nodes = editorRef.current.querySelectorAll('h1, h2, h3');
    if (nodes.length === 0) {
      showToast('Add Heading 1, 2, or 3 sections first to generate a Table of Contents');
      return;
    }
    const items = Array.from(nodes)
      .map((node, i) => {
        const indent =
          node.tagName === 'H2' ? '18px' : node.tagName === 'H3' ? '36px' : '0px';
        const cleanHeading = escapeHtml(node.innerText || 'Untitled Section');
        return `<div style="margin-left:${indent}; padding:4px 0; border-bottom:1px dotted #cbd5e1; display:flex; justify-content:space-between;"><span><strong>${
          i + 1
        }.</strong> ${cleanHeading}</span><span style="color:#64748b;">Section ${i + 1}</span></div>`;
      })
      .join('');

    const tocHtml = `
      <div style="background:#f8fafc; border:1px solid #cbd5e1; border-radius:8px; padding:16px 20px; margin:16px 0;">
        <h2 style="margin-top:0; color:#1e3a8a;">📑 Table of Contents</h2>
        ${items}
      </div><p><br/></p>`;
    editorRef.current.innerHTML = tocHtml + editorRef.current.innerHTML;
    handleEditorInput();
    showToast('Auto-generated Table of Contents inserted!');
  };

  const handleInsertSignature = () => {
    const sigHtml = `
      <div style="margin: 28px 0 14px; width: 280px;">
        <div style="border-bottom: 1.5px solid #0f172a; height: 32px;"></div>
        <p style="margin: 4px 0 0; font-weight: 700; font-size: 10.5pt;">Authorized Signature</p>
        <p style="margin: 0; font-size: 9.5pt; color: #64748b;">Date: ${new Date().toLocaleDateString()}</p>
      </div><p><br/></p>`;
    insertHtmlAtCursor(sigHtml);
  };

  // Voice Dictation into Word Document
  const handleToggleDictation = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Voice Dictation requires Chrome or Edge with SpeechRecognition support');
      return;
    }
    if (isDictating) {
      setIsDictating(false);
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    setIsDictating(true);
    showToast('🎙️ Listening... Speak now to dictate into your Word document!');

    recognition.onresult = (event) => {
      const rawTranscript = event.results[0][0].transcript;
      const cleanTranscript = escapeHtml(rawTranscript);
      insertHtmlAtCursor(`<span>${cleanTranscript} </span>`);
      showToast('Dictated text inserted');
    };
    recognition.onend = () => setIsDictating(false);
    recognition.onerror = () => setIsDictating(false);
    recognition.start();
  };

  // Format Painter Toggle
  const handleToggleFormatPainter = () => {
    if (formatPainterActive) {
      setFormatPainterActive(false);
      setCopiedStyle(null);
      return;
    }
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.anchorNode) {
      showToast('Select formatted text first, then click Format Painter');
      return;
    }
    const el =
      sel.anchorNode.nodeType === 3 ? sel.anchorNode.parentElement : sel.anchorNode;
    const computed = window.getComputedStyle(el);
    setCopiedStyle({
      color: computed.color,
      backgroundColor: computed.backgroundColor,
      fontWeight: computed.fontWeight,
      fontStyle: computed.fontStyle,
    });
    setFormatPainterActive(true);
    showToast('Formatting copied! Highlight target text to apply.');
  };

  // Find & Replace
  const handleReplace = (all = false) => {
    if (!findText || !editorRef.current) return;
    const flags = matchCase ? 'g' : 'gi';
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, all ? flags : matchCase ? '' : 'i');
    const currentHtml = editorRef.current.innerHTML;
    const walker = document.createTreeWalker(
      editorRef.current,
      NodeFilter.SHOW_TEXT,
      null
    );
    let count = 0;
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      if (regex.test(node.nodeValue)) {
        node.nodeValue = node.nodeValue.replace(regex, replaceText);
        count++;
        if (!all) break;
      }
    }
    if (count > 0 && currentHtml !== editorRef.current.innerHTML) {
      handleEditorInput();
      showToast(`Replaced ${count} occurrence(s)`);
    } else {
      showToast(`No matches found for "${findText}"`);
    }
  };

  // Read Aloud (Text-to-Speech)
  const handleToggleSpeak = () => {
    if (!('speechSynthesis' in window)) {
      showToast('Speech synthesis is not supported in this browser');
      return;
    }
    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }
    const temp = document.createElement('div');
    temp.innerHTML = activeDoc?.content || '';
    const plainText = temp.innerText || temp.textContent || '';
    if (!plainText.trim()) {
      showToast('Document is empty');
      return;
    }
    const utterance = new SpeechSynthesisUtterance(plainText);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
    showToast('Reading document aloud...');
  };

  const handleAddComment = () => {
    const text = window.prompt('Enter your review comment or annotation:');
    if (!text || !text.trim()) return;
    const newComment = {
      id: `c-${Date.now()}`,
      author: 'Author',
      text: text.trim(),
      createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDoc.id
          ? { ...d, comments: [...(d.comments || []), newComment] }
          : d
      )
    );
    setViewSettings((prev) => ({ ...prev, showOutline: true }));
    showToast('Comment added to document review pane');
  };

  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const rawContent = String(ev.target.result || '');
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      let htmlContent = '';
      if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        htmlContent = sanitizeHtml(rawContent);
      } else {
        htmlContent = rawContent
          .split('\n')
          .map((line) => `<p>${escapeHtml(line) || '<br/>'}</p>`)
          .join('');
      }
      const newDoc = {
        id: `doc-${Date.now()}`,
        title: baseName,
        content: htmlContent,
        updatedAt: Date.now(),
        comments: [],
      };
      setDocuments((prev) => [newDoc, ...prev]);
      setActiveDocId(newDoc.id);
      setWorkspaceMode('word');
      showToast(`Imported "${file.name}" into Word Studio`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const createBlankDocument = () => {
    flushEditorInput();
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: `Untitled Document ${documents.length + 1}`,
      content: `<p><br/></p>`,
      updatedAt: Date.now(),
      comments: [],
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setWorkspaceMode('word');
    showToast('Created new blank Word document');
  };

  const createDocumentFromTemplate = (tpl) => {
    flushEditorInput();
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: tpl.name,
      content: sanitizeHtml(tpl.content),
      updatedAt: Date.now(),
      comments: [],
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setShowTemplatesModal(false);
    setWorkspaceMode('word');
    showToast(`Loaded template: "${tpl.name}"`);
  };

  const deleteDocument = (id) => {
    if (documents.length <= 1) {
      showToast('At least one document must remain open');
      return;
    }
    const remaining = documents.filter((d) => d.id !== id);
    setDocuments(remaining);
    if (activeDocId === id) {
      setActiveDocId(remaining[0].id);
    }
    showToast('Document removed');
  };

  // Convert todos to table in Word
  const handleInsertTodosIntoWord = () => {
    const html = convertTodosToHtml(todos, 'Action Plan & Task Checklist');
    insertHtmlAtCursor(html);
    if (workspaceMode !== 'word' && workspaceMode !== 'split') {
      setWorkspaceMode('word');
    }
    showToast('Inserted To-Do List table into Word Document!');
  };

  const handleOpenTodosAsWordDoc = () => {
    flushEditorInput();
    const html = convertTodosToHtml(todos, 'Master Action Plan & To-Do Report');
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: 'Action Plan & To-Do Report',
      content: html,
      updatedAt: Date.now(),
      comments: [],
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setWorkspaceMode('word');
    showToast('Created editable Word document from your To-Do List!');
  };

  const handleInsertNoteIntoWord = (noteObj) => {
    const target =
      noteObj || notes.find((n) => n.id === activeNoteId) || notes[0];
    if (!target) return;
    const rawParsed =
      typeof window !== 'undefined' && window.marked
        ? window.marked.parse(target.content || '')
        : escapeHtml(target.content || '');
    const cleanMarkdown = sanitizeHtml(rawParsed);
    const cleanTitle = escapeHtml(target.title || 'Untitled Note');

    const formatted = `
      <div style="background-color:#fefce8; border-left:4px solid #eab308; padding:12px 16px; border-radius:6px; margin:14px 0;">
        <h3 style="margin:0 0 6px; color:#854d0e;">📝 ${cleanTitle}</h3>
        ${cleanMarkdown}
      </div><p><br/></p>`;
    insertHtmlAtCursor(formatted);
    if (workspaceMode !== 'word' && workspaceMode !== 'split') {
      setWorkspaceMode('word');
    }
    showToast(`Inserted note "${target.title}" into Word Document!`);
  };

  const handleConvertNoteToWordDoc = (noteObj) => {
    if (!noteObj) return;
    flushEditorInput();
    const rawParsed =
      typeof window !== 'undefined' && window.marked
        ? window.marked.parse(noteObj.content || '')
        : noteObj.content
            .split('\n')
            .map((line) => `<p>${escapeHtml(line) || '<br/>'}</p>`)
            .join('');
    const cleanMarkdown = sanitizeHtml(rawParsed);
    const cleanTitle = escapeHtml(noteObj.title || 'Converted Note');

    const newDoc = {
      id: `doc-${Date.now()}`,
      title: noteObj.title || 'Converted Note',
      content: `<h1>${cleanTitle}</h1><hr/>${cleanMarkdown}`,
      updatedAt: Date.now(),
      comments: [],
    };
    setDocuments((prev) => [newDoc, ...prev]);
    setActiveDocId(newDoc.id);
    setWorkspaceMode('word');
    showToast(`Promoted "${noteObj.title}" to a full Word Document!`);
  };

  const handleExtractTodosFromNote = (noteObj) => {
    if (!noteObj || !noteObj.content.trim()) {
      showToast('Write some lines in the note first to extract tasks');
      return;
    }
    const lines = noteObj.content
      .split('\n')
      .map((l) => l.replace(/^[-*•#[\]\s]+/, '').trim())
      .filter((l) => l.length > 2);

    if (lines.length === 0) {
      showToast('No actionable lines found in note');
      return;
    }

    lines.forEach((line) => {
      handleAddTodo({
        text: line,
        status: 'todo',
        priority: 'medium',
        category: 'General',
        dueDate: '',
        notes: `Extracted from note: ${noteObj.title}`,
      });
    });
    showToast(`Added ${lines.length} task(s) to your To-Do List!`);
  };

  // Interactive Feature Guide "Try It Now" dispatcher
  const handleTriggerFeatureFromGuide = (featureId) => {
    switch (featureId) {
      case 'export-docx':
        exportToDocx(activeDoc.title, activeDoc.content, pageSettings);
        showToast(`Exported "${activeDoc.title}.docx"`);
        break;
      case 'export-pdf':
        exportToPdf(activeDoc.title, activeDoc.content, pageSettings);
        showToast(`Exported "${activeDoc.title}.pdf"`);
        break;
      case 'insert-chart':
        setWorkspaceMode('word');
        setShowChartModal(true);
        break;
      case 'insert-equation':
        setWorkspaceMode('word');
        setShowEquationModal(true);
        break;
      case 'insert-diagram':
        setWorkspaceMode('word');
        setShowDiagramModal(true);
        break;
      case 'freehand-draw':
        setWorkspaceMode('word');
        setShowDrawingModal(true);
        break;
      case 'super-notepad':
      case 'notepad-powertools':
        setWorkspaceMode('notepad');
        break;
      case 'todo-kanban':
        setWorkspaceMode('todo');
        break;
      case 'page-setup':
        setWorkspaceMode('word');
        setActiveRibbonTab('layout');
        break;
      case 'voice-read-aloud':
        setWorkspaceMode('word');
        setActiveRibbonTab('review');
        handleToggleSpeak();
        break;
      default:
        break;
    }
  };

  // Document Metrics
  const stats = useMemo(() => {
    const temp = document.createElement('div');
    temp.innerHTML = activeDoc?.content || '';
    const text = (temp.innerText || temp.textContent || '').trim();
    const words = text ? text.split(/\s+/).length : 0;
    const charsWithSpaces = text.length;
    const charsNoSpaces = text.replace(/\s+/g, '').length;
    const paragraphs = temp.querySelectorAll('p, h1, h2, h3, li, blockquote').length || 1;
    const pages = Math.max(1, Math.ceil(words / 275));
    const readingMins = Math.max(1, Math.ceil(words / 200));
    return {
      words,
      charsWithSpaces,
      charsNoSpaces,
      paragraphs,
      pages,
      readingMins,
    };
  }, [activeDoc?.content]);

  const getPaperStyle = () => {
    const marginMap = {
      narrow: '36px',
      moderate: '52px',
      normal: '72px',
      wide: '104px',
    };
    const borderMap = {
      none: 'none',
      solid: '1.5px solid #1e293b',
      double: '4px double #1e293b',
      dashed: '2px dashed #475569',
      accent: '3px solid #1d4ed8',
    };

    const isLandscape = pageSettings.orientation === 'landscape';
    const baseWidth =
      viewSettings.layoutMode === 'web'
        ? '100%'
        : isLandscape
        ? '1056px'
        : pageSettings.pageSize === 'letter'
        ? '816px'
        : '794px';

    const minHeight =
      viewSettings.layoutMode === 'web'
        ? '720px'
        : isLandscape
        ? '794px'
        : '1056px';

    return {
      width: baseWidth,
      minHeight,
      padding: marginMap[pageSettings.margins] || '72px',
      backgroundColor: pageSettings.pageColor || '#ffffff',
      fontFamily: pageSettings.fontFamily,
      fontSize: pageSettings.fontSize,
      lineHeight: pageSettings.lineSpacing,
      border: borderMap[pageSettings.pageBorder] || 'none',
      transform: `scale(${viewSettings.zoom / 100})`,
      transformOrigin: 'top center',
    };
  };

  const pendingTodosCount = useMemo(
    () => todos.filter((t) => t.status !== 'done').length,
    [todos]
  );
  const doneTodosCount = useMemo(
    () => todos.filter((t) => t.status === 'done').length,
    [todos]
  );

  return (
    <div
      className={`omniword-app atmosphere-${atmosphere} ${
        darkChrome || atmosphere === 'cyber' ? 'dark-chrome' : ''
      } ${viewSettings.focusMode ? 'focus-mode' : ''}`}
    >
      {/* Animated Floating Mesh Gradient Orbs Backdrop */}
      <div className="ambient-mesh-bg no-print" aria-hidden="true">
        <div className="mesh-orb orb-1"></div>
        <div className="mesh-orb orb-2"></div>
        <div className="mesh-orb orb-3"></div>
      </div>

      {/* ==================== TOP OFFICE APPLICATION BAR ==================== */}
      <header className="office-topbar no-print">
        <div className="topbar-left">
          <div
            className="app-brand"
            style={{ cursor: 'pointer' }}
            onClick={() => setWorkspaceMode('bento')}
            title="Open Bento Command Dashboard"
          >
            <div className="brand-icon">
              <i className="fa-solid fa-file-word"></i>
            </div>
            <div className="brand-titles">
              <span className="brand-name">OmniWord Studio</span>
              <span className="brand-badge">Fluent 2 Glass • React + Vite</span>
            </div>
          </div>

          <div className="doc-title-box">
            <input
              type="text"
              className="doc-title-input"
              value={activeDoc?.title || ''}
              onChange={(e) => {
                const val = e.target.value;
                setDocuments((prev) =>
                  prev.map((d) => (d.id === activeDoc.id ? { ...d, title: val } : d))
                );
              }}
              title="Click to rename active Word Document"
            />
            <span
              className="autosave-pill"
              title={
                isBackendAvailable
                  ? 'Connected to local Python SQLite backend'
                  : 'Saved locally in browser storage'
              }
            >
              <i
                className={
                  isBackendAvailable
                    ? 'fa-solid fa-cloud-arrow-up'
                    : 'fa-solid fa-hard-drive'
                }
              ></i>{' '}
              {isBackendAvailable ? 'Synced' : 'Saved locally'}
            </span>
          </div>
        </div>

        {/* Center Workspace Mode Switcher */}
        <nav className="workspace-mode-switcher">
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'bento' ? 'active' : ''}`}
            onClick={() => {
              flushEditorInput();
              setWorkspaceMode('bento');
            }}
          >
            <i className="fa-solid fa-table-cells-large"></i> Bento Hub
          </button>
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'word' ? 'active' : ''}`}
            onClick={() => setWorkspaceMode('word')}
          >
            <i className="fa-solid fa-file-word"></i> Word Studio
          </button>
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'notepad' ? 'active' : ''}`}
            onClick={() => {
              flushEditorInput();
              setWorkspaceMode('notepad');
            }}
          >
            <i className="fa-solid fa-note-sticky"></i> Super-Notepad
            <span className="mode-count-badge">{notes.length}</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'todo' ? 'active' : ''}`}
            onClick={() => {
              flushEditorInput();
              setWorkspaceMode('todo');
            }}
          >
            <i className="fa-solid fa-list-check"></i> To-Do &amp; Kanban
            <span className="mode-count-badge">{pendingTodosCount}</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'split' ? 'active' : ''}`}
            onClick={() => setWorkspaceMode('split')}
            title="View Word Processor, To-Do List, and Notepad side by side"
          >
            <i className="fa-solid fa-table-columns"></i> Split Studio
          </button>
        </nav>

        {/* Right Quick Actions & Live Atmosphere Theme Switcher */}
        <div className="topbar-right">
          <select
            className="atmosphere-topbar-select"
            value={atmosphere}
            onChange={(e) => {
              setAtmosphere(e.target.value);
              try {
                localStorage.setItem('omniword_atmosphere', e.target.value);
              } catch {}
              showToast(`Atmosphere changed to ${e.target.options[e.target.selectedIndex].text}`);
            }}
            title="Change Animated Mesh Color Atmosphere"
          >
            {ATMOSPHERE_THEMES.map((th) => (
              <option key={th.id} value={th.id}>
                {th.name}
              </option>
            ))}
          </select>

          <button
            type="button"
            className="topbar-btn explore-glow-btn"
            onClick={() => setShowFeatureGuide(true)}
            title="Understand and launch any feature (Ctrl+K)"
          >
            <i className="fa-solid fa-wand-magic-sparkles"></i> Explore (Ctrl+K)
          </button>
          <button
            type="button"
            className="topbar-btn template-btn"
            onClick={() => setShowTemplatesModal(true)}
            title="Browse Document Templates"
          >
            <i className="fa-solid fa-layer-group"></i> Templates
          </button>
          <button
            type="button"
            className="topbar-btn theme-toggle"
            onClick={() => setDarkChrome((d) => !d)}
            title="Toggle Dark / Light Workspace Surface"
          >
            <i className={darkChrome ? 'fa-solid fa-sun' : 'fa-solid fa-moon'}></i>
          </button>
        </div>
      </header>

      {/* ==================== INTERACTIVE QUICK-START FEATURE BANNER ==================== */}
      {showQuickBanner && !viewSettings.focusMode && (
        <div className="interactive-onboarding-strip no-print">
          <div className="onboarding-left">
            <span className="onboarding-tag">✨ Interactive Studios</span>
            <button type="button" onClick={() => setWorkspaceMode('bento')}>
              🏠 Bento Dashboard
            </button>
            <button type="button" onClick={() => setShowChartModal(true)}>
              📊 Insert Chart (Chart.js)
            </button>
            <button type="button" onClick={() => setShowEquationModal(true)}>
              ∑ Math Equation (KaTeX)
            </button>
            <button type="button" onClick={() => setShowDiagramModal(true)}>
              🔀 Flowchart (Mermaid)
            </button>
            <button type="button" onClick={() => setShowDrawingModal(true)}>
              🎨 Freehand Draw / Sign
            </button>
            <button type="button" onClick={() => setWorkspaceMode('notepad')}>
              🐍 Python Notepad
            </button>
          </div>
          <button
            type="button"
            className="onboarding-dismiss"
            onClick={() => setShowQuickBanner(false)}
            title="Dismiss Quick-Start Bar"
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================== MICROSOFT WORD RIBBON TOOLBAR ==================== */}
      {(workspaceMode === 'word' || workspaceMode === 'split') && !viewSettings.focusMode && (
        <RibbonToolbar
          activeTab={activeRibbonTab}
          setActiveTab={setActiveRibbonTab}
          onCommand={execWordCommand}
          onApplyFontSizePt={handleApplyFontSizePt}
          onApplyStylePreset={handleApplyStylePreset}
          onChangeCase={handleChangeCase}
          onInsertTable={handleInsertTable}
          onInsertCallout={handleInsertCallout}
          onInsertChecklist={handleInsertChecklist}
          onInsertImage={handleInsertImage}
          onInsertLink={handleInsertLink}
          onInsertSymbol={handleInsertSymbol}
          onInsertDateTime={handleInsertDateTime}
          onInsertPageBreak={handleInsertPageBreak}
          onInsertCoverPage={handleInsertCoverPage}
          onInsertTableOfContents={handleInsertTableOfContents}
          onInsertSignature={handleInsertSignature}
          onInsertTodosIntoDoc={handleInsertTodosIntoWord}
          onInsertNoteIntoDoc={() => handleInsertNoteIntoWord()}
          onOpenChartModal={() => setShowChartModal(true)}
          onOpenEquationModal={() => setShowEquationModal(true)}
          onOpenDiagramModal={() => setShowDiagramModal(true)}
          onOpenDrawingModal={() => setShowDrawingModal(true)}
          onOpenFeatureGuide={() => setShowFeatureGuide(true)}
          pageSettings={pageSettings}
          setPageSettings={setPageSettings}
          viewSettings={viewSettings}
          setViewSettings={setViewSettings}
          onExportDocx={() => {
            flushEditorInput();
            exportToDocx(activeDoc.title, activeDoc.content, pageSettings);
            fireCelebrationConfetti();
            showToast(`Exported "${activeDoc.title}.docx" (Microsoft Word)`);
          }}
          onExportDoc={() => {
            flushEditorInput();
            exportToDoc(activeDoc.title, activeDoc.content, pageSettings);
            fireCelebrationConfetti();
            showToast(`Exported "${activeDoc.title}.doc" (Word 97-2003)`);
          }}
          onExportPdf={async () => {
            flushEditorInput();
            showToast('Generating PDF document...');
            await exportToPdf(activeDoc.title, activeDoc.content, pageSettings);
            fireCelebrationConfetti();
            showToast(`Exported "${activeDoc.title}.pdf"`);
          }}
          onExportHtml={() => {
            flushEditorInput();
            exportToHtmlFile(activeDoc.title, activeDoc.content, pageSettings);
            showToast(`Exported "${activeDoc.title}.html"`);
          }}
          onExportTxt={() => {
            flushEditorInput();
            exportToTxtFile(activeDoc.title, activeDoc.content);
            showToast(`Exported "${activeDoc.title}.txt"`);
          }}
          onExportMd={() => {
            flushEditorInput();
            exportToMarkdownFile(activeDoc.title, activeDoc.content);
            showToast(`Exported "${activeDoc.title}.md"`);
          }}
          onPrint={() => {
            flushEditorInput();
            printDocument(activeDoc.title, activeDoc.content, pageSettings);
          }}
          onNewDocument={createBlankDocument}
          onOpenTemplatesModal={() => setShowTemplatesModal(true)}
          onOpenFindReplace={() => setShowFindReplace((s) => !s)}
          onOpenWordCountModal={() => setShowWordCountModal(true)}
          onImportFile={handleImportFile}
          isSpeaking={isSpeaking}
          onToggleSpeak={handleToggleSpeak}
          isDictating={isDictating}
          onToggleDictation={handleToggleDictation}
          formatPainterActive={formatPainterActive}
          onToggleFormatPainter={handleToggleFormatPainter}
          onAddComment={handleAddComment}
        />
      )}

      {/* ==================== FIND & REPLACE FLOATING BAR ==================== */}
      {showFindReplace && (workspaceMode === 'word' || workspaceMode === 'split') && (
        <div className="find-replace-bar no-print">
          <div className="find-group">
            <i className="fa-solid fa-magnifying-glass"></i>
            <input
              type="text"
              placeholder="Find in document..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
            />
          </div>
          <div className="find-group">
            <i className="fa-solid fa-pen"></i>
            <input
              type="text"
              placeholder="Replace with..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
            />
          </div>
          <label className="find-case-toggle">
            <input
              type="checkbox"
              checked={matchCase}
              onChange={(e) => setMatchCase(e.target.checked)}
            />
            Match case
          </label>
          <button type="button" className="find-btn" onClick={() => handleReplace(false)}>
            Replace
          </button>
          <button type="button" className="find-btn primary" onClick={() => handleReplace(true)}>
            Replace All
          </button>
          <button
            type="button"
            className="find-close-btn"
            onClick={() => setShowFindReplace(false)}
          >
            ✕
          </button>
        </div>
      )}

      {/* ==================== MAIN WORKSPACE AREA ==================== */}
      <main className="studio-main-container">
        {(workspaceMode === 'word' || workspaceMode === 'split') && (
          <div className="word-studio-layout">
            {/* Left Document Navigation & Outline Pane */}
            {viewSettings.showOutline && !viewSettings.focusMode && (
              <aside className="word-left-nav no-print">
                <div className="nav-section">
                  <div className="nav-section-header">
                    <span>MY WORD FILES ({documents.length})</span>
                    <button
                      type="button"
                      onClick={createBlankDocument}
                      title="New Blank Document"
                    >
                      <i className="fa-solid fa-plus"></i>
                    </button>
                  </div>
                  <div className="doc-files-list">
                    {documents.map((doc) => (
                      <div
                        key={doc.id}
                        className={`doc-file-item ${doc.id === activeDoc.id ? 'active' : ''}`}
                        onClick={() => {
                          flushEditorInput();
                          setActiveDocId(doc.id);
                        }}
                      >
                        <i className="fa-solid fa-file-word"></i>
                        <span className="doc-file-title">{doc.title}</span>
                        {documents.length > 1 && (
                          <button
                            type="button"
                            className="doc-file-del"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteDocument(doc.id);
                            }}
                            title="Delete Document"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="nav-section">
                  <div className="nav-section-header">
                    <span>DOCUMENT OUTLINE</span>
                  </div>
                  <div className="doc-outline-list">
                    {outlineHeadings.length === 0 ? (
                      <p className="nav-empty-hint">
                        Add Heading 1, 2, or 3 styles to see a clickable document outline here.
                      </p>
                    ) : (
                      outlineHeadings.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          className={`outline-link level-${h.tag}`}
                          onClick={() => {
                            if (!editorRef.current) return;
                            const targets = editorRef.current.querySelectorAll('h1, h2, h3');
                            targets[h.index]?.scrollIntoView({
                              behavior: 'smooth',
                              block: 'center',
                            });
                          }}
                        >
                          {h.text}
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {activeDoc.comments && activeDoc.comments.length > 0 && (
                  <div className="nav-section">
                    <div className="nav-section-header">
                      <span>COMMENTS ({activeDoc.comments.length})</span>
                    </div>
                    <div className="doc-comments-list">
                      {activeDoc.comments.map((c) => (
                        <div key={c.id} className="doc-comment-card">
                          <div className="comment-meta">
                            <strong>{c.author}</strong>
                            <small>{c.createdAt}</small>
                          </div>
                          <p>{c.text}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </aside>
            )}

            {/* Center Word Viewport (Ruler + Paper Canvas) */}
            <section className="word-canvas-viewport">
              {viewSettings.focusMode && (
                <button
                  type="button"
                  className="exit-focus-btn no-print"
                  onClick={() =>
                    setViewSettings((prev) => ({ ...prev, focusMode: false }))
                  }
                >
                  <i className="fa-solid fa-compress"></i> Exit Focus Mode
                </button>
              )}

              {viewSettings.showRuler && viewSettings.layoutMode === 'print' && (
                <div className="word-horizontal-ruler no-print">
                  <div className="ruler-track">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((inch) => (
                      <div key={inch} className="ruler-inch">
                        <span className="inch-num">{inch}</span>
                        <span className="tick quarter"></span>
                        <span className="tick half"></span>
                        <span className="tick three-quarter"></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="word-paper-desk">
                <div
                  className={`word-paper-sheet ${
                    viewSettings.showGridlines ? 'gridlines-on' : ''
                  } ${viewSettings.layoutMode === 'web' ? 'web-mode' : 'print-mode'}`}
                  style={getPaperStyle()}
                >
                  {pageSettings.watermark && (
                    <div className="page-watermark-overlay">
                      {pageSettings.watermark}
                    </div>
                  )}

                  {pageSettings.headerText && (
                    <div
                      className="page-running-header"
                      title="Edit header text in Design & Layout tab"
                    >
                      <span>{pageSettings.headerText}</span>
                      <span>{activeDoc.title}</span>
                    </div>
                  )}

                  <div
                    ref={editorRef}
                    className={`word-editable-body cols-${pageSettings.columns}`}
                    contentEditable
                    suppressContentEditableWarning
                    spellCheck={viewSettings.spellCheck}
                    onInput={handleEditorInput}
                    onClick={handleEditorClick}
                  />

                  {pageSettings.footerText && (
                    <div
                      className="page-running-footer"
                      title="Edit footer text in Design & Layout tab"
                    >
                      <span>{pageSettings.footerText}</span>
                      <span>Page 1 of {stats.pages}</span>
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Right Productivity Dock */}
            {(viewSettings.showProductivityDock || workspaceMode === 'split') &&
              !viewSettings.focusMode && (
                <aside
                  className={`word-productivity-dock no-print ${
                    workspaceMode === 'split' ? 'wide-split-dock' : ''
                  }`}
                >
                  <div className="dock-tabs-header">
                    <button
                      type="button"
                      className={`dock-tab-btn ${dockTab === 'todo' ? 'active' : ''}`}
                      onClick={() => setDockTab('todo')}
                    >
                      <i className="fa-solid fa-list-check"></i> To-Do List (
                      {pendingTodosCount})
                    </button>
                    <button
                      type="button"
                      className={`dock-tab-btn ${dockTab === 'notepad' ? 'active' : ''}`}
                      onClick={() => setDockTab('notepad')}
                    >
                      <i className="fa-solid fa-note-sticky"></i> Super-Notepad ({notes.length})
                    </button>
                    {workspaceMode !== 'split' && (
                      <button
                        type="button"
                        className="dock-close-btn"
                        onClick={() =>
                          setViewSettings((prev) => ({
                            ...prev,
                            showProductivityDock: false,
                          }))
                        }
                        title="Hide Productivity Dock"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <div className="dock-body">
                    {dockTab === 'todo' ? (
                      <TodoManager
                        todos={todos}
                        onAddTodo={handleAddTodo}
                        onToggleTodo={handleToggleTodo}
                        onDeleteTodo={handleDeleteTodo}
                        onUpdateTodo={handleUpdateTodo}
                        onClearCompleted={handleClearCompletedTodos}
                        onInsertTodosIntoWord={handleInsertTodosIntoWord}
                        onOpenTodosAsWordDoc={handleOpenTodosAsWordDoc}
                        compact={true}
                      />
                    ) : (
                      <NotepadWorkspace
                        notes={notes}
                        activeNoteId={activeNoteId}
                        setActiveNoteId={setActiveNoteId}
                        onCreateNote={handleCreateNote}
                        onUpdateNote={handleUpdateNote}
                        onDeleteNote={handleDeleteNote}
                        onInsertNoteIntoWord={handleInsertNoteIntoWord}
                        onConvertNoteToWordDoc={handleConvertNoteToWordDoc}
                        onExtractTodosFromNote={handleExtractTodosFromNote}
                        compact={true}
                      />
                    )}
                  </div>
                </aside>
              )}
          </div>
        )}

        {/* MODE 2: FULL-PAGE TO-DO & KANBAN WORKSPACE */}
        {workspaceMode === 'todo' && (
          <div className="standalone-workspace-container">
            <TodoManager
              todos={todos}
              onAddTodo={handleAddTodo}
              onToggleTodo={handleToggleTodo}
              onDeleteTodo={handleDeleteTodo}
              onUpdateTodo={handleUpdateTodo}
              onClearCompleted={handleClearCompletedTodos}
              onInsertTodosIntoWord={handleInsertTodosIntoWord}
              onOpenTodosAsWordDoc={handleOpenTodosAsWordDoc}
              compact={false}
            />
          </div>
        )}

        {/* MODE 3: FULL-PAGE SUPER-NOTEPAD WORKSPACE */}
        {workspaceMode === 'notepad' && (
          <div className="standalone-workspace-container">
            <NotepadWorkspace
              notes={notes}
              activeNoteId={activeNoteId}
              setActiveNoteId={setActiveNoteId}
              onCreateNote={handleCreateNote}
              onUpdateNote={handleUpdateNote}
              onDeleteNote={handleDeleteNote}
              onInsertNoteIntoWord={handleInsertNoteIntoWord}
              onInsertRawHtmlIntoWord={(html) => {
                insertHtmlAtCursor(html);
                setWorkspaceMode('word');
                showToast('Inserted content into Word Document!');
              }}
              onConvertNoteToWordDoc={handleConvertNoteToWordDoc}
              onExtractTodosFromNote={handleExtractTodosFromNote}
              compact={false}
            />
          </div>
        )}

        {/* MODE 0: BENTO COMMAND DASHBOARD & ATMOSPHERE STUDIO */}
        {workspaceMode === 'bento' && (
          <div className="standalone-workspace-container">
            <BentoDashboard
              documents={documents}
              todos={todos}
              notes={notes}
              atmosphere={atmosphere}
              setAtmosphere={(id) => {
                setAtmosphere(id);
                try {
                  localStorage.setItem('omniword_atmosphere', id);
                } catch {}
              }}
              onSelectWorkspace={(mode) => {
                flushEditorInput();
                setWorkspaceMode(mode);
              }}
              onOpenDocument={(id) => {
                flushEditorInput();
                setActiveDocId(id);
              }}
              onCreateBlankDoc={createBlankDocument}
              onOpenTemplates={() => setShowTemplatesModal(true)}
              onToggleTodo={handleToggleTodo}
              onExportDocx={(doc) => {
                flushEditorInput();
                exportToDocx(doc.title, doc.content, pageSettings);
                fireCelebrationConfetti();
                showToast(`Exported "${doc.title}.docx"`);
              }}
              onExportPdf={async (doc) => {
                flushEditorInput();
                await exportToPdf(doc.title, doc.content, pageSettings);
                fireCelebrationConfetti();
                showToast(`Exported "${doc.title}.pdf"`);
              }}
            />
          </div>
        )}
      </main>

      {/* ==================== MICROSOFT WORD BOTTOM STATUS BAR ==================== */}
      <footer className="office-statusbar no-print">
        <div className="statusbar-left">
          <span className="status-item">
            <i className="fa-regular fa-file-lines"></i> Page 1 of {stats.pages}
          </span>
          <button
            type="button"
            className="status-item clickable"
            onClick={() => setShowWordCountModal(true)}
            title="Click for detailed Word Count & Statistics"
          >
            <i className="fa-solid fa-calculator"></i> {stats.words} words •{' '}
            {stats.charsWithSpaces} chars
          </button>
          <span className="status-item">
            <i className="fa-regular fa-clock"></i> ~{stats.readingMins} min read
          </span>
          <span className="status-item">
            <i className="fa-solid fa-check-double"></i> Tasks: {doneTodosCount}/{todos.length} done
          </span>
        </div>

        <div className="statusbar-right">
          <div className="status-layout-btns">
            <button
              type="button"
              className={viewSettings.layoutMode === 'print' ? 'active' : ''}
              onClick={() => {
                setWorkspaceMode('word');
                setViewSettings((prev) => ({ ...prev, layoutMode: 'print' }));
              }}
              title="Print Layout"
            >
              <i className="fa-regular fa-file-word"></i>
            </button>
            <button
              type="button"
              className={viewSettings.layoutMode === 'web' ? 'active' : ''}
              onClick={() => {
                setWorkspaceMode('word');
                setViewSettings((prev) => ({ ...prev, layoutMode: 'web' }));
              }}
              title="Web Layout"
            >
              <i className="fa-solid fa-globe"></i>
            </button>
            <button
              type="button"
              className={viewSettings.showProductivityDock ? 'active' : ''}
              onClick={() =>
                setViewSettings((prev) => ({
                  ...prev,
                  showProductivityDock: !prev.showProductivityDock,
                }))
              }
              title="Toggle To-Do & Notepad Sidebar"
            >
              <i className="fa-solid fa-table-columns"></i>
            </button>
          </div>

          <div className="status-zoom-controls">
            <button
              type="button"
              onClick={() =>
                setViewSettings((prev) => ({
                  ...prev,
                  zoom: Math.max(50, prev.zoom - 10),
                }))
              }
            >
              −
            </button>
            <input
              type="range"
              min="50"
              max="200"
              step="10"
              value={viewSettings.zoom}
              onChange={(e) =>
                setViewSettings((prev) => ({
                  ...prev,
                  zoom: Number(e.target.value),
                }))
              }
            />
            <button
              type="button"
              onClick={() =>
                setViewSettings((prev) => ({
                  ...prev,
                  zoom: Math.min(200, prev.zoom + 10),
                }))
              }
            >
              +
            </button>
            <span className="zoom-pct">{viewSettings.zoom}%</span>
          </div>
        </div>
      </footer>

      {/* ==================== INTERACTIVE MODALS ==================== */}
      {showChartModal && (
        <ChartBuilderModal
          onClose={() => setShowChartModal(false)}
          onInsertChartHtml={(html) => {
            insertHtmlAtCursor(html);
            showToast('Inserted Chart.js visualization into Word document!');
          }}
        />
      )}

      {showEquationModal && (
        <EquationBuilderModal
          onClose={() => setShowEquationModal(false)}
          onInsertEquationHtml={(html) => {
            insertHtmlAtCursor(html);
            showToast('Inserted KaTeX mathematical equation into Word document!');
          }}
        />
      )}

      {showDiagramModal && (
        <DiagramBuilderModal
          onClose={() => setShowDiagramModal(false)}
          onInsertDiagramHtml={(html) => {
            insertHtmlAtCursor(html);
            showToast('Inserted Mermaid flowchart diagram into Word document!');
          }}
        />
      )}

      {showDrawingModal && (
        <DrawingCanvasModal
          onClose={() => setShowDrawingModal(false)}
          onInsertDrawingHtml={(html) => {
            insertHtmlAtCursor(html);
            showToast('Inserted freehand drawing / signature into Word document!');
          }}
        />
      )}

      {showFeatureGuide && (
        <FeatureGuideModal
          onClose={() => setShowFeatureGuide(false)}
          onTriggerFeature={handleTriggerFeatureFromGuide}
        />
      )}

      {/* ==================== TEMPLATES MODAL ==================== */}
      {showTemplatesModal && (
        <div className="modal-backdrop" onClick={() => setShowTemplatesModal(false)}>
          <div className="modal-card wide" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-layer-group" style={{ color: '#2563eb' }}></i>{' '}
                Microsoft Word Document Templates
              </h3>
              <button type="button" onClick={() => setShowTemplatesModal(false)}>
                ✕
              </button>
            </div>
            <div className="templates-grid">
              {DOCUMENT_TEMPLATES.map((tpl) => (
                <div
                  key={tpl.id}
                  className="template-card"
                  onClick={() => createDocumentFromTemplate(tpl)}
                >
                  <div className="template-icon">
                    <i className={tpl.icon}></i>
                  </div>
                  <span className="template-cat">{tpl.category}</span>
                  <h4>{tpl.name}</h4>
                  <p>{tpl.description}</p>
                  <button type="button" className="template-use-btn">
                    Create Document
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================== WORD COUNT & ANALYTICS MODAL ==================== */}
      {showWordCountModal && (
        <div className="modal-backdrop" onClick={() => setShowWordCountModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <i className="fa-solid fa-chart-pie" style={{ color: '#2563eb' }}></i>{' '}
                Document Statistics
              </h3>
              <button type="button" onClick={() => setShowWordCountModal(false)}>
                ✕
              </button>
            </div>
            <div className="stats-table-list">
              <div className="stat-row">
                <span>Document Title</span>
                <strong>{activeDoc.title}</strong>
              </div>
              <div className="stat-row">
                <span>Estimated Pages</span>
                <strong>{stats.pages}</strong>
              </div>
              <div className="stat-row">
                <span>Words</span>
                <strong>{stats.words}</strong>
              </div>
              <div className="stat-row">
                <span>Characters (no spaces)</span>
                <strong>{stats.charsNoSpaces}</strong>
              </div>
              <div className="stat-row">
                <span>Characters (with spaces)</span>
                <strong>{stats.charsWithSpaces}</strong>
              </div>
              <div className="stat-row">
                <span>Paragraphs / Blocks</span>
                <strong>{stats.paragraphs}</strong>
              </div>
              <div className="stat-row">
                <span>Estimated Reading Time</span>
                <strong>~{stats.readingMins} min</strong>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TOAST NOTIFICATION ==================== */}
      {toast && (
        <div className="studio-toast no-print">
          <i className="fa-solid fa-circle-check"></i>
          <span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}
