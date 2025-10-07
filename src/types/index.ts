export interface Message {
  id: string
  content: string
  sender: 'user' | 'bot'
  timestamp: Date
}

export interface ChatRequest {
  userId: string
  message: string
}

export interface ChatResponse {
  reply: string
  success: boolean
  error?: string
}

export interface ChatLog {
  id: string
  user_id: string
  message: string
  reply: string
  timestamp: Date
}