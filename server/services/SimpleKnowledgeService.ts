import { VectorKnowledgeService } from './VectorKnowledgeService'
import { ExternalDataService, SearchResult } from './ExternalDataService'

interface SimpleKnowledgeResponse {
  answer: string
  sources: string[]
  debug?: {
    external_attempted: boolean
    external_results_found: number
    fallback_used: boolean
  }
}

export class SimpleKnowledgeService {
  private vectorService: VectorKnowledgeService
  private externalService: ExternalDataService
  private externalServiceDown = false
  private lastExternalFailTime = 0
  private readonly CIRCUIT_BREAKER_TIMEOUT = 30000 // 30 seconds

  constructor() {
    this.vectorService = new VectorKnowledgeService()
    this.externalService = new ExternalDataService()
  }

  async search(query: string): Promise<SimpleKnowledgeResponse> {
    const sources: string[] = []
    let allResults: string[] = []
    let externalAttempted = false
    let externalResultsFound = 0
    let fallbackUsed = false

    // Always search organizational knowledge first
    try {
      const orgResults = await this.vectorService.searchKnowledge(query, 3)
      if (orgResults.length > 0) {
        allResults.push(...orgResults)
        sources.push('organizational')
      }
    } catch (error) {
      console.error('Organizational search failed:', error)
    }

    // Try external database if available and circuit is closed
    if (this.shouldTryExternalService()) {
      externalAttempted = true
      try {
        const externalResults = await this.searchExternalWithTimeout(query)
        externalResultsFound = externalResults.length
        
        if (externalResults.length > 0) {
          allResults.push(...externalResults)
          sources.push('external')
          this.resetCircuitBreaker()
        }
      } catch (error) {
        console.error('External search failed:', error)
        this.tripCircuitBreaker()
        fallbackUsed = true
      }
    }

    // If no results, provide a helpful fallback
    if (allResults.length === 0) {
      fallbackUsed = true
      allResults.push(
        "I don't have specific information about that right now, but I'd be happy to help you with questions about our organization, donations, volunteering, or general inquiries. You can also contact us directly for more detailed information."
      )
      sources.push('fallback')
    }

    return {
      answer: allResults.join('\n\n'),
      sources,
      debug: {
        external_attempted: externalAttempted,
        external_results_found: externalResultsFound,
        fallback_used: fallbackUsed
      }
    }
  }

  private shouldTryExternalService(): boolean {
    if (!this.externalService.isAvailable()) return false
    if (!this.externalServiceDown) return true
    
    // Check if circuit breaker timeout has passed
    return Date.now() - this.lastExternalFailTime > this.CIRCUIT_BREAKER_TIMEOUT
  }

  private async searchExternalWithTimeout(query: string): Promise<string[]> {
    // Simple timeout wrapper
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('External search timeout')), 10000)
    )

    const searchPromise = this.searchExternal(query)

    return Promise.race([searchPromise, timeoutPromise])
  }

  private async searchExternal(query: string): Promise<string[]> {
    const queryLower = query.toLowerCase()
    
    // Simple keyword detection
    const isPianoQuery = ['piano', 'music', 'program', 'activation', 'concert', 'performance'].some(
      keyword => queryLower.includes(keyword)
    )
    const isNewsQuery = ['news', 'update', 'latest', 'recent', 'announcement'].some(
      keyword => queryLower.includes(keyword)
    )

    let results: SearchResult[] = []

    if (isPianoQuery && isNewsQuery) {
      // Search both
      const [pianoResults, newsResults] = await Promise.allSettled([
        this.externalService.searchPianoRecords(query, 2),
        this.externalService.searchNews(query, 2)
      ])
      
      if (pianoResults.status === 'fulfilled') results.push(...pianoResults.value)
      if (newsResults.status === 'fulfilled') results.push(...newsResults.value)
    } else if (isPianoQuery) {
      // Piano only
      results = await this.externalService.searchPianoRecords(query, 3)
    } else if (isNewsQuery) {
      // News only
      results = await this.externalService.searchNews(query, 3)
    } else {
      // General search - try both
      const [pianoResults, newsResults] = await Promise.allSettled([
        this.externalService.searchPianoRecords(query, 1),
        this.externalService.searchNews(query, 2)
      ])
      
      if (pianoResults.status === 'fulfilled') results.push(...pianoResults.value)
      if (newsResults.status === 'fulfilled') results.push(...newsResults.value)
    }

    return results.map(result => {
      const sourceType = result.type === 'news' ? 'News' : 'Piano'
      return `[${sourceType}] ${result.title}: ${result.content}`
    })
  }

  private resetCircuitBreaker() {
    this.externalServiceDown = false
    this.lastExternalFailTime = 0
  }

  private tripCircuitBreaker() {
    this.externalServiceDown = true
    this.lastExternalFailTime = Date.now()
    console.log('🔴 External service circuit breaker tripped, will retry in 30 seconds')
  }

  async initialize(): Promise<void> {
    console.log('Initializing Simple Knowledge Service...')
    
    // Initialize vector service
    await this.vectorService.initializeKnowledgeBase()
    
    // Test external service
    if (this.externalService.isAvailable()) {
      const testResult = await this.externalService.testConnection()
      console.log('External service test:', testResult.message)
    }
    
    console.log('Simple Knowledge Service initialized')
  }
}