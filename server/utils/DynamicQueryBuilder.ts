import { SupabaseClient } from '@supabase/supabase-js'
import { SchemaIntrospector, TableSchema } from './SchemaIntrospector.js'

/**
 * Query execution result with metadata
 */
export interface QueryResult {
  data: any[]
  tableName: string
  searchTermsUsed: string[]
  columnsSearched: string[]
  executionTimeMs: number
  error?: string
}

/**
 * Search strategy configuration
 */
export interface SearchStrategy {
  useExactMatch: boolean
  useFuzzySearch: boolean
  useFullTextSearch: boolean
  maxResults: number
  prioritizeRecent: boolean
}

/**
 * Dynamic query builder that adapts to database schema
 * Provides fallback strategies and comprehensive error handling
 */
export class DynamicQueryBuilder {
  private supabase: SupabaseClient
  private schemaIntrospector: SchemaIntrospector

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
    this.schemaIntrospector = new SchemaIntrospector(supabase)
  }

  /**
   * Execute intelligent search across relevant tables
   */
  async executeSearch(
    searchTerms: string[],
    queryType: string = 'general',
    strategy: SearchStrategy = this.getDefaultStrategy()
  ): Promise<QueryResult[]> {
    const startTime = Date.now()
    const results: QueryResult[] = []

    try {
      // Find relevant tables
      const relevantTables = await this.schemaIntrospector.findRelevantTables(queryType, searchTerms)
      
      if (relevantTables.length === 0) {
        console.log('⚠️ No relevant tables found for query type:', queryType)
        return results
      }

      console.log(`🎯 Searching ${relevantTables.length} relevant tables:`, relevantTables)

      // Search each relevant table
      for (const tableName of relevantTables) {
        try {
          const tableResult = await this.searchTable(tableName, searchTerms, strategy)
          if (tableResult.data.length > 0) {
            results.push(tableResult)
          }
        } catch (error) {
          console.error(`Error searching table ${tableName}:`, error)
          // Continue with other tables even if one fails
          results.push({
            data: [],
            tableName,
            searchTermsUsed: searchTerms,
            columnsSearched: [],
            executionTimeMs: Date.now() - startTime,
            error: error instanceof Error ? error.message : String(error)
          })
        }
      }

      return results

    } catch (error) {
      console.error('Search execution failed:', error)
      return [{
        data: [],
        tableName: 'unknown',
        searchTermsUsed: searchTerms,
        columnsSearched: [],
        executionTimeMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error)
      }]
    }
  }

  /**
   * Search a specific table with adaptive query strategies
   */
  private async searchTable(
    tableName: string,
    searchTerms: string[],
    strategy: SearchStrategy
  ): Promise<QueryResult> {
    const startTime = Date.now()
    const searchableColumns = await this.schemaIntrospector.getSearchableColumns(tableName)

    if (searchableColumns.length === 0) {
      return {
        data: [],
        tableName,
        searchTermsUsed: searchTerms,
        columnsSearched: [],
        executionTimeMs: Date.now() - startTime,
        error: `No searchable columns found in table ${tableName}`
      }
    }

    console.log(`🔍 Searching table ${tableName} in columns:`, searchableColumns)

    // Try different search strategies in order of precision
    const strategies = [
      () => this.executeExactSearch(tableName, searchableColumns, searchTerms, strategy),
      () => this.executeFuzzySearch(tableName, searchableColumns, searchTerms, strategy),
      () => this.executePartialSearch(tableName, searchableColumns, searchTerms, strategy),
      () => this.executeBroadSearch(tableName, searchableColumns, strategy)
    ]

    for (const [index, searchMethod] of strategies.entries()) {
      try {
        if (index === 0 && !strategy.useExactMatch) continue
        if (index === 1 && !strategy.useFuzzySearch) continue

        const data = await searchMethod()
        if (data && data.length > 0) {
          console.log(`✅ Found ${data.length} results using strategy ${index + 1} in ${tableName}`)
          return {
            data,
            tableName,
            searchTermsUsed: searchTerms,
            columnsSearched: searchableColumns,
            executionTimeMs: Date.now() - startTime
          }
        }
      } catch (error) {
        console.error(`Strategy ${index + 1} failed for table ${tableName}:`, error)
        // Continue with next strategy
      }
    }

    // No results found
    return {
      data: [],
      tableName,
      searchTermsUsed: searchTerms,
      columnsSearched: searchableColumns,
      executionTimeMs: Date.now() - startTime
    }
  }

  /**
   * Execute exact match search
   */
  private async executeExactSearch(
    tableName: string,
    columns: string[],
    searchTerms: string[],
    strategy: SearchStrategy
  ): Promise<any[]> {
    for (const term of searchTerms) {
      const conditions = columns.map(col => `${col}.eq."${this.sanitizeSearchTerm(term)}"`).join(',')
      
      let query = this.supabase
        .from(tableName)
        .select('*')
        .or(conditions)
        .limit(strategy.maxResults)

      if (strategy.prioritizeRecent) {
        query = this.addRecencyOrder(query, tableName)
      }

      const { data, error } = await query

      if (error) {
        console.error(`Exact search error in ${tableName}:`, error)
        continue
      }

      if (data && data.length > 0) {
        return data
      }
    }

    return []
  }

  /**
   * Execute fuzzy/ILIKE search
   */
  private async executeFuzzySearch(
    tableName: string,
    columns: string[],
    searchTerms: string[],
    strategy: SearchStrategy
  ): Promise<any[]> {
    for (const term of searchTerms) {
      const sanitizedTerm = this.sanitizeSearchTerm(term)
      const conditions = columns.map(col => `${col}.ilike."%${sanitizedTerm}%"`).join(',')
      
      let query = this.supabase
        .from(tableName)
        .select('*')
        .or(conditions)
        .limit(strategy.maxResults)

      if (strategy.prioritizeRecent) {
        query = this.addRecencyOrder(query, tableName)
      }

      const { data, error } = await query

      if (error) {
        console.error(`Fuzzy search error in ${tableName}:`, error)
        continue
      }

      if (data && data.length > 0) {
        return data
      }
    }

    return []
  }

  /**
   * Execute partial word search (for compound terms)
   */
  private async executePartialSearch(
    tableName: string,
    columns: string[],
    searchTerms: string[],
    strategy: SearchStrategy
  ): Promise<any[]> {
    // Break down compound terms into individual words
    const allWords = searchTerms.flatMap(term => 
      term.toLowerCase().split(/\s+/).filter(word => word.length > 2)
    )

    for (const word of allWords) {
      const sanitizedWord = this.sanitizeSearchTerm(word)
      const conditions = columns.map(col => `${col}.ilike."%${sanitizedWord}%"`).join(',')
      
      let query = this.supabase
        .from(tableName)
        .select('*')
        .or(conditions)
        .limit(strategy.maxResults)

      if (strategy.prioritizeRecent) {
        query = this.addRecencyOrder(query, tableName)
      }

      const { data, error } = await query

      if (error) {
        console.error(`Partial search error in ${tableName}:`, error)
        continue
      }

      if (data && data.length > 0) {
        return data
      }
    }

    return []
  }

  /**
   * Execute broad search (return recent records when specific search fails)
   */
  private async executeBroadSearch(
    tableName: string,
    columns: string[],
    strategy: SearchStrategy
  ): Promise<any[]> {
    let query = this.supabase
      .from(tableName)
      .select('*')
      .limit(Math.min(strategy.maxResults, 10)) // Limit broad search

    query = this.addRecencyOrder(query, tableName)

    const { data, error } = await query

    if (error) {
      console.error(`Broad search error in ${tableName}:`, error)
      return []
    }

    return data || []
  }

  /**
   * Add ordering by recency if possible
   */
  private addRecencyOrder(query: any, tableName: string): any {
    // Common timestamp column names to try
    const timestampColumns = ['created_at', 'updated_at', 'date_created', 'timestamp']
    
    // For now, default to created_at (most common)
    // In a production system, you'd check the schema
    try {
      return query.order('created_at', { ascending: false })
    } catch {
      // If ordering fails, return the query without ordering
      return query
    }
  }

  /**
   * Sanitize search terms to prevent injection
   */
  private sanitizeSearchTerm(term: string): string {
    return term
      .replace(/['"\\]/g, '') // Remove quotes and backslashes
      .replace(/[;--]/g, '') // Remove SQL injection attempts
      .substring(0, 100) // Limit length
      .trim()
  }

  /**
   * Validate table exists and is accessible
   */
  async validateTable(tableName: string): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(1)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Execute raw SQL query with safety checks (admin use only)
   */
  async executeRawQuery(query: string, params: any[] = []): Promise<any[]> {
    // Basic safety checks
    if (!this.isSafeQuery(query)) {
      throw new Error('Query contains potentially unsafe operations')
    }

    try {
      const { data, error } = await this.supabase.rpc('execute_query', {
        query_text: query,
        params: params
      })

      if (error) {
        throw new Error(`Query execution failed: ${error.message}`)
      }

      return data || []
    } catch (error) {
      console.error('Raw query execution failed:', error)
      throw error
    }
  }

  /**
   * Basic safety check for raw queries
   */
  private isSafeQuery(query: string): boolean {
    const lowerQuery = query.toLowerCase().trim()
    
    // Only allow SELECT statements
    if (!lowerQuery.startsWith('select')) {
      return false
    }

    // Disallow dangerous operations
    const dangerousKeywords = [
      'drop', 'delete', 'insert', 'update', 'alter', 'create',
      'truncate', 'exec', 'execute', 'xp_', 'sp_', 'pg_sleep'
    ]

    return !dangerousKeywords.some(keyword => lowerQuery.includes(keyword))
  }

  /**
   * Get default search strategy
   */
  private getDefaultStrategy(): SearchStrategy {
    return {
      useExactMatch: true,
      useFuzzySearch: true,
      useFullTextSearch: false,
      maxResults: 20,
      prioritizeRecent: true
    }
  }

  /**
   * Get search strategy optimized for specific query types
   */
  getOptimizedStrategy(queryType: string): SearchStrategy {
    const base = this.getDefaultStrategy()

    switch (queryType.toLowerCase()) {
      case 'news_search':
      case 'article_search':
        return { ...base, prioritizeRecent: true, maxResults: 15 }
      
      case 'knowledge_search':
      case 'document_search':
        return { ...base, useFullTextSearch: true, maxResults: 10 }
      
      case 'user_search':
      case 'profile_search':
        return { ...base, useExactMatch: true, useFuzzySearch: false, maxResults: 5 }
      
      case 'broad_search':
      case 'general_search':
        return { ...base, maxResults: 25, prioritizeRecent: false }
      
      default:
        return base
    }
  }

  /**
   * Get schema inspector instance
   */
  getSchemaIntrospector(): SchemaIntrospector {
    return this.schemaIntrospector
  }
}