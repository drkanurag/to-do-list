const { useState, useEffect, useRef, useCallback, useMemo } = React;


// --- src/utils/exportUtils.js ---
// Comprehensive Export & Import Utilities for Word (.docx / .doc), PDF (.pdf), Markdown, HTML, and TXT

/**
 * Minimal pure-JS ZIP builder (STORE method, level 0) to package valid OpenXML (.docx) archives
 * without requiring external binary dependencies.
 */
function crc32(bytes) {
  let c = -1;
  for (let i = 0; i < bytes.length; i++) {
    c = (c >>> 8) ^ CRC_TABLE[(c ^ bytes[i]) & 0xff];
  }
  return (c ^ -1) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function createZipBlob(files, mimeType) {
  const encoder = new TextEncoder();
  const fileEntries = files.map((file) => {
    const nameBytes = encoder.encode(file.name);
    const dataBytes =
      typeof file.content === 'string'
        ? encoder.encode(file.content)
        : file.content;
    const crc = crc32(dataBytes);
    return { nameBytes, dataBytes, crc };
  });

  let localOffset = 0;
  const localHeaders = [];
  const centralHeaders = [];

  for (const entry of fileEntries) {
    const { nameBytes, dataBytes, crc } = entry;
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const lv = new DataView(localHeader.buffer);
    lv.setUint32(0, 0x04034b50, true); // Local file header signature
    lv.setUint16(4, 20, true); // Version needed to extract
    lv.setUint16(6, 0, true); // General purpose bit flag
    lv.setUint16(8, 0, true); // Compression method (0 = store)
    lv.setUint16(10, 0, true); // File last mod time
    lv.setUint16(12, 0x21, true); // File last mod date
    lv.setUint32(14, crc, true); // CRC-32
    lv.setUint32(18, dataBytes.length, true); // Compressed size
    lv.setUint32(22, dataBytes.length, true); // Uncompressed size
    lv.setUint16(26, nameBytes.length, true); // File name length
    lv.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);

    localHeaders.push(localHeader, dataBytes);

    const centralHeader = new Uint8Array(46 + nameBytes.length);
    const cv = new DataView(centralHeader.buffer);
    cv.setUint32(0, 0x02014b50, true); // Central directory signature
    cv.setUint16(4, 20, true); // Version made by
    cv.setUint16(6, 20, true); // Version needed
    cv.setUint16(8, 0, true); // Flag
    cv.setUint16(10, 0, true); // Compression method
    cv.setUint16(12, 0, true); // Mod time
    cv.setUint16(14, 0x21, true); // Mod date
    cv.setUint32(16, crc, true); // CRC-32
    cv.setUint32(20, dataBytes.length, true); // Compressed size
    cv.setUint32(24, dataBytes.length, true); // Uncompressed size
    cv.setUint16(28, nameBytes.length, true); // File name length
    cv.setUint16(30, 0, true); // Extra field length
    cv.setUint16(32, 0, true); // File comment length
    cv.setUint16(34, 0, true); // Disk number
    cv.setUint16(36, 0, true); // Internal file attributes
    cv.setUint32(38, 0, true); // External file attributes
    cv.setUint32(42, localOffset, true); // Relative offset of local header
    centralHeader.set(nameBytes, 46);

    centralHeaders.push(centralHeader);
    localOffset += localHeader.length + dataBytes.length;
  }

  const centralDirSize = centralHeaders.reduce((acc, h) => acc + h.length, 0);
  const eocd = new Uint8Array(22);
  const ev = new DataView(eocd.buffer);
  ev.setUint32(0, 0x06054b50, true); // End of central directory signature
  ev.setUint16(4, 0, true); // Number of this disk
  ev.setUint16(6, 0, true); // Disk where central directory starts
  ev.setUint16(8, fileEntries.length, true); // Number of central directory records on this disk
  ev.setUint16(10, fileEntries.length, true); // Total number of central directory records
  ev.setUint32(12, centralDirSize, true); // Size of central directory
  ev.setUint32(16, localOffset, true); // Offset of start of central directory
  ev.setUint16(20, 0, true); // Comment length

  return new Blob([...localHeaders, ...centralHeaders, eocd], {
    type: mimeType,
  });
}

/**
 * Clean and prepare HTML content for Word / PDF export
 * Converts interactive checkboxes and custom widgets into standard rich HTML elements.
 */
function prepareExportHtml(rawHtml, pageSettings = {}) {
  const {
    fontFamily = 'Calibri, sans-serif',
    fontSize = '11pt',
    lineSpacing = '1.5',
    pageColor = '#ffffff',
    headerText = '',
    footerText = '',
    watermark = '',
  } = pageSettings;

  // Create a detached DOM container to normalize interactive elements
  const temp = document.createElement('div');
  temp.innerHTML = rawHtml;

  // Convert interactive checkboxes to visual symbols for Word compatibility
  const checkboxes = temp.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach((cb) => {
    const isChecked = cb.checked || cb.hasAttribute('checked');
    const span = document.createElement('span');
    span.style.fontFamily = 'Segoe UI Symbol, Arial Unicode MS, sans-serif';
    span.style.fontSize = '12pt';
    span.style.marginRight = '6px';
    span.textContent = isChecked ? '☑ ' : '☐ ';
    cb.parentNode.replaceChild(span, cb);
  });

  // Remove any UI-only action buttons inside embedded blocks
  temp.querySelectorAll('.no-export').forEach((el) => el.remove());

  const headerBlock = headerText
    ? `<div style="border-bottom: 1px solid #d1d5db; padding-bottom: 6px; margin-bottom: 18px; color: #6b7280; font-size: 9.5pt; display: flex; justify-content: space-between;">
         <span>${escapeHtml(headerText)}</span>
       </div>`
    : '';

  const footerBlock = footerText
    ? `<div style="border-top: 1px solid #d1d5db; padding-top: 6px; margin-top: 24px; color: #6b7280; font-size: 9.5pt; text-align: center;">
         <span>${escapeHtml(footerText)}</span>
       </div>`
    : '';

  const watermarkBlock = watermark
    ? `<div style="text-align: center; color: #e5e7eb; font-size: 10pt; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 8px;">
         [ ${escapeHtml(watermark)} ]
       </div>`
    : '';

  return `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>Document</title>
  <style>
    body {
      font-family: ${fontFamily};
      font-size: ${fontSize};
      line-height: ${lineSpacing};
      color: #111827;
      background-color: ${pageColor};
      margin: 0;
      padding: 0;
    }
    h1 { font-size: 22pt; color: #1e3a8a; margin: 14pt 0 6pt; font-weight: 700; }
    h2 { font-size: 16pt; color: #1e40af; margin: 12pt 0 4pt; font-weight: 600; }
    h3 { font-size: 13pt; color: #334155; margin: 10pt 0 4pt; font-weight: 600; }
    p { margin: 0 0 8pt 0; }
    table { border-collapse: collapse; width: 100%; margin: 10pt 0; }
    th, td { border: 1px solid #9ca3af; padding: 6pt 8pt; text-align: left; vertical-align: top; }
    th { background-color: #f1f5f9; font-weight: 600; }
    blockquote {
      border-left: 4px solid #2563eb;
      padding: 6pt 12pt;
      margin: 10pt 0;
      background-color: #f8fafc;
      color: #334155;
      font-style: italic;
    }
    pre, code {
      font-family: 'Consolas', 'Courier New', monospace;
      background-color: #f1f5f9;
      padding: 2pt 4pt;
      border-radius: 3pt;
    }
    hr { border: none; border-top: 1px solid #cbd5e1; margin: 14pt 0; }
    ul, ol { margin: 6pt 0 8pt 18pt; }
    li { margin-bottom: 3pt; }
    img { max-width: 100%; height: auto; }
    .page-break { page-break-after: always; break-after: page; border-top: 1px dashed #cbd5e1; margin: 16pt 0; }
  </style>
</head>
<body>
  ${watermarkBlock}
  ${headerBlock}
  ${temp.innerHTML}
  ${footerBlock}
</body>
</html>`;
}

function escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Export as genuine OpenXML .docx file (compatible with Microsoft Word 2007-2026+, LibreOffice, WPS)
 * Uses OpenXML altChunk HTML packaging + Section Properties for exact margins, page size, and orientation.
 */
function exportToDocx(title, rawHtml, pageSettings = {}) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const htmlDocument = prepareExportHtml(rawHtml, pageSettings);

  // Compute page dimensions in twips (1 inch = 1440 twips)
  const isLandscape = pageSettings.orientation === 'landscape';
  let widthTwips = pageSettings.pageSize === 'letter' ? 12240 : 11906; // Letter 8.5" vs A4 8.27"
  let heightTwips = pageSettings.pageSize === 'letter' ? 15840 : 16838; // Letter 11" vs A4 11.69"
  if (isLandscape) {
    [widthTwips, heightTwips] = [heightTwips, widthTwips];
  }

  const marginMap = {
    narrow: 720,   // 0.5 inch
    moderate: 1080, // 0.75 inch
    normal: 1440,  // 1.0 inch
    wide: 2160,    // 1.5 inch
  };
  const marginTwips = marginMap[pageSettings.margins] || 1440;

  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Default Extension="html" ContentType="text/html"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

  const docRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="htmlChunk1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/aFChunk" Target="afchunk.html"/>
</Relationships>`;

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <w:body>
    <w:altChunk r:id="htmlChunk1"/>
    <w:sectPr>
      <w:pgSz w:w="${widthTwips}" w:h="${heightTwips}" ${isLandscape ? 'w:orient="landscape"' : ''}/>
      <w:pgMar w:top="${marginTwips}" w:right="${marginTwips}" w:bottom="${marginTwips}" w:left="${marginTwips}" w:header="720" w:footer="720" w:gutter="0"/>
    </w:sectPr>
  </w:body>
</w:document>`;

  const blob = createZipBlob(
    [
      { name: '[Content_Types].xml', content: contentTypesXml },
      { name: '_rels/.rels', content: rootRelsXml },
      { name: 'word/_rels/document.xml.rels', content: docRelsXml },
      { name: 'word/document.xml', content: documentXml },
      { name: 'word/afchunk.html', content: htmlDocument },
    ],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  );

  triggerDownload(blob, `${cleanTitle}.docx`);
}

/**
 * Export as classic Microsoft Word (.doc) file with @page WordSection1 directives
 */
function exportToDoc(title, rawHtml, pageSettings = {}) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const isLandscape = pageSettings.orientation === 'landscape';
  const sizeStr = isLandscape ? '11.0in 8.5in' : '8.5in 11.0in';
  const marginIn =
    pageSettings.margins === 'narrow'
      ? '0.5in'
      : pageSettings.margins === 'wide'
      ? '1.5in'
      : pageSettings.margins === 'moderate'
      ? '0.75in'
      : '1.0in';

  const baseHtml = prepareExportHtml(rawHtml, pageSettings);
  const wordDocHtml = baseHtml.replace(
    '</style>',
    `  @page WordSection1 {
        size: ${sizeStr};
        margin: ${marginIn};
        mso-header-margin: .5in;
        mso-footer-margin: .5in;
        mso-paper-source: 0;
      }
      div.WordSection1 { page: WordSection1; }
    </style>`
  ).replace('<body>', '<body><div class="WordSection1">').replace('</body>', '</div></body>');

  const blob = new Blob(['\ufeff', wordDocHtml], {
    type: 'application/msword;charset=utf-8',
  });
  triggerDownload(blob, `${cleanTitle}.doc`);
}

/**
 * Export as PDF (.pdf)
 * Uses html2pdf.js if available in window for direct one-click PDF file download,
 * with a fallback to a dedicated high-resolution print-to-PDF frame.
 */
async function exportToPdf(title, rawHtml, pageSettings = {}) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const exportHtml = prepareExportHtml(rawHtml, pageSettings);

  if (typeof window !== 'undefined' && window.html2pdf) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = pageSettings.orientation === 'landscape' ? '1050px' : '780px';
    container.style.background = pageSettings.pageColor || '#ffffff';
    container.style.padding = '24px';
    container.innerHTML = exportHtml;
    document.body.appendChild(container);

    const marginMm =
      pageSettings.margins === 'narrow'
        ? 12
        : pageSettings.margins === 'wide'
        ? 32
        : pageSettings.margins === 'moderate'
        ? 18
        : 22;

    try {
      await window
        .html2pdf()
        .set({
          margin: marginMm,
          filename: `${cleanTitle}.pdf`,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: pageSettings.pageColor || '#ffffff',
          },
          jsPDF: {
            unit: 'mm',
            format: pageSettings.pageSize === 'letter' ? 'letter' : 'a4',
            orientation: pageSettings.orientation === 'landscape' ? 'landscape' : 'portrait',
          },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] },
        })
        .from(container)
        .save();
    } finally {
      document.body.removeChild(container);
    }
    return true;
  }

  // Fallback to native browser Print-to-PDF dialog via hidden iframe
  printDocument(title, rawHtml, pageSettings);
  return true;
}

/**
 * High-fidelity Print / Save as Vector PDF via dedicated print iframe
 */
function printDocument(title, rawHtml, pageSettings = {}) {
  const exportHtml = prepareExportHtml(rawHtml, pageSettings);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(exportHtml);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
    }, 1000);
  }, 300);
}

/**
 * Export as Standalone HTML (.html) or Plain Text (.txt) or Markdown (.md)
 */
function exportToHtmlFile(title, rawHtml, pageSettings = {}) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const html = prepareExportHtml(rawHtml, pageSettings);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${cleanTitle}.html`);
}

function exportToTxtFile(title, rawHtml) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const temp = document.createElement('div');
  temp.innerHTML = rawHtml;
  const text = temp.innerText || temp.textContent || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${cleanTitle}.txt`);
}

function exportToMarkdownFile(title, rawHtml) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const temp = document.createElement('div');
  temp.innerHTML = rawHtml;

  // Simple HTML to Markdown conversion
  let md = temp.innerHTML
    .replace(/<h1[^>]*>(.*?)<\/h1>/gi, '# $1\n\n')
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '## $1\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '### $1\n\n')
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '**$1**')
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '*$1*')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '*$1*')
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '- $1\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '');

  const textarea = document.createElement('textarea');
  textarea.innerHTML = md;
  md = textarea.value.trim();

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  triggerDownload(blob, `${cleanTitle}.md`);
}

/**
 * Convert To-Do List items into a rich HTML report suitable for Word Studio or direct Word/PDF export
 */
