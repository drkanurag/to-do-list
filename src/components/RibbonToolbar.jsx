import React, { useState } from 'react';

const FONT_FAMILIES = [
  { label: 'Calibri (Body)', value: 'Calibri, Candara, Segoe, Optima, Arial, sans-serif' },
  { label: 'Inter (Modern)', value: 'Inter, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: "'Times New Roman', Times, serif" },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Garamond', value: 'Garamond, Baskerville, serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Trebuchet MS', value: "'Trebuchet MS', Helvetica, sans-serif" },
  { label: 'Courier New', value: "'Courier New', Courier, monospace" },
  { label: 'Consolas (Code)', value: 'Consolas, Monaco, monospace' },
  { label: 'Segoe UI', value: "'Segoe UI', Tahoma, Geneva, sans-serif" },
  { label: 'Comic Sans MS', value: "'Comic Sans MS', cursive, sans-serif" },
];

const FONT_SIZES = [
  { label: '8 pt', cmdValue: '1', pt: '8pt' },
  { label: '9 pt', cmdValue: '1', pt: '9pt' },
  { label: '10 pt', cmdValue: '2', pt: '10pt' },
  { label: '11 pt', cmdValue: '3', pt: '11pt' },
  { label: '12 pt', cmdValue: '3', pt: '12pt' },
  { label: '14 pt', cmdValue: '4', pt: '14pt' },
  { label: '16 pt', cmdValue: '4', pt: '16pt' },
  { label: '18 pt', cmdValue: '5', pt: '18pt' },
  { label: '20 pt', cmdValue: '5', pt: '20pt' },
  { label: '24 pt', cmdValue: '6', pt: '24pt' },
  { label: '28 pt', cmdValue: '6', pt: '28pt' },
  { label: '36 pt', cmdValue: '7', pt: '36pt' },
  { label: '48 pt', cmdValue: '7', pt: '48pt' },
];

const QUICK_STYLES = [
  { id: 'normal', name: 'Normal', tag: 'p', previewStyle: { fontSize: '12px', fontWeight: '400', color: '#1e293b' } },
  { id: 'title', name: 'Title', tag: 'h1', previewStyle: { fontSize: '16px', fontWeight: '800', color: '#0f172a' } },
  { id: 'h1', name: 'Heading 1', tag: 'h1', previewStyle: { fontSize: '15px', fontWeight: '700', color: '#1e3a8a' } },
  { id: 'h2', name: 'Heading 2', tag: 'h2', previewStyle: { fontSize: '13px', fontWeight: '600', color: '#1d4ed8' } },
  { id: 'h3', name: 'Heading 3', tag: 'h3', previewStyle: { fontSize: '12px', fontWeight: '600', color: '#334155' } },
  { id: 'quote', name: 'Quote', tag: 'blockquote', previewStyle: { fontSize: '12px', fontStyle: 'italic', color: '#2563eb' } },
  { id: 'code', name: 'Code Block', tag: 'pre', previewStyle: { fontSize: '11px', fontFamily: 'monospace', color: '#0f172a' } },
];

const SPECIAL_SYMBOLS = [
  '©', '®', '™', '§', '¶', '•', '†', '‡', '€', '£', '¥', '₹', '¢',
  '±', '×', '÷', '≠', '≈', '≤', '≥', '∞', '∑', '∏', '√', '∫', 'Δ',
  'π', 'Ω', 'μ', 'α', 'β', 'γ', '→', '←', '↑', '↓', '↔', '⇒', '✓',
  '✔', '✗', '✘', '★', '☆', '♠', '♣', '♥', '♦', '⚡', '📌', '📝', '✅', '⚠️', '💡'
];

