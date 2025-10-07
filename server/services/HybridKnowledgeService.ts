import { VectorKnowledgeService } from './VectorKnowledgeService.js'
import { ExternalDataService, SearchResult } from './ExternalDataService.js'

interface KnowledgeResponse {
  source: 'vector' | 'news' | 'piano' | 'mixed'
  results: string[]
  metadata?: {
    total_results: number
    sources_used: string[]
    external_available: boolean
  }
}

export class HybridKnowledgeService {
  private vectorService: VectorKnowledgeService | null = null
  private externalService: ExternalDataService | null = null

  constructor() {
    // Services will be initialized lazily to avoid env var timing issues
  }

  private ensureServicesInitialized() {
    if (!this.vectorService) {
      this.vectorService = new VectorKnowledgeService()
    }
    if (!this.externalService) {
      this.externalService = new ExternalDataService()
    }
  }

  async searchAllSources(query: string, limit: number = 5): Promise<KnowledgeResponse> {
    this.ensureServicesInitialized()
    
    const sourcesUsed: string[] = []
    let allResults: string[] = []

    // Always search vector knowledge base (organizational info)
    try {
      const vectorResults = await this.vectorService!.searchKnowledge(query, Math.ceil(limit * 0.6))
      if (vectorResults.length > 0) {
        allResults.push(...vectorResults)
        sourcesUsed.push('organizational_knowledge')
      }
    } catch (error) {
      console.error('Error searching vector knowledge:', error)
    }

    // Search external database if available
    if (this.externalService!.isAvailable()) {
      try {
        const externalResults = await this.searchExternalContent(query, Math.ceil(limit * 0.4))
        console.log(`External database search for "${query}":`, {
          results_found: externalResults.length,
          query_lowercase: query.toLowerCase(),
          is_piano_related: this.isPianoRelated(query.toLowerCase()),
          is_recent_query: this.isRecentQuery(query.toLowerCase()),
          results_preview: externalResults.slice(0, 1)
        })
        if (externalResults.length > 0) {
          allResults.push(...externalResults)
          sourcesUsed.push('external_database')
        }
      } catch (error) {
        console.error('Error searching external database:', error)
      }
    } else {
      console.log('External database not available for search')
    }

    // Determine primary source for response classification
    const primarySource = this.determinePrimarySource(query, allResults, sourcesUsed)

    return {
      source: primarySource,
      results: allResults.slice(0, limit),
      metadata: {
        total_results: allResults.length,
        sources_used: sourcesUsed,
        external_available: this.externalService!.isAvailable()
      }
    }
  }

  private async searchExternalContent(query: string, limit: number): Promise<string[]> {
    const queryLower = query.toLowerCase()
    let results: string[] = []

    // Check for recency keywords that indicate user wants latest/most recent items
    const isRecentQuery = this.isRecentQuery(queryLower)
    
    // Determine search strategy based on query keywords
    const isNewsQuery = this.isNewsRelated(queryLower)
    const isPianoQuery = this.isPianoRelated(queryLower)

    if (isRecentQuery && isPianoQuery) {
      // For "last piano program", search recent piano records but also filter by query
      const pianoResults = await this.externalService!.searchPianoRecords(query, limit)
      results = this.formatExternalResults(pianoResults)
    } else if (isRecentQuery && isNewsQuery) {
      // For "latest news", prioritize recent news
      const newsResults = await this.externalService!.getRecentNews(limit)
      results = this.formatExternalResults(newsResults)
    } else if (isNewsQuery && isPianoQuery) {
      // Search both with equal weight
      const externalResults = await this.externalService!.searchBothSources(query, 2, 2)
      results = this.formatExternalResults(externalResults)
    } else if (isNewsQuery) {
      // Prioritize news search
      const newsResults = await this.externalService!.searchNews(query, limit)
      results = this.formatExternalResults(newsResults)
    } else if (isPianoQuery) {
      // Prioritize piano search
      const pianoResults = await this.externalService!.searchPianoRecords(query, limit)
      results = this.formatExternalResults(pianoResults)
    } else {
      // General search - check both sources
      const externalResults = await this.externalService!.searchBothSources(
        query, 
        Math.ceil(limit / 2), 
        Math.floor(limit / 2)
      )
      results = this.formatExternalResults(externalResults)
    }

    return results
  }

  private formatExternalResults(externalResults: SearchResult[]): string[] {
    return externalResults.map(result => {
      const sourceLabel = result.type === 'news' ? 'News' : 'Piano Record'
      const metadata = result.metadata
      
      let formattedResult = `[${sourceLabel}] ${result.title}: ${result.content}`
      
      // Add relevant metadata
      if (result.type === 'news' && metadata.published_at) {
        const date = new Date(metadata.published_at).toLocaleDateString()
        formattedResult += ` (Published: ${date})`
      } else if (result.type === 'piano' && (metadata.artist || metadata.composer)) {
        const attribution = [metadata.composer, metadata.artist].filter(Boolean).join(' - ')
        if (attribution) formattedResult += ` (${attribution})`
        if (metadata.year) formattedResult += ` (${metadata.year})`
      }
      
      return formattedResult
    })
  }

