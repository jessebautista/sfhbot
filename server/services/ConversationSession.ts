interface ConversationMessage {
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface UserSession {
  messages: ConversationMessage[]
  lastActivity: Date
}

export class ConversationSession {
  private sessions: Map<string, UserSession> = new Map()
  private readonly MAX_MESSAGES = 10 // Keep last 10 messages per user
  private readonly SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes

  constructor() {
    // Clean up old sessions every 5 minutes
    setInterval(() => {
      this.cleanupOldSessions()
    }, 5 * 60 * 1000)
  }

  /**
   * Add a message to the user's conversation session
   */
  addMessage(userId: string, role: 'user' | 'assistant', content: string): void {
    if (!this.sessions.has(userId)) {
      this.sessions.set(userId, {
        messages: [],
        lastActivity: new Date()
      })
    }

    const session = this.sessions.get(userId)!
    
    // Add the new message
    session.messages.push({
      role,
      content,
      timestamp: new Date()
    })

    // Keep only the last MAX_MESSAGES
    if (session.messages.length > this.MAX_MESSAGES) {
      session.messages = session.messages.slice(-this.MAX_MESSAGES)
    }

    // Update last activity
    session.lastActivity = new Date()

    console.log(`📝 Added ${role} message to session. Total messages: ${session.messages.length}`)
  }

  /**
   * Get conversation history for a user (excluding the current message)
   */
  getConversationHistory(userId: string): ConversationMessage[] {
    const session = this.sessions.get(userId)
    if (!session) {
      return []
    }

    // Return all messages except the last one (which would be the current user message)
    return session.messages.slice(0, -1)
  }

  /**
   * Get all conversation messages for a user
   */
  getAllMessages(userId: string): ConversationMessage[] {
    const session = this.sessions.get(userId)
    return session ? [...session.messages] : []
  }

  /**
   * Clear conversation history for a user
   */
  clearUserSession(userId: string): void {
    this.sessions.delete(userId)
    console.log(`🗑️ Cleared conversation session for user ${userId.substring(0, 8)}`)
  }

  /**
   * Clean up old inactive sessions
   */
  private cleanupOldSessions(): void {
    const now = new Date()
    let cleanedCount = 0

    for (const [userId, session] of this.sessions.entries()) {
      if (now.getTime() - session.lastActivity.getTime() > this.SESSION_TIMEOUT) {
        this.sessions.delete(userId)
        cleanedCount++
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} inactive conversation sessions`)
    }
  }

  /**
   * Get session statistics
   */
  getStats(): { activeUsers: number, totalMessages: number } {
    let totalMessages = 0
    for (const session of this.sessions.values()) {
      totalMessages += session.messages.length
    }

    return {
      activeUsers: this.sessions.size,
      totalMessages
    }
  }
}

// Singleton instance
export const conversationSession = new ConversationSession()