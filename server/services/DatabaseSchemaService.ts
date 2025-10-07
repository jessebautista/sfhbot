import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface TableSchema {
  tableName: string
  columns: ColumnInfo[]
  primaryKeys: string[]
  createdAt?: Date
  lastUpdated: Date
}

interface ColumnInfo {
  name: string
  type: string
  nullable: boolean
  defaultValue?: any
  isPrimaryKey: boolean
  isForeignKey: boolean
  description?: string
}

interface ColumnMapping {
  tableName: string
  mappings: Record<string, string> // assumed_column_name -> actual_column_name
  searchableColumns: string[]
  displayColumns: string[]
}

interface SchemaDiscoveryResult {
  success: boolean
  schemas: TableSchema[]
  mappings: ColumnMapping[]
  errors: string[]
}

/**
 * Database Schema Discovery Service
 * Dynamically queries database structure and provides column mapping
 * to handle schema mismatches gracefully
 */
export class DatabaseSchemaService {
  private supabase: SupabaseClient | null = null
  private schemaCache: Map<string, TableSchema> = new Map()
  private mappingCache: Map<string, ColumnMapping> = new Map()
  private isAvailable: boolean = false
  private lastCacheUpdate: Date | null = null
  private readonly CACHE_TTL_MINUTES = 30

  // Expected/assumed column names for backward compatibility
  private readonly assumedSchemas = {
    pianos: {
      title: ['piano_title', 'title', 'name', 'piano_name'],
      artist: ['artist_name', 'artist', 'musician', 'composer'],
      statement: ['piano_statement', 'statement', 'description', 'about', 'info'],
      location: ['piano_location', 'location', 'address', 'venue', 'place']
    },
    news: {
      title: ['news_title', 'title', 'headline', 'name'],
      content: ['newscontent', 'content', 'body', 'text', 'description'],
      excerpt: ['news_excerpt', 'excerpt', 'summary', 'brief', 'abstract'],
      categories: ['news_categories', 'categories', 'category', 'tags', 'type']
    },
    piano_activations: {
      title: ['act_title', 'title', 'name', 'activation_title'],
      location: ['act_location', 'location', 'venue', 'address'],
      content: ['act_content', 'content', 'description', 'details', 'info'],
      artists: ['act_artists', 'artists', 'performers', 'musicians']
    }
  }

  constructor() {
    this.initializeDatabase()
  }

  private async initializeDatabase() {
    const url = process.env.EXTERNAL_SUPABASE_URL
    const key = process.env.EXTERNAL_SUPABASE_ANON_KEY

    if (!url || !key) {
      console.log('⚠️ External database credentials missing for schema discovery')
      return
    }

    try {
      this.supabase = createClient(url, key)
      // Test connection and discover schema
      await this.discoverSchema()
      console.log(this.isAvailable ? '✅ Database schema service ready' : '❌ Schema discovery failed')
    } catch (error) {
      console.error('Database schema service initialization error:', error)
      this.isAvailable = false
    }
  }

  /**
   * Main method to discover database schema and create column mappings
   */
  async discoverSchema(forceRefresh = false): Promise<SchemaDiscoveryResult> {
    if (!this.supabase) {
      return {
        success: false,
        schemas: [],
        mappings: [],
        errors: ['Database connection not available']
      }
    }

    // Check cache validity
    if (!forceRefresh && this.lastCacheUpdate && this.isCacheValid()) {
      return {
        success: true,
        schemas: Array.from(this.schemaCache.values()),
        mappings: Array.from(this.mappingCache.values()),
        errors: []
      }
    }

    const result: SchemaDiscoveryResult = {
      success: true,
      schemas: [],
      mappings: [],
      errors: []
    }

    const targetTables = ['pianos', 'news', 'piano_activations']

    for (const tableName of targetTables) {
      try {
        console.log(`🔍 Discovering schema for table: ${tableName}`)
        
        // Get table structure using PostgreSQL information_schema
        const schema = await this.getTableSchema(tableName)
        if (schema) {
          result.schemas.push(schema)
          this.schemaCache.set(tableName, schema)

          // Create column mapping
          const mapping = this.createColumnMapping(tableName, schema)
          result.mappings.push(mapping)
          this.mappingCache.set(tableName, mapping)

          console.log(`✅ Schema discovered for ${tableName}: ${schema.columns.length} columns`)
        } else {
          const error = `Table ${tableName} not found or inaccessible`
          result.errors.push(error)
          console.warn(`⚠️ ${error}`)
        }
      } catch (error) {
        const errorMsg = `Error discovering schema for ${tableName}: ${error}`
        result.errors.push(errorMsg)
        console.error(`❌ ${errorMsg}`)
      }
    }

    this.isAvailable = result.schemas.length > 0
    this.lastCacheUpdate = new Date()

    console.log(`📊 Schema discovery complete: ${result.schemas.length} tables, ${result.errors.length} errors`)
    return result
  }

