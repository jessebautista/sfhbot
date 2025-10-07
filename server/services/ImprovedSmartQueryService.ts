import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'
import { DynamicQueryBuilder, QueryResult } from '../utils/DynamicQueryBuilder'
import { SchemaIntrospector } from '../utils/SchemaIntrospector'
import { QueryValidationService, QueryError, ValidationResult } from '../utils/QueryValidationService'

interface SmartSearchResult {
  results: any[]
  naturalResponse: string
  dataUsed: boolean
  reasoning: string
  queryType: string
  executionTimeMs?: number
  tablesSearched?: string[]
  warnings?: string[]
}

interface QueryAnalysis {
  type: string
  reasoning: string
  searchTerms: string[]
  confidence: number
}

/**
 * Improved Smart Query Service with dynamic schema awareness
 * Provides robust database querying with comprehensive error handling
 */
export class ImprovedSmartQueryService {
  private supabase: SupabaseClient | null = null
  private openai: OpenAI
  private isAvailable: boolean = false
  private queryBuilder: DynamicQueryBuilder | null = null
  private schemaIntrospector: SchemaIntrospector | null = null
  private validator: QueryValidationService
  private retryAttempts: number = 3

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
    this.validator = new QueryValidationService()
    this.initializeDatabase()
  }

  private async initializeDatabase() {
    const url = process.env.EXTERNAL_SUPABASE_URL || process.env.SUPABASE_URL
    const key = process.env.EXTERNAL_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

    if (!url || !key) {
      console.log('⚠️ Database credentials missing - SmartQuery service disabled')
      return
    }

    try {
      this.supabase = createClient(url, key)
      
      // Initialize utilities
      this.queryBuilder = new DynamicQueryBuilder(this.supabase)
      this.schemaIntrospector = new SchemaIntrospector(this.supabase)

      // Test database connectivity with schema introspection
      const schemaAvailable = await this.schemaIntrospector.isAvailable()
      
      if (schemaAvailable) {
        // Pre-load schema for better performance
        await this.schemaIntrospector.getSchema()
        this.isAvailable = true
        console.log('✅ Improved Smart Query Service ready with schema awareness')
      } else {
        // Fallback: test with a simple query
        const { error } = await this.supabase
          .from('knowledge_documents')
          .select('*', { count: 'exact', head: true })
          .limit(1)

        this.isAvailable = !error
        console.log(this.isAvailable 
          ? '⚠️ Smart Query Service ready (limited schema awareness)' 
          : '❌ Database connection failed'
        )
      }

    } catch (error) {
      console.error('Database initialization error:', error)
      this.isAvailable = false
    }
  }

  /**
   * Main smart search function with improved error handling and schema awareness
   */
  async smartSearch(userQuery: string): Promise<SmartSearchResult> {
    const startTime = Date.now()
    const warnings: string[] = []

    if (!this.isAvailable || !this.supabase || !this.queryBuilder) {
      return this.createUnavailableResponse()
    }

    try {
      // Step 1: Analyze and validate the query
      const analysis = await this.analyzeQuery(userQuery)
      console.log(`🎯 Query analysis: ${analysis.type} (confidence: ${analysis.confidence})`)

      // Step 2: Validate search inputs
      const validation = this.validator.validateSearchInput(analysis.searchTerms, analysis.type)
      if (!validation.isValid) {
        return this.createValidationErrorResponse(validation.errors)
      }

      if (validation.warnings.length > 0) {
        warnings.push(...validation.warnings)
      }

      // Step 3: Execute search with retry logic
      const queryResults = await this.executeSearchWithRetry(
        validation.sanitizedInput!.searchTerms,
        validation.sanitizedInput!.queryType
      )

      // Step 4: Process and format results
      const combinedResults = this.combineQueryResults(queryResults)
      
      const response = combinedResults.length > 0 
        ? await this.formatResults(combinedResults, userQuery, analysis)
        : this.createNoResultsResponse(userQuery, analysis)

      return {
        results: combinedResults,
        naturalResponse: response,
        dataUsed: combinedResults.length > 0,
        reasoning: analysis.reasoning,
        queryType: analysis.type,
        executionTimeMs: Date.now() - startTime,
        tablesSearched: queryResults.map(r => r.tableName),
        warnings: warnings.length > 0 ? warnings : undefined
      }

    } catch (error) {
      console.error('Smart search error:', error)
      const queryError = this.validator.classifyError(error, { query: userQuery })
      
      return {
        results: [],
        naturalResponse: this.validator.generateUserFriendlyMessage(queryError),
        dataUsed: false,
        reasoning: `Error: ${queryError.type}`,
        queryType: 'error',
        executionTimeMs: Date.now() - startTime,
        warnings: [`Error occurred: ${queryError.message}`]
      }
    }
  }

  /**
   * Enhanced query analysis with better AI prompt engineering
   */
  private async analyzeQuery(userQuery: string): Promise<QueryAnalysis> {
    // Get current database schema for context
    const schemaSummary = this.schemaIntrospector ? 
      await this.schemaIntrospector.getSchemaSummary() : 
      'Schema information unavailable'

    const prompt = `Analyze this user query for database search:

User Query: "${userQuery}"

Available Database Schema:
${schemaSummary}

Analyze the query and respond with JSON only:
{
  "type": "knowledge_search|chat_search|user_search|document_search|general_search|specific_table_search",
  "reasoning": "brief explanation of why this search type was chosen",
  "searchTerms": ["key", "search", "terms", "extracted"],
  "confidence": 0.8
}

Guidelines:
- Extract 2-5 meaningful search terms
- Choose the most specific search type possible
- Confidence should be 0.0-1.0 based on query clarity
- Prioritize semantic meaning over exact keywords`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 300
      })

      const response = completion.choices[0]?.message?.content
      if (response) {
        const parsed = JSON.parse(response)
        return {
          type: parsed.type || 'general_search',
          reasoning: parsed.reasoning || 'AI analysis performed',
          searchTerms: Array.isArray(parsed.searchTerms) ? parsed.searchTerms : [userQuery],
          confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
        }
      }
    } catch (error) {
      console.error('Query analysis error:', error)
    }

    // Fallback analysis
    return this.createFallbackAnalysis(userQuery)
  }

  /**
   * Execute search with retry logic for better reliability
   */
  private async executeSearchWithRetry(
    searchTerms: string[],
    queryType: string,
    attemptNumber: number = 1
  ): Promise<QueryResult[]> {
    if (!this.queryBuilder) return []

    try {
      const strategy = this.queryBuilder.getOptimizedStrategy(queryType)
      return await this.queryBuilder.executeSearch(searchTerms, queryType, strategy)
      
    } catch (error) {
      const queryError = this.validator.classifyError(error)
      
      if (this.validator.isRecoverableError(queryError) && attemptNumber < this.retryAttempts) {
        const delay = this.validator.getRetryDelay(queryError, attemptNumber)
        console.log(`⏳ Retrying query in ${delay}ms (attempt ${attemptNumber + 1}/${this.retryAttempts})`)
        
        await new Promise(resolve => setTimeout(resolve, delay))
        return this.executeSearchWithRetry(searchTerms, queryType, attemptNumber + 1)
      }

      throw error
    }
  }

  /**
   * Combine results from multiple tables, removing duplicates and ranking by relevance
   */
  private combineQueryResults(queryResults: QueryResult[]): any[] {
    if (queryResults.length === 0) return []

    const allResults: any[] = []
    const seenIds = new Set<string>()

    // Prioritize results by table relevance and execution success
    const sortedResults = queryResults
      .filter(qr => qr.data.length > 0 && !qr.error)
      .sort((a, b) => {
        // Prioritize tables with more results
        if (a.data.length !== b.data.length) {
          return b.data.length - a.data.length
        }
        // Then by execution time (faster is better)
        return a.executionTimeMs - b.executionTimeMs
      })

    for (const queryResult of sortedResults) {
      for (const item of queryResult.data) {
        // Create a unique identifier for deduplication
        const id = item.id || item.uuid || JSON.stringify(item).substring(0, 50)
        
        if (!seenIds.has(id)) {
          seenIds.add(id)
          // Add metadata about which table this came from
          allResults.push({
            ...item,
            _metadata: {
              source_table: queryResult.tableName,
              search_terms_used: queryResult.searchTermsUsed,
              execution_time_ms: queryResult.executionTimeMs
            }
          })
        }

        // Limit total results to prevent overwhelming responses
        if (allResults.length >= 25) break
      }
      if (allResults.length >= 25) break
    }

    return allResults
  }

  /**
   * Enhanced result formatting with better context awareness
   */
  private async formatResults(results: any[], userQuery: string, analysis: QueryAnalysis): Promise<string> {
    // Create a more informative summary
    const summary = results.slice(0, 8).map((result, index) => {
      const sourceTable = result._metadata?.source_table || 'unknown'
      
      // Format based on likely data structure
      if (result.title && result.content) {
        return `${index + 1}. ${result.title} (from ${sourceTable})\n   ${(result.content || '').substring(0, 150)}...`
      }
      if (result.name) {
        return `${index + 1}. ${result.name} (from ${sourceTable})`
      }
      if (result.message && result.reply) {
        return `${index + 1}. Chat: "${result.message.substring(0, 100)}..." (from ${sourceTable})`
      }
      
      // Generic fallback
      const firstTextField = Object.keys(result).find(key => 
        typeof result[key] === 'string' && result[key].length > 10
      )
      
      if (firstTextField) {
        return `${index + 1}. ${result[firstTextField].substring(0, 100)}... (from ${sourceTable})`
      }
      
      return `${index + 1}. Record from ${sourceTable}`
    }).join('\n\n')

    const prompt = `Create a helpful, natural response using this database information:

User asked: "${userQuery}"
Query type: ${analysis.type}
Search confidence: ${analysis.confidence}

Database results (${results.length} found):
${summary}

Create a conversational response that:
1. Directly addresses their question
2. Uses specific details from the results
3. Is natural and helpful
4. Mentions if results come from multiple sources
5. Keeps response under 300 words

Be informative but conversational.`

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

  /**
   * Create fallback analysis when AI analysis fails
   */
  private createFallbackAnalysis(userQuery: string): QueryAnalysis {
    const query = userQuery.toLowerCase()
    
    // Simple keyword-based analysis
    if (query.includes('chat') || query.includes('conversation') || query.includes('message')) {
      return {
        type: 'chat_search',
        reasoning: 'Query contains chat-related keywords',
        searchTerms: this.extractSimpleTerms(query),
        confidence: 0.7
      }
    }
    
    if (query.includes('knowledge') || query.includes('document') || query.includes('info')) {
      return {
        type: 'knowledge_search',
        reasoning: 'Query contains knowledge-related keywords',
        searchTerms: this.extractSimpleTerms(query),
        confidence: 0.6
      }
    }

    return {
      type: 'general_search',
      reasoning: 'Fallback analysis - general search',
      searchTerms: this.extractSimpleTerms(query),
      confidence: 0.4
    }
  }

  /**
   * Extract simple search terms when AI analysis fails
   */
  private extractSimpleTerms(query: string): string[] {
    return query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 2)
      .slice(0, 5)
  }

  /**
   * Create response when service is unavailable
   */
  private createUnavailableResponse(): SmartSearchResult {
    return {
      results: [],
      naturalResponse: 'The database search service is currently unavailable. Please try again later.',
      dataUsed: false,
      reasoning: 'Service unavailable',
      queryType: 'error',
      warnings: ['Database service is not available']
    }
  }

  /**
   * Create response for validation errors
   */
  private createValidationErrorResponse(errors: string[]): SmartSearchResult {
    return {
      results: [],
      naturalResponse: 'I had trouble understanding your search request. Please try rephrasing your question.',
      dataUsed: false,
      reasoning: 'Input validation failed',
      queryType: 'validation_error',
      warnings: errors
    }
  }

  /**
   * Create response when no results are found
   */
  private createNoResultsResponse(userQuery: string, analysis: QueryAnalysis): string {
    const suggestions = this.generateSearchSuggestions(analysis.type)
    return `I searched our database for "${userQuery}" but couldn't find any matching records. ${suggestions}`
  }

  /**
   * Generate helpful search suggestions based on query type
   */
  private generateSearchSuggestions(queryType: string): string {
    switch (queryType) {
      case 'knowledge_search':
        return 'Try searching for more general topics or check our main categories.'
      
      case 'chat_search':
        return 'Try looking for specific conversation topics or time periods.'
      
      default:
        return 'Try using different keywords or being more specific in your search.'
    }
  }

  /**
   * Create fallback response when AI formatting fails
   */
  private createFallbackResponse(results: any[], userQuery: string): string {
    if (results.length === 0) {
      return `I couldn't find any information about "${userQuery}" in our database.`
    }

    const count = results.length
    const sources = [...new Set(results.map(r => r._metadata?.source_table).filter(Boolean))]
    const sourceText = sources.length > 1 ? `from ${sources.length} different sources` : ''

    return `I found ${count} result${count > 1 ? 's' : ''} ${sourceText} related to your query about "${userQuery}". The information includes various records that match your search criteria.`
  }

  /**
   * Get service status and health information
   */
  getStatus() {
    return {
      available: this.isAvailable,
      hasConnection: this.supabase !== null,
      hasSchemaAwareness: this.schemaIntrospector !== null,
      hasDynamicQuerying: this.queryBuilder !== null,
      features: {
        schemaIntrospection: !!this.schemaIntrospector,
        dynamicQueries: !!this.queryBuilder,
        errorRetry: true,
        resultDeduplication: true,
        multiTableSearch: true
      }
    }
  }

  /**
   * Force refresh of database schema cache
   */
  async refreshSchema(): Promise<boolean> {
    if (!this.schemaIntrospector) return false

    try {
      await this.schemaIntrospector.getSchema(true) // Force refresh
      return true
    } catch (error) {
      console.error('Schema refresh failed:', error)
      return false
    }
  }

  /**
   * Get available tables and their searchable columns
   */
  async getAvailableTables(): Promise<any> {
    if (!this.schemaIntrospector) return null

    try {
      const schema = await this.schemaIntrospector.getSchema()
      const tableInfo: any = {}

      for (const [tableName, tableSchema] of schema.tables) {
        tableInfo[tableName] = {
          searchableColumns: tableSchema.searchableColumns,
          totalColumns: tableSchema.columns.length,
          hasFullText: tableSchema.hasFullText
        }
      }

      return tableInfo
    } catch (error) {
      console.error('Failed to get table info:', error)
      return null
    }
  }
}