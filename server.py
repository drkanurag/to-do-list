"""
OmniWord Studio — Full-Stack Python Backend Server (Flask + SQLite3 + OpenXML + Python/Matplotlib Kernel)
Serves the modern Word Processor, Super-Notepad, and Smart To-Do Suite on http://localhost:5173
"""

import base64
import io
import json
import math
import os
import re
import sqlite3
import sys
import traceback
import zipfile
from collections import Counter
from datetime import datetime
from flask import Flask, jsonify, request, send_file, send_from_directory, Response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "omniword_studio.db")

app = Flask(__name__, static_folder=BASE_DIR, static_url_path="")


# ==============================================================================
# 1. SQLITE DATABASE INITIALIZATION & PERSISTENCE
# ==============================================================================
def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        """
        CREATE TABLE IF NOT EXISTS workspace_state (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
        """
    )
    conn.commit()
    conn.close()


init_db()


@app.route("/api/health", methods=["GET"])
def api_health():
    return jsonify(
        {
            "status": "online",
            "engine": f"Python {sys.version.split()[0]} (Flask + SQLite3 + NumPy/Pandas/Matplotlib)",
            "database": "omniword_studio.db",
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/api/state", methods=["GET", "POST"])
def api_workspace_state():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()

    if request.method == "POST":
        payload = request.get_json(silent=True) or {}
        now = datetime.now().isoformat()
        for key in ("documents", "todos", "notes", "pageSettings"):
            if key in payload:
                c.execute(
                    """
                    INSERT INTO workspace_state (key, value, updated_at)
                    VALUES (?, ?, ?)
                    ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=excluded.updated_at
                    """,
                    (key, json.dumps(payload[key]), now),
                )
        conn.commit()
        conn.close()
        return jsonify({"saved": True, "updatedAt": now})

    # GET state
    c.execute("SELECT key, value, updated_at FROM workspace_state")
    rows = c.fetchall()
    conn.close()
    result = {}
    for k, v, updated_at in rows:
        try:
            result[k] = json.loads(v)
        except Exception:
            result[k] = None
    return jsonify({"state": result})


# ==============================================================================
# 2. LIVE PYTHON 3.13 + DATA SCIENCE & MATPLOTLIB KERNEL FOR SUPER-NOTEPAD
# ==============================================================================
@app.route("/api/run-python", methods=["POST"])
def api_run_python():
    """
    Executes user Python code from the Super-Notepad in a controlled namespace
    with math, statistics, numpy, pandas, and matplotlib pre-imported.
    Captures stdout, stderr, return values, and any Matplotlib figure as base64 PNG!
    """
    data = request.get_json(silent=True) or {}
    code = data.get("code", "")
    if not code.strip():
        return jsonify({"output": "No Python code provided.", "plotPng": None})

    stdout_buf = io.StringIO()
    plot_b64 = None

    # Prepare rich data science execution environment
    exec_globals = {
        "__builtins__": __builtins__,
        "math": math,
        "re": re,
        "json": json,
        "datetime": datetime,
    }

    try:
        import statistics
        exec_globals["statistics"] = statistics
    except ImportError:
        pass

    try:
        import numpy as np
        exec_globals["np"] = np
        exec_globals["numpy"] = np
    except ImportError:
        pass

    try:
        import pandas as pd
        exec_globals["pd"] = pd
        exec_globals["pandas"] = pd
    except ImportError:
        pass

    plt = None
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as _plt
        plt = _plt
        plt.close("all")
        exec_globals["plt"] = plt
    except ImportError:
        pass

    old_stdout = sys.stdout
    old_stderr = sys.stderr
    sys.stdout = stdout_buf
    sys.stderr = stdout_buf

    try:
        compiled = compile(code, "<SuperNotepad_Python>", "exec")
        exec(compiled, exec_globals)

        # Check if user generated a Matplotlib plot
        if plt is not None and plt.get_fignums():
            img_buf = io.BytesIO()
            plt.savefig(img_buf, format="png", bbox_inches="tight", dpi=140)
            img_buf.seek(0)
            plot_b64 = "data:image/png;base64," + base64.b64encode(img_buf.read()).decode("utf-8")
            plt.close("all")
    except Exception:
        traceback.print_exc(file=stdout_buf)
    finally:
        sys.stdout = old_stdout
        sys.stderr = old_stderr

    output_text = stdout_buf.getvalue()
    if not output_text.strip() and not plot_b64:
        output_text = "✓ Python script executed successfully (no stdout printed)."

    return jsonify(
        {
            "output": output_text,
            "plotPng": plot_b64,
            "pythonVersion": sys.version.split()[0],
        }
    )


# ==============================================================================
# 3. PYTHON NLP SMART DOCUMENT & NOTEPAD ASSISTANT
# ==============================================================================
def count_syllables(word: str) -> int:
    word = re.sub(r"[^a-z]", "", word.lower())
    if not word:
        return 0
    if len(word) <= 3:
        return 1
    word = re.sub(r"(?:[^laeiouy]es|ed|[^laeiouy]e)$", "", word)
    word = re.sub(r"^y", "", word)
    vowels = re.findall(r"[aeiouy]{1,2}", word)
    return max(1, len(vowels))


@app.route("/api/analyze-text", methods=["POST"])
def api_analyze_text():
    """
    Performs Python NLP readability analysis, extractive summarization,
    action-item detection, and keyword frequency analysis.
    """
    data = request.get_json(silent=True) or {}
    raw_text = data.get("text", "")
    # Strip HTML tags if present
    clean_text = re.sub(r"<[^>]+>", " ", raw_text)
    clean_text = re.sub(r"\s+", " ", clean_text).strip()

    if not clean_text:
        return jsonify(
            {
                "words": 0,
                "sentences": 0,
                "readingEase": 100,
                "gradeLevel": "N/A",
                "lexicalDiversity": 0,
                "summary": "Add some text to generate an executive summary.",
                "actionItems": [],
                "topKeywords": [],
            }
        )

    words_list = re.findall(r"\b[a-zA-Z0-9']+\b", clean_text)
    sentences_list = [s.strip() for s in re.split(r"[.!?]+", clean_text) if s.strip()]

    word_count = max(1, len(words_list))
    sentence_count = max(1, len(sentences_list))
    syllable_count = sum(count_syllables(w) for w in words_list)

    # Flesch Reading Ease & Flesch-Kincaid Grade Level
    asl = word_count / sentence_count
    asw = syllable_count / word_count
    reading_ease = round(max(0.0, min(100.0, 206.835 - (1.015 * asl) - (84.6 * asw))), 1)
    fk_grade = round(max(1.0, (0.39 * asl) + (11.8 * asw) - 15.59), 1)

    unique_words = len(set(w.lower() for w in words_list))
    lexical_diversity = round((unique_words / word_count) * 100, 1)

    stopwords = {
        "the", "and", "for", "that", "this", "with", "from", "your", "are", "was",
        "were", "have", "has", "had", "not", "but", "what", "all", "can", "will",
        "into", "our", "out", "use", "any", "how", "also", "its", "you", "their",
    }
    filtered_tokens = [
        w.lower() for w in words_list if len(w) > 3 and w.lower() not in stopwords
    ]
    freq = Counter(filtered_tokens)
    top_keywords = [{"word": w, "count": c} for w, c in freq.most_common(10)]

    # Extractive Summarization (score sentences by keyword density)
    scored_sentences = []
    for idx, s in enumerate(sentences_list):
        s_words = re.findall(r"\b[a-zA-Z]+\b", s.lower())
        score = sum(freq.get(w, 0) for w in s_words) / (len(s_words) + 1)
        scored_sentences.append((score, idx, s))

    top_sents = sorted(scored_sentences, key=lambda x: x[0], reverse=True)[:3]
    top_sents_ordered = [s for _, _, s in sorted(top_sents, key=lambda x: x[1])]
    summary = ". ".join(top_sents_ordered) + ("." if top_sents_ordered else "")

    # Action Item Detection
    action_verbs = (
        "todo", "finalize", "review", "verify", "prepare", "create", "build",
        "export", "send", "complete", "update", "schedule", "assign", "check",
    )
    action_items = [
        s for s in sentences_list
        if any(v in s.lower() for v in action_verbs) and len(s) < 140
    ][:6]

    return jsonify(
        {
            "words": len(words_list),
            "sentences": len(sentences_list),
            "readingEase": reading_ease,
            "gradeLevel": f"Grade {fk_grade}",
            "lexicalDiversity": lexical_diversity,
            "summary": summary,
            "actionItems": action_items,
            "topKeywords": top_keywords,
        }
    )


# ==============================================================================
# 4. NATIVE PYTHON OPENXML (.DOCX) SERVER-SIDE GENERATOR
# ==============================================================================
@app.route("/api/export/docx", methods=["POST"])
def api_export_docx():
    """
    Packages a genuine Microsoft Word OpenXML (.docx) ZIP archive in Python
    with exact page dimensions, orientation, margins, and embedded HTML altChunk.
    """
    data = request.get_json(silent=True) or {}
    title = re.sub(r"[^a-zA-Z0-9_-]", "_", data.get("title", "Document"))
    html_content = data.get("html", "<p></p>")
    settings = data.get("pageSettings", {})

    is_landscape = settings.get("orientation") == "landscape"
    w_twips = 12240 if settings.get("pageSize") == "letter" else 11906
    h_twips = 15840 if settings.get("pageSize") == "letter" else 16838
    if is_landscape:
        w_twips, h_twips = h_twips, w_twips

    margin_map = {"narrow": 720, "moderate": 1080, "normal": 1440, "wide": 2160}
    m_twips = margin_map.get(settings.get("margins", "normal"), 1440)

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>"""

    root_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>"""

    doc_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>"""

    orient_attr = 'w:orient="landscape"' if is_landscape else ""
    doc_xml = f"""<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="htmlChunk1"/>
    <w:sectPr>
      <w:pgSz w:w="{w_twips}" w:h="{h_twips}" {orient_attr}/>
      <w:pgMar w:top="{m_twips}" w:right="{m_twips}" w:bottom="{m_twips}" w:left="{m_twips}" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>"""

    mem_zip = io.BytesIO()
    with zipfile.ZipFile(mem_zip, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("[Content_Types].xml", content_types)
        zf.writestr("_rels/.rels", root_rels)
        zf.writestr("word/_rels/document.xml.rels", doc_rels)
        zf.writestr("word/document.xml", doc_xml)
        zf.writestr("word/afchunk.html", html_content.encode("utf-8"))

    mem_zip.seek(0)
    return send_file(
        mem_zip,
        mimetype="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        as_attachment=True,
        download_name=f"{title}.docx",
    )


# ==============================================================================
# 5. DYNAMIC COMBINED FRONTEND BUNDLE ENDPOINT (/app.bundle.jsx) & STATIC ROUTES
# ==============================================================================
@app.route("/app.bundle.jsx", methods=["GET"])
def serve_combined_jsx():
    """
    Combines all React components & utilities on the fly in Python so the browser
    loads a single clean script with zero Vite/Node build requirement.
    """
    files = [
        "src/utils/exportUtils.js",
        "src/utils/templates.js",
        "src/components/InteractiveModals.jsx",
        "src/components/BentoDashboard.jsx",
        "src/components/RibbonToolbar.jsx",
        "src/components/TodoManager.jsx",
        "src/components/NotepadWorkspace.jsx",
        "src/App.jsx",
    ]
    parts = ["const { useState, useEffect, useRef, useCallback, useMemo } = React;\n"]
    for rel_path in files:
        full_path = os.path.join(BASE_DIR, rel_path)
        if os.path.exists(full_path):
            with open(full_path, "r", encoding="utf-8") as f:
                code = f.read()
            # Strip ES module imports/exports for clean unified execution
            code = re.sub(r"^\s*import\s+[^;]+?\s+from\s+['\"][^'\"]+['\"];?\s*$", "", code, flags=re.MULTILINE)
            code = re.sub(r"^\s*import\s+['\"][^'\"]+['\"];?\s*$", "", code, flags=re.MULTILINE)
            code = re.sub(r"export\s+default\s+function\s+", "function ", code)
            code = re.sub(r"export\s+async\s+function\s+", "async function ", code)
            code = re.sub(r"export\s+function\s+", "function ", code)
            code = re.sub(r"export\s+const\s+", "const ", code)
            parts.append(f"// --- {rel_path} ---\n" + code)

    parts.append("\nReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));\n")
    combined = "\n\n".join(parts)
    return Response(combined, mimetype="text/plain; charset=utf-8")


@app.route("/")
def serve_index():
    return send_from_directory(BASE_DIR, "index.html")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5173))
    print(f"[OmniWord Studio] Full-Stack Python Server running on http://localhost:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
