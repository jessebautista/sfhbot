import { MemoryClient } from 'mem0ai'

interface PersonalMemory {
  content: string
  timestamp: Date
  metadata?: Record<string, any>
}

export class Mem0PersonalMemory {
  private memory: MemoryClient | null = null
  private fallbackMemories: Map<string, PersonalMemory[]> = new Map()
  private mem0Available: boolean = false
  private initializationAttempted: boolean = false

  constructor() {
    // Don't initialize Mem0 in constructor to avoid blocking startup
    console.log('Mem0PersonalMemory service created, will initialize on first use')
  }

  isAvailable(): boolean {
    return this.mem0Available
  }

  private async initializeMem0(): Promise<void> {
    if (this.initializationAttempted) return
    this.initializationAttempted = true

    try {
      const apiKey = process.env.MEM0_API_KEY?.trim()
      console.log('Attempting Mem0 initialization - API key present:', !!apiKey, 'Length:', apiKey?.length || 0)
      console.log('API key first/last 4 chars:', apiKey ? `${apiKey.substring(0, 4)}...${apiKey.substring(apiKey.length - 4)}` : 'none')
      
      if (apiKey && apiKey.length > 0) {
        this.memory = new MemoryClient({ apiKey })
        this.mem0Available = true
        console.log('Mem0 service initialized successfully')
      } else {
        console.log('MEM0_API_KEY not found, using fallback memory storage')
        this.mem0Available = false
      }
    } catch (error) {
      console.error('Failed to initialize Mem0:', error)
      console.log('Falling back to in-memory storage')
      this.mem0Available = false
      this.memory = null
    }
  }

  async storePersonalMemory(userId: string, message: string, reply: string, context?: Record<string, any>): Promise<void> {
    try {
      await this.initializeMem0()
      
      const memoryContent = `User said: "${message}" | Assistant replied: "${reply}"`
      
      if (this.memory && this.mem0Available) {
        console.log(`💾 Storing conversation memory for user ${userId.substring(0, 8)}...`)
        await this.memory.add([
          { role: "user", content: message },
          { role: "assistant", content: reply }
        ], {
          user_id: userId,
          metadata: {
            timestamp: new Date().toISOString(),
            type: 'conversation',
            user_message: message,
            assistant_reply: reply,
            ...context
          }
        })
        console.log(`✅ Conversation memory stored successfully`)
      } else {
        // Fallback to in-memory storage
        if (!this.fallbackMemories.has(userId)) {
          this.fallbackMemories.set(userId, [])
        }
        
        const userMemories = this.fallbackMemories.get(userId)!
        userMemories.push({
          content: memoryContent,
          timestamp: new Date(),
          metadata: { 
            type: 'conversation', 
            user_message: message,
            assistant_reply: reply,
            ...context 
          }
        })
        
        // Keep only last 20 memories per user
        if (userMemories.length > 20) {
          userMemories.shift()
        }
      }
    } catch (error) {
      console.error('Error storing personal memory:', error)
      // Always store in fallback on error
      this.storeFallbackMemory(userId, message, reply, context)
    }
  }

  private storeFallbackMemory(userId: string, message: string, reply: string, context?: Record<string, any>): void {
    if (!this.fallbackMemories.has(userId)) {
      this.fallbackMemories.set(userId, [])
    }
    
    const userMemories = this.fallbackMemories.get(userId)!
    userMemories.push({
      content: `User said: "${message}" | Assistant replied: "${reply}"`,
      timestamp: new Date(),
      metadata: { type: 'conversation', ...context }
    })
    
    if (userMemories.length > 20) {
      userMemories.shift()
    }
  }

  async getPersonalContext(userId: string, currentQuery?: string): Promise<string[]> {
    try {
      await this.initializeMem0()
      
      if (this.memory && this.mem0Available) {
        try {
          const query = currentQuery || ''
          
          const memories = await this.memory.search(query, {
            user_id: userId,
            limit: 5
          })
          
          return memories?.map((result: any) => result.memory || result.content || '') || []
        } catch (searchError) {
          console.warn('Mem0 search failed, returning empty context:', searchError.message)
          return []
        }
      } else {
        // Fallback memory
        const userMemories = this.fallbackMemories.get(userId) || []
        return userMemories
          .slice(-5) // Get last 5 memories
          .map(memory => memory.content)
      }
    } catch (error) {
      console.error('Error retrieving personal context:', error)
      // Return fallback on error
      const userMemories = this.fallbackMemories.get(userId) || []
      return userMemories.slice(-5).map(memory => memory.content)
    }
  }

