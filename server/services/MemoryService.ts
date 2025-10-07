export class MemoryService {
  private memories: Map<string, Array<{ message: string; reply: string; timestamp: Date }>> = new Map()

  async getMemories(userId: string): Promise<string[]> {
    const userMemories = this.memories.get(userId) || []
    
    const recentMemories = userMemories
      .slice(-5)
      .map(m => `User: ${m.message}\nAssistant: ${m.reply}`)
    
    return recentMemories
  }

  async storeMemory(userId: string, message: string, reply: string): Promise<void> {
    if (!this.memories.has(userId)) {
      this.memories.set(userId, [])
    }

    const userMemories = this.memories.get(userId)!
    userMemories.push({
      message,
      reply,
      timestamp: new Date()
    })

    if (userMemories.length > 20) {
      userMemories.shift()
    }
  }

  async clearMemories(userId: string): Promise<void> {
    this.memories.delete(userId)
  }
}