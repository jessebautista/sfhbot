import { Router, Request, Response } from 'express'
import { getPromptConfig } from '../config/promptConfig.js'

const router = Router()

// Get current prompt configuration
router.get('/config', (req: Request, res: Response) => {
  const config = getPromptConfig()
  res.json({
    success: true,
    config
  })
})

// Update prompt configuration (temporary, until server restart)
router.post('/config', (req: Request, res: Response) => {
  const { strategy, debugMode, temperature, maxTokens, model, features } = req.body
  
  // Update environment variables (temporary)
  if (strategy) process.env.PROMPT_STRATEGY = strategy
  if (debugMode !== undefined) process.env.PROMPT_DEBUG = String(debugMode)
  if (temperature !== undefined) process.env.PROMPT_TEMPERATURE = String(temperature)
  if (maxTokens !== undefined) process.env.PROMPT_MAX_TOKENS = String(maxTokens)
  if (model) process.env.PROMPT_MODEL = model
  
  if (features) {
    if (features.useSpecializedPrompts !== undefined) {
      process.env.USE_SPECIALIZED_PROMPTS = String(features.useSpecializedPrompts)
    }
    if (features.enforceDataUsage !== undefined) {
      process.env.ENFORCE_DATA_USAGE = String(features.enforceDataUsage)
    }
    if (features.showDebugInfo !== undefined) {
      process.env.SHOW_DEBUG_INFO = String(features.showDebugInfo)
    }
    if (features.logPromptMetrics !== undefined) {
      process.env.LOG_PROMPT_METRICS = String(features.logPromptMetrics)
    }
  }
  
  const updatedConfig = getPromptConfig()
  res.json({
    success: true,
    message: 'Configuration updated (temporary until restart)',
    config: updatedConfig
  })
})

// Test different prompt strategies with a sample query
router.post('/test-prompt', async (req: Request, res: Response) => {
  const { query, data, strategy } = req.body
  
  if (!query) {
    return res.status(400).json({
      success: false,
      error: 'Query is required'
    })
  }
  
  try {
    // Import prompt templates
    const { getPromptStrategy } = await import('../services/PromptTemplates')
    
    // Test the specified strategy
    const promptStrategy = getPromptStrategy(strategy || 'data-first')
    const systemPrompt = promptStrategy.buildSystemPrompt(
      [], // personalContext
      data || [], // organizationalKnowledge
      [] // userInsights
    )
    
    // Calculate prompt metrics
    const promptLength = systemPrompt.length
    const dataItemsProvided = (data || []).length
    const hasDataEnforcement = systemPrompt.includes('MUST') || systemPrompt.includes('CRITICAL') || systemPrompt.includes('FORBIDDEN')
    
    res.json({
      success: true,
      test: {
        query,
        strategy: promptStrategy.name,
        strategyDescription: promptStrategy.description,
        dataItemsProvided,
        promptLength,
        hasDataEnforcement,
        systemPrompt: systemPrompt.substring(0, 2000) + (systemPrompt.length > 2000 ? '...' : ''),
        fullPromptLength: systemPrompt.length,
        analysis: {
          dataUtilizationLikely: dataItemsProvided > 0 && hasDataEnforcement,
          promptComplexity: promptLength > 1000 ? 'High' : promptLength > 500 ? 'Medium' : 'Low',
          recommendedFor: getStrategyRecommendation(strategy || 'data-first', dataItemsProvided)
        }
      }
    })
  } catch (error) {
    console.error('Error testing prompt:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to test prompt strategy'
    })
  }
})

// Get prompt performance metrics
router.get('/metrics', (req: Request, res: Response) => {
  // In production, this would fetch from a database
  // For now, return mock data with realistic numbers
  const currentStrategy = process.env.PROMPT_STRATEGY || 'data-first'
  
  res.json({
    success: true,
    metrics: {
      summary: {
        totalRequests: 451,
        dataUtilizationRate: 89.2,
        avgResponseTime: 1234,
        currentStrategy
      },
      strategies: {
        'data-first': {
          totalQueries: 145,
          dataUtilizationRate: 89.7,
          avgResponseTime: 1234,
          userSatisfaction: 4.2,
          isActive: currentStrategy === 'data-first'
        },
        'structured': {
          totalQueries: 132,
          dataUtilizationRate: 91.2,
          avgResponseTime: 1156,
          userSatisfaction: 4.3,
          isActive: currentStrategy === 'structured'
        },
        'few-shot': {
          totalQueries: 98,
          dataUtilizationRate: 94.1,
          avgResponseTime: 1345,
          userSatisfaction: 4.5,
          isActive: currentStrategy === 'few-shot'
        },
        'chain-of-thought': {
          totalQueries: 76,
          dataUtilizationRate: 87.3,
          avgResponseTime: 1567,
          userSatisfaction: 4.1,
          isActive: currentStrategy === 'chain-of-thought'
        }
      },
      queryTypes: {
        'piano_location': { count: 234, successRate: 92.1 },
        'artist_query': { count: 156, successRate: 88.5 },
        'recent_news': { count: 189, successRate: 95.2 },
        'donation': { count: 87, successRate: 91.8 },
        'volunteer': { count: 134, successRate: 89.6 },
        'events': { count: 98, successRate: 93.4 },
        'general': { count: 372, successRate: 84.2 }
      },
      recommendations: generateRecommendations(currentStrategy)
    }
  })
})

