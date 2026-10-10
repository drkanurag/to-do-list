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
export function prepareExportHtml(rawHtml, pageSettings = {}) {
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
export function exportToDocx(title, rawHtml, pageSettings = {}) {
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
export function exportToDoc(title, rawHtml, pageSettings = {}) {
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
export async function exportToPdf(title, rawHtml, pageSettings = {}) {
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
export function printDocument(title, rawHtml, pageSettings = {}) {
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
export function exportToHtmlFile(title, rawHtml, pageSettings = {}) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const html = prepareExportHtml(rawHtml, pageSettings);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerDownload(blob, `${cleanTitle}.html`);
}

export function exportToTxtFile(title, rawHtml) {
  const cleanTitle = (title || 'Untitled_Document').replace(/[^a-zA-Z0-9_-]/g, '_');
  const temp = document.createElement('div');
  temp.innerHTML = rawHtml;
  const text = temp.innerText || temp.textContent || '';
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerDownload(blob, `${cleanTitle}.txt`);
}

export function exportToMarkdownFile(title, rawHtml) {
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
export function convertTodosToHtml(todos = [], listTitle = 'Master Action Plan & To-Do List') {
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