  async getRecentConversationHistory(userId: string, limit: number = 6): Promise<Array<{role: 'user' | 'assistant', content: string}>> {
    try {
      await this.initializeMem0()
      console.log(`🔍 Getting conversation history for user ${userId.substring(0, 8)}... (Mem0 available: ${this.mem0Available})`)
      if (this.memory && this.mem0Available) {
        try {
          // Get recent conversation history using Mem0
          const memories = await this.memory.getAll({
            filters: {
              user_id: userId
            },
            api_version: 'v2'
          })
          
          const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
          
          console.log(`🔍 Retrieved ${memories?.length || 0} memories for conversation history`)
          console.log(`🔍 Sample memory structure:`, memories?.[0] ? JSON.stringify(memories[0], null, 2) : 'No memories')
          
          if (memories && Array.isArray(memories)) {
            console.log(`🔍 Processing ${memories.length} memories for conversation history`)
            
            // Sort by timestamp (most recent first) and take pairs
            const sortedMemories = memories
              .filter((memory: any) => {
                const isConversation = memory.metadata?.type === 'conversation'
                console.log(`Memory type: ${memory.metadata?.type}, is conversation: ${isConversation}`)
                return isConversation
              })
              .sort((a: any, b: any) => new Date(b.created_at || b.timestamp || 0).getTime() - new Date(a.created_at || a.timestamp || 0).getTime())
              .slice(0, limit)
            
            console.log(`🔍 Found ${sortedMemories.length} conversation memories after filtering`)
            
            // Process memories in reverse to get chronological order
            for (let i = sortedMemories.length - 1; i >= 0; i--) {
              const memory = sortedMemories[i]
              const metadata = memory.metadata || {}
              
              console.log(`Memory ${i}: user_message=${!!metadata.user_message}, assistant_reply=${!!metadata.assistant_reply}`)
              
              if (metadata.user_message && metadata.assistant_reply) {
                conversationHistory.push({ role: 'user', content: metadata.user_message })
                conversationHistory.push({ role: 'assistant', content: metadata.assistant_reply })
              }
            }
            
            console.log(`📝 Final conversation history: ${conversationHistory.length} messages`)
          }
          
          return conversationHistory.slice(-limit)
        } catch (error) {
          console.warn('Failed to get recent conversation from Mem0:', error.message)
          console.warn('Full error:', error)
          return this.getFallbackConversationHistory(userId, limit)
        }
      } else {
        console.log(`🔄 Using fallback conversation history for user ${userId.substring(0, 8)}`)
        return this.getFallbackConversationHistory(userId, limit)
      }
    } catch (error) {
      console.error('Error getting recent conversation history:', error)
      return this.getFallbackConversationHistory(userId, limit)
    }
  }

  private getFallbackConversationHistory(userId: string, limit: number): Array<{role: 'user' | 'assistant', content: string}> {
    const userMemories = this.fallbackMemories.get(userId) || []
    const conversationHistory: Array<{role: 'user' | 'assistant', content: string}> = []
    
    console.log(`📋 Fallback memories for user ${userId.substring(0, 8)}: ${userMemories.length} total`)
    
    // Get recent conversation pairs from fallback
    const recentMemories = userMemories
      .filter(memory => memory.metadata?.type === 'conversation')
      .slice(-limit)
    
    console.log(`📋 Fallback conversation memories: ${recentMemories.length} found`)
    
    for (const memory of recentMemories) {
      const metadata = memory.metadata || {}
      if (metadata.user_message && metadata.assistant_reply) {
        conversationHistory.push({ role: 'user', content: metadata.user_message })
        conversationHistory.push({ role: 'assistant', content: metadata.assistant_reply })
      }
    }
    
    return conversationHistory.slice(-limit)
  }

  async storeUserPreference(userId: string, preference: string, value: any): Promise<void> {
    try {
      const preferenceText = `User prefers ${preference}: ${value}`
      
      if (this.memory) {
        await this.memory.add([
          { role: "user", content: preferenceText }
        ], {
          user_id: userId,
          metadata: {
            type: 'preference',
            preference_key: preference,
            preference_value: value,
            timestamp: new Date().toISOString()
          }
        })
      } else {
        if (!this.fallbackMemories.has(userId)) {
          this.fallbackMemories.set(userId, [])
        }
        
        this.fallbackMemories.get(userId)!.push({
          content: preferenceText,
          timestamp: new Date(),
          metadata: { type: 'preference', preference_key: preference }
        })
      }
    } catch (error) {
      console.error('Error storing user preference:', error)
    }
  }

  async clearUserMemories(userId: string): Promise<void> {
    try {
      if (this.memory) {
        // Note: Mem0 might not have a direct clear method for a specific user
        // This would need to be implemented based on their current API
        console.log(`Attempting to clear memories for user: ${userId}`)
        // You might need to get all memories and delete them individually
      }
      
      // Clear fallback memories
      this.fallbackMemories.delete(userId)
    } catch (error) {
      console.error('Error clearing user memories:', error)
    }
  }

  async getUserInsights(userId: string): Promise<string[]> {
    try {
      await this.initializeMem0()
      
      if (this.memory && this.mem0Available) {
        try {
          const insights = await this.memory.search('user preferences interests donations volunteering', {
            user_id: userId,
            limit: 3
          })
          
          return insights?.map((result: any) => result.memory || result.content || '') || []
        } catch (searchError) {
          console.warn('Mem0 insights search failed, returning empty insights:', searchError.message)
          return []
        }
      } else {
        const userMemories = this.fallbackMemories.get(userId) || []
        const preferenceMemories = userMemories
          .filter(memory => memory.metadata?.type === 'preference')
          .map(memory => memory.content)
        
        return preferenceMemories.slice(-3)
      }
    } catch (error) {
      console.error('Error getting user insights:', error)
      const userMemories = this.fallbackMemories.get(userId) || []
      return userMemories
        .filter(memory => memory.metadata?.type === 'preference')
        .slice(-3)
        .map(memory => memory.content)
    }
  }

  isMemoryServiceAvailable(): boolean {
    return this.mem0Available && this.memory !== null
  }

  getFallbackMemoryCount(): number {
    let total = 0
    for (const memories of this.fallbackMemories.values()) {
      total += memories.length
    }
    return total
  }
}