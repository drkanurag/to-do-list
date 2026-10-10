import React, { useState, useEffect } from 'react';
import {
  convertTodosToHtml,
  exportToDocx,
  exportToPdf,
} from '../utils/exportUtils';

const CATEGORIES = ['General', 'Work', 'Study', 'Personal', 'Document', 'Urgent'];

export default function TodoManager({
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
