import { OpenAI } from 'openai'

interface DatabaseSchema {
  pianos: {
    piano_title: string
    artist_name: string
    piano_statement: string
    piano_program: string
    piano_location: string
  }
  news: {
    news_title: string
    newscontent: string
    news_excerpt: string
    news_categories: string
  }
  piano_activations: {
    act_title: string
    act_location: string
    act_content: string
    act_artists: string
  }
}

interface QueryIntent {
  type: 'piano_search' | 'news_search' | 'activation_search' | 'general' | 'mixed'
  confidence: number
  entities: {
    location?: string[]
    artist?: string[]
    keywords?: string[]
    timeframe?: string
    category?: string
  }
  reasoning: string
}

interface SQLQuery {
  table: keyof DatabaseSchema
  query: string
  parameters: any[]
  reasoning: string
  expectedResultType: string
}

interface ProcessedResults {
  rawResults: any[]
  naturalLanguageResponse: string
  dataUsed: boolean
  summary: string
}

export class IntelligentQueryReasoner {
  private openai: OpenAI
  private databaseSchema: DatabaseSchema

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    
    // Define our database schema for AI reasoning
    this.databaseSchema = {
      pianos: {
        piano_title: 'Title/name of the piano',
        artist_name: 'Artist associated with the piano',
        piano_statement: 'Description or statement about the piano',
        piano_program: 'Program number or identifier',
        piano_location: 'Geographic location of the piano'
      },
      news: {
        news_title: 'News article title',
        newscontent: 'Full news content',
        news_excerpt: 'Brief excerpt or summary',
        news_categories: 'Categories/tags for the article'
      },
      piano_activations: {
        act_title: 'Activation event title',
        act_location: 'Location where activation occurred',
        act_content: 'Content/description of the activation',
        act_artists: 'Artists involved in the activation'
      }
    }
  }

  /**
   * Main reasoning function that processes a user query through multiple steps
   */
  async processQuery(userQuery: string): Promise<{
    intent: QueryIntent
    sqlQueries: SQLQuery[]
    executionPlan: string
  }> {
    console.log(`🧠 Starting intelligent query reasoning for: "${userQuery}"`)

    // Step 1: Analyze user intent with chain-of-thought reasoning
    const intent = await this.analyzeIntent(userQuery)
    
    // Step 2: Generate SQL queries based on intent
    const sqlQueries = await this.generateSQLQueries(userQuery, intent)
    
    // Step 3: Create execution plan
    const executionPlan = await this.createExecutionPlan(intent, sqlQueries)

    return {
      intent,
      sqlQueries,
      executionPlan
    }
  }

  /**
   * Step 1: Analyze user intent using chain-of-thought reasoning
   */
  private async analyzeIntent(userQuery: string): Promise<QueryIntent> {
    const systemPrompt = `You are an expert query analyzer for a music/arts database. Your job is to understand user intent through step-by-step reasoning.

Database contains:
- PIANOS: Information about pianos, their locations, artists, and descriptions
- NEWS: News articles about music/arts events and activities  
- PIANO_ACTIVATIONS: Events where pianos were activated/played

Think step by step:
1. What is the user asking about?
2. Which database tables are relevant?
3. What specific information do they want?
4. What search terms/filters should be used?

Respond with JSON only:
{
  "type": "piano_search|news_search|activation_search|general|mixed",
  "confidence": 0.0-1.0,
  "entities": {
    "location": ["extracted locations"],
    "artist": ["extracted artists"],
    "keywords": ["key terms"],
    "timeframe": "time references",
    "category": "topic category"
  },
  "reasoning": "step-by-step analysis of the query"
}`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `Analyze this query: "${userQuery}"` }
        ],
        temperature: 0.3,
        max_tokens: 500
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No response from OpenAI')
      }

      const intent = JSON.parse(response) as QueryIntent
      console.log(`🎯 Intent analyzed: ${intent.type} (${Math.round(intent.confidence * 100)}% confidence)`)
      console.log(`📝 Reasoning: ${intent.reasoning}`)
      
      return intent
    } catch (error) {
      console.error('Error analyzing intent:', error)
      // Fallback to simple keyword-based analysis
      return this.fallbackIntentAnalysis(userQuery)
    }
  }

  /**
   * Step 2: Generate targeted SQL queries based on analyzed intent
   */
  private async generateSQLQueries(userQuery: string, intent: QueryIntent): Promise<SQLQuery[]> {
    const systemPrompt = `You are an expert SQL generator. Create efficient, targeted queries based on user intent.

Database Schema:
${JSON.stringify(this.databaseSchema, null, 2)}

Rules:
1. Use ILIKE for case-insensitive text searches with % wildcards
2. Combine multiple conditions with AND/OR as appropriate
3. Limit results to avoid overwhelming responses (LIMIT 10-20)
4. Use specific column searches rather than generic ones
5. Generate multiple queries if the intent spans multiple tables

Respond with JSON array of queries:
[{
  "table": "pianos|news|piano_activations",
  "query": "SELECT * FROM table WHERE conditions ORDER BY relevance LIMIT N",
  "parameters": [],
  "reasoning": "why this query addresses the user's needs",
  "expectedResultType": "description of expected results"
}]`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Generate SQL queries for:
User Query: "${userQuery}"
Intent: ${JSON.stringify(intent, null, 2)}` 
          }
        ],
        temperature: 0.2,
        max_tokens: 800
      })

      const response = completion.choices[0]?.message?.content
      if (!response) {
        throw new Error('No SQL generation response')
      }

      const queries = JSON.parse(response) as SQLQuery[]
      console.log(`🗄️ Generated ${queries.length} SQL queries:`)
      queries.forEach((q, i) => {
        console.log(`  ${i + 1}. ${q.table}: ${q.reasoning}`)
      })
      
      return queries
    } catch (error) {
      console.error('Error generating SQL queries:', error)
      // Fallback to basic queries
      return this.fallbackQueryGeneration(userQuery, intent)
    }
  }

  /**
   * Step 3: Create execution plan for the queries
   */
  private async createExecutionPlan(intent: QueryIntent, sqlQueries: SQLQuery[]): Promise<string> {
    const plan = `
🔍 QUERY EXECUTION PLAN
Intent: ${intent.type} (${Math.round(intent.confidence * 100)}% confidence)

Strategy:
${intent.reasoning}

Queries to Execute:
${sqlQueries.map((q, i) => `${i + 1}. ${q.table}: ${q.expectedResultType}`).join('\n')}

Expected Outcome: Comprehensive response using specific database content
    `.trim()

    console.log(plan)
    return plan
  }

  /**
   * Process raw database results into natural language response
   */
  async processResults(rawResults: any[], userQuery: string, intent: QueryIntent): Promise<ProcessedResults> {
    if (rawResults.length === 0) {
      return {
        rawResults: [],
        naturalLanguageResponse: this.generateNoResultsResponse(userQuery, intent),
        dataUsed: false,
        summary: 'No matching records found in database'
      }
    }

    const systemPrompt = `You are an expert at converting database results into natural, helpful responses.

Your job:
1. Analyze the database results
2. Create a comprehensive, natural language response
3. Use specific details from the data
4. Be conversational and helpful
5. Don't just list data - synthesize it meaningfully

CRITICAL: Use specific details from the provided data. Don't be generic.

Database results contain real information about pianos, news, and events. Use names, locations, dates, and specific details to create a rich response.`

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `User asked: "${userQuery}"

Database results:
${JSON.stringify(rawResults.slice(0, 10), null, 2)}

Create a natural, specific response using this data.`
          }
        ],
        temperature: 0.4,
        max_tokens: 600
      })

      const response = completion.choices[0]?.message?.content || 'I found some information but had trouble formatting it.'
      
      return {
        rawResults,
        naturalLanguageResponse: response,
        dataUsed: true,
        summary: `Found ${rawResults.length} relevant records and generated natural language response`
      }
    } catch (error) {
      console.error('Error processing results:', error)
      return {
        rawResults,
        naturalLanguageResponse: this.fallbackResultProcessing(rawResults, userQuery),
        dataUsed: true,
        summary: 'Used fallback result processing due to AI processing error'
      }
    }
  }

  // Fallback methods for when AI calls fail
  private fallbackIntentAnalysis(userQuery: string): QueryIntent {
    const query = userQuery.toLowerCase()
    
    if (query.includes('piano') || query.includes('instrument')) {
      return {
        type: 'piano_search',
        confidence: 0.7,
        entities: { keywords: ['piano'] },
        reasoning: 'Keyword-based fallback detected piano-related query'
      }
    } else if (query.includes('news') || query.includes('article')) {
      return {
        type: 'news_search',
        confidence: 0.7,
        entities: { keywords: ['news'] },
        reasoning: 'Keyword-based fallback detected news-related query'
      }
    } else {
      return {
        type: 'general',
        confidence: 0.5,
        entities: { keywords: [userQuery] },
        reasoning: 'Fallback general query analysis'
      }
    }
  }

  private fallbackQueryGeneration(userQuery: string, intent: QueryIntent): SQLQuery[] {
    const queries: SQLQuery[] = []
    
    if (intent.type === 'piano_search' || intent.type === 'mixed') {
      queries.push({
        table: 'pianos',
        query: `SELECT * FROM pianos WHERE piano_title ILIKE $1 OR artist_name ILIKE $1 OR piano_statement ILIKE $1 LIMIT 10`,
        parameters: [`%${userQuery}%`],
        reasoning: 'Fallback piano search using basic text matching',
        expectedResultType: 'Piano records matching query terms'
      })
    }
    
    if (intent.type === 'news_search' || intent.type === 'mixed') {
      queries.push({
        table: 'news',
        query: `SELECT * FROM news WHERE news_title ILIKE $1 OR newscontent ILIKE $1 OR news_excerpt ILIKE $1 LIMIT 10`,
        parameters: [`%${userQuery}%`],
        reasoning: 'Fallback news search using basic text matching',
        expectedResultType: 'News articles matching query terms'
      })
    }
    
    return queries
  }

  private generateNoResultsResponse(userQuery: string, intent: QueryIntent): string {
    return `I searched our database for information related to "${userQuery}" but didn't find any specific records. Our database contains information about pianos, music news, and piano activations. Could you try rephrasing your question or being more specific about what you're looking for?`
  }

  private fallbackResultProcessing(rawResults: any[], userQuery: string): string {
    if (rawResults.length === 0) {
      return `I didn't find any specific information about "${userQuery}" in our database.`
    }
    
    const firstResult = rawResults[0]
    const keys = Object.keys(firstResult)
    const title = firstResult[keys.find(k => k.includes('title')) || keys[0]] || 'Unknown'
    
    return `I found ${rawResults.length} result${rawResults.length > 1 ? 's' : ''} related to "${userQuery}". One example is: ${title}${rawResults.length > 1 ? ` and ${rawResults.length - 1} more.` : '.'}`
  }
}