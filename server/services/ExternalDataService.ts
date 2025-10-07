import { createClient, SupabaseClient } from '@supabase/supabase-js'

interface NewsContent {
  id: bigint
  news_title: string
  news_content?: any // JSON field
  newscontent?: string // Text content field
  news_excerpt?: string
  news_date: string
  news_author?: string
  news_categories?: string
  news_status?: string
  news_url?: string
  created_at: string
  featured?: boolean
  draft?: boolean
}

interface PianoActivation {
  id: bigint
  act_title: string
  act_location?: string
  act_content?: string
  act_launch_date?: string
  act_start_date?: string
  act_end_date?: string
  act_artists?: string
  act_leaders?: any // JSON field
  status?: string
  created_at: string
}

interface PianoRecord {
  id: bigint
  piano_title: string
  piano_statement?: string
  artist_name?: string
  piano_year?: string
  piano_program?: string
  piano_artist_bio?: string
  permanent_home_name?: string
  public_location_name?: string
  created_at: string
}

export interface SearchResult {
  type: 'news' | 'piano_activation' | 'piano'
  id: string
  title: string
  content: string
  relevance: number
  metadata: Record<string, any>
}

export class ExternalDataService {
  private externalSupabase: SupabaseClient | null = null
  private isConfigured = false

  constructor() {
    const externalUrl = process.env.EXTERNAL_SUPABASE_URL
    const externalKey = process.env.EXTERNAL_SUPABASE_ANON_KEY

    console.log('🔧 ExternalDataService constructor debug:', {
      url_exists: !!externalUrl,
      key_exists: !!externalKey,
      url_length: externalUrl?.length || 0,
      key_length: externalKey?.length || 0,
      url_preview: externalUrl ? `${externalUrl.substring(0, 20)}...` : 'none'
    })

    if (externalUrl && externalKey) {
      try {
        this.externalSupabase = createClient(externalUrl, externalKey)
        this.isConfigured = true
        console.log('✅ External database service configured successfully')
      } catch (error) {
        console.error('❌ Failed to create external Supabase client:', error)
        this.isConfigured = false
      }
    } else {
      console.log('❌ External database not configured - missing environment variables')
      console.log('   EXTERNAL_SUPABASE_URL:', !!externalUrl)
      console.log('   EXTERNAL_SUPABASE_ANON_KEY:', !!externalKey)
    }
  }

  isAvailable(): boolean {
    return this.isConfigured && this.externalSupabase !== null
  }

