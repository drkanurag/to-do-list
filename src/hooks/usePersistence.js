import { useState, useEffect, useRef } from 'react';

/**
 * Safe LocalStorage and optional Backend State Sync Hook.
 * - Detects backend availability on mount.
 * - Debounces writes to avoid blocking on every keystroke.
 * - Gracefully handles storage quota exceptions.
 */
export function usePersistence(stateData, showToast) {
  const [isBackendAvailable, setIsBackendAvailable] = useState(false);
  const saveTimeoutRef = useRef(null);

  // Check backend reachability once on mount
  useEffect(() => {
    let active = true;
    fetch('/api/health', { method: 'GET' })
      .then((res) => {
        if (active && res.ok) {
          setIsBackendAvailable(true);
        }
      })
      .catch(() => {
        if (active) setIsBackendAvailable(false);
      });
    return () => {
      active = false;
    };
  }, []);

  // Debounced persistence effect
  useEffect(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      const { documents, todos, notes, pageSettings } = stateData;

      // 1. Safe localStorage persistence with QuotaExceededError protection
      try {
        if (documents) localStorage.setItem('omniword_documents', JSON.stringify(documents));
        if (todos) localStorage.setItem('todos', JSON.stringify({ todos }));
        if (notes) localStorage.setItem('omniword_notes', JSON.stringify(notes));
        if (pageSettings) localStorage.setItem('omniword_page_settings', JSON.stringify(pageSettings));
      } catch (err) {
        console.warn('LocalStorage quota exceeded or unavailable:', err);
        if (typeof showToast === 'function') {
          showToast('Local browser storage quota is near capacity.', 'warning');
        }
      }

      // 2. Sync to Python SQLite backend only if backend is detected online
      if (isBackendAvailable) {
        fetch('/api/state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ documents, todos, notes, pageSettings }),
        }).catch((err) => {
          console.debug('Background sync skipped:', err);
        });
      }
    }, 500);

    return () => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    };
  }, [stateData, isBackendAvailable, showToast]);

  return { isBackendAvailable };
}

