# Database Schema Discovery Service

The Database Schema Discovery Service automatically detects the actual database schema and provides column mapping to handle schema mismatches gracefully. This prevents errors like "column pianos.piano_location does not exist" by dynamically discovering the real column names and mapping them to expected names.

## Features

### 1. Dynamic Schema Discovery
- Queries database structure using PostgreSQL information_schema
- Discovers actual table columns, types, and constraints
- Caches schema information for performance (30-minute TTL)
- Provides fallback discovery when system tables aren't accessible

### 2. Intelligent Column Mapping
- Maps assumed column names to actual column names
- Uses fuzzy matching for similar column names
- Identifies searchable text columns automatically
- Provides display column recommendations

### 3. Graceful Error Handling
- Fallbacks to basic queries when schema discovery fails
- Client-side filtering when database queries fail
- Progressive degradation of functionality
- Detailed error logging and diagnostics

### 4. Performance Optimization
- Schema caching with configurable TTL
- Lazy initialization of database connections
- Efficient query building with actual column names
- Minimal overhead on successful queries

## Database Setup

### Option 1: Enhanced Setup (Recommended)
Run the SQL functions from `database_schema_functions.sql` in your Supabase database:

```sql
-- Creates helper functions for better schema introspection
-- get_table_schema(table_name) - Returns detailed schema information
-- get_tables_info(table_names[]) - Returns basic info for multiple tables
-- find_similar_columns(table_name, target_column) - Finds similar column names
-- validate_query_columns(table_name, columns[]) - Validates column existence
```

### Option 2: Basic Setup
The service will work without the SQL functions but with reduced capabilities:
- Uses fallback schema discovery from sample data
- Limited fuzzy matching capabilities
- Basic error recovery

## Usage

### Integration with SmartQueryService

The service is automatically integrated into `SmartQueryService`. No code changes required:

```typescript
// The SmartQueryService now uses schema-aware queries
const smartQuery = new SmartQueryService()
const results = await smartQuery.smartSearch("find pianos by Mozart")
```

### Direct Usage

```typescript
import { DatabaseSchemaService } from './services/DatabaseSchemaService'

const schemaService = new DatabaseSchemaService()

// Discover schema for all tables
const discovery = await schemaService.discoverSchema()
console.log(`Discovered ${discovery.schemas.length} tables`)

// Get column mapping for a specific table
const mapping = await schemaService.getColumnMapping('pianos')
console.log('Actual columns:', mapping?.searchableColumns)

// Build a search query with proper column names
const searchQuery = await schemaService.buildSearchQuery('pianos', 'Mozart')
// Returns: "title.ilike.\"%Mozart%\",composer.ilike.\"%Mozart%\",description.ilike.\"%Mozart%\""
```

## API Endpoints

### Schema Diagnostics
```bash
GET /api/diagnostics/schema
```

Returns comprehensive diagnostics about the schema service:

```json
{
  "success": true,
  "diagnostics": {
    "smartQueryService": {
      "available": true,
      "hasConnection": true,
      "hasOpenAI": true
    },
    "schemaService": {
      "isAvailable": true,
      "cacheStatus": {
        "valid": true,
        "lastUpdate": "2024-01-15T10:30:00Z",
        "tablesCached": 3
      },
      "tableDiagnostics": {
        "pianos": {
          "mappings": {
            "title": "piano_name",
            "artist": "composer",
            "location": "venue"
          },
          "searchableColumns": ["piano_name", "composer", "description"],
          "displayColumns": ["piano_name", "composer", "venue"],
          "columnCount": 8
        }
      }
    }
  }
}
```

### Force Schema Refresh
```bash
POST /api/diagnostics/schema/refresh
```

Forces a refresh of the schema cache:

```json
{
  "success": true,
  "result": {
    "success": true,
    "schemas": [...],
    "mappings": [...],
    "errors": []
  }
}
```

### Test Smart Query
```bash
POST /api/diagnostics/test-query
Content-Type: application/json

{
  "query": "find pianos by Mozart"
}
```

Tests the schema-aware query system:

```json
{
  "success": true,
  "result": {
    "results": [...],
    "naturalResponse": "I found 3 pianos related to Mozart...",
    "dataUsed": true,
    "reasoning": "Piano search with composer matching",
    "queryType": "piano_search"
  }
}
```

## Schema Mapping Configuration

The service uses intelligent mapping based on common naming patterns:

### Assumed vs Actual Column Mapping

```typescript
// For 'pianos' table
const assumedSchema = {
  title: ['piano_title', 'title', 'name', 'piano_name'],
  artist: ['artist_name', 'artist', 'musician', 'composer'],
  statement: ['piano_statement', 'statement', 'description', 'about'],
  location: ['piano_location', 'location', 'address', 'venue']
}

// For 'news' table  
const assumedSchema = {
  title: ['news_title', 'title', 'headline', 'name'],
  content: ['newscontent', 'content', 'body', 'text'],
  excerpt: ['news_excerpt', 'excerpt', 'summary', 'brief'],
  categories: ['news_categories', 'categories', 'category', 'tags']
}
```

### Adding New Table Support

To support a new table, add it to the `assumedSchemas` configuration:

```typescript
// In DatabaseSchemaService.ts
private readonly assumedSchemas = {
  // ... existing tables ...
  events: {
    title: ['event_title', 'title', 'name', 'event_name'],
    date: ['event_date', 'date', 'start_date', 'scheduled_date'],
    location: ['event_location', 'location', 'venue', 'address'],
    description: ['event_description', 'description', 'details', 'about']
  }
}
```

## Error Handling

The service provides multiple layers of error handling:

### 1. Schema Discovery Failures
- Falls back to sample data inspection
- Uses basic column type inference
- Continues with limited functionality

### 2. Query Execution Failures  
- Tries alternate sorting columns
- Falls back to unsorted queries
- Provides client-side filtering

### 3. Connection Failures
- Graceful degradation to offline mode
- Detailed error logging
- Clear status reporting

## Troubleshooting

### Common Issues

1. **"Column does not exist" errors**
   - Check schema diagnostics: `GET /api/diagnostics/schema`
   - Force schema refresh: `POST /api/diagnostics/schema/refresh`
   - Verify database connection and permissions

2. **No results from queries**
   - Test with diagnostic endpoint: `POST /api/diagnostics/test-query`
   - Check if tables have data
   - Verify searchable columns are identified correctly

3. **Performance issues**
   - Schema cache may be stale (refreshes every 30 minutes)
   - Force refresh to get latest schema
   - Consider adding database indexes on searchable columns

### Logging

The service provides detailed console logging:

```
✅ Connected to table: pianos
🔍 Schema discovered for 3 tables
🎹 Searching pianos with schema-aware approach
🔍 Using schema-aware query for pianos: title.ilike."%Mozart%"
✅ Schema-aware search found 2 results in pianos
```

Error logs include specific details:

```
❌ Schema-aware search error for pianos: column "piano_title" does not exist
🔄 Executing fallback search for pianos
📊 Fallback: Found 5 recent records from pianos
```

## Integration with Existing Code

The service is designed to be a drop-in replacement that enhances existing functionality without breaking changes:

- `SmartQueryService` automatically uses schema-aware queries
- Existing query logic falls back gracefully on errors  
- No changes required to calling code
- Additional diagnostics available for debugging

The schema discovery service makes the system more robust and adaptable to different database schemas while maintaining backward compatibility.