import { SupabaseClient } from '@supabase/supabase-js'

/**
 * Database schema introspection utility
 * Dynamically discovers table structures and column information
 */
export interface ColumnInfo {
  column_name: string
  data_type: string
  is_nullable: string
  column_default: string | null
  ordinal_position: number
}

export interface TableSchema {
  table_name: string
  columns: ColumnInfo[]
  searchableColumns: string[]
  primaryKey?: string
  hasFullText: boolean
}

export interface DatabaseSchema {
  tables: Map<string, TableSchema>
  lastUpdated: Date
}

export class SchemaIntrospector {
  private supabase: SupabaseClient
  private schemaCache: DatabaseSchema | null = null
  private cacheExpiry: number = 5 * 60 * 1000 // 5 minutes

  constructor(supabase: SupabaseClient) {
    this.supabase = supabase
  }

  /**
   * Get complete database schema with caching
   */
  async getSchema(forceRefresh: boolean = false): Promise<DatabaseSchema> {
    if (this.schemaCache && 
        !forceRefresh && 
        Date.now() - this.schemaCache.lastUpdated.getTime() < this.cacheExpiry) {
      return this.schemaCache
    }

    console.log('🔍 Introspecting database schema...')
    
    const tables = new Map<string, TableSchema>()

    try {
      // Get all user tables (excluding system tables)
      const { data: tableData, error: tableError } = await this.supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE')

      if (tableError) {
        console.error('Error fetching tables:', tableError)
        throw new Error(`Failed to fetch tables: ${tableError.message}`)
      }

      for (const table of tableData || []) {
        const schema = await this.getTableSchema(table.table_name)
        if (schema) {
          tables.set(table.table_name, schema)
        }
      }

      this.schemaCache = {
        tables,
        lastUpdated: new Date()
      }

      console.log(`✅ Schema introspection complete: ${tables.size} tables discovered`)
      return this.schemaCache

    } catch (error) {
      console.error('Schema introspection failed:', error)
      // Return empty schema on failure
      return {
        tables: new Map(),
        lastUpdated: new Date()
      }
    }
  }

  /**
   * Get schema for a specific table
   */
  private async getTableSchema(tableName: string): Promise<TableSchema | null> {
    try {
      // Get column information
      const { data: columns, error } = await this.supabase
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable, column_default, ordinal_position')
        .eq('table_name', tableName)
        .eq('table_schema', 'public')
        .order('ordinal_position')

      if (error || !columns) {
        console.error(`Error fetching columns for ${tableName}:`, error)
        return null
      }

      // Identify searchable text columns
      const searchableColumns = columns
        .filter(col => 
          ['text', 'character varying', 'varchar', 'json', 'jsonb'].includes(col.data_type.toLowerCase()) ||
          col.column_name.toLowerCase().includes('title') ||
          col.column_name.toLowerCase().includes('name') ||
          col.column_name.toLowerCase().includes('content') ||
          col.column_name.toLowerCase().includes('description') ||
          col.column_name.toLowerCase().includes('excerpt')
        )
        .map(col => col.column_name)

      // Find primary key
      const primaryKey = columns.find(col => 
        col.column_name === 'id' || 
        col.column_default?.includes('uuid_generate') ||
        col.column_default?.includes('nextval')
      )?.column_name

      // Check if table has full-text search capabilities
      const hasFullText = columns.some(col => 
        col.data_type === 'tsvector' || 
        searchableColumns.length > 2
      )

      return {
        table_name: tableName,
        columns: columns as ColumnInfo[],
        searchableColumns,
        primaryKey,
        hasFullText
      }

    } catch (error) {
      console.error(`Failed to get schema for table ${tableName}:`, error)
      return null
    }
  }

  /**
   * Find tables that likely contain the type of data requested
   */
  async findRelevantTables(queryType: string, searchTerms: string[]): Promise<string[]> {
    const schema = await this.getSchema()
    const relevantTables: string[] = []

    // Keyword-based table matching
    const tableKeywords = new Map([
      ['knowledge', ['knowledge', 'document', 'content', 'article']],
      ['chat', ['chat', 'message', 'conversation', 'log']],
      ['user', ['user', 'session', 'profile', 'account']],
      ['piano', ['piano', 'instrument', 'music']],
      ['news', ['news', 'article', 'post', 'content']],
      ['event', ['event', 'activity', 'activation', 'schedule']]
    ])

    // Score tables based on relevance
    const tableScores = new Map<string, number>()

    for (const [tableName, tableSchema] of schema.tables) {
      let score = 0

      // Score based on table name matching
      for (const [category, keywords] of tableKeywords) {
        if (queryType.toLowerCase().includes(category) || 
            searchTerms.some(term => keywords.includes(term.toLowerCase()))) {
          if (keywords.some(keyword => tableName.toLowerCase().includes(keyword))) {
            score += 10
          }
        }
      }

      // Score based on searchable columns
      score += tableSchema.searchableColumns.length * 2

      // Bonus for tables with full-text capabilities
      if (tableSchema.hasFullText) {
        score += 5
      }

      // Bonus for tables with content-like columns
      const contentColumns = tableSchema.searchableColumns.filter(col =>
        ['title', 'content', 'description', 'text', 'body', 'excerpt'].some(
          contentWord => col.toLowerCase().includes(contentWord)
        )
      )
      score += contentColumns.length * 3

      if (score > 0) {
        tableScores.set(tableName, score)
      }
    }

    // Return tables sorted by relevance score
    return Array.from(tableScores.entries())
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5) // Limit to top 5 most relevant tables
      .map(([tableName]) => tableName)
  }

  /**
   * Validate if a column exists in a table
   */
  async validateColumn(tableName: string, columnName: string): Promise<boolean> {
    const schema = await this.getSchema()
    const table = schema.tables.get(tableName)
    return table?.columns.some(col => col.column_name === columnName) || false
  }

  /**
   * Get searchable columns for a table with fallbacks
   */
  async getSearchableColumns(tableName: string): Promise<string[]> {
    const schema = await this.getSchema()
    const table = schema.tables.get(tableName)
    
    if (!table) return []

    // Return identified searchable columns or fallback to common patterns
    if (table.searchableColumns.length > 0) {
      return table.searchableColumns
    }

    // Fallback: look for common column patterns
    const commonPatterns = ['title', 'name', 'content', 'description', 'text', 'body']
    return table.columns
      .filter(col => 
        commonPatterns.some(pattern => col.column_name.toLowerCase().includes(pattern))
      )
      .map(col => col.column_name)
  }

  /**
   * Check if schema introspection is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('information_schema.tables')
        .select('table_name', { count: 'exact', head: true })
        .limit(1)

      return !error
    } catch {
      return false
    }
  }

  /**
   * Get a summary of the database structure for AI context
   */
  async getSchemaSummary(): Promise<string> {
    const schema = await this.getSchema()
    
    if (schema.tables.size === 0) {
      return "No accessible database schema found."
    }

    let summary = "Database contains the following tables:\n"
    
    for (const [tableName, table] of schema.tables) {
      const searchableCols = table.searchableColumns.slice(0, 5).join(', ')
      const totalCols = table.columns.length
      
      summary += `- ${tableName}: ${totalCols} columns, searchable: [${searchableCols}]\n`
    }

    return summary
  }

  /**
   * Clear schema cache
   */
  clearCache(): void {
    this.schemaCache = null
  }
}