function convertTodosToHtml(todos = [], listTitle = 'Master Action Plan & To-Do List') {
  const completedCount = todos.filter((t) => t.completed).length;
  const rows = todos
    .map(
      (t, i) => `
      <tr>
        <td style="width: 40px; text-align: center;">${i + 1}</td>
        <td style="width: 50px; text-align: center; font-size: 13pt;">${t.completed ? '☑' : '☐'}</td>
        <td style="${t.completed ? 'text-decoration: line-through; color: #6b7280;' : 'font-weight: 500;'}">
          ${escapeHtml(t.text)}
          ${t.notes ? `<div style="font-size: 9pt; color: #64748b; margin-top: 2px;">${escapeHtml(t.notes)}</div>` : ''}
        </td>
        <td style="width: 100px;">${escapeHtml(t.category || 'General')}</td>
        <td style="width: 90px; text-align: center;">
          <span style="padding: 2px 8px; border-radius: 10px; font-size: 9pt; font-weight: 600; background: ${
            t.priority === 'high' ? '#fee2e2' : t.priority === 'low' ? '#dcfce7' : '#fef3c7'
          }; color: ${
            t.priority === 'high' ? '#991b1b' : t.priority === 'low' ? '#166534' : '#92400e'
          };">
            ${(t.priority || 'medium').toUpperCase()}
          </span>
        </td>
        <td style="width: 110px;">${escapeHtml(t.dueDate || '—')}</td>
      </tr>`
    )
    .join('');

  return `
    <h1>${escapeHtml(listTitle)}</h1>
    <p style="color: #475569;">Generated on ${new Date().toLocaleDateString()} &bull; Completed: <strong>${completedCount} / ${todos.length}</strong> tasks</p>
    <hr />
    <table>
      <thead>
        <tr>
          <th style="width: 40px; text-align: center;">#</th>
          <th style="width: 50px; text-align: center;">Done</th>
          <th>Task &amp; Details</th>
          <th style="width: 100px;">Category</th>
          <th style="width: 90px; text-align: center;">Priority</th>
          <th style="width: 110px;">Due Date</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="6" style="text-align: center; color: #94a3b8;">No tasks added yet.</td></tr>'}
      </tbody>
    </table>
    <p></p>
  `;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}


// --- src/utils/templates.js ---
// Rich Document Templates for Word Studio

