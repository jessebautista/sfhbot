/**
 * Comprehensive query validation and error handling service
 * Provides safety checks, query sanitization, and graceful error recovery
 */

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  sanitizedInput?: any
}

export interface QueryError {
  type: 'database' | 'validation' | 'permission' | 'timeout' | 'network'
  message: string
  originalError?: any
  tableName?: string
  query?: string
  timestamp: Date
}

export class QueryValidationService {
  
  /**
   * Validate search input parameters
   */
  validateSearchInput(searchTerms: string[], queryType?: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // Basic null/undefined checks
    if (!searchTerms || !Array.isArray(searchTerms)) {
      errors.push('Search terms must be provided as an array')
      return { isValid: false, errors, warnings }
    }

    // Empty search terms check
    if (searchTerms.length === 0) {
      errors.push('At least one search term must be provided')
      return { isValid: false, errors, warnings }
    }

    // Sanitize and validate each term
    const sanitizedTerms = searchTerms
      .filter(term => typeof term === 'string' && term.trim().length > 0)
      .map(term => this.sanitizeSearchTerm(term))
      .filter(term => term.length > 0)

    // Check if any valid terms remain after sanitization
    if (sanitizedTerms.length === 0) {
      errors.push('No valid search terms found after sanitization')
      return { isValid: false, errors, warnings }
    }

    // Check for excessively long terms
    const longTerms = sanitizedTerms.filter(term => term.length > 100)
    if (longTerms.length > 0) {
      warnings.push(`Some search terms are very long and have been truncated: ${longTerms.length} terms`)
    }

    // Check for too many terms
    if (sanitizedTerms.length > 10) {
      warnings.push('Too many search terms provided; using first 10 terms only')
    }

    // Validate query type if provided
    if (queryType && typeof queryType !== 'string') {
      warnings.push('Query type should be a string; using default type')
    }

    return {
      isValid: true,
      errors,
      warnings,
      sanitizedInput: {
        searchTerms: sanitizedTerms.slice(0, 10),
        queryType: typeof queryType === 'string' ? queryType.toLowerCase().trim() : 'general'
      }
    }
  }

