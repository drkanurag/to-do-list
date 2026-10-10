import React from 'react'
import TodoCard from './TodoCard'

export default function TodoList(props) {
  const { todos } = props

  return (
    <ul className='main'>
      {todos.map((todo, todoIndex) => {
        const text = typeof todo === 'string' ? todo : todo.text
        return (
          <TodoCard {...props} key={todoIndex} index={todoIndex}>
            <p>{text}</p>
          </TodoCard>
        )
      })}
    </ul>
  )
}
