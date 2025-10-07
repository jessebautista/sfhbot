// Prompt Configuration for A/B Testing and Debugging
// This file manages prompt strategy selection and debugging options

export interface PromptConfig {
  strategy: 'data-first' | 'decision-tree' | 'few-shot' | 'chain-of-thought'
  debugMode: boolean
  temperature: number
  maxTokens: number
  model: string
  features: {
    useSpecializedPrompts: boolean
    enforceDataUsage: boolean
    showDebugInfo: boolean
    logPromptMetrics: boolean
  }
}

// Default configuration
export const defaultConfig: PromptConfig = {
  strategy: 'data-first',
  debugMode: false,
  temperature: 0.7,
  maxTokens: 500,
  model: 'gpt-4',
  features: {
    useSpecializedPrompts: true,
    enforceDataUsage: true,
    showDebugInfo: false,
    logPromptMetrics: true
  }
}

// Get configuration from environment or use defaults
export function getPromptConfig(): PromptConfig {
  return {
    strategy: (process.env.PROMPT_STRATEGY as PromptConfig['strategy']) || defaultConfig.strategy,
    debugMode: process.env.PROMPT_DEBUG === 'true',
    temperature: parseFloat(process.env.PROMPT_TEMPERATURE || String(defaultConfig.temperature)),
    maxTokens: parseInt(process.env.PROMPT_MAX_TOKENS || String(defaultConfig.maxTokens)),
    model: process.env.PROMPT_MODEL || defaultConfig.model,
    features: {
      useSpecializedPrompts: process.env.USE_SPECIALIZED_PROMPTS !== 'false',
      enforceDataUsage: process.env.ENFORCE_DATA_USAGE !== 'false',
      showDebugInfo: process.env.SHOW_DEBUG_INFO === 'true',
      logPromptMetrics: process.env.LOG_PROMPT_METRICS !== 'false'
    }
  }
}

// A/B Testing configurations
export const abTestConfigs: Record<string, Partial<PromptConfig>> = {
  // Test 1: Compare prompt strategies
  'test-strategies': {
    // Randomly assign one of the strategies
    strategy: ['data-first', 'decision-tree', 'few-shot', 'chain-of-thought'][
      Math.floor(Math.random() * 4)
    ] as PromptConfig['strategy']
  },
  
  // Test 2: Temperature variations
  'test-temperature': {
    temperature: [0.5, 0.7, 0.9][Math.floor(Math.random() * 3)]
  },
  
  // Test 3: Model comparison
  'test-models': {
    model: ['gpt-4', 'gpt-4-turbo-preview', 'gpt-3.5-turbo'][
      Math.floor(Math.random() * 3)
    ]
  },
  
  // Test 4: Debug mode impact
  'test-debug': {
    debugMode: Math.random() > 0.5,
    features: {
      ...defaultConfig.features,
      showDebugInfo: Math.random() > 0.5
    }
  }
}

// Get A/B test configuration if enabled
export function getABTestConfig(testName?: string): Partial<PromptConfig> | null {
  if (!testName || !abTestConfigs[testName]) {
    return null
  }
  return abTestConfigs[testName]
}

// Metrics tracking for A/B testing
export interface PromptMetrics {
  strategy: string
  queryType: string
  dataProvided: boolean
  dataUsedInResponse: boolean
  responseTime: number
  tokenCount: number
  userSatisfaction?: number
  timestamp: Date
}

// Store metrics (in production, this would go to a database)
export function logPromptMetrics(metrics: PromptMetrics): void {
  if (getPromptConfig().features.logPromptMetrics) {
    console.log('Prompt Metrics:', {
      ...metrics,
      timestamp: metrics.timestamp.toISOString()
    })
    
    // In production, send to analytics service:
    // analyticsService.track('prompt_metrics', metrics)
  }
}

// Helper to determine if response used provided data
export function analyzeDataUsage(response: string, data: string[]): boolean {
  if (data.length === 0) return false
  
  // Check if response contains specific details from the data
  const dataKeywords = data.join(' ').toLowerCase()
  const responseLower = response.toLowerCase()
  
  // Look for specific indicators that data was used
  const indicators = [
    // Names and titles from data
    ...extractNames(data),
    // Years from data
    ...extractYears(data),
    // Locations from data
    ...extractLocations(data),
    // Program numbers
    ...extractProgramNumbers(data)
  ]
  
  return indicators.some(indicator => 
    responseLower.includes(indicator.toLowerCase())
  )
}

// Extract specific details from data for verification
function extractNames(data: string[]): string[] {
  const names: string[] = []
  const namePattern = /(?:Artist|Composer|by):\s*([^,\)]+)/gi
  
  data.forEach(item => {
    let match
    while ((match = namePattern.exec(item)) !== null) {
      names.push(match[1].trim())
    }
  })
  
  return names
}

function extractYears(data: string[]): string[] {
  const years: string[] = []
  const yearPattern = /\b(19|20)\d{2}\b/g
  
  data.forEach(item => {
    const matches = item.match(yearPattern)
    if (matches) {
      years.push(...matches)
    }
  })
  
  return [...new Set(years)]
}

function extractLocations(data: string[]): string[] {
  const locations: string[] = []
  const locationPattern = /Location:\s*([^,\)]+)/gi
  
  data.forEach(item => {
    let match
    while ((match = locationPattern.exec(item)) !== null) {
      locations.push(match[1].trim())
    }
  })
  
  return locations
}

function extractProgramNumbers(data: string[]): string[] {
  const programs: string[] = []
  const programPattern = /Program:\s*(\d+)/gi
  
  data.forEach(item => {
    let match
    while ((match = programPattern.exec(item)) !== null) {
      programs.push(match[1])
    }
  })
  
  return programs
}

export default {
  getPromptConfig,
  getABTestConfig,
  logPromptMetrics,
  analyzeDataUsage
}