import React, { useState, useRef, useEffect } from 'react'
import { Message } from '../types'

interface ChatWidgetProps {
  userId: string
}

const ChatWidget: React.FC<ChatWidgetProps> = ({ userId }) => {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const sendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue,
      sender: 'user',
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInputValue('')
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          userId,
          message: inputValue
        })
      })

      const raw = await response.text()

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}${raw ? `: ${raw}` : ''}`)
      }

      if (!raw) {
        throw new Error('Empty response from server')
      }

      let data: any
      // Always try to parse as JSON first, regardless of content type
      try {
        data = JSON.parse(raw)
      } catch (parseError) {
        console.log('JSON parse failed for response:', raw)
        // If JSON parsing fails, treat as plain text response
        data = { reply: raw }
      }

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data?.reply || 'Sorry, I encountered an error.',
        sender: 'bot',
        timestamp: new Date()
      }

      setMessages(prev => [...prev, botMessage])
    } catch (error) {
      console.error('Error sending message:', error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot',
        timestamp: new Date()
      }
      setMessages(prev => [...prev, errorMessage])
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div className="chat-widget">
      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
          >
            <div className="message-content">
              {message.content}
            </div>
            <div className="message-timestamp">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="message bot-message">
            <div className="message-content typing">
              Typing...
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>
      
      <div className="input-container">
        <textarea
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me anything about our organization..."
          disabled={isLoading}
          rows={3}
        />
        <button
          onClick={sendMessage}
          disabled={isLoading || !inputValue.trim()}
        >
          Send
        </button>
      </div>

      <style>{`
        .chat-widget {
          max-width: 600px;
          margin: 0 auto;
          border: 1px solid #ccc;
          border-radius: 8px;
          height: 500px;
          display: flex;
          flex-direction: column;
          background: #f9f9f9;
        }

        .messages-container {
          flex: 1;
          overflow-y: auto;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .message {
          display: flex;
          flex-direction: column;
          max-width: 80%;
        }

        .user-message {
          align-self: flex-end;
          align-items: flex-end;
        }

        .bot-message {
          align-self: flex-start;
          align-items: flex-start;
        }

        .message-content {
          padding: 12px;
          border-radius: 12px;
          word-wrap: break-word;
        }

        .user-message .message-content {
          background: #007bff;
          color: white;
        }

        .bot-message .message-content {
          background: white;
          border: 1px solid #ddd;
          color: #333;
        }

        .message-timestamp {
          font-size: 0.8em;
          color: #666;
          margin-top: 4px;
        }

        .typing {
          font-style: italic;
          opacity: 0.7;
        }

        .input-container {
          padding: 16px;
          border-top: 1px solid #ddd;
          display: flex;
          gap: 8px;
        }

        .input-container textarea {
          flex: 1;
          padding: 8px;
          border: 1px solid #ddd;
          border-radius: 4px;
          resize: none;
          font-family: inherit;
        }

        .input-container button {
          padding: 8px 16px;
          background: #007bff;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
        }

        .input-container button:disabled {
          background: #ccc;
          cursor: not-allowed;
        }

        .input-container button:hover:not(:disabled) {
          background: #0056b3;
        }
      `}</style>
    </div>
  )
}

export default ChatWidget
