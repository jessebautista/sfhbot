import OpenAI from 'openai'
import { HybridKnowledgeService } from './HybridKnowledgeService'
import { Mem0PersonalMemory } from './Mem0PersonalMemory'
import { IntelligentExternalDataService } from './IntelligentExternalDataService'
import { getPromptStrategy } from './PromptTemplates'

export class IntelligentChatService {
  private openai: OpenAI
  private personalMemory: Mem0PersonalMemory
  private knowledgeService: HybridKnowledgeService
  private intelligentExternalData: IntelligentExternalDataService

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    this.personalMemory = new Mem0PersonalMemory()
    this.knowledgeService = new HybridKnowledgeService()
    this.intelligentExternalData = new IntelligentExternalDataService()
  }

  async processMessage(userId: string, message: string): Promise<string> {
    try {
      const startTime = Date.now()
      console.log(`🧠 Processing message with intelligent reasoning: "${message}"`)
      
      // Get personal context from Mem0 (user-specific memories)
      const personalContext = await this.personalMemory.getPersonalContext(userId, message)
      
      // Step 1: Use intelligent external data search first (this is our main data source)
      const intelligentSearchResult = await this.intelligentExternalData.intelligentSearch(message)
      console.log(`🎯 Intelligent search result:`, {
        dataUsed: intelligentSearchResult.dataUsed,
        resultsCount: intelligentSearchResult.results.length,
        reasoning: intelligentSearchResult.reasoning,
        executionSteps: intelligentSearchResult.executionLog.length
      })

      // Step 2: Fallback to organizational knowledge if external data is insufficient
      let organizationalKnowledge: string[] = []
      let knowledgeSource = 'intelligent_external'
      
      if (intelligentSearchResult.results.length === 0) {
        console.log('🔄 No external data found, falling back to organizational knowledge')
        const knowledgeResponse = await this.knowledgeService.searchAllSources(message)
        organizationalKnowledge = knowledgeResponse.results
        knowledgeSource = knowledgeResponse.source
      } else {
        // Convert intelligent results to the format expected by prompt templates
        organizationalKnowledge = this.convertIntelligentResultsToPromptFormat(intelligentSearchResult.results)
      }

      // Detect query type for specialized handling
      const queryType = this.detectQueryType(message)
      
      // Enhanced logging for the intelligent system
      console.log(`🔍 Knowledge search results:`, {
        source: knowledgeSource,
        query_type: queryType,
        results_count: organizationalKnowledge.length,
        intelligent_reasoning: intelligentSearchResult.reasoning,
        data_utilization: intelligentSearchResult.dataUsed,
        execution_log: intelligentSearchResult.executionLog
      })
      
      // Get user insights/preferences
      const userInsights = await this.personalMemory.getUserInsights(userId)

      // Check for active A/B test and override configuration
      let effectiveConfig = {
        strategy: process.env.PROMPT_STRATEGY || 'data-first',
        temperature: parseFloat(process.env.PROMPT_TEMPERATURE || '0.7'),
        model: process.env.PROMPT_MODEL || 'gpt-4',
        maxTokens: parseInt(process.env.PROMPT_MAX_TOKENS || '1000')
      }

      // Apply A/B test overrides if active
      const activeTest = process.env.AB_TEST_ACTIVE
      if (activeTest === 'test-strategies') {
        const strategies = ['data-first', 'structured', 'few-shot', 'chain-of-thought']
        effectiveConfig.strategy = strategies[Math.floor(Math.random() * strategies.length)]
      } else if (activeTest === 'test-temperature') {
        const temperatures = [0.5, 0.7, 0.9]
        effectiveConfig.temperature = temperatures[Math.floor(Math.random() * temperatures.length)]
      } else if (activeTest === 'test-models') {
        const models = ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo']
        effectiveConfig.model = models[Math.floor(Math.random() * models.length)]
      }

      // Use the optimized prompt system with effective configuration
      const promptStrategy = getPromptStrategy(effectiveConfig.strategy)
      const systemPrompt = promptStrategy.buildSystemPrompt(personalContext, organizationalKnowledge, userInsights)
      
      console.log(`📝 Using prompt strategy: ${promptStrategy.name}`)
      if (activeTest) {
        console.log(`🧪 A/B Test active: ${activeTest} - Config: ${JSON.stringify(effectiveConfig)}`)
      }
      if (organizationalKnowledge.length > 0) {
        console.log(`📊 Data provided to AI: ${organizationalKnowledge.length} items`)
        console.log(`🧠 Intelligent reasoning applied: ${intelligentSearchResult.reasoning}`)
      }

      // Enhanced prompt with intelligent search context
      let enhancedSystemPrompt = systemPrompt
      if (intelligentSearchResult.dataUsed && intelligentSearchResult.naturalResponse) {
        enhancedSystemPrompt += `\n\n🧠 INTELLIGENT SEARCH CONTEXT:\n${intelligentSearchResult.reasoning}\n\nPre-processed natural response suggestion: ${intelligentSearchResult.naturalResponse}\n\nUse this intelligent analysis to provide an even better, more comprehensive response.`
      }
      
      const completion = await this.openai.chat.completions.create({
        model: effectiveConfig.model,
        messages: [
          { role: 'system', content: enhancedSystemPrompt },
          { role: 'user', content: message }
        ],
        max_tokens: effectiveConfig.maxTokens,
        temperature: effectiveConfig.temperature
      })

      let reply = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.'

      // If we have a good intelligent search result and the AI response is generic, use the intelligent response
      if (intelligentSearchResult.dataUsed && 
          intelligentSearchResult.naturalResponse && 
          (reply.includes("I don't have") || reply.includes("I apologize") || reply.length < 100)) {
        console.log('🔄 Using intelligent pre-processed response due to generic AI reply')
        reply = intelligentSearchResult.naturalResponse
      }

      // Simple metrics logging
      const responseTime = Date.now() - startTime
      
      // Enhanced logging for intelligent system performance
      if (organizationalKnowledge.length > 0 && reply.includes("I don't have")) {
        console.warn('⚠️ Data was provided but response seems generic:', {
          query: message,
          dataCount: organizationalKnowledge.length,
          strategy: promptStrategy.name,
          intelligentSearch: intelligentSearchResult.dataUsed,
          reasoning: intelligentSearchResult.reasoning,
          responsePreview: reply.substring(0, 100)
        })
      } else if (intelligentSearchResult.dataUsed) {
        console.log('✅ Intelligent search successfully provided specific response')
      }
      
      console.log(`💬 Response time: ${responseTime}ms, Strategy: ${promptStrategy.name}, Intelligent: ${intelligentSearchResult.dataUsed}`)

      // Store the conversation in personal memory with enhanced metadata
      await this.personalMemory.storePersonalMemory(userId, message, reply, {
        timestamp: new Date().toISOString(),
        knowledge_used: organizationalKnowledge.length > 0,
        knowledge_source: knowledgeSource,
        prompt_strategy: promptStrategy.name,
        query_type: queryType,
        ab_test: activeTest || null,
        effective_config: effectiveConfig,
        intelligent_search: {
          used: intelligentSearchResult.dataUsed,
          reasoning: intelligentSearchResult.reasoning,
          results_count: intelligentSearchResult.results.length,
          execution_steps: intelligentSearchResult.executionLog.length
        }
      })

      return reply
    } catch (error) {
      console.error('IntelligentChatService error:', error)
      return 'I apologize, but I encountered an error processing your request. Please try again.'
    }
  }

  /**
   * Convert intelligent search results to the string format expected by prompt templates
   */
  private convertIntelligentResultsToPromptFormat(results: any[]): string[] {
    return results.map(result => {
      // Piano record
      if (result.piano_title) {
        return `[Piano Record] ${result.piano_title}: ${result.piano_statement || 'Piano information'} (Artist: ${result.artist_name || 'Unknown'}, Location: ${result.piano_location || 'Not specified'}, Program: ${result.piano_program || 'N/A'})`
      }
      
      // News record
      if (result.news_title) {
        return `[News Article] ${result.news_title}: ${result.news_excerpt || result.newscontent?.substring(0, 200) || 'News content'} (Categories: ${result.news_categories || 'General'})`
      }
      
      // Piano activation record
      if (result.act_title) {
        return `[Piano Activation] ${result.act_title}: ${result.act_content || 'Activation details'} (Location: ${result.act_location || 'Not specified'}, Artists: ${result.act_artists || 'Various'})`
      }
      
      // Fallback for unknown record types
      return JSON.stringify(result)
    })
  }

  private detectQueryType(message: string): string {
    const msg = message.toLowerCase()
    
    if (msg.includes('piano') || msg.includes('instrument')) return 'piano_query'
    if (msg.includes('news') || msg.includes('article') || msg.includes('recent')) return 'news_query'
    if (msg.includes('activation') || msg.includes('event') || msg.includes('performance')) return 'activation_query'
    if (msg.includes('donate') || msg.includes('donation') || msg.includes('support')) return 'donation_query'
    if (msg.includes('volunteer') || msg.includes('help') || msg.includes('participate')) return 'volunteer_query'
    
    return 'general_query'
  }

  /**
   * Get service status including intelligent components
   */
  getServiceStatus() {
    return {
      openai_available: !!this.openai,
      memory_service: this.personalMemory ? 'available' : 'unavailable',
      knowledge_service: this.knowledgeService ? 'available' : 'unavailable',
      intelligent_external: this.intelligentExternalData ? this.intelligentExternalData.getStatus() : null
    }
  }
}