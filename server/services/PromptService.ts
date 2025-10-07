import fs from 'fs/promises'
import path from 'path'

interface ModelSettings {
  model: string
  temperature: number
  max_tokens: number
}

interface PromptTemplate {
  name: string
  description: string
  template: string
  variables: string[]
  model_settings: ModelSettings
}

interface SystemPrompts {
  intelligent_query_analysis: PromptTemplate
  search_term_extraction: {
    name: string
    description: string
    config: Record<string, string[]>
  }
  database_schema_info: {
    name: string
    description: string
    tables: Record<string, {
      searchable_columns: string[]
      display_columns: string[]
      sort_preference: string
    }>
  }
  query_strategies: {
    name: string
    description: string
    strategies: Record<string, {
      description: string
      priority: number
      fallback: string | null
    }>
  }
  response_formatting: {
    name: string
    description: string
    templates: Record<string, string>
  }
  debugging: {
    name: string
    description: string
    settings: Record<string, boolean>
  }
}

export class PromptService {
  private static instance: PromptService
  private prompts: SystemPrompts | null = null
  private lastLoaded: Date | null = null
  private readonly CACHE_TTL_MINUTES = 5 // Reload prompts every 5 minutes
  private readonly PROMPTS_FILE = path.join(process.cwd(), 'config', 'system-prompts.json')

  private constructor() {}

  static getInstance(): PromptService {
    if (!PromptService.instance) {
      PromptService.instance = new PromptService()
    }
    return PromptService.instance
  }

  /**
   * Load prompts from file, with caching
   */
  async loadPrompts(): Promise<SystemPrompts> {
    const now = new Date()
    
    // Check if we need to reload
    if (this.prompts && this.lastLoaded) {
      const minutesSinceLoad = (now.getTime() - this.lastLoaded.getTime()) / (1000 * 60)
      if (minutesSinceLoad < this.CACHE_TTL_MINUTES) {
        return this.prompts
      }
    }

    try {
      const data = await fs.readFile(this.PROMPTS_FILE, 'utf-8')
      this.prompts = JSON.parse(data)
      this.lastLoaded = now
      console.log('✅ System prompts loaded successfully')
      return this.prompts!
    } catch (error) {
      console.error('❌ Error loading system prompts:', error)
      
      // Return default prompts if file doesn't exist
      const defaultPrompts = this.getDefaultPrompts()
      this.prompts = defaultPrompts
      this.lastLoaded = now
      
      // Try to create the file with defaults
      try {
        await this.ensureConfigDirectory()
        await fs.writeFile(this.PROMPTS_FILE, JSON.stringify(defaultPrompts, null, 2))
        console.log('✅ Created default system prompts file')
      } catch (writeError) {
        console.error('❌ Error creating default prompts file:', writeError)
      }
      
      return defaultPrompts
    }
  }

  /**
   * Get a formatted prompt for AI analysis
   */
  async getQueryAnalysisPrompt(userQuery: string): Promise<{
    prompt: string
    modelSettings: ModelSettings
  }> {
    const prompts = await this.loadPrompts()
    const template = prompts.intelligent_query_analysis.template
    const modelSettings = prompts.intelligent_query_analysis.model_settings

    const prompt = template.replace('{userQuery}', userQuery)

    return { prompt, modelSettings }
  }

  /**
   * Get search keywords for a specific category
   */
  async getSearchKeywords(category: string): Promise<string[]> {
    const prompts = await this.loadPrompts()
    return prompts.search_term_extraction.config[`${category}_keywords`] || []
  }

  /**
   * Get database schema information
   */
  async getDatabaseSchema(): Promise<SystemPrompts['database_schema_info']['tables']> {
    const prompts = await this.loadPrompts()
    return prompts.database_schema_info.tables
  }

  /**
   * Get query strategies
   */
  async getQueryStrategies(): Promise<SystemPrompts['query_strategies']['strategies']> {
    const prompts = await this.loadPrompts()
    return prompts.query_strategies.strategies
  }

  /**
   * Get response templates
   */
  async getResponseTemplates(): Promise<SystemPrompts['response_formatting']['templates']> {
    const prompts = await this.loadPrompts()
    return prompts.response_formatting.templates
  }

  /**
   * Get debugging settings
   */
  async getDebuggingSettings(): Promise<SystemPrompts['debugging']['settings']> {
    const prompts = await this.loadPrompts()
    return prompts.debugging.settings
  }

