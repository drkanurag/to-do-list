import { useState, useCallback } from 'react';

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

export function useNotepadState() {
  const [notes, setNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('omniword_notes');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.error('Error loading notes:', e);
    }
    return DEFAULT_NOTES;
  });

  const [activeNoteId, setActiveNoteId] = useState(() => notes[0]?.id || 'note-1');

  const handleCreateNote = useCallback(() => {
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
    return newNote;
  }, [notes.length]);

  const handleUpdateNote = useCallback((id, updates) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id ? { ...n, ...updates, updatedAt: Date.now() } : n
      )
    );
  }, []);

  const handleDeleteNote = useCallback((id) => {
    setNotes((prev) => {
      const remaining = prev.filter((n) => n.id !== id);
      if (activeNoteId === id && remaining[0]) {
        setActiveNoteId(remaining[0].id);
      }
      return remaining;
    });
  }, [activeNoteId]);

  return {
    notes,
    setNotes,
    activeNoteId,
    setActiveNoteId,
    handleCreateNote,
    handleUpdateNote,
    handleDeleteNote,
  };
}