  /**
   * Validate table name to prevent injection
   */
  validateTableName(tableName: string): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!tableName || typeof tableName !== 'string') {
      errors.push('Table name must be a non-empty string')
      return { isValid: false, errors, warnings }
    }

    const sanitized = tableName.trim().toLowerCase()

    // Check for valid table name format (alphanumeric + underscores only)
    if (!/^[a-z][a-z0-9_]*$/.test(sanitized)) {
      errors.push('Table name contains invalid characters (only letters, numbers, and underscores allowed)')
      return { isValid: false, errors, warnings }
    }

    // Check length
    if (sanitized.length > 63) {
      errors.push('Table name is too long (maximum 63 characters)')
      return { isValid: false, errors, warnings }
    }

    // Check for reserved PostgreSQL keywords
    const reservedKeywords = [
      'select', 'insert', 'update', 'delete', 'drop', 'create', 'alter', 
      'table', 'index', 'view', 'function', 'procedure', 'trigger',
      'user', 'role', 'grant', 'revoke', 'commit', 'rollback'
    ]

    if (reservedKeywords.includes(sanitized)) {
      errors.push(`Table name '${sanitized}' is a reserved keyword`)
      return { isValid: false, errors, warnings }
    }

    return {
      isValid: true,
      errors,
      warnings,
      sanitizedInput: sanitized
    }
  }

  /**
   * Validate column names for queries
   */
  validateColumnNames(columnNames: string[]): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!columnNames || !Array.isArray(columnNames)) {
      errors.push('Column names must be provided as an array')
      return { isValid: false, errors, warnings }
    }

    const sanitizedColumns: string[] = []

    for (const col of columnNames) {
      if (!col || typeof col !== 'string') {
        warnings.push('Skipping invalid column name (not a string)')
        continue
      }

      const sanitized = col.trim().toLowerCase()

      // Validate column name format
      if (!/^[a-z][a-z0-9_]*$/.test(sanitized)) {
        warnings.push(`Skipping invalid column name: ${col}`)
        continue
      }

      // Check length
      if (sanitized.length > 63) {
        warnings.push(`Column name too long, truncating: ${col}`)
        sanitizedColumns.push(sanitized.substring(0, 63))
        continue
      }

      sanitizedColumns.push(sanitized)
    }

    if (sanitizedColumns.length === 0) {
      errors.push('No valid column names found')
      return { isValid: false, errors, warnings }
    }

    return {
      isValid: true,
      errors,
      warnings,
      sanitizedInput: sanitizedColumns
    }
  }

  /**
   * Sanitize search term to prevent injection
   */
  private sanitizeSearchTerm(term: string): string {
    if (typeof term !== 'string') return ''

    return term
      .trim()
      // Remove or escape potentially dangerous characters
      .replace(/['"\\`;]/g, '') // Remove quotes, backslashes, semicolons
      .replace(/--/g, '') // Remove SQL comment markers
      .replace(/\/\*/g, '') // Remove block comment starts
      .replace(/\*\//g, '') // Remove block comment ends
      .replace(/\x00/g, '') // Remove null bytes
      // Limit length
      .substring(0, 100)
  }

  /**
   * Classify and handle different types of database errors
   */
  classifyError(error: any, context: { tableName?: string, query?: string } = {}): QueryError {
    const timestamp = new Date()

    // PostgreSQL/Supabase specific error classification
    if (error?.code) {
      switch (error.code) {
        case '42P01': // undefined_table
          return {
            type: 'database',
            message: `Table '${context.tableName || 'unknown'}' does not exist`,
            originalError: error,
            tableName: context.tableName,
            timestamp
          }

        case '42703': // undefined_column
          return {
            type: 'database',
            message: `Column does not exist in table '${context.tableName || 'unknown'}'`,
            originalError: error,
            tableName: context.tableName,
            timestamp
          }

        case '42501': // insufficient_privilege
          return {
            type: 'permission',
            message: `Insufficient permissions to access '${context.tableName || 'resource'}'`,
            originalError: error,
            tableName: context.tableName,
            timestamp
          }

        case '57014': // query_canceled (timeout)
          return {
            type: 'timeout',
            message: 'Query was canceled due to timeout',
            originalError: error,
            query: context.query,
            timestamp
          }

        case '08000': // connection_exception
        case '08003': // connection_does_not_exist
        case '08006': // connection_failure
          return {
            type: 'network',
            message: 'Database connection failed',
            originalError: error,
            timestamp
          }

        default:
          return {
            type: 'database',
            message: `Database error: ${error.message || 'Unknown error'}`,
            originalError: error,
            tableName: context.tableName,
            query: context.query,
            timestamp
          }
      }
    }

    // Handle Supabase API errors
    if (error?.message) {
      if (error.message.includes('permission')) {
        return {
          type: 'permission',
          message: `Permission denied: ${error.message}`,
          originalError: error,
          timestamp
        }
      }

      if (error.message.includes('timeout') || error.message.includes('timed out')) {
        return {
          type: 'timeout',
          message: `Request timed out: ${error.message}`,
          originalError: error,
          timestamp
        }
      }

      if (error.message.includes('network') || error.message.includes('connection')) {
        return {
          type: 'network',
          message: `Network error: ${error.message}`,
          originalError: error,
          timestamp
        }
      }
    }

    // Generic error fallback
    return {
      type: 'database',
      message: error?.message || 'An unknown error occurred',
      originalError: error,
      tableName: context.tableName,
      query: context.query,
      timestamp
    }
  }

  /**
   * Generate user-friendly error message
   */
  generateUserFriendlyMessage(queryError: QueryError): string {
    switch (queryError.type) {
      case 'database':
        if (queryError.message.includes('does not exist')) {
          return 'The requested information could not be found in our database. Please try a different search term.'
        }
        return 'We encountered a database issue while searching. Please try again in a moment.'

      case 'permission':
        return 'Access to this information is restricted. Please contact support if you believe this is an error.'

      case 'timeout':
        return 'Your search is taking longer than expected. Please try with more specific search terms.'

      case 'network':
        return 'We\'re having trouble connecting to our database. Please check your connection and try again.'

      case 'validation':
        return queryError.message // Validation messages are already user-friendly

      default:
        return 'An unexpected error occurred. Please try again or contact support if the issue persists.'
    }
  }

  /**
   * Check if an error is recoverable
   */
  isRecoverableError(queryError: QueryError): boolean {
    switch (queryError.type) {
      case 'timeout':
      case 'network':
        return true

      case 'database':
        // Some database errors are recoverable (like connection issues)
        return queryError.message.includes('connection') || 
               queryError.message.includes('timeout')

      case 'permission':
      case 'validation':
        return false

      default:
        return false
    }
  }

  /**
   * Get suggested retry delay for recoverable errors
   */
  getRetryDelay(queryError: QueryError, attemptNumber: number): number {
    if (!this.isRecoverableError(queryError)) {
      return 0
    }

    const baseDelay = 1000 // 1 second
    const maxDelay = 30000 // 30 seconds

    switch (queryError.type) {
      case 'timeout':
        return Math.min(baseDelay * Math.pow(2, attemptNumber), maxDelay)

      case 'network':
        return Math.min(baseDelay * attemptNumber, maxDelay)

      default:
        return baseDelay
    }
  }

  /**
   * Validate query result structure
   */
  validateQueryResult(result: any): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (!result) {
      errors.push('Query result is null or undefined')
      return { isValid: false, errors, warnings }
    }

    if (!Array.isArray(result)) {
      warnings.push('Query result is not an array, attempting to normalize')
      const normalized = Array.isArray(result.data) ? result.data : [result]
      return {
        isValid: true,
        errors,
        warnings,
        sanitizedInput: normalized
      }
    }

    // Check for suspiciously large results
    if (result.length > 1000) {
      warnings.push(`Large result set returned: ${result.length} rows. Consider adding limits.`)
    }

    return {
      isValid: true,
      errors,
      warnings,
      sanitizedInput: result
    }
  }
}