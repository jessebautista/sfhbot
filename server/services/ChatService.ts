import OpenAI from 'openai'
import { HybridKnowledgeService } from './HybridKnowledgeService.js'
import { Mem0PersonalMemory } from './Mem0PersonalMemory.js'
import { SmartQueryService } from './SmartQueryService.js'
import { FAQKnowledgeService } from './FAQKnowledgeService.js'
import { getPromptStrategy } from './PromptTemplates.js'
import { conversationSession } from './ConversationSession.js'

export class ChatService {
  private openai: OpenAI
  private personalMemory: Mem0PersonalMemory
  private knowledgeService: HybridKnowledgeService
  private smartQuery: SmartQueryService
  private faqService: FAQKnowledgeService

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    })
    this.personalMemory = new Mem0PersonalMemory()
    this.knowledgeService = new HybridKnowledgeService()
    this.smartQuery = new SmartQueryService()
    this.faqService = new FAQKnowledgeService()
  }

  async processMessage(userId: string, message: string): Promise<string> {
    try {
      const startTime = Date.now()
      
      console.log(`🧠 Processing with intelligent reasoning: "${message}"`)
      
      // Add user message to conversation session
      conversationSession.addMessage(userId, 'user', message)
      
      // Get simple conversation history from current session
      const conversationHistory = conversationSession.getConversationHistory(userId)
      
      // For logged-out users, skip personal memory - just use session conversation
      const personalContext: string[] = []
      
      // Step 1: Check for vague queries that need clarification
      const clarifyingResponse = this.checkForVagueQuery(message)
      if (clarifyingResponse) {
        console.log(`❓ Detected vague query, providing clarifying questions`)
        conversationSession.addMessage(userId, 'assistant', clarifyingResponse)
        return clarifyingResponse
      }

      // Step 2: Check FAQ for foundational/static information
      const faqResults = this.faqService.searchFAQ(message)
      console.log(`📚 FAQ search: Found ${faqResults.length} relevant items`)
      
      // Step 2: Use smart query system for external database (current/dynamic data)
      const smartResult = await this.smartQuery.smartSearch(message)
      console.log(`🎯 Smart query result: ${smartResult.dataUsed ? 'SUCCESS' : 'NO DATA'} - ${smartResult.reasoning}`)
      
      // Step 3: Combine FAQ and external data or fallback to organizational knowledge
      let organizationalKnowledge: string[] = []
      let knowledgeSource = 'hybrid'
      
      // Priority: FAQ + External Data > FAQ only > External Data only > Organizational Knowledge
      if (faqResults.length > 0 && smartResult.dataUsed) {
        // Best case: Both FAQ and current data available
        organizationalKnowledge = [
          this.faqService.formatFAQForResponse(faqResults),
          smartResult.naturalResponse
        ]
        knowledgeSource = 'faq_and_external'
        console.log('✅ Using both FAQ and external data')
      } else if (faqResults.length > 0) {
        // FAQ found but no current data
        organizationalKnowledge = [this.faqService.formatFAQForResponse(faqResults)]
        knowledgeSource = 'faq_only'
        console.log('📖 Using FAQ knowledge only')
      } else if (smartResult.dataUsed) {
        // External data found but no FAQ
        organizationalKnowledge = [smartResult.naturalResponse]
        knowledgeSource = 'external_only'
        console.log('🔍 Using external data only')
      } else {
        // Fallback to organizational knowledge base
        console.log('🔄 No FAQ or external data found, using organizational knowledge')
        const knowledgeResponse = await this.knowledgeService.searchAllSources(message)
        organizationalKnowledge = knowledgeResponse.results
        knowledgeSource = knowledgeResponse.source
      }
      
      // Detect query type for specialized handling
      const queryType = smartResult.queryType || this.detectQueryType(message)
      
      // Enhanced logging
      console.log(`🔍 Knowledge search results:`, {
        source: knowledgeSource,
        query_type: queryType,
        results_count: organizationalKnowledge.length,
        faq_results: faqResults.length,
        smart_reasoning: smartResult.reasoning,
        data_used: smartResult.dataUsed,
        conversation_history_length: conversationHistory.length
      })
      
      // For logged-out users, no user insights needed
      const userInsights: string[] = []

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
      }
      
      // Build conversation messages including history for context
      const historyMessages = conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      }))

      const messages = [
        { role: 'system' as const, content: systemPrompt },
        ...historyMessages,
        { role: 'user' as const, content: message }
      ]

      // Limit total context to avoid token limits (keep most recent if needed)
      const maxMessages = 15 // System + history + current
      const finalMessages = messages.length > maxMessages 
        ? [messages[0], ...messages.slice(-(maxMessages - 1))]
        : messages

      console.log(`💬 Conversation context: ${conversationHistory.length} previous exchanges`)

      const completion = await this.openai.chat.completions.create({
        model: effectiveConfig.model,
        messages: finalMessages,
        max_tokens: effectiveConfig.maxTokens,
        temperature: effectiveConfig.temperature
      })

      let reply = completion.choices[0]?.message?.content || 'I apologize, but I encountered an error processing your request.'

      // If smart query found data but AI response is generic, use smart response directly
      if (smartResult.dataUsed && 
          smartResult.naturalResponse && 
          (reply.includes("I don't have") || reply.includes("I apologize") || reply.length < 100)) {
        console.log('🎯 Using smart query response due to generic AI output')
        reply = smartResult.naturalResponse
      }

      // Simple metrics logging
      const responseTime = Date.now() - startTime
      
      // Enhanced logging for smart query performance
      if (organizationalKnowledge.length > 0 && reply.includes("I don't have")) {
        console.warn('⚠️ Data was provided but response seems generic:', {
          query: message,
          dataCount: organizationalKnowledge.length,
          strategy: promptStrategy.name,
          smartQuery: smartResult.dataUsed,
          smartReasoning: smartResult.reasoning,
          responsePreview: reply.substring(0, 100)
        })
      }
      
      console.log(`💬 Response time: ${responseTime}ms, Strategy: ${promptStrategy.name}`)

      // Add assistant reply to conversation session
      conversationSession.addMessage(userId, 'assistant', reply)

      // For logged-out users, skip storing in Mem0 - session is sufficient

      return reply
    } catch (error) {
      console.error('ChatService error:', error)
      return 'I apologize, but I encountered an error. Please try again later.'
    }
  }

  private detectQueryType(message: string): string {
    const lowerMessage = message.toLowerCase()
    
    if (lowerMessage.includes('piano') && (lowerMessage.includes('where') || lowerMessage.includes('location') || 
        lowerMessage.includes(' in ') || lowerMessage.includes(' at '))) {
      return 'piano_location'
    }
    if (lowerMessage.includes('artist') || lowerMessage.includes('who created') || lowerMessage.includes('who made')) {
      return 'artist_query'
    }
    if (lowerMessage.includes('news') || lowerMessage.includes('latest') || lowerMessage.includes('recent') || 
        lowerMessage.includes('new') || lowerMessage.includes('update')) {
      return 'recent_news'
    }
    if (lowerMessage.includes('donate') || lowerMessage.includes('donation') || lowerMessage.includes('contribute')) {
      return 'donation'
    }
    if (lowerMessage.includes('volunteer') || lowerMessage.includes('help out') || lowerMessage.includes('get involved')) {
      return 'volunteer'
    }
    if (lowerMessage.includes('event') || lowerMessage.includes('happening') || lowerMessage.includes('schedule')) {
      return 'events'
    }
    
    return 'general'
  }


  async initializeServices(): Promise<void> {
    try {
      console.log('Initializing Chat Service...')
      
      // Initialize the hybrid knowledge service (organizational + external)
      await this.knowledgeService.initializeServices()
      
      // Show service status
      const serviceStatus = this.knowledgeService.getServiceStatus()
      console.log('Knowledge services status:', serviceStatus)
      console.log(`Memory service available: ${this.personalMemory.isMemoryServiceAvailable()}`)
      
      if (!this.personalMemory.isMemoryServiceAvailable()) {
        console.log(`Fallback memories stored: ${this.personalMemory.getFallbackMemoryCount()}`)
      }
      
      console.log('Chat Service initialization complete.')
    } catch (error) {
      console.error('Error initializing Chat Service:', error)
    }
  }

  async clearUserData(userId: string): Promise<void> {
    try {
      conversationSession.clearUserSession(userId)
      console.log(`Cleared conversation session for user: ${userId}`)
    } catch (error) {
      console.error(`Error clearing data for user ${userId}:`, error)
    }
  }

  private checkForVagueQuery(message: string): string | null {
    const lowerMessage = message.toLowerCase().trim()
    
    // Common vague patterns that need clarification
    const vaguePatterns = [
      {
        patterns: [/^who('s| is)? the director\??$/i, /^director\??$/i],
        response: "I'd be happy to help you find director information! Could you be more specific? For example:\n\n• **Executive Director** - Our organizational leadership\n• **IT Director** - Technology and systems\n• **Program Director** - Specific program leadership\n• **Development Director** - Fundraising and partnerships\n\nWhich type of director are you looking for?"
      },
      {
        patterns: [/^who('s| is)? in charge\??$/i, /^who runs (this|the organization)\??$/i],
        response: "I can help you learn about our leadership! Are you interested in:\n\n• **Executive Leadership** - Our founders and executive directors\n• **Department Leadership** - Specific department heads\n• **Program Leadership** - Leaders of specific programs\n• **Board Leadership** - Board of directors\n\nWhat level of leadership information would be most helpful?"
      },
      {
        patterns: [/^contact$/i, /^how do i contact\??$/i, /^contact info$/i],
        response: "I'd love to help you get in touch! What type of contact are you looking for?\n\n• **General Information** - Main office contact\n• **Donations** - Development team\n• **Volunteering** - Volunteer coordination\n• **Programs** - Specific program inquiries\n• **Media** - Press and media relations\n\nWhich would be most helpful for your needs?"
      },
      {
        patterns: [/^help$/i, /^what can you do\??$/i, /^info$/i],
        response: "I'm here to help with information about Sing for Hope! I can assist with:\n\n• **About Us** - Mission, founders, and organizational info\n• **Programs** - Details about our initiatives and services\n• **Get Involved** - Volunteering and donation opportunities\n• **Events** - Upcoming activities and how to participate\n• **Contact** - How to reach the right person for your needs\n\nWhat would you like to know more about?"
      }
    ]

    for (const vague of vaguePatterns) {
      if (vague.patterns.some(pattern => pattern.test(lowerMessage))) {
        return vague.response
      }
    }

    return null
  }
}