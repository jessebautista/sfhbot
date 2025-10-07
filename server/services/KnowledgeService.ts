export class KnowledgeService {
  private knowledgeBase: Array<{ content: string; category: string }> = [
    {
      content: "Our non-profit organization focuses on community support and charitable activities. We accept donations year-round and organize regular community events.",
      category: "general"
    },
    {
      content: "Donations can be made through our website, by check, or in person. All donations are tax-deductible and go directly to supporting our community programs.",
      category: "donations"
    },
    {
      content: "We host monthly community events including food drives, educational workshops, and volunteer appreciation gatherings. Check our events calendar for upcoming activities.",
      category: "events"
    },
    {
      content: "Volunteers are always welcome! We have opportunities for various skill levels and time commitments. Contact us to learn about current volunteer needs.",
      category: "volunteering"
    }
  ]

  async searchKnowledge(query: string): Promise<string[]> {
    const queryLower = query.toLowerCase()
    
    const relevantKnowledge = this.knowledgeBase
      .filter(item => {
        const content = item.content.toLowerCase()
        return content.includes(queryLower) || 
               queryLower.includes(item.category) ||
               this.hasKeywordMatch(queryLower, content)
      })
      .map(item => item.content)

    return relevantKnowledge.slice(0, 3)
  }

  private hasKeywordMatch(query: string, content: string): boolean {
    const queryWords = query.split(/\s+/)
    const contentWords = content.split(/\s+/)
    
    return queryWords.some(queryWord => 
      queryWord.length > 3 && 
      contentWords.some(contentWord => 
        contentWord.toLowerCase().includes(queryWord)
      )
    )
  }

  async addKnowledge(content: string, category: string): Promise<void> {
    this.knowledgeBase.push({ content, category })
  }
}