const DOCUMENT_TEMPLATES = [
  {
    id: 'welcome-workspace',
    name: 'Workspace Guide & Sample Doc',
    category: 'Starter',
    icon: 'fa-solid fa-wand-magic-sparkles',
    description: 'Interactive showcase of Word formatting, tables, checklists, and export features.',
    content: `
      <h1 style="color: #1e3a8a; border-bottom: 2px solid #2563eb; padding-bottom: 8px;">OmniWord Studio &amp; Productivity Hub</h1>
      <p style="font-size: 12pt; color: #475569;"><strong>Welcome to your unified Microsoft Word Processor, Actionable To-Do List, and Quick Notepad.</strong> Everything you write, plan, or sketch here is automatically saved and can be exported to <strong>Microsoft Word (.docx / .doc)</strong> and <strong>PDF (.pdf)</strong> with a single click.</p>
      
      <h2>1. Executive Summary &amp; Project Overview</h2>
      <p>Use the <strong>Ribbon Toolbar</strong> above just like Microsoft Word: switch between <em>Home</em>, <em>Insert</em>, <em>Design &amp; Layout</em>, and <em>View &amp; Review</em> tabs to customize fonts, paragraph spacing, page margins, orientation, watermarks, tables, callout boxes, and more.</p>
      
      <blockquote>
        "Productivity is never an accident. It is always the result of a commitment to excellence, intelligent planning, and focused effort." — Paul J. Meyer
      </blockquote>

      <h2>2. Key Milestones &amp; Deliverable Schedule</h2>
      <table>
        <thead>
          <tr>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Phase</th>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Deliverable</th>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Owner</th>
            <th style="background-color: #dbeafe; color: #1e3a8a;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Phase 1</strong></td>
            <td>System Architecture &amp; UI Design</td>
            <td>Product Team</td>
            <td><span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; border-radius: 4px; font-weight: 600;">Completed</span></td>
          </tr>
          <tr>
            <td><strong>Phase 2</strong></td>
            <td>Rich Word Editor &amp; Multi-Tab Ribbon</td>
            <td>Core Engineering</td>
            <td><span style="background-color: #dcfce7; color: #166534; padding: 2px 8px; font-weight: 600; border-radius: 4px;">Completed</span></td>
          </tr>
          <tr>
            <td><strong>Phase 3</strong></td>
            <td>DOCX &amp; PDF High-Fidelity Export Engine</td>
            <td>Document Systems</td>
            <td><span style="background-color: #fef3c7; color: #92400e; padding: 2px 8px; font-weight: 600; border-radius: 4px;">In Review</span></td>
          </tr>
        </tbody>
      </table>

      <h2>3. Embedded Action Checklist</h2>
      <p>You can manage tasks in the dedicated <strong>To-Do Manager</strong> tab or embed interactive checklists directly inside any Word document:</p>
      <ul style="list-style-type: none; padding-left: 4px;">
        <li style="margin-bottom: 6px;"><input type="checkbox" checked="checked" /> Finalize Q4 strategic roadmap document in Word Studio</li>
        <li style="margin-bottom: 6px;"><input type="checkbox" checked="checked" /> Sync high-priority tasks from the To-Do sidebar into the executive report</li>
        <li style="margin-bottom: 6px;"><input type="checkbox" /> Export final deliverable as both <strong>.DOCX</strong> and <strong>.PDF</strong> for stakeholders</li>
      </ul>

      <div style="background-color: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 6px; margin: 16px 0;">
        <strong style="color: #1d4ed8;">💡 Pro Tip:</strong> Use the right-hand <strong>Productivity Dock</strong> to jot down quick ideas in your <em>Notepad</em> or check off items in your <em>To-Do List</em> without ever leaving your document—or click <strong>"Insert Tasks into Doc"</strong> to drop your live task table right at your cursor!
      </div>
    `,
  },
  {
    id: 'blank',
    name: 'Blank Document',
    category: 'General',
    icon: 'fa-regular fa-file',
    description: 'Start fresh with a clean, standard A4/Letter Word document.',
    content: `<p>Start typing your document here...</p>`,
  },
  {
    id: 'project-proposal',
    name: 'Project Proposal',
    category: 'Business',
    icon: 'fa-solid fa-briefcase',
    description: 'Structured business proposal with objectives, scope, budget table, and sign-off.',
    content: `
      <h1 style="text-align: center; color: #0f172a; font-size: 24pt;">STRATEGIC PROJECT PROPOSAL</h1>
      <p style="text-align: center; color: #64748b; font-size: 11pt;">Prepared by: [Your Name / Organization] &bull; Date: ${new Date().toLocaleDateString()}</p>
      <hr />
      <h2>1. Problem Statement &amp; Objective</h2>
      <p>Describe the core opportunity or business challenge this initiative addresses. Outline measurable goals and target outcomes for the upcoming quarter.</p>
      <h2>2. Scope of Work</h2>
      <ul>
        <li><strong>Discovery &amp; Research:</strong> Stakeholder interviews, competitive benchmarking, and technical audit.</li>
        <li><strong>Implementation:</strong> Core platform development, QA testing, and staging deployment.</li>
        <li><strong>Launch &amp; Rollout:</strong> Documentation, team training, and post-launch monitoring.</li>
      </ul>
      <h2>3. Estimated Budget &amp; Resource Allocation</h2>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Description</th>
            <th>Timeline</th>
            <th>Estimated Cost</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Research &amp; Design</td>
            <td>UX/UI wireframes, user testing, design system</td>
            <td>3 Weeks</td>
            <td>$4,500</td>
          </tr>
          <tr>
            <td>Engineering</td>
            <td>Frontend, backend APIs, export integration</td>
            <td>6 Weeks</td>
            <td>$12,000</td>
          </tr>
          <tr>
            <td>Quality Assurance</td>
            <td>Automated testing &amp; security review</td>
            <td>2 Weeks</td>
            <td>$2,500</td>
          </tr>
        </tbody>
      </table>
      <h2>4. Approval &amp; Sign-Off</h2>
      <p style="margin-top: 28px;"><strong>Approved By:</strong> ___________________________ &nbsp;&nbsp;&nbsp;&nbsp; <strong>Date:</strong> _______________</p>
    `,
  },
  {
    id: 'meeting-notes',
    name: 'Meeting Minutes & Action Plan',
    category: 'Productivity',
    icon: 'fa-solid fa-users-rectangle',
    description: 'Capture attendees, agenda items, key decisions, and assigned action items.',
    content: `
      <h1 style="color: #1e40af;">Meeting Minutes &amp; Action Plan</h1>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()} &nbsp;|&nbsp; <strong>Time:</strong> 10:00 AM &nbsp;|&nbsp; <strong>Location:</strong> Conference Room A / Virtual</p>
      <p><strong>Attendees:</strong> Alex Morgan, Priya Nair, David Kim, Sarah Jenkins</p>
      <hr />
      <h2>1. Agenda Topics</h2>
      <ol>
        <li>Review previous sprint velocity and completed tasks</li>
        <li>Discuss upcoming product release milestones</li>
        <li>Assign action items and deadlines</li>
      </ol>
      <h2>2. Key Discussion Points &amp; Decisions</h2>
      <p>The team agreed to prioritize the Microsoft Word and PDF export workflows and integrate the live To-Do List and Notepad side-by-side with the main document editor.</p>
      <h2>3. Action Items</h2>
      <table>
        <thead>
          <tr>
            <th>Done</th>
            <th>Action Item</th>
            <th>Assignee</th>
            <th>Due Date</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="text-align: center;">☐</td>
            <td>Prepare final specification deck</td>
            <td>Alex Morgan</td>
            <td>Friday</td>
          </tr>
          <tr>
            <td style="text-align: center;">☐</td>
            <td>Verify PDF &amp; DOCX formatting across devices</td>
            <td>Priya Nair</td>
            <td>Monday</td>
          </tr>
        </tbody>
      </table>
    `,
  },
  {
    id: 'modern-resume',
    name: 'Executive Resume / CV',
    category: 'Personal',
    icon: 'fa-solid fa-id-card',
    description: 'Clean, ATS-friendly professional resume layout ready for Word and PDF export.',
    content: `
      <h1 style="text-align: center; margin-bottom: 2px; color: #0f172a;">ALEXANDER MORGAN</h1>
      <p style="text-align: center; color: #475569; font-size: 10.5pt;">San Francisco, CA &bull; alex.morgan@email.com &bull; (555) 234-5678 &bull; linkedin.com/in/alexmorgan</p>
      <hr />
      <h2>PROFESSIONAL SUMMARY</h2>
      <p>Results-driven Full-Stack Software Engineer with 5+ years of experience designing high-performance web applications, document processing engines, and intuitive user interfaces.</p>
      <h2>WORK EXPERIENCE</h2>
      <p><strong>Senior Frontend Engineer — TechNova Solutions</strong> <em>(2023 – Present)</em></p>
      <ul>
        <li>Architected a browser-based rich document suite supporting real-time DOCX and PDF generation for 150K+ monthly active users.</li>
        <li>Reduced bundle load time by 42% and improved accessibility compliance to WCAG 2.1 AA standards.</li>
      </ul>
      <p><strong>Software Developer — CloudScale Labs</strong> <em>(2020 – 2023)</em></p>
      <ul>
        <li>Built collaborative task management and note-taking workflows using React, TypeScript, and modern state persistence.</li>
      </ul>
      <h2>EDUCATION &amp; SKILLS</h2>
      <p><strong>B.S. in Computer Science</strong> — University of California</p>
      <p><strong>Core Competencies:</strong> React, JavaScript/TypeScript, HTML5/CSS3, Node.js, UI/UX Architecture, Document Systems</p>
    `,
  },
  {
    id: 'academic-paper',
    name: 'Academic Research Paper',
    category: 'Education',
    icon: 'fa-solid fa-graduation-cap',
    description: 'Formal academic paper layout with abstract, sections, citations, and references.',
    content: `
      <h1 style="text-align: center; font-family: 'Times New Roman', serif; font-size: 20pt; color: #000000;">Modern Web-Based Document Processing and Task Synthesis</h1>
      <p style="text-align: center; font-family: 'Times New Roman', serif; font-style: italic;">Department of Computer Science &amp; Engineering</p>
      <div style="margin: 16px 32px; padding: 12px; background-color: #f8fafc; border: 1px solid #cbd5e1;">
        <strong>Abstract—</strong> This paper explores the convergence of structured task management, rapid note capture, and WYSIWYG word processing within a unified browser environment, enabling seamless cross-format export to OpenXML (.docx) and Portable Document Format (.pdf).
      </div>
      <h2 style="font-family: 'Times New Roman', serif; color: #000000;">I. Introduction</h2>
      <p style="font-family: 'Times New Roman', serif; text-align: justify;">Traditional workflows fragment ideation (notepads), execution tracking (to-do lists), and formal documentation (word processors) across disparate applications. Unifying these paradigms reduces cognitive switching costs.</p>
      <h2 style="font-family: 'Times New Roman', serif; color: #000000;">II. Methodology &amp; Architecture</h2>
      <p style="font-family: 'Times New Roman', serif; text-align: justify;">By combining an interactive Rich Text DOM canvas with structured state persistence and client-side OpenXML packaging, users can transition effortlessly from bulleted action items to publication-ready manuscripts.</p>
      <h2 style="font-family: 'Times New Roman', serif; color: #000000;">III. References</h2>
      <ol style="font-family: 'Times New Roman', serif; font-size: 10pt;">
        <li>ECMA-376, "Office Open XML File Formats," Ecma International, 5th Edition.</li>
        <li>ISO 32000-2, "Document management — Portable document format," International Organization for Standardization.</li>
      </ol>
    `,
  },
];


// --- src/components/InteractiveModals.jsx ---

/* ==========================================================================
   1. INTERACTIVE CHART BUILDER MODAL (Powered by Chart.js)
   ========================================================================== */