  private isNewsRelated(query: string): boolean {
    const newsKeywords = [
      'news', 'article', 'update', 'announcement', 'press', 'recent', 
      'latest', 'happening', 'event', 'story', 'report', 'published'
    ]
    return newsKeywords.some(keyword => query.includes(keyword))
  }

  private isPianoRelated(query: string): boolean {
    const pianoKeywords = [
      'piano', 'music', 'song', 'piece', 'composer', 'artist', 'classical',
      'performance', 'recording', 'album', 'track', 'melody', 'composition',
      'program', 'activation', 'musical', 'concert', 'recital', 'player',
      'instrument', 'keyboard', 'keys', 'steinway', 'yamaha', 'grand piano'
    ]
    return pianoKeywords.some(keyword => query.includes(keyword))
  }

  private isRecentQuery(query: string): boolean {
    const recentKeywords = [
      'last', 'latest', 'recent', 'newest', 'new', 'current', 'today',
      'this week', 'this month', 'now', 'upcoming', 'next', 'current'
    ]
    return recentKeywords.some(keyword => query.includes(keyword))
  }

  private determinePrimarySource(query: string, results: string[], sources: string[]): 'vector' | 'news' | 'piano' | 'mixed' {
    if (sources.length === 1) {
      if (sources[0] === 'organizational_knowledge') return 'vector'
      if (sources[0] === 'external_database') {
        // Determine if external results are primarily news or piano
        const newsCount = results.filter(r => r.includes('[News]')).length
        const pianoCount = results.filter(r => r.includes('[Piano Record]')).length
        if (newsCount > pianoCount) return 'news'
        if (pianoCount > newsCount) return 'piano'
        return 'mixed'
      }
    }
    
    if (sources.length > 1) return 'mixed'
    return 'vector' // fallback
  }

  // Method to get recent content for general "what's new" queries
  async getRecentUpdates(limit: number = 3): Promise<KnowledgeResponse> {
    this.ensureServicesInitialized()
    
    if (!this.externalService!.isAvailable()) {
      return {
        source: 'vector',
        results: ['I can help with information about our organization, but I don\'t have access to recent news or updates at the moment.'],
        metadata: {
          total_results: 0,
          sources_used: [],
          external_available: false
        }
      }
    }

    try {
      const recentNews = await this.externalService!.getRecentNews(limit)
      const results = this.formatExternalResults(recentNews)

      return {
        source: 'news',
        results,
        metadata: {
          total_results: results.length,
          sources_used: ['external_database'],
          external_available: true
        }
      }
    } catch (error) {
      console.error('Error getting recent updates:', error)
      return {
        source: 'vector',
        results: ['I encountered an error while fetching recent updates.'],
        metadata: {
          total_results: 0,
          sources_used: [],
          external_available: this.externalService!.isAvailable()
        }
      }
    }
  }

  // Method for specific content type requests
  async getContentByType(type: 'news' | 'piano', query?: string, limit: number = 3): Promise<string[]> {
    this.ensureServicesInitialized()
    
    if (!this.externalService!.isAvailable()) {
      return [`I don't currently have access to ${type} content.`]
    }

    try {
      let results: SearchResult[]
      
      if (query) {
        results = type === 'news' 
          ? await this.externalService!.searchNews(query, limit)
          : await this.externalService!.searchPianoRecords(query, limit)
      } else {
        results = type === 'news'
          ? await this.externalService!.getRecentNews(limit)
          : await this.externalService!.getRecentPianoRecords(limit)
      }

      return this.formatExternalResults(results)
    } catch (error) {
      console.error(`Error getting ${type} content:`, error)
      return [`I encountered an error while fetching ${type} content.`]
    }
  }

  // Initialize and test all services
  async initializeServices(): Promise<void> {
    this.ensureServicesInitialized()
    
    console.log('Initializing Hybrid Knowledge Service...')
    
    // Initialize vector knowledge base
    await this.vectorService!.initializeKnowledgeBase()
    
    // Test external database connection
    if (this.externalService!.isAvailable()) {
      const testResult = await this.externalService!.testConnection()
      console.log(`External database: ${testResult.message}`)
    } else {
      console.log('External database not configured')
    }
    
    console.log('Hybrid Knowledge Service initialization complete.')
  }

  // Get service status for debugging
  getServiceStatus(): {
    vector_service: boolean
    external_service: boolean
    services_available: string[]
  } {
    return {
      vector_service: true, // VectorKnowledgeService always available (has fallback)
      external_service: this.externalService!.isAvailable(),
      services_available: [
        'organizational_knowledge',
        ...(this.externalService!.isAvailable() ? ['news_content', 'piano_records'] : [])
      ]
    }
  }
}