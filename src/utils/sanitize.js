/**
 * Robust HTML Sanitization & URL Validation Utilities
 * Powered by DOMPurify with defensive fallbacks and protocol whitelisting.
 */

const ALLOWED_PROTOCOLS = ['http:', 'https:', 'mailto:'];

/**
 * Escapes characters for safe inclusion in plain HTML text and attributes.
 */
export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Validates and sanitizes a URL.
 * Only allows http:, https:, and mailto: protocols.
 * Rejects javascript:, data:, vbscript:, and relative script injections.
 */
export function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  try {
    const parsed = new URL(trimmed, window.location.origin);
    if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
      return trimmed;
    }
    return '#';
  } catch {
    // If not a parseable URL, reject if it has forbidden patterns
    if (/^(javascript|data|vbscript):/i.test(trimmed)) {
      return '#';
    }
    return '#';
  }
}

/**
 * Sanitizes HTML content using DOMPurify with strict protocol and tag whitelisting.
 */
export function sanitizeHtml(dirtyHtml) {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  const purify =
    (typeof window !== 'undefined' && window.DOMPurify) || null;

  if (purify && typeof purify.sanitize === 'function') {
    return purify.sanitize(dirtyHtml, {
      ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
      ADD_ATTR: ['target', 'rel', 'style', 'class', 'colspan', 'rowspan'],
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
    });
  }

  // Fallback basic sanitizer if DOMPurify is not yet loaded
  const template = document.createElement('template');
  template.innerHTML = dirtyHtml;
  const scripts = template.content.querySelectorAll('script, iframe, object, embed');
  scripts.forEach((s) => s.remove());
  return template.innerHTML;
}

