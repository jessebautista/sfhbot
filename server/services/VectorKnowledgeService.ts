import { createClient, SupabaseClient } from '@supabase/supabase-js'
import OpenAI from 'openai'

interface KnowledgeDocument {
  id: string
  content: string
  category: string
  title: string
  metadata?: Record<string, any>
  embedding?: number[]
}

export class VectorKnowledgeService {
  private supabase: SupabaseClient | null = null
  private openai: OpenAI | null = null
  private fallbackKnowledge: KnowledgeDocument[] = []

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (supabaseUrl && supabaseKey) {
      this.supabase = createClient(supabaseUrl, supabaseKey)
      
      if (process.env.OPENAI_API_KEY) {
        this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
      }
    } else {
      console.warn('Supabase not configured, using fallback knowledge base')
      this.initializeFallbackKnowledge()
    }
  }

  private initializeFallbackKnowledge(): void {
    this.fallbackKnowledge = [
      {
        id: '1',
        content: 'Our non-profit organization accepts donations through our website, by check, or in person. All donations are tax-deductible and go directly to supporting our community programs. We provide receipts for all donations above $25.',
        category: 'donations',
        title: 'How to Donate'
      },
      {
        id: '2', 
        content: 'We host monthly community events including food drives, educational workshops, volunteer appreciation gatherings, and fundraising events. Check our events calendar on our website for upcoming activities.',
        category: 'events',
        title: 'Community Events'
      },
      {
        id: '3',
        content: 'Volunteers are always welcome! We have opportunities for various skill levels including community outreach, event planning, administrative support, and direct service. Training is provided for all volunteer positions.',
        category: 'volunteering',
        title: 'Volunteer Opportunities'
      },
      {
        id: '4',
        content: 'Our organization is committed to transparency. We publish annual reports showing how donations are used, with detailed breakdowns of program expenses, administrative costs, and fundraising expenses.',
        category: 'transparency',
        title: 'Financial Transparency'
      },
      {
        id: '5',
        content: 'We offer various programs including youth mentorship, senior citizen support, food assistance, educational scholarships, and community health initiatives. Each program has specific eligibility requirements.',
        category: 'programs',
        title: 'Our Programs'
      }
    ]
  }

  async searchKnowledge(query: string, limit: number = 3): Promise<string[]> {
    try {
      if (this.supabase && this.openai) {
        return await this.searchWithVector(query, limit)
      } else {
        return this.searchFallback(query, limit)
      }
    } catch (error) {
      console.error('Error searching knowledge:', error)
      return this.searchFallback(query, limit)
    }
  }

  private async searchWithVector(query: string, limit: number): Promise<string[]> {
    // Generate embedding for the query
    const embedding = await this.generateEmbedding(query)
    
    // Search for similar documents using vector similarity
    const { data, error } = await this.supabase!
      .rpc('search_knowledge_documents', {
        query_embedding: embedding,
        match_threshold: 0.7,
        match_count: limit
      })

    if (error) {
      console.error('Vector search error:', error)
      return this.searchFallback(query, limit)
    }

    return data?.map((doc: any) => doc.content) || []
  }

  private searchFallback(query: string, limit: number): string[] {
    const queryLower = query.toLowerCase()
    
    const relevantDocs = this.fallbackKnowledge
      .filter(doc => {
        const content = doc.content.toLowerCase()
        const title = doc.title.toLowerCase()
        const category = doc.category.toLowerCase()
        
        return content.includes(queryLower) || 
               title.includes(queryLower) ||
               category.includes(queryLower) ||
               this.hasKeywordMatch(queryLower, content)
      })
      .slice(0, limit)
      .map(doc => doc.content)

    return relevantDocs
  }

  private hasKeywordMatch(query: string, content: string): boolean {
    const queryWords = query.split(/\s+/).filter(word => word.length > 3)
    const contentWords = content.split(/\s+/)
    
    return queryWords.some(queryWord => 
      contentWords.some(contentWord => 
        contentWord.toLowerCase().includes(queryWord)
      )
    )
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    if (!this.openai) throw new Error('OpenAI not configured')

    const response = await this.openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text
    })

    return response.data[0].embedding
  }

  async addKnowledgeDocument(doc: Omit<KnowledgeDocument, 'id' | 'embedding'>): Promise<void> {
    try {
      if (this.supabase && this.openai) {
        await this.addDocumentWithVector(doc)
      } else {
        this.fallbackKnowledge.push({
          ...doc,
          id: Date.now().toString()
        })
      }
    } catch (error) {
      console.error('Error adding knowledge document:', error)
    }
  }

  private async addDocumentWithVector(doc: Omit<KnowledgeDocument, 'id' | 'embedding'>): Promise<void> {
    const embedding = await this.generateEmbedding(doc.content)
    
    const { error } = await this.supabase!
      .from('knowledge_documents')
      .insert({
        content: doc.content,
        category: doc.category,
        title: doc.title,
        metadata: doc.metadata,
        embedding: embedding
      })

    if (error) {
      console.error('Error inserting knowledge document:', error)
      throw error
    }
  }

  async initializeKnowledgeBase(): Promise<void> {
    console.log('Initializing knowledge base with organizational information...')
    
    const documents = [
      {
        title: 'About Our Organization',
        category: 'general',
        content: 'We are a community-focused non-profit organization dedicated to making a positive impact in our local area. We focus on education, community support, and social services.',
        metadata: { priority: 'high', type: 'about' }
      },
      {
        title: 'Donation Process',
        category: 'donations',
        content: 'Donations can be made online through our secure website, by phone during business hours, or by mailing a check to our office. We accept one-time and recurring donations. All donations are tax-deductible and you will receive a receipt.',
        metadata: { priority: 'high', type: 'process' }
      },
      {
        title: 'Volunteer Registration',
        category: 'volunteering',
        content: 'To become a volunteer, complete our online application form, attend an orientation session, and complete any required training. We offer flexible scheduling and various volunteer opportunities to match your interests and skills.',
        metadata: { priority: 'high', type: 'process' }
      },
      {
        title: 'Upcoming Events',
        category: 'events',
        content: 'We regularly host community events including monthly food drives, quarterly fundraising galas, educational workshops, and volunteer appreciation events. Visit our events calendar for specific dates and registration information.',
        metadata: { priority: 'medium', type: 'information' }
      },
      {
        title: 'Contact Information',
        category: 'contact',
        content: 'You can reach us by phone during business hours Monday-Friday 9am-5pm, by email, or visit our office downtown. We respond to all inquiries within 24 hours during business days.',
        metadata: { priority: 'high', type: 'contact' }
      }
    ]

    for (const doc of documents) {
      await this.addKnowledgeDocument(doc)
    }

    console.log('Knowledge base initialization complete.')
  }
}