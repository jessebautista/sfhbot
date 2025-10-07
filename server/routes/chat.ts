import { Router } from 'express'
import { z } from 'zod'
import { ChatService } from '../services/ChatService.js'
import { SupabaseService } from '../services/SupabaseService.js'
import { SmartQueryService } from '../services/SmartQueryService.js'

const router = Router()

const chatRequestSchema = z.object({
  userId: z.string().min(1),
  message: z.string().min(1)
})

let chatService: ChatService
let supabaseService: SupabaseService
let smartQueryService: SmartQueryService
let isInitialized = false

const getChatService = async () => {
  if (!chatService) {
    chatService = new ChatService()
    if (!isInitialized) {
      await chatService.initializeServices()
      isInitialized = true
    }
  }
  return chatService
}

const getSupabaseService = () => {
  if (!supabaseService) {
    supabaseService = new SupabaseService()
  }
  return supabaseService
}

const getSmartQueryService = () => {
  if (!smartQueryService) {
    smartQueryService = new SmartQueryService()
  }
  return smartQueryService
}

router.post('/chat', async (req, res) => {
  const startTime = Date.now()
  let userId: string = ''
  let message: string = ''
  let reply: string = ''
  let _errorOccurred = false
  let errorMessage = ''

  try {
    console.log('Chat request received:', { body: req.body })
    
    // Check if OpenAI API key is available
    if (!process.env.OPENAI_API_KEY) {
      console.error('OpenAI API key not configured')
      return res.json({ 
        reply: 'Hello! I\'m currently being configured. Please check back in a few minutes while the administrator sets up the necessary API keys.' 
      })
    }
    
    const parsed = chatRequestSchema.parse(req.body)
    userId = parsed.userId
    message = parsed.message
    
    console.log('Processing chat message:', { userId, message })

    reply = await (await getChatService()).processMessage(userId, message)
    
    console.log('Chat response generated:', { reply })

    const responseTime = Date.now() - startTime

    // Update user session
    await getSupabaseService().updateUserSession(userId)

    // Store detailed chat log
    await getSupabaseService().storeChatLog({
      user_id: userId,
      session_id: req.headers['x-session-id'] as string,
      message,
      reply,
      response_time_ms: responseTime,
      model_used: 'gpt-4',
      mem0_memories_used: true, // Will be updated based on actual usage
      timestamp: new Date(),
      ip_address: req.ip,
      user_agent: req.headers['user-agent'],
      error_occurred: false
    })

    res.json({
      reply,
      success: true,
      response_time_ms: responseTime
    })
  } catch (error) {
    _errorOccurred = true
    errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    console.error('Chat endpoint error:', error)
    
    const responseTime = Date.now() - startTime

    // Store error log if we have user info
    if (userId && message) {
      await getSupabaseService().storeChatLog({
        user_id: userId,
        session_id: req.headers['x-session-id'] as string,
        message,
        reply: 'Error occurred during processing',
        response_time_ms: responseTime,
        timestamp: new Date(),
        ip_address: req.ip,
        user_agent: req.headers['user-agent'],
        error_occurred: true,
        error_message: errorMessage
      })
    }
    
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request format',
        details: error.errors
      })
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error'
    })
  }
})

// Schema diagnostics endpoint
router.get('/diagnostics/schema', async (req, res) => {
  try {
    const smartQuery = getSmartQueryService()
    const diagnostics = await smartQuery.getDiagnostics()
    
    res.json({
      success: true,
      diagnostics
    })
  } catch (error) {
    console.error('Schema diagnostics error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get schema diagnostics'
    })
  }
})

// Force schema refresh endpoint
router.post('/diagnostics/schema/refresh', async (req, res) => {
  try {
    const smartQuery = getSmartQueryService()
    const result = await smartQuery.refreshSchema()
    
    res.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Schema refresh error:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to refresh schema'
    })
  }
})

// Test smart query endpoint
router.post('/diagnostics/test-query', async (req, res) => {
  try {
    const { query } = req.body
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Query parameter is required'
      })
    }

    const smartQuery = getSmartQueryService()
    const result = await smartQuery.smartSearch(query)
    
    res.json({
      success: true,
      result
    })
  } catch (error) {
    console.error('Test query error:', error)
    res.status(500).json({
      success: false,
      error: 'Test query failed'
    })
  }
})

export { router as chatRouter }