// Add metrics logging endpoint for ChatService to use
router.post('/log-metric', (req: Request, res: Response) => {
  // In production, this would store in database
  // For now, just log to console if metrics are enabled
  if (process.env.LOG_PROMPT_METRICS === 'true') {
    console.log('📊 Prompt Metric:', {
      timestamp: new Date().toISOString(),
      ...req.body
    })
  }
  res.json({ success: true })
})

// A/B Testing endpoints
router.get('/ab-tests', (req: Request, res: Response) => {
  try {
    const availableTests = [
      {
        id: 'test-strategies',
        name: 'Prompt Strategy Comparison',
        description: 'Compare different prompt strategies (data-first, structured, few-shot, chain-of-thought)',
        status: process.env.AB_TEST_ACTIVE === 'test-strategies' ? 'active' : 'inactive'
      },
      {
        id: 'test-temperature',
        name: 'Temperature Optimization',
        description: 'Test different temperature settings (0.5, 0.7, 0.9)',
        status: process.env.AB_TEST_ACTIVE === 'test-temperature' ? 'active' : 'inactive'
      },
      {
        id: 'test-models',
        name: 'Model Performance',
        description: 'Compare GPT-4, GPT-4 Turbo, and GPT-3.5 Turbo',
        status: process.env.AB_TEST_ACTIVE === 'test-models' ? 'active' : 'inactive'
      }
    ]
    
    res.json({
      success: true,
      tests: availableTests,
      currentActiveTest: process.env.AB_TEST_ACTIVE || null
    })
  } catch (error) {
    console.error('Error getting A/B tests:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to get A/B tests'
    })
  }
})

router.post('/ab-tests/:testId/start', (req: Request, res: Response) => {
  try {
    const { testId } = req.params
    const validTests = ['test-strategies', 'test-temperature', 'test-models']
    
    if (!validTests.includes(testId)) {
      return res.status(400).json({
        success: false,
        error: `Invalid test ID. Valid tests: ${validTests.join(', ')}`
      })
    }
    
    // Enable the A/B test
    process.env.AB_TEST_ACTIVE = testId
    
    console.log(`🧪 A/B Test started: ${testId}`)
    
    res.json({
      success: true,
      message: `A/B test '${testId}' started successfully`,
      activeTest: testId
    })
  } catch (error) {
    console.error('Error starting A/B test:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to start A/B test'
    })
  }
})

router.post('/ab-tests/stop', (req: Request, res: Response) => {
  try {
    const previousTest = process.env.AB_TEST_ACTIVE
    delete process.env.AB_TEST_ACTIVE
    
    console.log(`🧪 A/B Test stopped: ${previousTest}`)
    
    res.json({
      success: true,
      message: 'A/B testing stopped successfully',
      previousTest
    })
  } catch (error) {
    console.error('Error stopping A/B test:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to stop A/B test'
    })
  }
})

// Utility functions
function getStrategyRecommendation(strategy: string, dataItems: number): string {
  if (dataItems === 0) {
    return 'Any strategy works for general queries without specific data'
  }
  
  switch (strategy) {
    case 'data-first':
      return 'Best for ensuring data utilization with strong enforcement'
    case 'structured':
      return 'Best for complex queries requiring systematic processing'
    case 'few-shot':
      return 'Best when you have good examples of desired responses'
    case 'chain-of-thought':
      return 'Best for debugging and understanding AI reasoning'
    default:
      return 'General purpose strategy'
  }
}

function generateRecommendations(currentStrategy: string): string[] {
  const recommendations: string[] = []
  
  // Mock recommendations based on current strategy
  switch (currentStrategy) {
    case 'data-first':
      recommendations.push('Current strategy shows good data utilization (89.7%)')
      recommendations.push('Consider testing few-shot strategy for better performance (94.1% utilization)')
      break
    case 'structured':
      recommendations.push('Structured approach is working well with 91.2% data utilization')
      recommendations.push('Response times are excellent at 1156ms average')
      break
    case 'few-shot':
      recommendations.push('Excellent data utilization rate of 94.1% - keep this strategy')
      recommendations.push('Monitor response time (1345ms) - consider optimization if needed')
      break
    case 'chain-of-thought':
      recommendations.push('Data utilization could be improved (87.3%)')
      recommendations.push('Consider switching to data-first or few-shot strategy')
      break
    default:
      recommendations.push('System is performing within normal parameters')
  }
  
  return recommendations
}

export default router