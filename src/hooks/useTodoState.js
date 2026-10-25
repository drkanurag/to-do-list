import { useState, useCallback } from 'react';

function generateTaskId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'task-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7);
}

export function useTodoState(onTaskCompleted) {
  const [todos, setTodos] = useState(() => {
    try {
      const raw = localStorage.getItem('todos');
      if (raw) {
        const parsed = JSON.parse(raw);
        const list = Array.isArray(parsed) ? parsed : parsed?.todos;
        if (Array.isArray(list)) {
          return list.map((item, idx) => {
            if (typeof item === 'string') {
              return {
                id: generateTaskId(),
                text: item,
                status: 'todo',
                priority: 'medium',
                category: 'General',
                dueDate: '',
                notes: '',
              };
            }
            // Normalize legacy completed boolean to unified status
            const normalizedStatus =
              item.status || (item.completed ? 'done' : 'todo');
            const { completed, ...cleanItem } = item;
            return {
              id: cleanItem.id || generateTaskId(),
              ...cleanItem,
              status: normalizedStatus,
            };
          });
        }
      }
    } catch (e) {
      console.error('Error loading tasks:', e);
    }
    return [];
  });

  const handleAddTodo = useCallback((todoData) => {
    const newTodo = {
      id: generateTaskId(),
      status: 'todo',
      priority: 'medium',
      category: 'General',
      dueDate: '',
      notes: '',
      ...todoData,
    };
    setTodos((prev) => [newTodo, ...prev]);
  }, []);

  const handleToggleTodo = useCallback((id) => {
    setTodos((prev) =>
      prev.map((t) => {
        if (t.id === id) {
          const nextStatus = t.status === 'done' ? 'todo' : 'done';
          if (nextStatus === 'done' && typeof onTaskCompleted === 'function') {
            onTaskCompleted();
          }
          return { ...t, status: nextStatus };
        }
        return t;
      })
    );
  }, [onTaskCompleted]);

  const handleDeleteTodo = useCallback((id) => {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const handleUpdateTodo = useCallback((id, updates) => {
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates } : t))
    );
  }, []);

  const handleClearCompletedTodos = useCallback(() => {
    setTodos((prev) => prev.filter((t) => t.status !== 'done'));
  }, []);

  return {
    todos,
    setTodos,
    handleAddTodo,
    handleToggleTodo,
    handleDeleteTodo,
    handleUpdateTodo,
    handleClearCompletedTodos,
  };
}