  /**
   * Force reload prompts (useful when they're updated via admin interface)
   */
  async reloadPrompts(): Promise<SystemPrompts> {
    this.prompts = null
    this.lastLoaded = null
    return await this.loadPrompts()
  }

  /**
   * Ensure config directory exists
   */
  private async ensureConfigDirectory(): Promise<void> {
    const configDir = path.dirname(this.PROMPTS_FILE)
    try {
      await fs.access(configDir)
    } catch {
      await fs.mkdir(configDir, { recursive: true })
    }
  }

  /**
   * Get default prompts if file doesn't exist
   */
  private getDefaultPrompts(): SystemPrompts {
    return {
      intelligent_query_analysis: {
        name: "Intelligent Query Analysis",
        description: "Main prompt for analyzing user queries and determining search strategy",
        template: `Analyze this user query for a music/piano database search:
"{userQuery}"

Database contains:
- pianos: piano_title, artist_name, piano_statement
- news: news_title, newscontent, news_excerpt, news_categories  
- piano_activations: act_title, act_location, act_content, act_artists

Respond with JSON only:
{
  "type": "piano_search|news_search|activation_search|location_search|artist_search|general",
  "reasoning": "brief explanation",
  "searchTerms": ["key", "search", "terms"],
  "tables": ["primary", "secondary"]
}`,
        variables: ["userQuery"],
        model_settings: {
          model: "gpt-4",
          temperature: 0.1,
          max_tokens: 300
        }
      },
      search_term_extraction: {
        name: "Search Term Extraction",
        description: "Instructions for extracting clean search terms from user queries",
        config: {
          piano_keywords: ["piano", "instrument", "music", "keyboard"],
          news_keywords: ["black radio", "experience", "glasper", "robert glasper", "radio", "news", "article"],
          activation_keywords: ["event", "activation", "performance", "show", "concert"],
          artist_keywords: ["artist", "musician", "composer", "performer"],
          location_keywords: ["location", "place", "venue", "address", "city"],
          time_keywords: ["newest", "latest", "recent", "new", "old", "vintage"]
        }
      },
      database_schema_info: {
        name: "Database Schema Information",
        description: "Current database structure and column mappings",
        tables: {
          pianos: {
            searchable_columns: ["piano_title", "artist_name", "piano_statement"],
            display_columns: ["piano_title", "artist_name", "piano_statement", "created_at"],
            sort_preference: "created_at"
          },
          news: {
            searchable_columns: ["news_title", "newscontent", "news_excerpt", "news_categories"],
            display_columns: ["news_title", "news_excerpt", "newscontent", "created_at"],
            sort_preference: "created_at"
          },
          piano_activations: {
            searchable_columns: ["act_title", "act_content", "act_artists", "act_location"],
            display_columns: ["act_title", "act_content", "act_artists", "act_location", "created_at"],
            sort_preference: "created_at"
          }
        }
      },
      query_strategies: {
        name: "Query Strategies",
        description: "Different strategies for finding relevant data",
        strategies: {
          exact_match: {
            description: "Look for exact matches in key fields",
            priority: 1,
            fallback: "fuzzy_search"
          },
          fuzzy_search: {
            description: "Use partial matching with ILIKE queries",
            priority: 2,
            fallback: "broad_search"
          },
          broad_search: {
            description: "Get recent records when specific searches fail",
            priority: 3,
            fallback: "organizational_knowledge"
          },
          organizational_knowledge: {
            description: "Fall back to vector knowledge base",
            priority: 4,
            fallback: null
          }
        }
      },
      response_formatting: {
        name: "Response Formatting",
        description: "How to format AI responses with found data",
        templates: {
          piano_found: "Based on our piano collection, here's what I found: {data}",
          news_found: "From our news archives: {data}",
          activation_found: "Here are the relevant events and activations: {data}",
          multiple_types: "I found information across several categories: {data}",
          no_data: "I couldn't find specific information about that in our database, but here's what I can tell you about our organization: {fallback_data}"
        }
      },
      debugging: {
        name: "Debugging Settings",
        description: "Control logging and debugging output",
        settings: {
          log_extracted_terms: true,
          log_query_analysis: true,
          log_database_results: true,
          log_ai_reasoning: true,
          verbose_errors: true
        }
      }
    }
  }
}