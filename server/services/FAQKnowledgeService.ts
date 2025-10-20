import fs from 'fs'
import path from 'path'

export interface FAQItem {
  question: string
  answer: string
  category?: string
  keywords: string[]
}

export class FAQKnowledgeService {
  private faqData: FAQItem[] = []
  private isLoaded = false

  constructor() {
    this.loadFAQData()
  }

  private loadFAQData(): void {
    try {
      // Try to load FAQ.md from multiple possible locations
      const possiblePaths = [
        path.join(process.cwd(), 'public', 'FAQ.md'),
        path.join(process.cwd(), 'dist', 'FAQ.md'),
        path.join(__dirname, '..', '..', 'public', 'FAQ.md'),
        path.join(__dirname, '..', '..', 'dist', 'FAQ.md')
      ]

      let faqContent = ''
      let loadedFrom = ''

      for (const faqPath of possiblePaths) {
        try {
          if (fs.existsSync(faqPath)) {
            faqContent = fs.readFileSync(faqPath, 'utf-8')
            loadedFrom = faqPath
            break
          }
        } catch (error) {
          // Continue to next path
          continue
        }
      }

      if (!faqContent.trim()) {
        console.log('FAQ.md is empty or not found. Using default FAQ structure.')
        this.initializeDefaultFAQ()
        return
      }

      console.log(`✅ FAQ loaded from: ${loadedFrom}`)
      this.parseFAQContent(faqContent)
      this.isLoaded = true

    } catch (error) {
      console.error('Error loading FAQ:', error)
      this.initializeDefaultFAQ()
    }
  }

  private initializeDefaultFAQ(): void {
    // Default FAQ structure that can be easily updated
    this.faqData = [
      {
        question: "What is SFH Bot?",
        answer: "SFH Bot is an AI-powered receptionist service designed specifically for non-profit organizations. I provide 24/7 automated customer support for donations, events, volunteering inquiries, and general organizational information.",
        category: "About",
        keywords: ["about", "what is", "sfh bot", "ai receptionist", "non-profit"]
      },
      {
        question: "How can I help with donations?",
        answer: "I can provide information about donation processes, accepted donation methods, tax deductibility, and connect you with the appropriate team members for larger donations or specific donation inquiries.",
        category: "Donations",
        keywords: ["donate", "donation", "give", "contribute", "tax deductible"]
      },
      {
        question: "What volunteer opportunities are available?",
        answer: "I can help you learn about current volunteer opportunities, application processes, and connect you with our volunteer coordination team. Please let me know what type of volunteering interests you most.",
        category: "Volunteering",
        keywords: ["volunteer", "help", "give time", "opportunities", "community service"]
      },
      {
        question: "How can I get involved with events?",
        answer: "I can provide information about upcoming events, registration processes, and how to stay updated on our event calendar. Would you like to know about specific types of events?",
        category: "Events",
        keywords: ["events", "calendar", "activities", "programs", "register"]
      }
    ]
    
    console.log('📋 Default FAQ initialized with foundational knowledge')
    this.isLoaded = true
  }

  private parseFAQContent(content: string): void {
    // Parse markdown FAQ format
    const lines = content.split('\n')
    const faqs: FAQItem[] = []
    
    let currentQuestion = ''
    let currentAnswer = ''
    let currentCategory = 'General'
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim()
      
      // Category headers (## Category Name)
      if (line.startsWith('## ')) {
        currentCategory = line.replace('## ', '')
        continue
      }
      
      // Questions (### Question or **Question**)
      if (line.startsWith('### ') || (line.startsWith('**') && line.endsWith('**'))) {
        // Save previous Q&A if exists
        if (currentQuestion && currentAnswer) {
          faqs.push(this.createFAQItem(currentQuestion, currentAnswer, currentCategory))
        }
        
        currentQuestion = line.replace('### ', '').replace(/\*\*/g, '')
        currentAnswer = ''
        continue
      }
      
      // Answers (regular text)
      if (line && !line.startsWith('#') && currentQuestion) {
        currentAnswer += (currentAnswer ? ' ' : '') + line
      }
    }
    
    // Add the last Q&A
    if (currentQuestion && currentAnswer) {
      faqs.push(this.createFAQItem(currentQuestion, currentAnswer, currentCategory))
    }
    
    this.faqData = faqs
    console.log(`📚 Parsed ${faqs.length} FAQ items from FAQ.md`)
  }

  private createFAQItem(question: string, answer: string, category: string): FAQItem {
    // Generate keywords from question and answer
    const keywords = this.extractKeywords(question + ' ' + answer)
    
    return {
      question: question.trim(),
      answer: answer.trim(),
      category,
      keywords
    }
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'will', 'would', 'could', 'should', 'can', 'may', 'might'
    ])
    
    return text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word))
      .slice(0, 10) // Limit to top 10 keywords
  }

  public searchFAQ(query: string): FAQItem[] {
    if (!this.isLoaded) {
      return []
    }

    const queryWords = query.toLowerCase().split(/\s+/)
    const matches: Array<{item: FAQItem, score: number}> = []

    for (const faq of this.faqData) {
      let score = 0
      
      // Check question match
      const questionMatch = queryWords.some(word => 
        faq.question.toLowerCase().includes(word)
      )
      if (questionMatch) score += 3
      
      // Check keyword match
      const keywordMatch = queryWords.some(word =>
        faq.keywords.some(keyword => keyword.includes(word) || word.includes(keyword))
      )
      if (keywordMatch) score += 2
      
      // Check answer match
      const answerMatch = queryWords.some(word =>
        faq.answer.toLowerCase().includes(word)
      )
      if (answerMatch) score += 1
      
      if (score > 0) {
        matches.push({ item: faq, score })
      }
    }

    // Sort by score and return top matches
    return matches
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(match => match.item)
  }

  public getAllFAQs(): FAQItem[] {
    return this.faqData
  }

  public getFAQsByCategory(category: string): FAQItem[] {
    return this.faqData.filter(faq => 
      faq.category?.toLowerCase() === category.toLowerCase()
    )
  }

  public getCategories(): string[] {
    const categories = new Set(this.faqData.map(faq => faq.category).filter(Boolean))
    return Array.from(categories)
  }

  public formatFAQForResponse(faqs: FAQItem[]): string {
    if (faqs.length === 0) {
      return ''
    }

    if (faqs.length === 1) {
      const faq = faqs[0]
      return `**${faq.question}**\n\n${faq.answer}`
    }

    let formatted = "Here's what I found in our FAQ:\n\n"
    for (const faq of faqs) {
      formatted += `**${faq.question}**\n${faq.answer}\n\n`
    }
    
    return formatted.trim()
  }

  public reloadFAQ(): void {
    console.log('🔄 Reloading FAQ data...')
    this.isLoaded = false
    this.faqData = []
    this.loadFAQData()
  }
}