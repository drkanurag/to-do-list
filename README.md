# OmniWord Studio — Full-Stack Python + React Microsoft Word, Super-Notepad & Smart To-Do Suite

A full-stack productivity platform powered by **Python 3.13 (Flask + SQLite3 + NumPy + Pandas + Matplotlib)** on the backend and **React 18 + Chart.js + KaTeX + Mermaid.js + Marked.js + html2pdf.js** on the frontend.

## 🌐 Live Local URL
- **http://localhost:5173**

## 🚀 Architecture & Features

1. **Full-Stack Python Backend (`server.py`)**:
   - **SQLite3 Database Persistence (`omniword_studio.db`)**: Automatically persists all Word documents, To-Do tasks, and Super-Notepad notes to disk via `/api/state`.
   - **Live Python 3.13 + Matplotlib Kernel (`/api/run-python`)**: Write and execute real Python 3.13 code (`numpy`, `pandas`, `matplotlib`, `math`, `statistics`) right inside the **Super-Notepad**, view live console output and rendered Matplotlib charts, and insert generated figures directly into your Microsoft Word document!
   - **Python NLP Readability & Summarizer (`/api/analyze-text`)**: Computes Flesch Reading Ease, Flesch-Kincaid Grade Level, Lexical Diversity, Extractive Summaries, and Action Items.
   - **Native OpenXML `.DOCX` Engine (`/api/export/docx`)**: Packages valid Microsoft Word `.docx` files with custom page setup, margins, and orientation.

2. **Microsoft Word 365 Studio (`RibbonToolbar.jsx`, `App.jsx`, `InteractiveModals.jsx`)**:
   - 6-Tab Office Ribbon (*File*, *Home*, *Insert & Studios*, *Design & Layout*, *Review & Voice*, *View*).
   - Interactive **Chart.js Builder**, **KaTeX Math Equation Studio**, **Mermaid Flowchart Studio**, **HTML5 Freehand Drawing & Signature Pad**, **Auto Table of Contents**, **Voice Dictation (Speech-to-Text)**, and **Read Aloud (TTS)**.
   - One-click export to **Microsoft Word (`.docx` & `.doc`)**, **PDF (`.pdf`)**, **HTML (`.html`)**, **Markdown (`.md`)**, and **Plain Text (`.txt`)**.

3. **Super-Notepad (`NotepadWorkspace.jsx`)**:
   - 4 Interactive Modes: **Plain / Sticky Notes**, **Split Live Markdown Preview**, **Code Runner (Python 3.13 & JavaScript)**, and **Python NLP Word Analytics**.
   - 1-Click Power-Tools: Voice Dictation, Sort Lines A→Z, Deduplicate Lines, Bulletize, Prettify JSON, and 1-click sync into Word or To-Do List.

4. **Smart To-Do List, Kanban Board & Pomodoro Timer (`TodoManager.jsx`)**:
   - Toggle between **List View** and a 3-column **Kanban Board** (*To Do*, *In Progress*, *Completed*), use the built-in **Pomodoro Focus Timer**, and export or embed tasks directly into your Word document.

## ▶️ How to Run
```bash
python server.py
```
Then open **http://localhost:5173** in your browser.
