"""
OmniWord Studio — Local Backend Companion (Flask + SQLite3 + OpenXML + Text Analytics)
Securely bound to 127.0.0.1 on port 5000.
"""

import io
import json
import os
import re
import sqlite3
import sys
import zipfile
from collections import Counter
from datetime import datetime
from flask import Flask, jsonify, request, send_file, send_from_directory, Response

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(BASE_DIR, "omniword_studio.db")
DIST_DIR = os.path.join(BASE_DIR, "dist")

# Ensure dist directory exists for static assets
os.makedirs(DIST_DIR, exist_ok=True)

# Securely serve only the dedicated dist folder — never project root
app = Flask(__name__, static_folder=DIST_DIR, static_url_path="")


# ==============================================================================
# CORS & SECURITY HEADERS (Localhost Development & Isolation)
# ==============================================================================
@app.after_request
def add_security_and_cors_headers(response):
    # Restrict CORS to local development Vite server and origin
    origin = request.headers.get("Origin")
    if origin in ("http://127.0.0.1:5173", "http://localhost:5173"):
        response.headers["Access-Control-Allow-Origin"] = origin
        response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
        response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"

    # Defensive browser headers
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response


# ==============================================================================
# 1. SQLITE DATABASE INITIALIZATION & STATE PERSISTENCE
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
    """Health check endpoint for frontend reachability detection."""
    return jsonify(
        {
            "status": "online",
            "version": "1.0.0",
            "engine": f"Python {sys.version.split()[0]} (Flask + SQLite3)",
            "timestamp": datetime.now().isoformat(),
        }
    )


@app.route("/api/state", methods=["GET", "POST", "OPTIONS"])
def api_workspace_state():
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

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
# 2. TEXT & DOCUMENT READABILITY ANALYTICS (NLP)
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


@app.route("/api/analyze-text", methods=["POST", "OPTIONS"])
def api_analyze_text():
    """
    Performs readability analysis, extractive summarization,
    action-item detection, and keyword frequency analysis.
    """
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

    data = request.get_json(silent=True) or {}
    raw_text = data.get("text", "")
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

    # Extractive Summarization
    scored_sentences = []
    for idx, s in enumerate(sentences_list):
        s_words = re.findall(r"\b[a-zA-Z]+\b", s.lower())
        score = sum(freq.get(w, 0) for w in s_words) / (len(s_words) + 1)
        scored_sentences.append((score, idx, s))

    top_sents = sorted(scored_sentences, key=lambda x: x[0], reverse=True)[:3]
    top_sents_ordered = [s for _, _, s in sorted(top_sents, key=lambda x: x[1])]
    summary = ". ".join(top_sents_ordered) + ("." if top_sents_ordered else "")

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
# 3. OPENXML (.DOCX) SERVER-SIDE GENERATOR
# ==============================================================================
@app.route("/api/export/docx", methods=["POST", "OPTIONS"])
def api_export_docx():
    """
    Packages a genuine Microsoft Word OpenXML (.docx) ZIP archive in Python
    with exact page dimensions, orientation, margins, and embedded HTML altChunk.
    """
    if request.method == "OPTIONS":
        return jsonify({"ok": True})

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
# 4. STATIC ASSET SERVING (Dedicated dist folder only)
# ==============================================================================
@app.route("/", defaults={"path": ""})
@app.route("/<path:path>")
def serve_static_app(path):
    # If file exists inside dist, serve it
    if path != "" and os.path.exists(os.path.join(DIST_DIR, path)):
        return send_from_directory(DIST_DIR, path)

    # Fall back to index.html in dist for client-side routing
    if os.path.exists(os.path.join(DIST_DIR, "index.html")):
        return send_from_directory(DIST_DIR, "index.html")

    # If dist hasn't been compiled yet, return an informative status message
    return Response(
        """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>OmniWord Studio — Companion Server</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; box-sizing: border-box; }
    .card { max-width: 540px; background: #1e293b; border-radius: 12px; border: 1px solid #334155; padding: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
    h2 { color: #60a5fa; margin-top: 0; font-size: 22px; }
    p { color: #94a3b8; font-size: 14.5px; line-height: 1.6; }
    code { background: #0f172a; color: #38bdf8; padding: 3px 8px; border-radius: 4px; font-size: 13px; font-family: monospace; }
    .badge { display: inline-block; padding: 4px 10px; background: rgba(34,197,94,0.15); color: #4ade80; border: 1px solid rgba(34,197,94,0.3); border-radius: 9999px; font-size: 12px; font-weight: 600; margin-bottom: 14px; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">Backend Active</div>
    <h2>OmniWord Studio Companion API</h2>
    <p>The local Python companion is running securely bound to <code>http://127.0.0.1:5000</code>.</p>
    <p>To run the user interface:</p>
    <ul>
      <li><p><strong>Development:</strong> Run <code>npm run dev</code> to start the Vite live dev server on <code>http://localhost:5173</code>.</p></li>
      <li><p><strong>Production Build:</strong> Run <code>npm run build</code> to compile assets into <code>dist/</code>.</p></li>
    </ul>
  </div>
</body>
</html>""",
        mimetype="text/html",
    )


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))

    # Prefer production WSGI server waitress if installed, fallback to Flask
    try:
        from waitress import serve
        print(f"[OmniWord Studio] Production WSGI server (Waitress) listening on http://127.0.0.1:{port}")
        serve(app, host="127.0.0.1", port=port)
    except ImportError:
        print(f"[OmniWord Studio] Local companion server listening on http://127.0.0.1:{port}")
        app.run(host="127.0.0.1", port=port, debug=False)
