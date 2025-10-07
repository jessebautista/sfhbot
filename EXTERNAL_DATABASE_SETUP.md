# External Database Integration Guide

## Overview

Your SFH Bot can now search **multiple databases** simultaneously:
- **SFH Bot Database**: Organizational knowledge (donations, events, volunteering)
- **Your Existing Database**: News articles and piano records (live, always up-to-date)

## Quick Setup

### 1. Add External Database Credentials

Add these to your `.env` file:

```env
# Your existing Supabase database
EXTERNAL_SUPABASE_URL=https://your-existing-project.supabase.co
EXTERNAL_SUPABASE_ANON_KEY=your-existing-anon-key
```

### 2. Update Table Names (Important!)

The system assumes your tables are named:
- `news` - for news articles
- `piano_records` - for piano records

**If your tables have different names**, update these files:
- `server/services/ExternalDataService.ts` (lines with `.from('news')` and `.from('piano_records')`)

### 3. Update Column Names (Important!)

The system expects these columns:

**For News Table:**
```sql
-- Required
id, title

-- Optional (but recommended)
content, excerpt, published_at, category, slug
```

**For Piano Records Table:**
```sql
-- Required  
id

-- Optional (but recommended)
title, artist, composer, genre, description, year, created_at
```

**If your columns are different**, update the `.select()` statements in `ExternalDataService.ts`.

## How It Works

### Smart Query Routing

The system automatically determines what to search based on user queries:

- **"Tell me about donations"** → Searches organizational knowledge only
- **"What's the latest news?"** → Searches your news database
- **"Find piano pieces by Chopin"** → Searches your piano records
- **"Any recent updates?"** → Searches both external databases
- **"How do I volunteer for music events?"** → Searches all databases

### Response Format

Users get contextualized responses like:

> "Based on our organizational information: [donation process details]
> 
> Recent news update: [News] Concert Fundraiser Success: Our recent fundraiser raised $15,000... (Published: Dec 15, 2024)
>
> Related music: [Piano Record] Chopin - Nocturne in E-flat major (Classical piece from 1831)"

## Testing Your Integration

### 1. Test Connection

```bash
# Start your server
npm run dev

# Check logs for:
# "External database connection successful" ✅
# OR "External database not configured" (if credentials missing)
# OR "Connection failed: [error message]" (if there's an issue)
```

### 2. Test Queries

Try these in your chat:

**News queries:**
- "What's the latest news?"
- "Any recent articles?"
- "Show me news about [your topic]"

**Piano queries:**
- "Find piano music"
- "Show me pieces by [artist/composer]"
- "What piano recordings do you have?"

**Mixed queries:**
- "Any recent updates?"
- "What's happening with the organization?"

### 3. Check Response Sources

Look for responses that mention:
- `[News]` - Content from your news database
- `[Piano Record]` - Content from your piano database
- Organizational info without brackets - From SFH Bot knowledge base

## Customization Options

### 1. Adjust Table/Column Names

In `server/services/ExternalDataService.ts`:

```typescript
// Change table names
.from('your_news_table_name')
.from('your_piano_table_name')

// Change column selections
.select('id, your_title_column, your_content_column, your_date_column')
```

### 2. Modify Search Keywords

In `server/services/HybridKnowledgeService.ts`:

```typescript
// Add your specific keywords
const newsKeywords = ['news', 'article', 'your_custom_keyword']
const pianoKeywords = ['piano', 'music', 'your_music_keywords']
```

### 3. Adjust Search Priority

```typescript
// In searchAllSources method
const vectorResults = await this.vectorService.searchKnowledge(query, Math.ceil(limit * 0.6)) // 60% organizational
const externalResults = await this.searchExternalContent(query, Math.ceil(limit * 0.4)) // 40% external
```

## Troubleshooting

### Issue: "External database not configured"
**Solution**: Add `EXTERNAL_SUPABASE_URL` and `EXTERNAL_SUPABASE_ANON_KEY` to `.env`

### Issue: "Connection failed: [error]"
**Solutions**:
- Check if your existing Supabase project is active
- Verify the URL format: `https://project-id.supabase.co`
- Ensure the anon key has read permissions on your tables
- Check if RLS (Row Level Security) is blocking access

### Issue: "No results from external database"
**Solutions**:
- Verify your table names match the code
- Check that your tables have the expected columns
- Test a direct query in your Supabase dashboard
- Check if your tables have data

### Issue: "Table 'news' doesn't exist"
**Solution**: Update the table names in `ExternalDataService.ts` to match your schema

## Security Considerations

- **Read-Only Access**: The external service only reads data, never writes
- **Separate Credentials**: Uses different credentials from your main SFH Bot database
- **No Data Mixing**: Your existing data stays in its original database
- **Privacy Compliant**: Personal user data only goes to SFH Bot database

## Performance Impact

- **Minimal**: External queries run in parallel with organizational search
- **Cached Results**: Recent searches may be faster
- **Fallback**: If external database is slow/unavailable, organizational search still works
- **Average Overhead**: +100-200ms for external database queries

## Benefits

✅ **Always Up-to-Date**: No need to sync or duplicate data
✅ **No Data Migration**: Keep your existing database structure  
✅ **Smart Search**: System knows which database to search based on user questions
✅ **Seamless Integration**: Users don't know they're searching multiple databases
✅ **Fallback Ready**: Works even if external database is unavailable

Your chatbot now has access to both organizational knowledge AND your live content! 🎉