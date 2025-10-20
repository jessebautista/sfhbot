import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

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
        question: "Who founded Sing for Hope?",
        answer: "Sing for Hope was founded in 2006 by Monica Yunus and Camille Zamora, two acclaimed opera singers who envisioned using the arts to build community and heal hearts.",
        category: "About",
        keywords: ["founder", "founded", "monica yunus", "camille zamora", "opera singers", "2006"]
      },
      {
        question: "What is Sing for Hope's mission?",
        answer: "Sing for Hope harnesses the power of the arts to create a better world. We bring hope, healing, and inspiration to millions by creating interactive public art projects and providing arts programming in underserved communities.",
        category: "About", 
        keywords: ["mission", "arts", "hope", "healing", "inspiration", "public art", "communities"]
      },
      {
        question: "Who is the current director of Sing for Hope?",
        answer: "Sing for Hope is co-led by its founders Monica Yunus and Camille Zamora, who serve as Co-Founders and Executive Directors. They continue to guide the organization's artistic vision and community impact initiatives.",
        category: "Leadership",
        keywords: ["director", "leadership", "executive", "monica yunus", "camille zamora", "co-founders"]
      },
      {
        question: "Who is the IT Director?",
        answer: "The IT Director at Sing for Hope is Alex Chen, who oversees all technology infrastructure, digital platforms, and information systems. Alex joined the organization in 2019 and has been instrumental in modernizing our digital capabilities.",
        category: "Leadership",
        keywords: ["it director", "technology", "alex chen", "digital", "infrastructure", "systems"]
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
      }
    ]
    
    console.log('📋 Default FAQ initialized with Sing for Hope foundational knowledge')
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
      console.log('🚫 FAQ not loaded, returning empty results')
      return []
    }

    // Filter out very common words that shouldn't trigger matches
    const stopWords = new Set([
      'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 
      'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 
      'has', 'had', 'will', 'would', 'could', 'should', 'can', 'may', 'might',
      'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
      'me', 'him', 'her', 'us', 'them', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
      'what', 'when', 'where', 'why', 'how', 'who', 'which', 'cool', 'about', 'mean'
    ])

    const queryWords = query.toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 2 && !stopWords.has(word.replace(/[^\w]/g, '')))
    
    const matches: Array<{item: FAQItem, score: number}> = []
    
    console.log(`🔍 Searching FAQ for: "${query}" (filtered words: ${queryWords.join(', ')})`)

    if (queryWords.length === 0) {
      console.log('⚠️ No meaningful search terms after filtering')
      return []
    }

    for (const faq of this.faqData) {
      let score = 0
      
      // Exact phrase match in question (highest priority)
      const exactPhraseMatch = queryWords.every(word =>
        faq.question.toLowerCase().includes(word)
      )
      if (exactPhraseMatch && queryWords.length > 1) score += 10
      
      // Individual word matches in question
      const questionMatches = queryWords.filter(word => 
        faq.question.toLowerCase().includes(word)
      ).length
      score += questionMatches * 3
      
      // Keyword matches (exact matches only)
      const keywordMatches = queryWords.filter(word =>
        faq.keywords.some(keyword => keyword.toLowerCase() === word.toLowerCase())
      ).length
      score += keywordMatches * 5
      
      // Partial keyword matches
      const partialKeywordMatches = queryWords.filter(word =>
        faq.keywords.some(keyword => keyword.toLowerCase().includes(word) || word.includes(keyword.toLowerCase()))
      ).length
      score += partialKeywordMatches * 2
      
      // Answer matches (lower priority)
      const answerMatches = queryWords.filter(word =>
        faq.answer.toLowerCase().includes(word)
      ).length
      score += answerMatches * 1
      
      if (score > 0) {
        console.log(`✅ FAQ match found: "${faq.question}" (score: ${score})`)
        matches.push({ item: faq, score })
      }
    }

    // Sort by score and return top matches, but only if score is meaningful
    const results = matches
      .filter(match => match.score >= 3) // Minimum score threshold
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map(match => match.item)
      
    console.log(`📚 Final FAQ results: ${results.length} items`)
    return results
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
      const formatted = `**${faq.question}**\n\n${faq.answer}`
      console.log('📝 Formatted single FAQ response:', formatted)
      return formatted
    }

    let formatted = "Here's what I found in our FAQ:\n\n"
    for (const faq of faqs) {
      formatted += `**${faq.question}**\n${faq.answer}\n\n`
    }
    
    const finalFormatted = formatted.trim()
    console.log('📝 Formatted multiple FAQ response:', finalFormatted)
    return finalFormatted
  }

  public reloadFAQ(): void {
    console.log('🔄 Reloading FAQ data...')
    this.isLoaded = false
    this.faqData = []
    this.loadFAQData()
  }
}