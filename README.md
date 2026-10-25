# 📝 OmniWord Studio — Word Processor, Super-Notepad & Kanban Productivity Suite

<div align="center">

[![GitHub Pages](https://img.shields.io/badge/🚀_GitHub_Pages-drkanurag.github.io-059669?style=for-the-badge)](https://drkanurag.github.io/to-do-list/)
[![Frontend - Vite + React](https://img.shields.io/badge/Frontend-React_18_%2B_Vite-61DAFB?style=flat-square&logo=vite&logoColor=white)](https://vitejs.dev/)
[![Security - DOMPurify](https://img.shields.io/badge/Security-DOMPurify_3.0.9-00B0FF?style=flat-square)](https://github.com/cure53/DOMPurify)
[![Python Companion](https://img.shields.io/badge/Companion-Python_3_%2B_Flask-3776AB?style=flat-square&logo=python&logoColor=white)](https://flask.palletsprojects.com/)
[![License - MIT](https://img.shields.io/badge/License-MIT-green?style=flat-square)](./LICENSE)

**An open-source, client-side document engineering and productivity suite that unifies a Microsoft Word-compatible WYSIWYG Processor, an isolated Developer & Markdown Super-Notepad, and an interactive Kanban & Pomodoro Task Manager.**

</div>

---

## 🌐 1. Live Deployment & Access

| Environment | Direct URL | Description & Capabilities |
| :--- | :--- | :--- |
| 🚀 **GitHub Pages Official Site** | **[https://drkanurag.github.io/to-do-list/](https://drkanurag.github.io/to-do-list/)** | **Official static deployment** built and deployed continuously via [GitHub Actions CI/CD](./.github/workflows/deploy.yml). Runs client-side in any modern browser with offline local storage support and isolated WebAssembly code execution. |
| 💻 **Local Vite Development** | **[http://localhost:5173](http://localhost:5173)** | Live hot-module reloading environment via `npm run dev`. |
| 🐍 **Local Python Companion** | **[http://127.0.0.1:5000](http://127.0.0.1:5000)** | Optional local backend companion for SQLite persistence, text analytics, and OpenXML generation. Securely bound to localhost. |

---

## 📦 2. Deliverables & Capabilities Matrix

| # | Module | Primary Source Files | Key Capabilities | Status |
| :-: | :--- | :--- | :--- | :-: |
| **D1** | **Word Processor** | [`src/App.jsx`](./src/App.jsx)<br/>[`src/components/RibbonToolbar.jsx`](./src/components/RibbonToolbar.jsx) | Multi-tab Office Ribbon (*File*, *Home*, *Insert*, *Design & Layout*, *Review & Voice*, *View*), A4/Letter canvas, Portrait/Landscape, margins, multi-column layout, watermarks, headers/footers, ruler, outline navigation, Format Painter, Find & Replace. | ✅ Verified |
| **D2** | **Document Export Engine** | [`src/utils/exportUtils.js`](./src/utils/exportUtils.js)<br/>[`server.py`](./server.py) | Client-side pure-JS PKZIP OpenXML `.docx` generator, Word 97–2003 `.doc` builder, high-DPI `html2pdf.js` `.pdf` renderer, native print-to-PDF stylesheet, plus `.html`, `.md`, and `.txt` exporters. | ✅ Verified |
| **D3** | **Interactive Studios** | [`src/components/InteractiveModals.jsx`](./src/components/InteractiveModals.jsx) | **Chart.js** data visualizer, **KaTeX** mathematical equation builder, strict-mode **Mermaid.js** diagram studio, **HTML5 Canvas** freehand drawing/signature pad, and `Ctrl+K` Feature Explorer. | ✅ Verified |
| **D4** | **Developer Super-Notepad** | [`src/components/NotepadWorkspace.jsx`](./src/components/NotepadWorkspace.jsx) | Color-coded Sticky Notes, Live GFM Markdown preview, **Client-side Pyodide WebAssembly Python** sandbox runner, JavaScript sandbox, and text readability analytics. | ✅ Verified |
| **D5** | **Smart To-Do & Kanban** | [`src/components/TodoManager.jsx`](./src/components/TodoManager.jsx) | List and 3-column **Kanban Board** (*To Do*, *In Progress*, *Done*), priorities, categories, due dates, progress bar, drift-free **Pomodoro Focus Timer**, and 1-click Word/PDF report generation. | ✅ Verified |
| **D6** | **Bento Hub & Atmospheres** | [`src/components/BentoDashboard.jsx`](./src/components/BentoDashboard.jsx)<br/>[`src/index.css`](./src/index.css) | Frosted-glass Bento Grid, SVG progress indicator, **6 animated mesh gradient atmospheres**, and **Web Audio API** procedural focus soundscapes. | ✅ Verified |
| **D7** | **Security & Storage Engine** | [`src/utils/sanitize.js`](./src/utils/sanitize.js)<br/>[`src/hooks/usePersistence.js`](./src/hooks/usePersistence.js) | Full DOMPurify XSS sanitization, safe URL scheme validation, debounced saving with storage quota handling, and isolated localhost companion APIs. | ✅ Verified |

---

## 🛡️ 3. Security Architecture & Hardening

OmniWord Studio implements strict security controls across all layers:

1. **Host-Isolated Code Execution**:
   - Python code execution runs **entirely in the browser** via [Pyodide WebAssembly](https://pyodide.org/) inside the browser's native WebAssembly sandbox.
   - The host backend never executes arbitrary user scripts, completely preventing remote code execution risks on the host machine.
2. **Strict HTML Sanitization & URL Whitelisting**:
   - All dynamic content inserted into the editable document (Markdown, imports, cover pages, tables of contents, links, image alt attributes, and speech transcripts) is sanitized through [DOMPurify](https://github.com/cure53/DOMPurify) and escaped.
   - Link URLs enforce a strict protocol whitelist: only `http:`, `https:`, and `mailto:` are permitted; `javascript:`, `data:`, and `vbscript:` schemes are blocked.
   - Vector diagrams powered by Mermaid operate with `securityLevel: 'strict'`.
3. **Localhost Network Isolation**:
   - The Python companion server (`server.py`) binds strictly to loopback (`127.0.0.1`), never `0.0.0.0`.
   - The server serves exclusively from the compiled `dist/` directory; project roots, `.git`, databases, and sensitive source files are never exposed.
4. **Resilient Data Persistence**:
   - Keystrokes are debounced before triggering persistence.
   - Storage writes are protected against `QuotaExceededError`.
   - The frontend automatically detects companion availability, operating seamlessly offline on static hosts like GitHub Pages.

---

## 🛠️ 4. Technology Stack & Dependencies

### Frontend (`package.json`)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| **react** / **react-dom** | `^18.2.0` | Declarative UI and component lifecycle |
| **dompurify** | `^3.0.9` | Cross-site scripting (XSS) sanitizer |
| **chart.js** | `^4.4.1` | Interactive charts and canvas rasterization |
| **katex** | `^0.16.9` | Fast LaTeX mathematical typesetting |
| **mermaid** | `^10.8.0` | Strict-mode vector diagramming |
| **marked** | `^11.2.0` | GitHub Flavored Markdown parsing |
| **html2pdf.js** | `^0.10.1` | High-fidelity PDF document rendering |
| **canvas-confetti** | `^1.9.2` | Particle celebration animations |
| **vite** | `^5.1.4` | Standard build tool and development server |

### Backend (`requirements.txt`)
| Package | Version | Purpose |
| :--- | :--- | :--- |
| **Flask** | `==3.0.3` | Lightweight REST API routing |
| **waitress** | `==3.0.0` | Production WSGI server for local deployment |
| **numpy** | `==1.26.4` | Numerical calculations |
| **pandas** | `==2.2.2` | Data transformations |
| **matplotlib** | `==3.8.4` | Headless chart generation |

---

## 🚀 5. Getting Started

### Prerequisites
- Modern Web Browser (Chrome, Firefox, Safari, Edge)
- Optional: [Node.js](https://nodejs.org/) (v18+) for frontend development and building
- Optional: [Python](https://www.python.org/) (3.10+) for local backend companion

### Option A: Frontend Development (Vite)
```bash
# 1. Install dependencies
npm install

# 2. Start Vite development server
npm run dev

# 3. Build for production (outputs to ./dist)
npm run build
```

### Option B: Local Python Companion Server
```bash
# 1. Install Python dependencies
pip install -r requirements.txt

# 2. Start the local server (bound to 127.0.0.1:5000)
python server.py
# Or on Windows, double-click Start_OmniWord_Studio.bat
```

---

## 📄 6. License

This project is licensed under the [MIT License](./LICENSE).