function ChartBuilderModal({ onClose, onInsertChartHtml }) {
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

function EquationBuilderModal({ onClose, onInsertEquationHtml }) {
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

function DiagramBuilderModal({ onClose, onInsertDiagramHtml }) {
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
function DrawingCanvasModal({ onClose, onInsertDrawingHtml }) {
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
function FeatureGuideModal({ onClose, onTriggerFeature }) {
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



// --- src/components/BentoDashboard.jsx ---

const ATMOSPHERE_THEMES = [
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

function BentoDashboard({
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



// --- src/components/RibbonToolbar.jsx ---

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

function RibbonToolbar({
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


// --- src/components/TodoManager.jsx ---


const CATEGORIES = ['General', 'Work', 'Study', 'Personal', 'Document', 'Urgent'];

function TodoManager({
  todos,
  onAddTodo,
  onToggleTodo,
  onDeleteTodo,
  onUpdateTodo,
  onClearCompleted,
  onInsertTodosIntoWord,
  onOpenTodosAsWordDoc,
  compact = false,
}) {
  const [text, setText] = useState('');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('Work');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterCategory, setFilterCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [viewMode, setViewMode] = useState('list'); // 'list' | 'kanban'

  // Pomodoro Focus Timer State
  const [pomoSeconds, setPomoSeconds] = useState(25 * 60);
  const [pomoRunning, setPomoRunning] = useState(false);
  const [pomoLabel, setPomoLabel] = useState('25m Focus');

  useEffect(() => {
    if (!pomoRunning) return;
    const timer = setInterval(() => {
      setPomoSeconds((prev) => {
        if (prev <= 1) {
          setPomoRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [pomoRunning]);

  const formatTimer = (secs) => {
    const m = String(Math.floor(secs / 60)).padStart(2, '0');
    const s = String(secs % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onAddTodo({
      text: text.trim(),
      priority,
      category,
      dueDate,
      notes: notes.trim(),
      status: 'todo',
    });
    setText('');
    setNotes('');
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditValue(todo.text);
    setEditNotes(todo.notes || '');
  };

  const saveEdit = (id) => {
    if (!editValue.trim()) return;
    onUpdateTodo(id, { text: editValue.trim(), notes: editNotes.trim() });
    setEditingId(null);
  };

  const moveKanbanTask = (todo, newStatus) => {
    const isDone = newStatus === 'done';
    onUpdateTodo(todo.id, { status: newStatus, completed: isDone });
  };

  const filteredTodos = todos.filter((todo) => {
    if (filterStatus === 'active' && todo.completed) return false;
    if (filterStatus === 'completed' && !todo.completed) return false;
    if (filterStatus === 'high' && todo.priority !== 'high') return false;
    if (filterCategory !== 'All' && todo.category !== filterCategory) return false;
    if (
      searchQuery.trim() &&
      !todo.text.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !(todo.notes || '').toLowerCase().includes(searchQuery.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const completedCount = todos.filter((t) => t.completed).length;
  const completionPct = todos.length ? Math.round((completedCount / todos.length) * 100) : 0;

  const handleExportTasksWord = () => {
    const html = convertTodosToHtml(todos, 'Action Plan & To-Do List');
    exportToDocx('Action_Plan_Todo_List', html, {
      fontFamily: 'Calibri, sans-serif',
      fontSize: '11pt',
      margins: 'normal',
      orientation: 'portrait',
    });
  };

  const handleExportTasksPdf = () => {
    const html = convertTodosToHtml(todos, 'Action Plan & To-Do List');
    exportToPdf('Action_Plan_Todo_List', html, {
      fontFamily: 'Calibri, sans-serif',
      fontSize: '11pt',
      margins: 'normal',
      orientation: 'portrait',
    });
  };

  return (
    <div className={`todo-manager-wrap ${compact ? 'compact-dock' : 'full-page'}`}>
      {/* Header, Pomodoro Timer & Progress */}
      <div className="todo-header-card">
        <div className="todo-header-top">
          <div>
            <h2>
              <i className="fa-solid fa-list-check" style={{ color: '#2563eb' }}></i>{' '}
              {compact ? 'To-Do & Tasks' : 'Smart To-Do, Kanban Board & Focus Studio'}
            </h2>
            {!compact && (
              <p className="todo-subtitle">
                Manage tasks in List or Kanban Board view, track focus sessions with Pomodoro, and sync or export to Word (.DOCX) &amp; PDF.
              </p>
            )}
          </div>

          <div className="todo-export-actions">
            {!compact && (
              <div className="todo-view-switcher">
                <button
                  type="button"
                  className={`todo-view-btn ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => setViewMode('list')}
                >
                  <i className="fa-solid fa-list"></i> List
                </button>
                <button
                  type="button"
                  className={`todo-view-btn ${viewMode === 'kanban' ? 'active' : ''}`}
                  onClick={() => setViewMode('kanban')}
                >
                  <i className="fa-solid fa-table-columns"></i> Kanban Board
                </button>
              </div>
            )}

            <button
              type="button"
              className="todo-action-pill sync"
              onClick={onInsertTodosIntoWord}
              title="Insert this To-Do list into the active Word document"
            >
              <i className="fa-solid fa-file-import"></i> Insert in Word
            </button>
            {!compact && (
              <button
                type="button"
                className="todo-action-pill open-doc"
                onClick={onOpenTodosAsWordDoc}
                title="Open these tasks as a full editable Word document"
              >
                <i className="fa-solid fa-wand-magic-sparkles"></i> Edit as Word Doc
              </button>
            )}
            <button
              type="button"
              className="todo-action-pill word"
              onClick={handleExportTasksWord}
              title="Export To-Do List as Word (.docx)"
            >
              <i className="fa-solid fa-file-word"></i> .DOCX
            </button>
            <button
              type="button"
              className="todo-action-pill pdf"
              onClick={handleExportTasksPdf}
              title="Export To-Do List as PDF (.pdf)"
            >
              <i className="fa-solid fa-file-pdf"></i> .PDF
            </button>
          </div>
        </div>

        {/* Pomodoro Focus Timer Bar (in Full Page mode) */}
        {!compact && (
          <div className="pomodoro-bar">
            <div className="pomo-left">
              <span className="pomo-badge">
                <i className="fa-solid fa-stopwatch"></i> {pomoLabel}
              </span>
              <strong className="pomo-clock">{formatTimer(pomoSeconds)}</strong>
              <button
                type="button"
                className="pomo-btn primary"
                onClick={() => setPomoRunning((r) => !r)}
              >
                {pomoRunning ? 'Pause' : 'Start Focus'}
              </button>
              <button
                type="button"
                className="pomo-btn"
                onClick={() => {
                  setPomoRunning(false);
                  setPomoSeconds(25 * 60);
                  setPomoLabel('25m Focus');
                }}
              >
                25m
              </button>
              <button
                type="button"
                className="pomo-btn"
                onClick={() => {
                  setPomoRunning(false);
                  setPomoSeconds(5 * 60);
                  setPomoLabel('5m Break');
                }}
              >
                5m Break
              </button>
            </div>

            <div className="pomo-right">
              <span>
                <strong>{completedCount}</strong> / <strong>{todos.length}</strong> Completed ({completionPct}%)
              </span>
            </div>
          </div>
        )}

        {/* Completion Progress Bar */}
        <div className="todo-progress-section">
          {compact && (
            <div className="todo-progress-labels">
              <span>
                <strong>{completedCount}</strong> of <strong>{todos.length}</strong> done
              </span>
              <span className="todo-pct-badge">{completionPct}%</span>
            </div>
          )}
          <div className="todo-progress-track">
            <div
              className="todo-progress-fill"
              style={{ width: `${completionPct}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Add Task Form */}
      <form className="todo-add-form" onSubmit={handleSubmit}>
        <div className="todo-input-main-row">
          <input
            type="text"
            className="todo-text-input"
            placeholder="Add a new task or action item..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button type="submit" className="todo-submit-btn">
            <i className="fa-solid fa-plus"></i> {compact ? 'Add' : 'Add Task'}
          </button>
        </div>

        <div className="todo-meta-row">
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            className="todo-meta-select"
            title="Task Priority"
          >
            <option value="high">🔴 High Priority</option>
            <option value="medium">🟡 Medium Priority</option>
            <option value="low">🟢 Low Priority</option>
          </select>

          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="todo-meta-select"
            title="Category"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                📁 {c}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
            className="todo-meta-date"
            title="Due Date"
          />

          {!compact && (
            <input
              type="text"
              placeholder="Optional sub-notes or details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="todo-meta-notes"
            />
          )}
        </div>
      </form>

      {/* ==================== KANBAN BOARD VIEW ==================== */}
      {!compact && viewMode === 'kanban' ? (
        <div className="kanban-board-grid">
          {[
            { id: 'todo', title: '📌 To Do', filterFn: (t) => !t.completed && t.status !== 'inprogress' },
            { id: 'inprogress', title: '⚡ In Progress', filterFn: (t) => !t.completed && t.status === 'inprogress' },
            { id: 'done', title: '✅ Completed', filterFn: (t) => !!t.completed },
          ].map((col) => {
            const colTasks = todos.filter(col.filterFn);
            return (
              <div key={col.id} className="kanban-column">
                <div className="kanban-col-header">
                  <strong>{col.title}</strong>
                  <span className="kanban-count">{colTasks.length}</span>
                </div>
                <div className="kanban-cards-stack">
                  {colTasks.map((t) => (
                    <div key={t.id} className={`kanban-card priority-${t.priority || 'medium'}`}>
                      <div className="kanban-card-top">
                        <span className={`priority-badge ${t.priority || 'medium'}`}>
                          {t.priority || 'medium'}
                        </span>
                        <span className="category-badge">{t.category || 'General'}</span>
                      </div>
                      <p className="kanban-card-title">{t.text}</p>
                      {t.notes && <small className="kanban-card-notes">{t.notes}</small>}
                      <div className="kanban-card-Moves">
                        {col.id !== 'todo' && (
                          <button type="button" onClick={() => moveKanbanTask(t, 'todo')}>
                            ← To Do
                          </button>
                        )}
                        {col.id !== 'inprogress' && (
                          <button type="button" onClick={() => moveKanbanTask(t, 'inprogress')}>
                            ⚡ In Progress
                          </button>
                        )}
                        {col.id !== 'done' && (
                          <button type="button" onClick={() => moveKanbanTask(t, 'done')}>
                            ✓ Done
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          {/* Filter & Search Bar */}
          <div className="todo-filters-bar">
            <div className="todo-status-pills">
              {[
                { id: 'all', label: 'All' },
                { id: 'active', label: 'Pending' },
                { id: 'completed', label: 'Done' },
                { id: 'high', label: 'High Priority' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`todo-filter-pill ${filterStatus === tab.id ? 'active' : ''}`}
                  onClick={() => setFilterStatus(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="todo-search-and-cat">
              {!compact && (
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="todo-meta-select"
                >
                  <option value="All">All Categories</option>
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="text"
                placeholder="Search tasks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="todo-search-input"
              />
              {completedCount > 0 && (
                <button
                  type="button"
                  className="todo-clear-btn"
                  onClick={onClearCompleted}
                  title="Remove all completed tasks"
                >
                  Clear Done
                </button>
              )}
            </div>
          </div>

          {/* Task List */}
          <div className="todo-items-list">
            {filteredTodos.length === 0 ? (
              <div className="todo-empty-state">
                <i className="fa-solid fa-clipboard-check"></i>
                <p>No tasks match your current filter. Add a task above!</p>
              </div>
            ) : (
              filteredTodos.map((todo) => (
                <div
                  key={todo.id}
                  className={`todo-card-item ${todo.completed ? 'completed' : ''} priority-${
                    todo.priority || 'medium'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={!!todo.completed}
                    onChange={() => onToggleTodo(todo.id)}
                    className="todo-checkbox"
                  />

                  <div className="todo-card-body">
                    {editingId === todo.id ? (
                      <div className="todo-edit-inline">
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          className="todo-edit-input"
                          autoFocus
                        />
                        <input
                          type="text"
                          value={editNotes}
                          onChange={(e) => setEditNotes(e.target.value)}
                          placeholder="Task notes..."
                          className="todo-edit-notes"
                        />
                        <div className="todo-edit-btns">
                          <button type="button" onClick={() => saveEdit(todo.id)} className="save-btn">
                            Save
                          </button>
                          <button type="button" onClick={() => setEditingId(null)} className="cancel-btn">
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="todo-title-row">
                          <span
                            className="todo-item-text"
                            onDoubleClick={() => startEdit(todo)}
                          >
                            {todo.text}
                          </span>
                          <div className="todo-badges">
                            <span className={`priority-badge ${todo.priority || 'medium'}`}>
                              {todo.priority || 'medium'}
                            </span>
                            {todo.category && (
                              <span className="category-badge">{todo.category}</span>
                            )}
                            {todo.dueDate && (
                              <span className="duedate-badge">
                                <i className="fa-regular fa-calendar"></i> {todo.dueDate}
                              </span>
                            )}
                          </div>
                        </div>
                        {todo.notes && <p className="todo-item-notes">{todo.notes}</p>}
                      </>
                    )}
                  </div>

                  <div className="todo-card-actions">
                    <button
                      type="button"
                      onClick={() => startEdit(todo)}
                      title="Edit Task"
                      className="todo-icon-action"
                    >
                      <i className="fa-regular fa-pen-to-square"></i>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTodo(todo.id)}
                      title="Delete Task"
                      className="todo-icon-action delete"
                    >
                      <i className="fa-regular fa-trash-can"></i>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}


// --- src/components/NotepadWorkspace.jsx ---


const NOTE_COLORS = [
  { id: 'yellow', bg: '#fef9c3', border: '#fde047', label: 'Sticky Yellow' },
  { id: 'blue', bg: '#e0f2fe', border: '#7dd3fc', label: 'Sky Blue' },
  { id: 'green', bg: '#dcfce7', border: '#86efac', label: 'Mint Green' },
  { id: 'pink', bg: '#fce7f3', border: '#f9a8d4', label: 'Rose Pink' },
  { id: 'purple', bg: '#f3e8ff', border: '#d8b4fe', label: 'Lavender' },
  { id: 'white', bg: '#ffffff', border: '#cbd5e1', label: 'Clean White' },
  { id: 'dark', bg: '#0f172a', border: '#38bdf8', label: 'Developer Dark', dark: true },
];

function NotepadWorkspace({
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

  // Render Markdown using Marked.js
  const renderedMarkdownHtml = useMemo(() => {
    const raw = activeNote?.content || '';
    if (!raw.trim())
      return '<p style="color:#94a3b8;">Live Markdown preview will appear here as you type...</p>';
    if (typeof window !== 'undefined' && window.marked) {
      try {
        return window.marked.parse(raw, { breaks: true, gfm: true });
      } catch (e) {
        console.error(e);
      }
    }
    return raw
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/^### (.*$)/gim, '<h3>$1</h3>')
      .replace(/^## (.*$)/gim, '<h2>$1</h2>')
      .replace(/^# (.*$)/gim, '<h1>$1</h1>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/gim, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
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

  // Run Python 3.13 on Backend (or Pyodide WebAssembly in Browser) OR JS in Browser
  const handleExecuteCode = async () => {
    if (!activeNote) return;
    setIsRunningCode(true);
    setPythonPlot(null);

    if (codeLang === 'python') {
      try {
        const res = await fetch('/api/run-python', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code: activeNote.content }),
        });
        if (res.ok) {
          const data = await res.json();
          setCodeOutput(
            [`[Python ${data.pythonVersion || '3.13'} Kernel Output]`].concat(
              (data.output || '').split('\n')
            )
          );
          if (data.plotPng) {
            setPythonPlot(data.plotPng);
          }
          setIsRunningCode(false);
          return;
        }
      } catch (err) {
        // Fallback to Pyodide WebAssembly Python in browser when hosted statically
      }

      try {
        setCodeOutput(['[Loading Pyodide WebAssembly Python Runtime in Browser...]']);
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



// --- src/App.jsx ---








function fireCelebrationConfetti() {
  if (typeof window !== 'undefined' && window.confetti) {
    window.confetti({
      particleCount: 65,
      spread: 70,
      origin: { y: 0.65 },
    });
  }
}

const DEFAULT_TODOS = [];

const DEFAULT_NOTES = [
  {
    id: 'note-1',
    title: 'Untitled Note',
    color: 'yellow',
    pinned: false,
    tags: [],
    updatedAt: Date.now(),
    content: '',
  },
];

// Clear any previously cached demo/example data so the workspace starts clean and blank
try {
  if (typeof window !== 'undefined' && !localStorage.getItem('omniword_blank_reset_v1')) {
    localStorage.removeItem('omniword_documents');
    localStorage.removeItem('todos');
    localStorage.removeItem('omniword_notes');
    localStorage.removeItem('omniword_page_settings');
    localStorage.setItem('omniword_blank_reset_v1', 'true');
  }
} catch (e) {
  console.error(e);
}

function App() {
  // Primary Workspace Mode: 'bento' | 'word' | 'todo' | 'notepad' | 'split'
  const [workspaceMode, setWorkspaceMode] = useState('word');
  const [activeRibbonTab, setActiveRibbonTab] = useState('home');
  const [darkChrome, setDarkChrome] = useState(false);
  const [atmosphere, setAtmosphere] = useState(() => {
    return localStorage.getItem('omniword_atmosphere') || 'aurora';
  });

  // Documents State
  const [documents, setDocuments] = useState(() => {
    try {
      const saved = localStorage.getItem('omniword_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
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
      console.error(e);
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

  // Todos State
  const [todos, setTodos] = useState(() => {
    try {
      const raw = localStorage.getItem('todos');
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed?.todos;
        if (Array.isArray(list)) {
          return list.map((item, idx) =>
            typeof item === 'string'
              ? {
                  id: `legacy-${idx}-${Date.now()}`,
                  text: item,
                  completed: false,
                  status: 'todo',
                  priority: 'medium',
                  category: 'General',
                  dueDate: '',
                  notes: '',
                }
              : item
          );
        }
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_TODOS;
  });

  // Notepad State
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('omniword_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error(e);
    }
    return DEFAULT_NOTES;
  });
  const [activeNoteId, setActiveNoteId] = useState(() => notes[0]?.id || 'note-1');

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
  const [toast, setToast] = useState(null);
  const [outlineHeadings, setOutlineHeadings] = useState([]);

  const editorRef = useRef(null);
  const activeDoc =
    documents.find((d) => d.id === activeDocId) || documents[0];

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev));
    }, 3400);
  }, []);

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

  // Persist States to LocalStorage + Python SQLite3 Backend (/api/state)
  useEffect(() => {
    localStorage.setItem('omniword_documents', JSON.stringify(documents));
    localStorage.setItem('todos', JSON.stringify({ todos }));
    localStorage.setItem('omniword_notes', JSON.stringify(notes));
    localStorage.setItem('omniword_page_settings', JSON.stringify(pageSettings));

    const timer = setTimeout(() => {
      fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documents, todos, notes, pageSettings }),
      }).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [documents, todos, notes, pageSettings]);

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

  useEffect(() => {
    if (editorRef.current && activeDoc) {
      if (editorRef.current.innerHTML !== activeDoc.content) {
        editorRef.current.innerHTML = activeDoc.content;
      }
      refreshOutline();
    }
  }, [activeDocId, workspaceMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleEditorInput = () => {
    if (!editorRef.current) return;
    const html = editorRef.current.innerHTML;
    setDocuments((prev) =>
      prev.map((d) =>
        d.id === activeDoc.id ? { ...d, content: html, updatedAt: Date.now() } : d
      )
    );
    refreshOutline();
  };

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
    if (!editorRef.current) {
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === activeDoc.id
            ? { ...d, content: d.content + htmlSnippet, updatedAt: Date.now() }
            : d
        )
      );
      return;
    }
    editorRef.current.focus();
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editorRef.current.contains(sel.anchorNode)) {
      document.execCommand('insertHTML', false, htmlSnippet);
    } else {
      editorRef.current.innerHTML += htmlSnippet;
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
    const text = sel.toString();
    let ptValue = sizeAction;
    if (sizeAction === 'increase') ptValue = '14pt';
    if (sizeAction === 'decrease') ptValue = '10pt';
    document.execCommand(
      'insertHTML',
      false,
      `<span style="font-size: ${ptValue};">${text}</span>`
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
    const reader = new FileReader();
    reader.onload = (ev) => {
      const html = `<div style="text-align:center; margin:14px 0;"><img src="${ev.target.result}" alt="${file.name}" style="max-width:85%; height:auto; border-radius:6px; box-shadow:0 2px 8px rgba(0,0,0,0.1);" /><p style="font-size:9.5pt; color:#64748b; margin-top:4px;">Figure: ${file.name}</p></div><p><br/></p>`;
      insertHtmlAtCursor(html);
      showToast(`Inserted image "${file.name}"`);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleInsertLink = () => {
    const url = window.prompt('Enter URL (e.g. https://example.com):', 'https://');
    if (!url) return;
    const label = window.prompt('Enter link display text:', url) || url;
    insertHtmlAtCursor(
      `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:#2563eb; text-decoration:underline;">${label}</a> `
    );
  };

  const handleInsertSymbol = (sym) => {
    insertHtmlAtCursor(`<span>${sym}</span>`);
  };

  const handleInsertDateTime = () => {
    const now = new Date().toLocaleString([], {
      dateStyle: 'full',
      timeStyle: 'short',
    });
    insertHtmlAtCursor(`<span>${now}</span> `);
  };

  const handleInsertPageBreak = () => {
    insertHtmlAtCursor(
      `<div class="page-break" style="page-break-after: always; border-top: 2px dashed #94a3b8; margin: 28px 0; text-align: center; position: relative;"><span class="no-export" style="background: #f1f5f9; color: #64748b; font-size: 9pt; padding: 2px 10px; border-radius: 10px; position: relative; top: -10px;">--- PAGE BREAK ---</span></div><p><br/></p>`
    );
    showToast('Page Break inserted');
  };

  const handleInsertCoverPage = () => {
    const coverHtml = `
      <div style="padding: 48px 24px; text-align: center; border: 2px solid #1e3a8a; border-radius: 8px; background: linear-gradient(180deg, #eff6ff 0%, #ffffff 100%); margin-bottom: 28px; page-break-after: always;">
        <p style="letter-spacing: 3px; text-transform: uppercase; color: #2563eb; font-weight: 700; font-size: 10pt;">OFFICIAL DOCUMENT</p>
        <h1 style="font-size: 28pt; color: #0f172a; margin: 16px 0;">${activeDoc.title}</h1>
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
        return `<div style="margin-left:${indent}; padding:4px 0; border-bottom:1px dotted #cbd5e1; display:flex; justify-content:space-between;"><span><strong>${
          i + 1
        }.</strong> ${node.innerText}</span><span style="color:#64748b;">Section ${i + 1}</span></div>`;
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
      const transcript = event.results[0][0].transcript;
      insertHtmlAtCursor(`<span>${transcript} </span>`);
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
      const content = String(ev.target.result || '');
      const baseName = file.name.replace(/\.[^/.]+$/, '');
      let htmlContent = content;
      if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
        htmlContent = content
          .split('\n')
          .map((line) => `<p>${line || '<br/>'}</p>`)
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
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: tpl.name,
      content: tpl.content,
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

  // ==================== TO-DO HANDLERS ====================
  const handleAddTodo = (todoData) => {
    const newTodo = {
      id: `todo-${Date.now()}`,
      completed: false,
      status: 'todo',
      ...todoData,
    };
    setTodos((prev) => [newTodo, ...prev]);
    showToast('Task added to To-Do List');
  };

  const handleToggleTodo = (id) => {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextDone = !t.completed;
          if (nextDone) fireCelebrationConfetti();
          return { ...t, completed: nextDone, status: nextDone ? 'done' : 'todo' };
        }
        return t;
      })
    );
  };

  const handleDeleteTodo = (id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  };

  const handleUpdateTodo = (id, updates) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  };

  const handleClearCompletedTodos = () => {
    setTodos((prev) => prev.filter((t) => !t.completed));
    showToast('Cleared completed tasks');
  };

  const handleInsertTodosIntoWord = () => {
    const html = convertTodosToHtml(todos, 'Action Plan & Task Checklist');
    insertHtmlAtCursor(html);
    if (workspaceMode !== 'word' && workspaceMode !== 'split') {
      setWorkspaceMode('word');
    }
    showToast('Inserted To-Do List table into Word Document!');
  };

  const handleOpenTodosAsWordDoc = () => {
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

  // ==================== NOTEPAD HANDLERS ====================
  const handleCreateNote = () => {
    const colors = ['yellow', 'blue', 'green', 'pink', 'purple', 'white', 'dark'];
    const nextColor = colors[notes.length % colors.length];
    const newNote = {
      id: `note-${Date.now()}`,
      title: `Quick Note ${notes.length + 1}`,
      color: nextColor,
      pinned: false,
      tags: ['note'],
      content: '',
      updatedAt: Date.now(),
    };
    setNotes((prev) => [newNote, ...prev]);
    setActiveNoteId(newNote.id);
    showToast('Created new Super-Note');
  };

  const handleUpdateNote = (id, updates) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
      )
    );
  };

  const handleDeleteNote = (id) => {
    const remaining = notes.filter((n) => n.id !== id);
    setNotes(remaining);
    if (activeNoteId === id && remaining[0]) {
      setActiveNoteId(remaining[0].id);
    }
  };

  const handleInsertNoteIntoWord = (noteObj) => {
    const target =
      noteObj || notes.find((n) => n.id === activeNoteId) || notes[0];
    if (!target) return;
    const parsedBody =
      typeof window !== 'undefined' && window.marked
        ? window.marked.parse(target.content || '')
        : `<div style="white-space:pre-wrap;">${(target.content || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')}</div>`;

    const formatted = `
      <div style="background-color:#fefce8; border-left:4px solid #eab308; padding:12px 16px; border-radius:6px; margin:14px 0;">
        <h3 style="margin:0 0 6px; color:#854d0e;">📝 ${target.title}</h3>
        ${parsedBody}
      </div><p><br/></p>`;
    insertHtmlAtCursor(formatted);
    if (workspaceMode !== 'word' && workspaceMode !== 'split') {
      setWorkspaceMode('word');
    }
    showToast(`Inserted note "${target.title}" into Word Document!`);
  };

  const handleConvertNoteToWordDoc = (noteObj) => {
    if (!noteObj) return;
    const parsedBody =
      typeof window !== 'undefined' && window.marked
        ? window.marked.parse(noteObj.content || '')
        : (noteObj.content || '')
            .split('\n')
            .map((line) => `<p>${line || '<br/>'}</p>`)
            .join('');
    const newDoc = {
      id: `doc-${Date.now()}`,
      title: noteObj.title || 'Converted Note',
      content: `<h1>${noteObj.title}</h1><hr/>${parsedBody}`,
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

    const created = lines.map((line, idx) => ({
      id: `todo-extracted-${Date.now()}-${idx}`,
      text: line,
      completed: false,
      status: 'todo',
      priority: 'medium',
      category: 'General',
      dueDate: '',
      notes: `From note: ${noteObj.title}`,
    }));
    setTodos((prev) => [...created, ...prev]);
    showToast(`Added ${created.length} task(s) to your To-Do List!`);
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

  // ==================== DOCUMENT METRICS ====================
  const getDocStats = () => {
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
  };

  const stats = getDocStats();

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

      {/* ==================== TOP OFFICE 365 APPLICATION BAR ==================== */}
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
              <span className="brand-badge">Fluent 2 Glass • Python + React</span>
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
            <span className="autosave-pill" title="Saved to SQLite3 + LocalStorage">
              <i className="fa-solid fa-cloud-arrow-up"></i> Synced
            </span>
          </div>
        </div>

        {/* Center Workspace Mode Switcher */}
        <nav className="workspace-mode-switcher">
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'bento' ? 'active' : ''}`}
            onClick={() => setWorkspaceMode('bento')}
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
            onClick={() => setWorkspaceMode('notepad')}
          >
            <i className="fa-solid fa-note-sticky"></i> Super-Notepad
            <span className="mode-count-badge">{notes.length}</span>
          </button>
          <button
            type="button"
            className={`mode-pill ${workspaceMode === 'todo' ? 'active' : ''}`}
            onClick={() => setWorkspaceMode('todo')}
          >
            <i className="fa-solid fa-list-check"></i> To-Do &amp; Kanban
            <span className="mode-count-badge">
              {todos.filter((t) => !t.completed).length}
            </span>
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
              localStorage.setItem('omniword_atmosphere', e.target.value);
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
              🏠 Bento Dashboard &amp; Soundscapes
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
              🐍 Python 3.13 + Matplotlib Notepad
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
            exportToDocx(activeDoc.title, activeDoc.content, pageSettings);
            fireCelebrationConfetti();
            showToast(`Exported "${activeDoc.title}.docx" (Microsoft Word)`);
          }}
          onExportDoc={() => {
            exportToDoc(activeDoc.title, activeDoc.content, pageSettings);
            fireCelebrationConfetti();
            showToast(`Exported "${activeDoc.title}.doc" (Word 97-2003)`);
          }}
          onExportPdf={async () => {
            showToast('Generating PDF document...');
            await exportToPdf(activeDoc.title, activeDoc.content, pageSettings);
            fireCelebrationConfetti();
            showToast(`Exported "${activeDoc.title}.pdf"`);
          }}
          onExportHtml={() => {
            exportToHtmlFile(activeDoc.title, activeDoc.content, pageSettings);
            showToast(`Exported "${activeDoc.title}.html"`);
          }}
          onExportTxt={() => {
            exportToTxtFile(activeDoc.title, activeDoc.content);
            showToast(`Exported "${activeDoc.title}.txt"`);
          }}
          onExportMd={() => {
            exportToMarkdownFile(activeDoc.title, activeDoc.content);
            showToast(`Exported "${activeDoc.title}.md"`);
          }}
          onPrint={() => printDocument(activeDoc.title, activeDoc.content, pageSettings)}
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
                        onClick={() => setActiveDocId(doc.id)}
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
                      {todos.filter((t) => !t.completed).length})
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
                showToast('Inserted Python Matplotlib Plot into Word Document!');
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
                localStorage.setItem('omniword_atmosphere', id);
              }}
              onSelectWorkspace={(mode) => setWorkspaceMode(mode)}
              onOpenDocument={(id) => setActiveDocId(id)}
              onCreateBlankDoc={createBlankDocument}
              onOpenTemplates={() => setShowTemplatesModal(true)}
              onToggleTodo={handleToggleTodo}
              onExportDocx={(doc) => {
                exportToDocx(doc.title, doc.content, pageSettings);
                fireCelebrationConfetti();
                showToast(`Exported "${doc.title}.docx"`);
              }}
              onExportPdf={async (doc) => {
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
            <i className="fa-solid fa-check-double"></i> Tasks:{' '}
            {todos.filter((t) => t.completed).length}/{todos.length} done
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



ReactDOM.createRoot(document.getElementById('root')).render(React.createElement(App));
