# Smart Query Service Improvements

This document outlines the significant improvements made to the SmartQueryService for better database query handling, schema awareness, and error resilience.

## Overview of Changes

The original SmartQueryService had hardcoded table names and column references that didn't match the actual database schema. The improved system provides:

1. **Dynamic Schema Introspection** - Automatically discovers database structure
2. **Adaptive Query Building** - Creates queries based on actual schema
3. **Comprehensive Error Handling** - Graceful failure handling with retry logic
4. **Fallback Strategies** - Multiple search approaches when primary methods fail

## New Architecture

### Core Components

#### 1. SchemaIntrospector (`/server/utils/SchemaIntrospector.ts`)
- **Purpose**: Dynamically discovers database table structures and column information
- **Features**:
  - Caches schema information for performance (5-minute expiry)
  - Identifies searchable columns automatically
  - Finds relevant tables based on query context
  - Provides schema summaries for AI context

#### 2. DynamicQueryBuilder (`/server/utils/DynamicQueryBuilder.ts`)
- **Purpose**: Builds and executes database queries adaptively
- **Features**:
  - Multiple search strategies (exact, fuzzy, partial, broad)
  - Query optimization based on search type
  - Result deduplication and ranking
  - Safe query execution with injection prevention

#### 3. QueryValidationService (`/server/utils/QueryValidationService.ts`)
- **Purpose**: Validates inputs and handles errors comprehensively
- **Features**:
  - Input sanitization and validation
  - Error classification (database, network, permission, timeout)
  - User-friendly error messages
  - Retry strategy recommendations

#### 4. ImprovedSmartQueryService (`/server/services/ImprovedSmartQueryService.ts`)
- **Purpose**: Main service orchestrating all components
- **Features**:
  - Enhanced AI query analysis with schema context
  - Retry logic for recoverable errors
  - Multi-table search with result combination
  - Performance tracking and warnings

## Key Improvements

### 1. Schema Awareness
**Before**: Hardcoded table names (`pianos`, `news`, `piano_activations`)
```typescript
// Old approach - brittle and error-prone
const { data: pianos } = await this.supabase
  .from('pianos') // This table doesn't exist!
  .select('*')
  .or(`piano_title.ilike."${searchPattern}"`) // Column doesn't exist!
```

**After**: Dynamic schema discovery
```typescript
// New approach - discovers actual schema
const relevantTables = await this.schemaIntrospector.findRelevantTables(queryType, searchTerms)
const searchableColumns = await this.schemaIntrospector.getSearchableColumns(tableName)
```

### 2. Error Handling
**Before**: Basic try-catch with generic error messages
```typescript
} catch (error) {
  console.error('Database query error:', error)
  return []
}
```

**After**: Comprehensive error classification and recovery
```typescript
const queryError = this.validator.classifyError(error, { tableName, query })
if (this.validator.isRecoverableError(queryError) && attemptNumber < this.retryAttempts) {
  const delay = this.validator.getRetryDelay(queryError, attemptNumber)
  // Implement retry logic
}
```

### 3. Query Strategies
**Before**: Single query approach
```typescript
// Only one way to search
.or(`column1.ilike."${searchPattern}",column2.ilike."${searchPattern}"`)
```

**After**: Multiple fallback strategies
```typescript
const strategies = [
  () => this.executeExactSearch(tableName, columns, searchTerms, strategy),
  () => this.executeFuzzySearch(tableName, columns, searchTerms, strategy),
  () => this.executePartialSearch(tableName, columns, searchTerms, strategy),
  () => this.executeBroadSearch(tableName, columns, strategy)
]
```

## Usage Examples

### Basic Migration
Replace the old service with the new one:

```typescript
// Old usage
import { SmartQueryService } from './services/SmartQueryService'

// New usage
import { ImprovedSmartQueryService } from './services/ImprovedSmartQueryService'

const queryService = new ImprovedSmartQueryService()
```

### Enhanced Features
```typescript
// Get service status
const status = queryService.getStatus()
console.log('Schema awareness:', status.hasSchemaAwareness)

// Force schema refresh
await queryService.refreshSchema()

// Get available tables
const tables = await queryService.getAvailableTables()
```

### Error Handling
```typescript
const result = await queryService.smartSearch("find piano information")

if (result.warnings) {
  console.warn('Search warnings:', result.warnings)
}

console.log('Tables searched:', result.tablesSearched)
console.log('Execution time:', result.executionTimeMs, 'ms')
```

