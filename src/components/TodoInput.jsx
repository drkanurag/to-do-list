import React from 'react'

export default function TodoInput(props) {
  const { handleAddTodos, todoValue, setTodoValue } = props
  return (
    <header>
      <input
        value={todoValue}
        onChange={(e) => setTodoValue(e.target.value)}
        placeholder="Enter todo..."
      />
      <button
        onClick={() => {
          if (!todoValue.trim()) return
          handleAddTodos(todoValue)
          setTodoValue('')
        }}
      >
        Add
      </button>
    </header>
  )
}