  async searchNews(query: string, limit: number = 3): Promise<SearchResult[]> {
    if (!this.externalSupabase) return []

    try {
      // Escape and clean the query for PostgreSQL ILIKE
      const cleanQuery = query.replace(/[%_]/g, '\\$&').replace(/'/g, "''")
      
      // Search in news content with actual column names
      const { data, error } = await this.externalSupabase
        .from('news')
        .select('id, news_title, news_content, newscontent, news_excerpt, news_date, news_author, news_categories, news_status, featured, draft')
        .eq('draft', false) // Only get published articles
        .or(`news_title.ilike.%${cleanQuery}%,newscontent.ilike.%${cleanQuery}%,news_excerpt.ilike.%${cleanQuery}%,news_categories.ilike.%${cleanQuery}%`)
        .order('news_date', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error searching news:', error)
        return []
      }

      return (data || []).map((item: NewsContent): SearchResult => ({
        type: 'news',
        id: item.id.toString(),
        title: item.news_title,
        content: item.news_excerpt || item.newscontent || this.extractTextFromJSON(item.news_content) || '',
        relevance: this.calculateRelevance(query, item.news_title, item.news_excerpt || item.newscontent || ''),
        metadata: {
          published_at: item.news_date,
          author: item.news_author,
          categories: item.news_categories,
          status: item.news_status,
          featured: item.featured,
          source: 'external_news'
        }
      }))
    } catch (error) {
      console.error('Error searching news:', error)
      return []
    }
  }

  async searchPianoRecords(query: string, limit: number = 2): Promise<SearchResult[]> {
    if (!this.externalSupabase) return []

    try {
      // Search both pianos table and piano_activations table
      const [pianosResults, activationsResults] = await Promise.all([
        this.searchPianos(query, Math.ceil(limit / 2)),
        this.searchPianoActivations(query, Math.floor(limit / 2))
      ])

      // Combine results and sort by relevance
      return [...pianosResults, ...activationsResults]
        .sort((a, b) => b.relevance - a.relevance)
        .slice(0, limit)
    } catch (error) {
      console.error('Error searching piano records:', error)
      return []
    }
  }

  private async searchPianos(query: string, limit: number): Promise<SearchResult[]> {
    const cleanQuery = query.replace(/[%_]/g, '\\$&').replace(/'/g, "''")
    
    const { data, error } = await this.externalSupabase!
      .from('pianos')
      .select('id, piano_title, piano_statement, artist_name, piano_year, piano_program, piano_artist_bio, permanent_home_name, public_location_name, created_at')
      .or(`piano_title.ilike.%${cleanQuery}%,artist_name.ilike.%${cleanQuery}%,piano_statement.ilike.%${cleanQuery}%,piano_program.ilike.%${cleanQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error searching pianos:', error)
      return []
    }

    return (data || []).map((item: PianoRecord): SearchResult => ({
      type: 'piano',
      id: item.id.toString(),
      title: item.piano_title || 'Piano',
      content: item.piano_statement || `Piano by ${item.artist_name || 'Unknown Artist'}${item.piano_year ? ` (${item.piano_year})` : ''}${item.permanent_home_name ? ` - Located at ${item.permanent_home_name}` : ''}`,
      relevance: this.calculateRelevance(query, item.piano_title || '', `${item.artist_name || ''} ${item.piano_statement || ''} ${item.piano_program || ''}`),
      metadata: {
        artist: item.artist_name,
        year: item.piano_year,
        program: item.piano_program,
        location: item.permanent_home_name || item.public_location_name,
        bio: item.piano_artist_bio,
        created_at: item.created_at,
        source: 'external_piano'
      }
    }))
  }

  private async searchPianoActivations(query: string, limit: number): Promise<SearchResult[]> {
    const cleanQuery = query.replace(/[%_]/g, '\\$&').replace(/'/g, "''")
    
    const { data, error } = await this.externalSupabase!
      .from('piano_activations')
      .select('id, act_title, act_location, act_content, act_launch_date, act_start_date, act_end_date, act_artists, act_leaders, status, created_at')
      .or(`act_title.ilike.%${cleanQuery}%,act_location.ilike.%${cleanQuery}%,act_content.ilike.%${cleanQuery}%,act_artists.ilike.%${cleanQuery}%`)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('Error searching piano activations:', error)
      return []
    }

    return (data || []).map((item: PianoActivation): SearchResult => ({
      type: 'piano_activation',
      id: item.id.toString(),
      title: item.act_title || 'Piano Activation',
      content: item.act_content || `Piano activation at ${item.act_location || 'various locations'}${item.act_start_date ? ` starting ${item.act_start_date}` : ''}${item.act_artists ? ` featuring ${item.act_artists}` : ''}`,
      relevance: this.calculateRelevance(query, item.act_title || '', `${item.act_location || ''} ${item.act_content || ''} ${item.act_artists || ''}`),
      metadata: {
        location: item.act_location,
        artists: item.act_artists,
        leaders: item.act_leaders,
        start_date: item.act_start_date,
        end_date: item.act_end_date,
        launch_date: item.act_launch_date,
        status: item.status,
        created_at: item.created_at,
        source: 'external_piano_activation'
      }
    }))
  }

  async searchBothSources(query: string, newsLimit: number = 2, pianoLimit: number = 2): Promise<SearchResult[]> {
    const [newsResults, pianoResults] = await Promise.all([
      this.searchNews(query, newsLimit),
      this.searchPianoRecords(query, pianoLimit)
    ])

    // Combine and sort by relevance
    const allResults = [...newsResults, ...pianoResults]
      .sort((a, b) => b.relevance - a.relevance)

    return allResults
  }

  async getRecentNews(limit: number = 5): Promise<SearchResult[]> {
    if (!this.externalSupabase) return []

    try {
      const { data, error } = await this.externalSupabase
        .from('news')
        .select('id, news_title, news_content, newscontent, news_excerpt, news_date, news_author, news_categories, news_status, featured, draft')
        .eq('draft', false) // Only published articles
        .order('news_date', { ascending: false })
        .limit(limit)

      if (error) {
        console.error('Error getting recent news:', error)
        return []
      }

      return (data || []).map((item: NewsContent): SearchResult => ({
        type: 'news',
        id: item.id.toString(),
        title: item.news_title,
        content: item.news_excerpt || item.newscontent || this.extractTextFromJSON(item.news_content) || '',
        relevance: 1.0, // Recent items get high relevance
        metadata: {
          published_at: item.news_date,
          author: item.news_author,
          categories: item.news_categories,
          featured: item.featured,
          source: 'external_news'
        }
      }))
    } catch (error) {
      console.error('Error getting recent news:', error)
      return []
    }
  }

  async getRecentPianoRecords(limit: number = 5): Promise<SearchResult[]> {
    if (!this.externalSupabase) return []

    try {
      // Get recent items from both piano tables
      const [recentPianos, recentActivations] = await Promise.all([
        this.getRecentPianos(Math.ceil(limit / 2)),
        this.getRecentPianoActivations(Math.floor(limit / 2))
      ])

      return [...recentPianos, ...recentActivations]
        .sort((a, b) => new Date(b.metadata.created_at).getTime() - new Date(a.metadata.created_at).getTime())
        .slice(0, limit)
    } catch (error) {
      console.error('Error getting recent piano records:', error)
      return []
    }
  }

  private async getRecentPianos(limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.externalSupabase!
      .from('pianos')
      .select('id, piano_title, piano_statement, artist_name, piano_year, piano_program, permanent_home_name, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []

    return (data || []).map((item: PianoRecord): SearchResult => ({
      type: 'piano',
      id: item.id.toString(),
      title: item.piano_title || 'Piano',
      content: item.piano_statement || `Piano by ${item.artist_name || 'Unknown Artist'}`,
      relevance: 1.0,
      metadata: {
        artist: item.artist_name,
        year: item.piano_year,
        program: item.piano_program,
        location: item.permanent_home_name,
        created_at: item.created_at,
        source: 'external_piano'
      }
    }))
  }

  private async getRecentPianoActivations(limit: number): Promise<SearchResult[]> {
    const { data, error } = await this.externalSupabase!
      .from('piano_activations')
      .select('id, act_title, act_location, act_content, act_start_date, act_artists, status, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) return []

    return (data || []).map((item: PianoActivation): SearchResult => ({
      type: 'piano_activation',
      id: item.id.toString(),
      title: item.act_title || 'Piano Activation',
      content: item.act_content || `Piano activation at ${item.act_location || 'various locations'}`,
      relevance: 1.0,
      metadata: {
        location: item.act_location,
        artists: item.act_artists,
        start_date: item.act_start_date,
        status: item.status,
        created_at: item.created_at,
        source: 'external_piano_activation'
      }
    }))
  }

  private extractTextFromJSON(jsonContent: any): string {
    if (!jsonContent) return ''
    
    try {
      // If it's already a string, return it
      if (typeof jsonContent === 'string') return jsonContent
      
      // If it's a JSON object, extract text content
      if (typeof jsonContent === 'object') {
        // Handle common JSON structures for content
        if (jsonContent.blocks) {
          // Draft.js style blocks
          return jsonContent.blocks
            .map((block: any) => block.text || '')
            .join(' ')
        }
        
        if (jsonContent.content) {
          // Nested content property
          return this.extractTextFromJSON(jsonContent.content)
        }
        
        if (Array.isArray(jsonContent)) {
          // Array of content blocks
          return jsonContent
            .map((item: any) => this.extractTextFromJSON(item))
            .join(' ')
        }
        
        // Generic object - join all string values
        return Object.values(jsonContent)
          .filter(val => typeof val === 'string')
          .join(' ')
      }
      
      return String(jsonContent)
    } catch (error) {
      console.error('Error extracting text from JSON:', error)
      return ''
    }
  }

  private calculateRelevance(query: string, title: string, content: string): number {
    const queryLower = query.toLowerCase()
    const titleLower = title.toLowerCase()
    const contentLower = content.toLowerCase()
    
    let relevance = 0
    
    // Title matches are more relevant
    if (titleLower.includes(queryLower)) relevance += 0.8
    if (contentLower.includes(queryLower)) relevance += 0.4
    
    // Word matches
    const queryWords = queryLower.split(/\s+/)
    queryWords.forEach(word => {
      if (word.length > 2) {
        if (titleLower.includes(word)) relevance += 0.3
        if (contentLower.includes(word)) relevance += 0.1
      }
    })
    
    return Math.min(relevance, 1.0)
  }

  // Method to test connection and verify data
  async testConnection(): Promise<{ success: boolean; message: string }> {
    if (!this.externalSupabase) {
      return { success: false, message: 'External database not configured' }
    }

    try {
      // Check all three tables for data
      const [newsCheck, pianosCheck, activationsCheck] = await Promise.all([
        this.externalSupabase.from('news').select('*', { count: 'exact', head: true }),
        this.externalSupabase.from('pianos').select('*', { count: 'exact', head: true }),
        this.externalSupabase.from('piano_activations').select('*', { count: 'exact', head: true })
      ])

      const tableStats = {
        news: newsCheck.count || 0,
        pianos: pianosCheck.count || 0,
        piano_activations: activationsCheck.count || 0
      }

      console.log('📊 External database table statistics:', tableStats)

      // Get a sample record from each table if exists
      if (tableStats.news > 0) {
        const { data: newsData } = await this.externalSupabase
          .from('news')
          .select('news_title, draft, created_at')
          .limit(1)
        console.log('📰 Sample news record:', newsData?.[0])
      }

      if (tableStats.pianos > 0) {
        const { data: pianoData } = await this.externalSupabase
          .from('pianos')
          .select('piano_title, artist_name, created_at')
          .limit(1)
        console.log('🎹 Sample piano record:', pianoData?.[0])
      }

      const totalRecords = Object.values(tableStats).reduce((sum, count) => sum + count, 0)
      
      return { 
        success: true, 
        message: `External database connection successful. Total records: ${totalRecords} (${JSON.stringify(tableStats)})` 
      }
    } catch (error) {
      return { 
        success: false, 
        message: `Connection error: ${error instanceof Error ? error.message : 'Unknown error'}` 
      }
    }
  }
}