  /**
   * Get detailed schema information for a specific table
   */
  private async getTableSchema(tableName: string): Promise<TableSchema | null> {
    if (!this.supabase) return null

    try {
      // First, try to get basic table info by querying the table directly
      const { data: sampleData, error: sampleError } = await this.supabase
        .from(tableName)
        .select('*')
        .limit(1)

      if (sampleError) {
        console.error(`Cannot access table ${tableName}:`, sampleError.message)
        return null
      }

      // Get column information using PostgreSQL system catalogs
      const { data: columnInfo, error: columnError } = await this.supabase
        .rpc('get_table_schema', { table_name: tableName })
        .single()

      // If RPC function doesn't exist, fallback to manual discovery
      if (columnError || !columnInfo) {
        return this.fallbackSchemaDiscovery(tableName, sampleData)
      }

      return this.parseSchemaFromRPC(tableName, columnInfo)
    } catch (error) {
      console.error(`Schema discovery error for ${tableName}:`, error)
      return null
    }
  }

  /**
   * Fallback method when RPC function is not available
   * Discovers schema from sample data and common PostgreSQL queries
   */
  private async fallbackSchemaDiscovery(tableName: string, sampleData: any[] | null): Promise<TableSchema | null> {
    if (!this.supabase || !sampleData || sampleData.length === 0) {
      // Try to get any data to inspect structure
      const { data, error } = await this.supabase!
        .from(tableName)
        .select('*')
        .limit(1)

      if (error || !data || data.length === 0) {
        console.log(`⚠️ Table ${tableName} exists but has no data to inspect`)
        return null
      }
      sampleData = data
    }

    const columns: ColumnInfo[] = []
    const sampleRow = sampleData[0]

    // Analyze each column from the sample data
    for (const [columnName, value] of Object.entries(sampleRow)) {
      const columnInfo: ColumnInfo = {
        name: columnName,
        type: this.inferColumnType(value),
        nullable: value === null,
        isPrimaryKey: columnName.toLowerCase().includes('id'),
        isForeignKey: columnName.toLowerCase().endsWith('_id') && columnName !== 'id',
        description: this.generateColumnDescription(tableName, columnName)
      }
      columns.push(columnInfo)
    }

    return {
      tableName,
      columns,
      primaryKeys: columns.filter(c => c.isPrimaryKey).map(c => c.name),
      lastUpdated: new Date()
    }
  }

  /**
   * Parse schema information from RPC function result
   */
  private parseSchemaFromRPC(tableName: string, schemaInfo: any): TableSchema {
    // This would parse the result from a custom PostgreSQL function
    // For now, implementing basic structure
    return {
      tableName,
      columns: schemaInfo.columns || [],
      primaryKeys: schemaInfo.primary_keys || [],
      lastUpdated: new Date()
    }
  }

  /**
   * Create intelligent column mapping based on discovered schema
   */
  private createColumnMapping(tableName: string, schema: TableSchema): ColumnMapping {
    const actualColumns = schema.columns.map(c => c.name.toLowerCase())
    const mappings: Record<string, string> = {}
    const searchableColumns: string[] = []
    const displayColumns: string[] = []

    // Get assumed schema for this table
    const assumedSchema = this.assumedSchemas[tableName as keyof typeof this.assumedSchemas]
    if (!assumedSchema) {
      // No assumed schema - use all text-like columns
      schema.columns
        .filter(col => this.isTextColumn(col.type))
        .forEach(col => {
          searchableColumns.push(col.name)
          displayColumns.push(col.name)
        })

      return {
        tableName,
        mappings,
        searchableColumns,
        displayColumns
      }
    }

    // Map assumed columns to actual columns using intelligent matching
    for (const [assumedName, possibleColumns] of Object.entries(assumedSchema)) {
      const actualColumn = this.findBestColumnMatch(possibleColumns, actualColumns)
      if (actualColumn) {
        mappings[assumedName] = actualColumn
        
        // Add to searchable columns if it's a text field
        const columnInfo = schema.columns.find(c => c.name.toLowerCase() === actualColumn)
        if (columnInfo && this.isTextColumn(columnInfo.type)) {
          searchableColumns.push(actualColumn)
        }
        
        // Add important columns to display list
        if (['title', 'name', 'artist', 'location'].some(key => assumedName.includes(key))) {
          displayColumns.push(actualColumn)
        }
      } else {
        console.warn(`⚠️ No matching column found for ${tableName}.${assumedName}`)
      }
    }

    // Add any additional text columns that might be useful for searching
    schema.columns
      .filter(col => 
        this.isTextColumn(col.type) && 
        !searchableColumns.includes(col.name) &&
        !col.name.toLowerCase().endsWith('_id') &&
        col.name.toLowerCase() !== 'id'
      )
      .forEach(col => {
        searchableColumns.push(col.name)
      })

    return {
      tableName,
      mappings,
      searchableColumns: [...new Set(searchableColumns)],
      displayColumns: [...new Set(displayColumns)]
    }
  }

