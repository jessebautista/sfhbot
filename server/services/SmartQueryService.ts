import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { PromptService } from './PromptService'

interface SmartSearchResult {
  results: any[]
  naturalResponse: string
  dataUsed: boolean
  reasoning: string
  queryType: string
}

/**
 * Simplified, production-ready intelligent query service
 * Combines AI reasoning with efficient database queries
 */
export class SmartQueryService {
  private supabase: SupabaseClient | null = null
  private openai: OpenAI
  private promptService: PromptService
  private isAvailable: boolean = false

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.promptService = PromptService.getInstance()
    this.initializeDatabase()
  }

  private async initializeDatabase() {
    const url = process.env.EXTERNAL_SUPABASE_URL
    const key = process.env.EXTERNAL_SUPABASE_ANON_KEY

    if (!url || !key) {
      console.log('⚠️ External database credentials missing')
      return
    }

    try {
      this.supabase = createClient(url, key)
      // Test connection with schema-aware approach
      await this.testConnectionAndSchema()
      console.log(this.isAvailable ? '✅ Smart query service ready with schema discovery' : '❌ Database connection failed')
    } catch (error) {
      console.error('Database initialization error:', error)
      this.isAvailable = false
    }
  }

  /**
   * Test database connection and initialize schema discovery
   */
  private async testConnectionAndSchema() {
    if (!this.supabase) return

    try {
      // Test basic connection with any available table
      const tables = ['pianos', 'news', 'piano_activations']
      let connectionWorking = false
      
      for (const table of tables) {
        try {
          const { error } = await this.supabase
            .from(table)
            .select('*', { count: 'exact', head: true })
          
          if (!error) {
            connectionWorking = true
            console.log(`✅ Connected to table: ${table}`)
            break
          }
        } catch (e) {
          console.log(`⚠️ Table ${table} not accessible: ${e}`)
        }
      }

      if (connectionWorking) {
        console.log('✅ Smart query service ready')
        this.isAvailable = true
      } else {
        console.error('❌ Could not connect to any expected tables')
        this.isAvailable = false
      }
    } catch (error) {
      console.error('Connection test failed:', error)
      this.isAvailable = false
    }
  }

  /**
   * Main smart search function - simplified but effective
   */
  async smartSearch(userQuery: string): Promise<SmartSearchResult> {
    if (!this.isAvailable || !this.supabase) {
      return {
        results: [],
        naturalResponse: 'External database is not available right now.',
        dataUsed: false,
        reasoning: 'Database unavailable',
        queryType: 'error'
      }
    }

    try {
      // Step 1: Quick AI analysis to determine search strategy (single API call)
      const analysis = await this.analyzeQuery(userQuery)
      console.log(`🎯 Query analysis: ${analysis.type} - ${analysis.reasoning}`)

      // Step 2: Execute targeted database queries based on analysis
      const results = await this.executeSmartQueries(userQuery, analysis)
      console.log(`📊 Found ${results.length} results`)

      // Step 3: Format results naturally (only if we found data)
      const response = results.length > 0 
        ? await this.formatResults(results, userQuery, analysis)
        : this.createNoResultsResponse(userQuery, analysis)

      return {
        results,
        naturalResponse: response,
        dataUsed: results.length > 0,
        reasoning: analysis.reasoning,
        queryType: analysis.type
      }
    } catch (error) {
      console.error('Smart search error:', error)
      return {
        results: [],
        naturalResponse: 'I encountered an error searching the database. Please try rephrasing your question.',
        dataUsed: false,
        reasoning: `Error: ${error}`,
        queryType: 'error'
      }
    }
  }

  /**
   * Single AI call to analyze query intent and generate search strategy
   */
  private async analyzeQuery(userQuery: string): Promise<{
    type: string
    reasoning: string
    searchTerms: string[]
    tables: string[]
  }> {
    try {
      // Get configurable prompt and settings
      const { prompt, modelSettings } = await this.promptService.getQueryAnalysisPrompt(userQuery)
      const debugSettings = await this.promptService.getDebuggingSettings()

      if (debugSettings.log_query_analysis) {
        console.log(`🧠 Using configurable prompt for query: "${userQuery}"`)
      }

      const completion = await this.openai.chat.completions.create({
        model: modelSettings.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: modelSettings.temperature,
        max_tokens: modelSettings.max_tokens
      })

      const response = completion.choices[0]?.message?.content
      const analysis = response ? JSON.parse(response) : this.fallbackAnalysis(userQuery)

      if (debugSettings.log_query_analysis) {
        console.log(`🎯 Query analysis result:`, analysis)
      }

      return analysis
    } catch (error) {
      console.error('Query analysis error:', error)
      return this.fallbackAnalysis(userQuery)
    }
  }

  /**
   * Execute database queries based on AI analysis - Schema-aware with graceful fallback
   */
  private async executeSmartQueries(userQuery: string, analysis: any): Promise<any[]> {
    if (!this.supabase) return []

    const results: any[] = []
    
    // Extract key search terms from the query instead of using the full query
    const searchTerms = await this.extractSearchTerms(userQuery, analysis)
    console.log(`🔍 Extracted search terms:`, searchTerms)

    try {
      // Piano search (most common) - Direct approach with known columns
      if (analysis.tables.includes('pianos') || analysis.type.includes('piano') || analysis.type.includes('location') || analysis.type.includes('artist')) {
        console.log(`🎹 Searching pianos with terms:`, searchTerms)
        
        for (const term of searchTerms) {
          // Use only columns that exist in the actual database
          const searchPattern = `%${term}%`
          const { data: pianos, error } = await this.supabase
            .from('pianos')
            .select('*')
            .or(`piano_title.ilike."${searchPattern}",artist_name.ilike."${searchPattern}",piano_statement.ilike."${searchPattern}"`)
            .limit(15)
          
          if (error) {
            console.error(`Error searching pianos with term "${term}":`, error)
            continue
          }
          
          if (pianos && pianos.length > 0) {
            console.log(`✅ Found ${pianos.length} pianos for term "${term}"`)
            results.push(...pianos)
            break // Found results, no need to try more terms
          }
        }
        
        // If no results with terms, try a broader search
        if (results.length === 0 && analysis.type.includes('piano')) {
          console.log('🔄 Trying broader piano search...')
          const { data: allPianos, error } = await this.supabase
            .from('pianos')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10)
          
          if (!error && allPianos) {
            console.log(`📊 Found ${allPianos.length} pianos via broad search`)
            results.push(...allPianos)
          }
        }
      }

      // News search - Enhanced with better term extraction
      if (analysis.tables.includes('news') || analysis.type.includes('news')) {
        console.log(`📰 Searching news with terms:`, searchTerms)
        
        for (const term of searchTerms) {
          // Use proper Supabase query syntax with escaped search term
          const searchPattern = `%${term}%`
          const { data: news, error } = await this.supabase
            .from('news')
            .select('*')
            .or(`news_title.ilike."${searchPattern}",newscontent.ilike."${searchPattern}",news_excerpt.ilike."${searchPattern}",news_categories.ilike."${searchPattern}"`)
            .limit(10)
          
          if (error) {
            console.error(`Error searching news with term "${term}":`, error)
            continue
          }
          
          if (news && news.length > 0) {
            console.log(`✅ Found ${news.length} news articles for term "${term}"`)
            results.push(...news)
            break
          }
        }
      }

      // Activation search - Enhanced
      if (analysis.tables.includes('piano_activations') || analysis.type.includes('activation')) {
        console.log(`🎭 Searching activations with terms:`, searchTerms)
        
        for (const term of searchTerms) {
          // Use proper Supabase query syntax with escaped search term
          const searchPattern = `%${term}%`
          const { data: activations, error } = await this.supabase
            .from('piano_activations')
            .select('*')
            .or(`act_title.ilike."${searchPattern}",act_content.ilike."${searchPattern}",act_artists.ilike."${searchPattern}",act_location.ilike."${searchPattern}"`)
            .limit(10)
          
          if (error) {
            console.error(`Error searching activations with term "${term}":`, error)
            continue
          }
          
          if (activations && activations.length > 0) {
            console.log(`✅ Found ${activations.length} activations for term "${term}"`)
            results.push(...activations)
            break
          }
        }
      }

      console.log(`🎯 Total results found: ${results.length}`)
      return results
    } catch (error) {
      console.error('Database query error:', error)
      return []
    }
  }


  /**
   * Extract clean search terms from user query
   */
  private async extractSearchTerms(userQuery: string, analysis: any): Promise<string[]> {
    const query = userQuery.toLowerCase()
    const terms: string[] = []

    try {
      // Get configurable keywords
      const pianoKeywords = await this.promptService.getSearchKeywords('piano')
      const newsKeywords = await this.promptService.getSearchKeywords('news')
      const activationKeywords = await this.promptService.getSearchKeywords('activation')
      const timeKeywords = await this.promptService.getSearchKeywords('time')
      const debugSettings = await this.promptService.getDebuggingSettings()

      // Use AI-provided search terms if available
      if (analysis.searchTerms && analysis.searchTerms.length > 0) {
        terms.push(...analysis.searchTerms.map((term: string) => term.toLowerCase().replace(/[^a-z0-9\s]/g, '')))
      }

      // Extract key terms based on query type using configurable keywords
      if (analysis.type.includes('piano')) {
        terms.push(...pianoKeywords)
        // Extract potential artist names or locations
        const words = query.replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 2)
        terms.push(...words)
      }

      if (analysis.type.includes('news')) {
        terms.push(...newsKeywords)
        
        // Check for specific patterns from configurable keywords
        if (newsKeywords.some(keyword => query.includes(keyword))) {
          terms.push(...newsKeywords.filter(keyword => query.includes(keyword)))
        }
        
        // Extract quoted phrases or specific terms
        const specificTerms = query.match(/"([^"]+)"/g) || []
        terms.push(...specificTerms.map(t => t.replace(/"/g, '')))
        
        // Add general news-related words from the query
        const words = query.replace(/[^a-z0-9\s]/g, '').split(' ').filter(w => w.length > 2)
        terms.push(...words)
      }

      if (analysis.type.includes('activation')) {
        terms.push(...activationKeywords)
      }

      // Check for time-based keywords
      if (timeKeywords.some(timeWord => query.includes(timeWord))) {
        terms.push(...timeKeywords.filter(timeWord => query.includes(timeWord)))
      }

      // Clean up terms and remove duplicates
      const cleanTerms = [...new Set(terms)]
        .map(term => term.trim().replace(/[^a-z0-9\s]/g, ''))
        .filter(term => term.length > 0 && !['the', 'and', 'or', 'a', 'an', 'is', 'are', 'was', 'were', 'have', 'has', 'what', 'how', 'where', 'when', 'why', 'your', 'you', 'i', 'my', 'me'].includes(term))

      if (debugSettings.log_extracted_terms) {
        console.log(`🔍 Extracted search terms from configurable keywords:`, cleanTerms.slice(0, 5))
      }

      return cleanTerms.slice(0, 5) // Limit to 5 most relevant terms
    } catch (error) {
      console.error('Error extracting search terms:', error)
      // Fallback to original logic
      if (analysis.searchTerms && analysis.searchTerms.length > 0) {
        return analysis.searchTerms.slice(0, 5)
      }
      return []
    }
  }

  /**
   * Format results into natural language (only when we have data)
   */
  private async formatResults(results: any[], userQuery: string, analysis: any): Promise<string> {
    // Create a concise summary of the results
    const summary = results.slice(0, 5).map(result => {
      if (result.piano_title) return `${result.piano_title} by ${result.artist_name || 'Unknown'} (${result.piano_location || 'Location TBD'})`
      if (result.news_title) return `${result.news_title}: ${result.news_excerpt || result.newscontent?.substring(0, 100) || ''}...`
      if (result.act_title) return `${result.act_title} at ${result.act_location || 'TBD'}`
      return 'Unknown record'
    }).join('\n')

    const prompt = `Create a natural, helpful response using this database information:

User asked: "${userQuery}"
Query type: ${analysis.type}

Database results (${results.length} found):
${summary}

Create a conversational response that directly addresses their question using specific details from the results. Be natural and helpful.`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.4,
        max_tokens: 400
      })

      return completion.choices[0]?.message?.content || this.createFallbackResponse(results, userQuery)
    } catch (error) {
      console.error('Result formatting error:', error)
      return this.createFallbackResponse(results, userQuery)
    }
  }

  private fallbackAnalysis(userQuery: string) {
    const query = userQuery.toLowerCase()
    if (query.includes('piano')) return { type: 'piano_search', reasoning: 'Piano keyword detected', searchTerms: ['piano'], tables: ['pianos'] }
    if (query.includes('news')) return { type: 'news_search', reasoning: 'News keyword detected', searchTerms: ['news'], tables: ['news'] }
    return { type: 'general', reasoning: 'General search', searchTerms: [userQuery], tables: ['pianos', 'news', 'piano_activations'] }
  }

  private createFallbackResponse(results: any[], userQuery: string): string {
    if (results.length === 0) return `I couldn't find any information about "${userQuery}" in our database.`
    
    const first = results[0]
    if (first.piano_title) return `I found ${results.length} result${results.length > 1 ? 's' : ''} about pianos. One example is "${first.piano_title}" by ${first.artist_name || 'Unknown artist'}.`
    if (first.news_title) return `I found ${results.length} news article${results.length > 1 ? 's' : ''}. One is titled "${first.news_title}".`
    return `I found ${results.length} result${results.length > 1 ? 's' : ''} related to your query.`
  }

  private createNoResultsResponse(userQuery: string, analysis: any): string {
    return `I searched our database for "${userQuery}" but couldn't find any matching records. Our database contains information about pianos, news articles, and piano activations. Could you try rephrasing your question or being more specific?`
  }

  getStatus() {
    return {
      available: this.isAvailable,
      hasConnection: this.supabase !== null
    }
  }

  /**
   * Get comprehensive diagnostics for troubleshooting
   */
  async getDiagnostics() {
    return {
      smartQueryService: {
        available: this.isAvailable,
        hasConnection: this.supabase !== null,
        hasOpenAI: !!process.env.OPENAI_API_KEY
      },
      environment: {
        hasExternalDbUrl: !!process.env.EXTERNAL_SUPABASE_URL,
        hasExternalDbKey: !!process.env.EXTERNAL_SUPABASE_ANON_KEY
      }
    }
  }

  /**
   * Force refresh of schema cache for troubleshooting
   */
  async refreshSchema() {
    console.log('🔄 Refreshing schema cache...')
    // Schema refresh not implemented - using direct database queries
    return { success: true, message: 'Schema refresh not needed with current implementation' }
  }
}