## Configuration

### Environment Variables
The service works with both internal and external Supabase configurations:

```bash
# Primary (external database)
EXTERNAL_SUPABASE_URL=your_external_db_url
EXTERNAL_SUPABASE_ANON_KEY=your_external_key

# Fallback (main project database)
SUPABASE_URL=your_main_db_url
SUPABASE_ANON_KEY=your_main_key

# Required for AI analysis
OPENAI_API_KEY=your_openai_key
```

### Database Requirements
The service works with any PostgreSQL/Supabase database that has:
- `information_schema` access for schema introspection
- At least one table with searchable text columns
- Proper RLS policies if using row-level security

## Performance Considerations

### Schema Caching
- Schema information is cached for 5 minutes
- Force refresh available via `refreshSchema()` method
- Automatic cache invalidation on errors

### Query Optimization
- Results limited to prevent overwhelming responses (max 25 combined results)
- Fastest queries executed first
- Result deduplication to prevent duplicates across tables

### Retry Logic
- Automatic retry for recoverable errors (network, timeout)
- Exponential backoff for timeouts
- Linear backoff for network issues
- Maximum 3 retry attempts

## Security Features

### Input Validation
- All search terms sanitized to prevent SQL injection
- Table and column names validated against schema
- Query length limits enforced

### Safe Query Execution
- Only SELECT statements allowed for raw queries
- Dangerous SQL keywords blocked
- Parameter binding where possible

### Error Information
- Sensitive database details not exposed to users
- User-friendly error messages generated
- Full error details logged server-side only

## Backward Compatibility

The new service maintains the same interface as the original:
- `smartSearch(userQuery: string): Promise<SmartSearchResult>`
- Same return type structure with additional optional fields
- Existing code can be migrated with minimal changes

Additional fields in response:
- `executionTimeMs?` - Query performance metrics
- `tablesSearched?` - Which tables were actually searched
- `warnings?` - Non-fatal issues encountered

## Future Enhancements

### Planned Features
1. **Full-Text Search Integration** - PostgreSQL FTS support
2. **Vector Search Support** - Semantic search capabilities
3. **Query Caching** - Cache frequent query results
4. **Advanced Analytics** - Query performance tracking
5. **Admin Dashboard** - Schema and performance monitoring

### Extensibility
The modular architecture allows easy addition of:
- New search strategies in DynamicQueryBuilder
- Additional error types in QueryValidationService
- Custom schema validation rules
- Different database backends

## Testing

### Unit Tests (Recommended)
```typescript
// Test schema introspection
const schema = await schemaIntrospector.getSchema()
expect(schema.tables.size).toBeGreaterThan(0)

// Test query validation
const validation = validator.validateSearchInput(['test', 'search'])
expect(validation.isValid).toBe(true)

// Test error classification
const error = new Error('connection failed')
const classified = validator.classifyError(error)
expect(classified.type).toBe('network')
```

### Integration Tests
- Test with actual database connections
- Verify schema discovery works correctly
- Confirm fallback strategies execute properly
- Validate error recovery mechanisms

## Troubleshooting

### Common Issues

1. **"Schema information unavailable"**
   - Check database permissions for `information_schema` access
   - Verify connection credentials
   - Ensure PostgreSQL version supports required features

2. **"No relevant tables found"**
   - Check if tables exist and are accessible
   - Verify table names match expected patterns
   - Consider adding custom table mapping

3. **Slow query performance**
   - Review database indexes on searchable columns
   - Check query complexity and result limits
   - Monitor schema cache hit rates

### Debugging
Enable detailed logging by setting appropriate log levels:
```typescript
// Add to service initialization
console.log('Service status:', queryService.getStatus())
console.log('Available tables:', await queryService.getAvailableTables())
```

## Migration Checklist

- [ ] Install new utility files in `/server/utils/`
- [ ] Deploy ImprovedSmartQueryService
- [ ] Update imports in consuming services
- [ ] Test with your specific database schema
- [ ] Verify error handling works correctly
- [ ] Update any custom query logic
- [ ] Monitor performance and adjust limits if needed
- [ ] Set up proper error logging/monitoring

## Support

For questions or issues with the improved Smart Query Service:
1. Check the troubleshooting section above
2. Review the service status with `getStatus()`
3. Examine server logs for detailed error information
4. Verify database schema and permissions