  /**
   * Find the best matching column name from a list of possibilities
   */
  private findBestColumnMatch(possibleColumns: string[], actualColumns: string[]): string | null {
    // Exact match first
    for (const possible of possibleColumns) {
      if (actualColumns.includes(possible.toLowerCase())) {
        return actualColumns.find(col => col === possible.toLowerCase()) || null
      }
    }

    // Partial match
    for (const possible of possibleColumns) {
      const match = actualColumns.find(actual => 
        actual.includes(possible.toLowerCase()) || possible.toLowerCase().includes(actual)
      )
      if (match) return match
    }

    return null
  }

  /**
   * Infer column type from sample value
   */
  private inferColumnType(value: any): string {
    if (value === null || value === undefined) return 'unknown'
    if (typeof value === 'string') return 'text'
    if (typeof value === 'number') return Number.isInteger(value) ? 'integer' : 'numeric'
    if (typeof value === 'boolean') return 'boolean'
    if (value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)))) return 'timestamp'
    if (Array.isArray(value)) return 'array'
    if (typeof value === 'object') return 'json'
    return 'unknown'
  }

  /**
   * Check if column type is text-searchable
   */
  private isTextColumn(type: string): boolean {
    return ['text', 'varchar', 'char', 'string'].some(textType => 
      type.toLowerCase().includes(textType)
    )
  }

  /**
   * Generate helpful column descriptions
   */
  private generateColumnDescription(tableName: string, columnName: string): string {
    const name = columnName.toLowerCase()
    if (name.includes('title') || name.includes('name')) return 'Title or name field'
    if (name.includes('content') || name.includes('description')) return 'Main content field'
    if (name.includes('location') || name.includes('address')) return 'Location information'
    if (name.includes('artist') || name.includes('musician')) return 'Artist information'
    if (name.includes('date') || name.includes('time')) return 'Date/time field'
    if (name.includes('id')) return 'Identifier field'
    return `Column in ${tableName} table`
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate) return false
    const now = new Date()
    const diffMinutes = (now.getTime() - this.lastCacheUpdate.getTime()) / (1000 * 60)
    return diffMinutes < this.CACHE_TTL_MINUTES
  }

  // Public API methods

  /**
   * Get column mapping for a specific table
   */
  async getColumnMapping(tableName: string): Promise<ColumnMapping | null> {
    if (this.mappingCache.has(tableName) && this.isCacheValid()) {
      return this.mappingCache.get(tableName) || null
    }

    await this.discoverSchema()
    return this.mappingCache.get(tableName) || null
  }

  /**
   * Get actual column name from assumed column name
   */
  async getMappedColumn(tableName: string, assumedColumnName: string): Promise<string | null> {
    const mapping = await this.getColumnMapping(tableName)
    return mapping?.mappings[assumedColumnName] || null
  }

  /**
   * Get all searchable columns for a table
   */
  async getSearchableColumns(tableName: string): Promise<string[]> {
    const mapping = await this.getColumnMapping(tableName)
    return mapping?.searchableColumns || []
  }

  /**
   * Build a safe search query string for Supabase with proper column mapping
   */
  async buildSearchQuery(tableName: string, searchTerm: string): Promise<string | null> {
    const searchableColumns = await this.getSearchableColumns(tableName)
    if (searchableColumns.length === 0) return null

    const searchPattern = `%${searchTerm}%`
    const conditions = searchableColumns
      .map(column => `${column}.ilike."${searchPattern}"`)
      .join(',')

    return conditions
  }

  /**
   * Get table schema information
   */
  async getTableSchema(tableName: string): Promise<TableSchema | null> {
    if (this.schemaCache.has(tableName) && this.isCacheValid()) {
      return this.schemaCache.get(tableName) || null
    }

    await this.discoverSchema()
    return this.schemaCache.get(tableName) || null
  }

  /**
   * Get service status and diagnostics
   */
  getStatus() {
    return {
      available: this.isAvailable,
      hasConnection: this.supabase !== null,
      tablesDiscovered: this.schemaCache.size,
      mappingsCreated: this.mappingCache.size,
      lastCacheUpdate: this.lastCacheUpdate,
      cacheValid: this.isCacheValid()
    }
  }

  /**
   * Force refresh of schema cache
   */
  async refreshSchema(): Promise<SchemaDiscoveryResult> {
    console.log('🔄 Forcing schema refresh...')
    this.schemaCache.clear()
    this.mappingCache.clear()
    return await this.discoverSchema(true)
  }

  /**
   * Get diagnostic information about column mappings
   */
  getDiagnostics() {
    const diagnostics: any = {}
    
    for (const [tableName, mapping] of this.mappingCache) {
      diagnostics[tableName] = {
        mappings: mapping.mappings,
        searchableColumns: mapping.searchableColumns,
        displayColumns: mapping.displayColumns,
        columnCount: this.schemaCache.get(tableName)?.columns.length || 0
      }
    }

    return {
      isAvailable: this.isAvailable,
      cacheStatus: {
        valid: this.isCacheValid(),
        lastUpdate: this.lastCacheUpdate,
        tablesCached: this.schemaCache.size
      },
      tableDiagnostics: diagnostics
    }
  }
}