export default function RibbonToolbar({
  activeTab,
  setActiveTab,
  onCommand,
  onApplyFontSizePt,
  onApplyStylePreset,
  onChangeCase,
  onInsertTable,
  onInsertCallout,
  onInsertChecklist,
  onInsertImage,
  onInsertLink,
  onInsertSymbol,
  onInsertDateTime,
  onInsertPageBreak,
  onInsertCoverPage,
  onInsertSignature,
  onInsertTableOfContents,
  onInsertTodosIntoDoc,
  onInsertNoteIntoDoc,
  onOpenChartModal,
  onOpenEquationModal,
  onOpenDiagramModal,
  onOpenDrawingModal,
  onOpenFeatureGuide,
  pageSettings,
  setPageSettings,
  viewSettings,
  setViewSettings,
  onExportDocx,
  onExportDoc,
  onExportPdf,
  onExportHtml,
  onExportTxt,
  onExportMd,
  onPrint,
  onNewDocument,
  onOpenTemplatesModal,
  onOpenFindReplace,
  onOpenWordCountModal,
  onImportFile,
  isSpeaking,
  onToggleSpeak,
  isDictating,
  onToggleDictation,
  formatPainterActive,
  onToggleFormatPainter,
  onAddComment,
}) {
  const [tableRows, setTableRows] = useState(3);
  const [tableCols, setTableCols] = useState(3);
  const [showSymbolPicker, setShowSymbolPicker] = useState(false);
  const [textColor, setTextColor] = useState('#1d4ed8');
  const [highlightColor, setHighlightColor] = useState('#fef08a');

  const tabs = [
    { id: 'file', label: 'File', icon: 'fa-solid fa-folder-open' },
    { id: 'home', label: 'Home', icon: 'fa-solid fa-pen-nib' },
    { id: 'insert', label: 'Insert & Studios', icon: 'fa-solid fa-circle-plus' },
    { id: 'layout', label: 'Design & Layout', icon: 'fa-solid fa-sliders' },
    { id: 'review', label: 'Review & Voice', icon: 'fa-solid fa-spell-check' },
    { id: 'view', label: 'View', icon: 'fa-solid fa-eye' },
  ];

  return (
    <div className="word-ribbon-container no-print">
      {/* Ribbon Top Tab Strip */}
      <div className="ribbon-tabs-bar">
        <div className="ribbon-tabs-left">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`ribbon-tab-btn ${activeTab === tab.id ? 'active' : ''} ${tab.id === 'file' ? 'file-tab' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <i className={tab.icon}></i>
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="ribbon-tabs-right">
          <button
            type="button"
            className="ribbon-quick-export-btn guide"
            onClick={onOpenFeatureGuide}
            title="Open Interactive Guide to explore and test all features"
          >
            <i className="fa-solid fa-compass"></i> All Features Guide
          </button>
          <button
            type="button"
            className="ribbon-quick-export-btn docx"
            onClick={onExportDocx}
            title="Download as Microsoft Word (.docx)"
          >
            <i className="fa-solid fa-file-word"></i> Export Word (.docx)
          </button>
          <button
            type="button"
            className="ribbon-quick-export-btn pdf"
            onClick={onExportPdf}
            title="Download as PDF Document (.pdf)"
          >
            <i className="fa-solid fa-file-pdf"></i> Export PDF (.pdf)
          </button>
          <button
            type="button"
            className="ribbon-quick-export-btn print"
            onClick={onPrint}
            title="Print or Save as Vector PDF"
          >
            <i className="fa-solid fa-print"></i>
          </button>
        </div>
      </div>

      {/* Ribbon Active Content Panel */}
      <div className="ribbon-panel">
        {/* ==================== FILE TAB ==================== */}
        {activeTab === 'file' && (
          <div className="ribbon-groups-row">
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn" onClick={onNewDocument}>
                  <i className="fa-solid fa-file-circle-plus" style={{ color: '#2563eb' }}></i>
                  <span>New Blank</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onOpenTemplatesModal}>
                  <i className="fa-solid fa-layer-group" style={{ color: '#7c3aed' }}></i>
                  <span>Templates</span>
                </button>
                <label className="ribbon-large-btn" style={{ cursor: 'pointer' }}>
                  <i className="fa-solid fa-file-import" style={{ color: '#059669' }}></i>
                  <span>Import File</span>
                  <input
                    type="file"
                    accept=".txt,.html,.htm,.md,.json"
                    style={{ display: 'none' }}
                    onChange={onImportFile}
                  />
                </label>
              </div>
              <div className="ribbon-group-title">Document</div>
            </div>

            <div className="ribbon-divider"></div>

            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn highlight-docx" onClick={onExportDocx}>
                  <i className="fa-solid fa-file-word" style={{ color: '#1d4ed8' }}></i>
                  <span>Word (.docx)</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onExportDoc}>
                  <i className="fa-solid fa-file-lines" style={{ color: '#2563eb' }}></i>
                  <span>Word 97 (.doc)</span>
                </button>
                <button type="button" className="ribbon-large-btn highlight-pdf" onClick={onExportPdf}>
                  <i className="fa-solid fa-file-pdf" style={{ color: '#dc2626' }}></i>
                  <span>PDF (.pdf)</span>
                </button>
              </div>
              <div className="ribbon-group-title">Primary Exports (Word &amp; PDF)</div>
            </div>

            <div className="ribbon-divider"></div>

            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn" onClick={onExportHtml}>
                  <i className="fa-brands fa-html5" style={{ color: '#ea580c' }}></i>
                  <span>Web (.html)</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onExportMd}>
                  <i className="fa-brands fa-markdown" style={{ color: '#0f172a' }}></i>
                  <span>Markdown (.md)</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onExportTxt}>
                  <i className="fa-regular fa-file-lines" style={{ color: '#475569' }}></i>
                  <span>Notepad (.txt)</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onPrint}>
                  <i className="fa-solid fa-print" style={{ color: '#0284c7' }}></i>
                  <span>Print / PDF</span>
                </button>
              </div>
              <div className="ribbon-group-title">Other Formats &amp; Print</div>
            </div>
          </div>
        )}

        {/* ==================== HOME TAB ==================== */}
        {activeTab === 'home' && (
          <div className="ribbon-groups-row">
            {/* Clipboard & History */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <div className="ribbon-col-stack">
                  <button type="button" className="ribbon-sm-btn" onClick={() => onCommand('undo')} title="Undo (Ctrl+Z)">
                    <i className="fa-solid fa-rotate-left"></i> Undo
                  </button>
                  <button type="button" className="ribbon-sm-btn" onClick={() => onCommand('redo')} title="Redo (Ctrl+Y)">
                    <i className="fa-solid fa-rotate-right"></i> Redo
                  </button>
                </div>
                <div className="ribbon-col-stack">
                  <button
                    type="button"
                    className={`ribbon-sm-btn ${formatPainterActive ? 'active' : ''}`}
                    onClick={onToggleFormatPainter}
                    title="Copy formatting from selection and apply to another"
                  >
                    <i className="fa-solid fa-paint-roller"></i> Painter
                  </button>
                  <button
                    type="button"
                    className="ribbon-sm-btn"
                    onClick={() => onCommand('removeFormat')}
                    title="Clear All Formatting"
                  >
                    <i className="fa-solid fa-eraser"></i> Clear
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Clipboard</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Font Group */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls vertical">
                <div className="ribbon-row">
                  <select
                    className="ribbon-select font-family-select"
                    value={pageSettings.fontFamily}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPageSettings((prev) => ({ ...prev, fontFamily: val }));
                      onCommand('fontName', val);
                    }}
                    title="Font Family"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.label} value={f.value} style={{ fontFamily: f.value }}>
                        {f.label}
                      </option>
                    ))}
                  </select>

                  <select
                    className="ribbon-select font-size-select"
                    defaultValue="11pt"
                    onChange={(e) => onApplyFontSizePt(e.target.value)}
                    title="Font Size"
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s.pt} value={s.pt}>
                        {s.label}
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onApplyFontSizePt('increase')}
                    title="Increase Font Size"
                  >
                    <span style={{ fontWeight: 700, fontSize: '12px' }}>A▲</span>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onApplyFontSizePt('decrease')}
                    title="Decrease Font Size"
                  >
                    <span style={{ fontWeight: 700, fontSize: '11px' }}>A▼</span>
                  </button>

                  <select
                    className="ribbon-select case-select"
                    value=""
                    onChange={(e) => {
                      if (e.target.value) onChangeCase(e.target.value);
                    }}
                    title="Change Case"
                  >
                    <option value="" disabled>Aa</option>
                    <option value="UPPER">UPPERCASE</option>
                    <option value="lower">lowercase</option>
                    <option value="Title">Capitalize Each Word</option>
                    <option value="Sentence">Sentence case</option>
                  </select>
                </div>

                <div className="ribbon-row">
                  <button type="button" className="ribbon-icon-btn" onClick={() => onCommand('bold')} title="Bold (Ctrl+B)">
                    <i className="fa-solid fa-bold"></i>
                  </button>
                  <button type="button" className="ribbon-icon-btn" onClick={() => onCommand('italic')} title="Italic (Ctrl+I)">
                    <i className="fa-solid fa-italic"></i>
                  </button>
                  <button type="button" className="ribbon-icon-btn" onClick={() => onCommand('underline')} title="Underline (Ctrl+U)">
                    <i className="fa-solid fa-underline"></i>
                  </button>
                  <button type="button" className="ribbon-icon-btn" onClick={() => onCommand('strikeThrough')} title="Strikethrough">
                    <i className="fa-solid fa-strikethrough"></i>
                  </button>
                  <button type="button" className="ribbon-icon-btn" onClick={() => onCommand('subscript')} title="Subscript">
                    <i className="fa-solid fa-subscript"></i>
                  </button>
                  <button type="button" className="ribbon-icon-btn" onClick={() => onCommand('superscript')} title="Superscript">
                    <i className="fa-solid fa-superscript"></i>
                  </button>

                  {/* Font Color */}
                  <div className="ribbon-color-picker-wrap" title="Text Color">
                    <button
                      type="button"
                      className="ribbon-icon-btn color-apply-btn"
                      onClick={() => onCommand('foreColor', textColor)}
                    >
                      <i className="fa-solid fa-font"></i>
                      <span className="color-bar" style={{ backgroundColor: textColor }}></span>
                    </button>
                    <input
                      type="color"
                      value={textColor}
                      onChange={(e) => {
                        setTextColor(e.target.value);
                        onCommand('foreColor', e.target.value);
                      }}
                      className="ribbon-color-input"
                    />
                  </div>

                  {/* Highlight Color */}
                  <div className="ribbon-color-picker-wrap" title="Text Highlight Color">
                    <button
                      type="button"
                      className="ribbon-icon-btn color-apply-btn"
                      onClick={() => onCommand('hiliteColor', highlightColor)}
                    >
                      <i className="fa-solid fa-highlighter"></i>
                      <span className="color-bar" style={{ backgroundColor: highlightColor }}></span>
                    </button>
                    <input
                      type="color"
                      value={highlightColor}
                      onChange={(e) => {
                        setHighlightColor(e.target.value);
                        onCommand('hiliteColor', e.target.value);
                      }}
                      className="ribbon-color-input"
                    />
                  </div>
                </div>
              </div>
              <div className="ribbon-group-title">Font</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Paragraph Group */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls vertical">
                <div className="ribbon-row">
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('insertUnorderedList')}
                    title="Bullet List"
                  >
                    <i className="fa-solid fa-list-ul"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('insertOrderedList')}
                    title="Numbered List"
                  >
                    <i className="fa-solid fa-list-ol"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={onInsertChecklist}
                    title="Insert Interactive Checklist Item"
                  >
                    <i className="fa-solid fa-list-check"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('outdent')}
                    title="Decrease Indent"
                  >
                    <i className="fa-solid fa-outdent"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('indent')}
                    title="Increase Indent"
                  >
                    <i className="fa-solid fa-indent"></i>
                  </button>
                </div>

                <div className="ribbon-row">
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('justifyLeft')}
                    title="Align Left"
                  >
                    <i className="fa-solid fa-align-left"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('justifyCenter')}
                    title="Align Center"
                  >
                    <i className="fa-solid fa-align-center"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('justifyRight')}
                    title="Align Right"
                  >
                    <i className="fa-solid fa-align-right"></i>
                  </button>
                  <button
                    type="button"
                    className="ribbon-icon-btn"
                    onClick={() => onCommand('justifyFull')}
                    title="Justify"
                  >
                    <i className="fa-solid fa-align-justify"></i>
                  </button>

                  <select
                    className="ribbon-select spacing-select"
                    value={pageSettings.lineSpacing}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, lineSpacing: e.target.value }))
                    }
                    title="Line & Paragraph Spacing"
                  >
                    <option value="1.15">↕ 1.15</option>
                    <option value="1.35">↕ 1.35</option>
                    <option value="1.5">↕ 1.50</option>
                    <option value="1.75">↕ 1.75</option>
                    <option value="2.0">↕ 2.00</option>
                  </select>
                </div>
              </div>
              <div className="ribbon-group-title">Paragraph</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Quick Styles Gallery */}
            <div className="ribbon-group">
              <div className="ribbon-styles-gallery">
                {QUICK_STYLES.map((st) => (
                  <button
                    key={st.id}
                    type="button"
                    className="ribbon-style-card"
                    onClick={() => onApplyStylePreset(st.id)}
                    title={`Apply ${st.name} style`}
                  >
                    <span style={st.previewStyle}>AaBbCc</span>
                    <small>{st.name}</small>
                  </button>
                ))}
              </div>
              <div className="ribbon-group-title">Styles</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Editing & Voice Group */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <div className="ribbon-col-stack">
                  <button type="button" className="ribbon-sm-btn" onClick={onOpenFindReplace}>
                    <i className="fa-solid fa-magnifying-glass"></i> Find &amp; Replace
                  </button>
                  <button
                    type="button"
                    className={`ribbon-sm-btn ${isDictating ? 'active' : ''}`}
                    onClick={onToggleDictation}
                    title="Voice Dictation (Speech-to-Text into Word)"
                  >
                    <i className="fa-solid fa-microphone" style={{ color: '#dc2626' }}></i>{' '}
                    {isDictating ? 'Listening...' : 'Voice Dictate'}
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Editing &amp; Voice</div>
            </div>
          </div>
        )}

        {/* ==================== INSERT & STUDIOS TAB ==================== */}
        {activeTab === 'insert' && (
          <div className="ribbon-groups-row">
            {/* Pages & TOC */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn" onClick={onInsertCoverPage}>
                  <i className="fa-solid fa-book-open" style={{ color: '#2563eb' }}></i>
                  <span>Cover Page</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onInsertTableOfContents}>
                  <i className="fa-solid fa-list-ol" style={{ color: '#7c3aed' }}></i>
                  <span>Auto TOC</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onInsertPageBreak}>
                  <i className="fa-solid fa-scissors" style={{ color: '#64748b' }}></i>
                  <span>Page Break</span>
                </button>
              </div>
              <div className="ribbon-group-title">Pages &amp; TOC</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Interactive Studios: Chart.js, KaTeX, Mermaid, Freehand Draw */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button
                  type="button"
                  className="ribbon-large-btn highlight-docx"
                  onClick={onOpenChartModal}
                  title="Open Interactive Chart.js Builder (Bar, Line, Pie, Doughnut, Radar)"
                >
                  <i className="fa-solid fa-chart-column" style={{ color: '#2563eb' }}></i>
                  <span>Chart Studio</span>
                </button>
                <button
                  type="button"
                  className="ribbon-large-btn"
                  onClick={onOpenEquationModal}
                  title="Open LaTeX & Math Equation Builder (KaTeX)"
                >
                  <i className="fa-solid fa-square-root-variable" style={{ color: '#7c3aed' }}></i>
                  <span>Math / LaTeX</span>
                </button>
                <button
                  type="button"
                  className="ribbon-large-btn"
                  onClick={onOpenDiagramModal}
                  title="Open Flowchart & Sequence Diagram Studio (Mermaid.js)"
                >
                  <i className="fa-solid fa-diagram-project" style={{ color: '#059669' }}></i>
                  <span>Flowchart</span>
                </button>
                <button
                  type="button"
                  className="ribbon-large-btn"
                  onClick={onOpenDrawingModal}
                  title="Open Freehand Ink Drawing, Whiteboard & Signature Pad"
                >
                  <i className="fa-solid fa-paintbrush" style={{ color: '#db2777' }}></i>
                  <span>Draw / Sign</span>
                </button>
              </div>
              <div className="ribbon-group-title">Interactive Visual Studios</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Table Creator */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <div className="ribbon-table-creator">
                  <div className="ribbon-row" style={{ gap: '4px', alignItems: 'center' }}>
                    <label style={{ fontSize: '11px', color: '#475569' }}>R:</label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      value={tableRows}
                      onChange={(e) => setTableRows(Math.max(1, Number(e.target.value)))}
                      className="ribbon-num-input"
                    />
                    <label style={{ fontSize: '11px', color: '#475569' }}>C:</label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      value={tableCols}
                      onChange={(e) => setTableCols(Math.max(1, Number(e.target.value)))}
                      className="ribbon-num-input"
                    />
                  </div>
                  <button
                    type="button"
                    className="ribbon-sm-btn primary-tint"
                    onClick={() => onInsertTable(tableRows, tableCols)}
                  >
                    <i className="fa-solid fa-table"></i> Table ({tableRows}×{tableCols})
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Tables</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Illustrations & Blocks */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <label className="ribbon-large-btn" style={{ cursor: 'pointer' }}>
                  <i className="fa-regular fa-image" style={{ color: '#059669' }}></i>
                  <span>Picture</span>
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={onInsertImage}
                  />
                </label>

                <div className="ribbon-col-stack">
                  <button
                    type="button"
                    className="ribbon-sm-btn"
                    onClick={() => onInsertCallout('info')}
                  >
                    <i className="fa-solid fa-circle-info" style={{ color: '#2563eb' }}></i> Info Box
                  </button>
                  <button
                    type="button"
                    className="ribbon-sm-btn"
                    onClick={() => onInsertCallout('warning')}
                  >
                    <i className="fa-solid fa-triangle-exclamation" style={{ color: '#d97706' }}></i> Warning
                  </button>
                </div>

                <div className="ribbon-col-stack">
                  <button
                    type="button"
                    className="ribbon-sm-btn"
                    onClick={() => onInsertCallout('success')}
                  >
                    <i className="fa-solid fa-circle-check" style={{ color: '#16a34a' }}></i> Tip Box
                  </button>
                  <button
                    type="button"
                    className="ribbon-sm-btn"
                    onClick={() => onCommand('insertHorizontalRule')}
                  >
                    <i className="fa-solid fa-minus"></i> Divider
                  </button>
                </div>
              </div>
              <div className="ribbon-group-title">Media &amp; Callouts</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Productivity Widgets (To-Do & Notepad Integration) */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button
                  type="button"
                  className="ribbon-large-btn"
                  onClick={onInsertTodosIntoDoc}
                  title="Insert your current To-Do List table directly into this Word document"
                >
                  <i className="fa-solid fa-list-check" style={{ color: '#16a34a' }}></i>
                  <span>To-Do Table</span>
                </button>
                <button
                  type="button"
                  className="ribbon-large-btn"
                  onClick={onInsertNoteIntoDoc}
                  title="Insert your active Quick Notepad note into this Word document"
                >
                  <i className="fa-solid fa-note-sticky" style={{ color: '#eab308' }}></i>
                  <span>Notepad Note</span>
                </button>
              </div>
              <div className="ribbon-group-title">Workspace Sync</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Links, Symbols, Date & Signature */}
            <div className="ribbon-group" style={{ position: 'relative' }}>
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn" onClick={onInsertLink}>
                  <i className="fa-solid fa-link" style={{ color: '#2563eb' }}></i>
                  <span>Hyperlink</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onInsertDateTime}>
                  <i className="fa-regular fa-calendar-check" style={{ color: '#7c3aed' }}></i>
                  <span>Date/Time</span>
                </button>
                <button
                  type="button"
                  className="ribbon-large-btn"
                  onClick={() => setShowSymbolPicker((s) => !s)}
                >
                  <i className="fa-solid fa-omega" style={{ color: '#db2777' }}></i>
                  <span>Symbols</span>
                </button>
              </div>
              <div className="ribbon-group-title">Links &amp; Symbols</div>

              {showSymbolPicker && (
                <div className="symbol-picker-popover">
                  <div className="symbol-picker-header">
                    <span>Insert Special Symbol / Emoji</span>
                    <button type="button" onClick={() => setShowSymbolPicker(false)}>✕</button>
                  </div>
                  <div className="symbol-grid">
                    {SPECIAL_SYMBOLS.map((sym) => (
                      <button
                        key={sym}
                        type="button"
                        className="symbol-cell"
                        onClick={() => {
                          onInsertSymbol(sym);
                          setShowSymbolPicker(false);
                        }}
                      >
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== DESIGN & LAYOUT TAB ==================== */}
        {activeTab === 'layout' && (
          <div className="ribbon-groups-row">
            {/* Page Setup */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Margins</label>
                  <select
                    className="ribbon-select"
                    value={pageSettings.margins}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, margins: e.target.value }))
                    }
                  >
                    <option value="normal">Normal (1.0")</option>
                    <option value="narrow">Narrow (0.5")</option>
                    <option value="moderate">Moderate (0.75")</option>
                    <option value="wide">Wide (1.5")</option>
                  </select>
                </div>

                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Orientation</label>
                  <select
                    className="ribbon-select"
                    value={pageSettings.orientation}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, orientation: e.target.value }))
                    }
                  >
                    <option value="portrait">Portrait</option>
                    <option value="landscape">Landscape</option>
                  </select>
                </div>

                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Paper Size</label>
                  <select
                    className="ribbon-select"
                    value={pageSettings.pageSize}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, pageSize: e.target.value }))
                    }
                  >
                    <option value="a4">A4 (210 × 297 mm)</option>
                    <option value="letter">US Letter (8.5 × 11 in)</option>
                  </select>
                </div>

                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Columns</label>
                  <select
                    className="ribbon-select"
                    value={pageSettings.columns}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, columns: Number(e.target.value) }))
                    }
                  >
                    <option value={1}>1 Column</option>
                    <option value={2}>2 Columns</option>
                    <option value={3}>3 Columns</option>
                  </select>
                </div>
              </div>
              <div className="ribbon-group-title">Page Setup</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Page Background & Watermark */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Watermark</label>
                  <select
                    className="ribbon-select"
                    value={pageSettings.watermark}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, watermark: e.target.value }))
                    }
                  >
                    <option value="">None</option>
                    <option value="CONFIDENTIAL">CONFIDENTIAL</option>
                    <option value="DRAFT">DRAFT</option>
                    <option value="DO NOT COPY">DO NOT COPY</option>
                    <option value="URGENT">URGENT</option>
                    <option value="APPROVED">APPROVED</option>
                  </select>
                </div>

                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Page Color</label>
                  <div className="ribbon-row" style={{ gap: '4px' }}>
                    {['#ffffff', '#fefce8', '#f0f9ff', '#f8fafc', '#fdf2f8'].map((col) => (
                      <button
                        key={col}
                        type="button"
                        className={`page-color-swatch ${pageSettings.pageColor === col ? 'active' : ''}`}
                        style={{ backgroundColor: col }}
                        onClick={() => setPageSettings((prev) => ({ ...prev, pageColor: col }))}
                        title={`Page background ${col}`}
                      />
                    ))}
                  </div>
                </div>

                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Page Border</label>
                  <select
                    className="ribbon-select"
                    value={pageSettings.pageBorder}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, pageBorder: e.target.value }))
                    }
                  >
                    <option value="none">None</option>
                    <option value="solid">Classic Box Border</option>
                    <option value="double">Executive Double Line</option>
                    <option value="dashed">Dashed Frame</option>
                    <option value="accent">Royal Blue Frame</option>
                  </select>
                </div>
              </div>
              <div className="ribbon-group-title">Page Background</div>
            </div>

            <div className="ribbon-divider"></div>

            {/* Header & Footer Inputs */}
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Running Header Text</label>
                  <input
                    type="text"
                    className="ribbon-text-input"
                    placeholder="e.g., Q4 Strategic Report"
                    value={pageSettings.headerText}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, headerText: e.target.value }))
                    }
                  />
                </div>
                <div className="ribbon-col-stack">
                  <label className="ribbon-field-label">Running Footer Text</label>
                  <input
                    type="text"
                    className="ribbon-text-input"
                    placeholder="e.g., Page 1 • Internal Use Only"
                    value={pageSettings.footerText}
                    onChange={(e) =>
                      setPageSettings((prev) => ({ ...prev, footerText: e.target.value }))
                    }
                  />
                </div>
              </div>
              <div className="ribbon-group-title">Header &amp; Footer</div>
            </div>
          </div>
        )}

        {/* ==================== REVIEW & VOICE TAB ==================== */}
        {activeTab === 'review' && (
          <div className="ribbon-groups-row">
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn" onClick={onOpenWordCountModal}>
                  <i className="fa-solid fa-chart-pie" style={{ color: '#2563eb' }}></i>
                  <span>Word Count</span>
                </button>
                <button
                  type="button"
                  className={`ribbon-large-btn ${isSpeaking ? 'active-speaking' : ''}`}
                  onClick={onToggleSpeak}
                >
                  <i
                    className={isSpeaking ? 'fa-solid fa-volume-high' : 'fa-solid fa-headphones'}
                    style={{ color: isSpeaking ? '#dc2626' : '#059669' }}
                  ></i>
                  <span>{isSpeaking ? 'Stop Reading' : 'Read Aloud'}</span>
                </button>
                <button
                  type="button"
                  className={`ribbon-large-btn ${isDictating ? 'active-speaking' : ''}`}
                  onClick={onToggleDictation}
                >
                  <i className="fa-solid fa-microphone-lines" style={{ color: '#dc2626' }}></i>
                  <span>{isDictating ? 'Stop Mic' : 'Voice Dictate'}</span>
                </button>
                <button
                  type="button"
                  className={`ribbon-large-btn ${viewSettings.spellCheck ? 'active' : ''}`}
                  onClick={() =>
                    setViewSettings((prev) => ({ ...prev, spellCheck: !prev.spellCheck }))
                  }
                >
                  <i className="fa-solid fa-spell-check" style={{ color: '#7c3aed' }}></i>
                  <span>Spellcheck: {viewSettings.spellCheck ? 'ON' : 'OFF'}</span>
                </button>
              </div>
              <div className="ribbon-group-title">Proofing &amp; Voice Studio</div>
            </div>

            <div className="ribbon-divider"></div>

            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button type="button" className="ribbon-large-btn" onClick={onAddComment}>
                  <i className="fa-regular fa-comment-dots" style={{ color: '#d97706' }}></i>
                  <span>New Comment</span>
                </button>
                <button type="button" className="ribbon-large-btn" onClick={onOpenFindReplace}>
                  <i className="fa-solid fa-magnifying-glass" style={{ color: '#0284c7' }}></i>
                  <span>Find &amp; Replace</span>
                </button>
              </div>
              <div className="ribbon-group-title">Comments &amp; Review</div>
            </div>
          </div>
        )}

        {/* ==================== VIEW TAB ==================== */}
        {activeTab === 'view' && (
          <div className="ribbon-groups-row">
            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button
                  type="button"
                  className={`ribbon-large-btn ${viewSettings.layoutMode === 'print' ? 'active' : ''}`}
                  onClick={() => setViewSettings((prev) => ({ ...prev, layoutMode: 'print' }))}
                >
                  <i className="fa-regular fa-file-word" style={{ color: '#2563eb' }}></i>
                  <span>Print Layout</span>
                </button>
                <button
                  type="button"
                  className={`ribbon-large-btn ${viewSettings.layoutMode === 'web' ? 'active' : ''}`}
                  onClick={() => setViewSettings((prev) => ({ ...prev, layoutMode: 'web' }))}
                >
                  <i className="fa-solid fa-globe" style={{ color: '#059669' }}></i>
                  <span>Web Layout</span>
                </button>
                <button
                  type="button"
                  className={`ribbon-large-btn ${viewSettings.focusMode ? 'active' : ''}`}
                  onClick={() =>
                    setViewSettings((prev) => ({ ...prev, focusMode: !prev.focusMode }))
                  }
                >
                  <i className="fa-solid fa-expand" style={{ color: '#7c3aed' }}></i>
                  <span>Focus Mode</span>
                </button>
              </div>
              <div className="ribbon-group-title">Document Views</div>
            </div>

            <div className="ribbon-divider"></div>

            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <label className="ribbon-checkbox-label">
                  <input
                    type="checkbox"
                    checked={viewSettings.showRuler}
                    onChange={(e) =>
                      setViewSettings((prev) => ({ ...prev, showRuler: e.target.checked }))
                    }
                  />
                  <span>Horizontal Ruler</span>
                </label>
                <label className="ribbon-checkbox-label">
                  <input
                    type="checkbox"
                    checked={viewSettings.showGridlines}
                    onChange={(e) =>
                      setViewSettings((prev) => ({ ...prev, showGridlines: e.target.checked }))
                    }
                  />
                  <span>Page Gridlines</span>
                </label>
                <label className="ribbon-checkbox-label">
                  <input
                    type="checkbox"
                    checked={viewSettings.showOutline}
                    onChange={(e) =>
                      setViewSettings((prev) => ({ ...prev, showOutline: e.target.checked }))
                    }
                  />
                  <span>Navigation / Docs Pane</span>
                </label>
                <label className="ribbon-checkbox-label">
                  <input
                    type="checkbox"
                    checked={viewSettings.showProductivityDock}
                    onChange={(e) =>
                      setViewSettings((prev) => ({
                        ...prev,
                        showProductivityDock: e.target.checked,
                      }))
                    }
                  />
                  <span>To-Do &amp; Notepad Dock</span>
                </label>
              </div>
              <div className="ribbon-group-title">Show / Hide Panes</div>
            </div>

            <div className="ribbon-divider"></div>

            <div className="ribbon-group">
              <div className="ribbon-group-controls">
                <button
                  type="button"
                  className="ribbon-icon-btn"
                  onClick={() =>
                    setViewSettings((prev) => ({
                      ...prev,
                      zoom: Math.max(50, prev.zoom - 10),
                    }))
                  }
                >
                  <i className="fa-solid fa-magnifying-glass-minus"></i>
                </button>
                <span style={{ fontSize: '12px', fontWeight: 600, minWidth: '44px', textAlign: 'center' }}>
                  {viewSettings.zoom}%
                </span>
                <button
                  type="button"
                  className="ribbon-icon-btn"
                  onClick={() =>
                    setViewSettings((prev) => ({
                      ...prev,
                      zoom: Math.min(200, prev.zoom + 10),
                    }))
                  }
                >
                  <i className="fa-solid fa-magnifying-glass-plus"></i>
                </button>
                <button
                  type="button"
                  className="ribbon-sm-btn"
                  onClick={() => setViewSettings((prev) => ({ ...prev, zoom: 100 }))}
                >
                  100%
                </button>
              </div>
              <div className="ribbon-group-title">Zoom</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
