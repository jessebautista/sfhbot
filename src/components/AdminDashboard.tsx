import React, { useState, useEffect } from 'react'
import {
  HiCog,
  HiBeaker,
  HiChartBar,
  HiPlay,
  HiStop,
  HiExclamation,
  HiCheckCircle,
  HiInformationCircle,
  HiAdjustments,
  HiClipboardCheck,
  HiTrendingUp,
  HiLightBulb,
  HiSparkles,
  HiCubeTransparent,
  HiLightningBolt,
  HiChip,
  HiCloud,
  HiDatabase,
  HiEye,
  HiClock,
  HiStar,
  HiUsers,
  HiGlobeAlt,
  HiShieldCheck,
  HiCode,
  HiTemplate
} from 'react-icons/hi'
import SystemPromptsEditor from './SystemPromptsEditor'
import ModernSidebar from './admin/ModernSidebar'
import DashboardHeader from './admin/DashboardHeader'
import StatsCard from './admin/StatsCard'
import ConfigurationCard, { ConfigSection, ConfigRow, ConfigToggle, ConfigSelect, ConfigSlider } from './admin/ConfigurationCard'

interface PromptConfig {
  strategy: string
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

const AdminDashboard: React.FC = () => {
  const [config, setConfig] = useState<PromptConfig | null>(null)
  const [testQuery, setTestQuery] = useState('')
  const [testData, setTestData] = useState('')
  const [testResult, setTestResult] = useState<any>(null)
  const [metrics, setMetrics] = useState<any>(null)
  const [abTests, setAbTests] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<'dashboard' | 'prompts' | 'settings' | 'testing' | 'analytics'>('dashboard')

  useEffect(() => {
    // Initialize with mock data instead of API calls
    initializeMockData()
  }, [])

  const initializeMockData = () => {
    // Mock configuration data
    setConfig({
      strategy: 'data-first',
      debugMode: false,
      temperature: 0.7,
      maxTokens: 1000,
      model: 'gpt-4',
      features: {
        useSpecializedPrompts: true,
        enforceDataUsage: true,
        showDebugInfo: false,
        logPromptMetrics: true
      }
    })

    // Mock metrics data
    setMetrics({
      totalQueries: 24891,
      dataUtilizationRate: 87.3,
      avgResponseTime: 1200,
      userSatisfaction: 4.6,
      strategies: {
        'data-first': {
          totalQueries: 15234,
          dataUtilizationRate: 92.1,
          avgResponseTime: 1150,
          userSatisfaction: 4.8,
          isActive: true
        },
        'structured': {
          totalQueries: 5892,
          dataUtilizationRate: 78.5,
          avgResponseTime: 1300,
          userSatisfaction: 4.2,
          isActive: false
        },
        'few-shot': {
          totalQueries: 2341,
          dataUtilizationRate: 83.7,
          avgResponseTime: 980,
          userSatisfaction: 4.5,
          isActive: false
        },
        'chain-of-thought': {
          totalQueries: 1424,
          dataUtilizationRate: 88.9,
          avgResponseTime: 1450,
          userSatisfaction: 4.7,
          isActive: false
        }
      },
      queryTypes: {
        'piano_search': { count: 8234, successRate: 94.2 },
        'news_search': { count: 6341, successRate: 87.6 },
        'donation': { count: 4892, successRate: 96.1 },
        'volunteer': { count: 3124, successRate: 91.3 },
        'general': { count: 2300, successRate: 82.4 }
      },
      recommendations: [
        'Current data utilization rate is excellent at 87.3%',
        'Consider optimizing response time for general queries',
        'User satisfaction scores are above target across all categories'
      ]
    })

    // Mock A/B tests data
    setAbTests({
      currentActiveTest: null,
      tests: [
        {
          id: 'test-strategies',
          name: 'Strategy Comparison',
          description: 'Compare different prompt strategies for effectiveness',
          status: 'inactive'
        },
        {
          id: 'test-temperature',
          name: 'Temperature Optimization',
          description: 'Test different temperature settings for response quality',
          status: 'inactive'
        },
        {
          id: 'test-models',
          name: 'Model Performance',
          description: 'Compare GPT-4 vs GPT-3.5 performance metrics',
          status: 'inactive'
        }
      ]
    })
  }

  const updateConfig = async (updates: Partial<PromptConfig>) => {
    setLoading(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 500))
      
      // Update local state (in a real app, this would be an API call)
      setConfig(prevConfig => ({ ...prevConfig!, ...updates }))
      alert('Configuration updated successfully!')
    } catch (error) {
      console.error('Failed to update config:', error)
      alert('Failed to update configuration')
    } finally {
      setLoading(false)
    }
  }

  const testPrompt = async () => {
    if (!testQuery) {
      alert('Please enter a test query')
      return
    }
    
    setLoading(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500))
      
      // Mock test result
      const mockResult = {
        test: {
          strategy: config?.strategy || 'data-first',
          dataItemsProvided: testData ? testData.split('\n').filter(line => line.trim()).length : 0,
          fullPromptLength: testQuery.length + 250,
          hasDataEnforcement: config?.features.enforceDataUsage || true,
          analysis: {
            dataUtilizationLikely: true,
            promptComplexity: 'Medium',
            recommendedFor: 'General queries with specific data requirements'
          },
          systemPrompt: `System: You are an AI assistant for Sing for Hope.\n\nUser Query: ${testQuery}\n\nResponse: Based on the provided data, I can help you with information about our programs and services.`
        }
      }
      setTestResult(mockResult)
    } catch (error) {
      console.error('Failed to test prompt:', error)
      alert('Failed to test prompt')
    } finally {
      setLoading(false)
    }
  }

  const startAbTest = async (testId: string) => {
    setLoading(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update local state to show test as active
      setAbTests((prev: any) => ({
        ...prev,
        currentActiveTest: testId,
        tests: prev.tests.map((test: any) => ({
          ...test,
          status: test.id === testId ? 'active' : 'inactive'
        }))
      }))
      
      alert(`A/B Test started: ${testId}`)
    } catch (error) {
      console.error('Failed to start A/B test:', error)
      alert('Failed to start A/B test')
    } finally {
      setLoading(false)
    }
  }

  const stopAbTest = async () => {
    setLoading(true)
    try {
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000))
      
      // Update local state to stop all tests
      setAbTests((prev: any) => ({
        ...prev,
        currentActiveTest: null,
        tests: prev.tests.map((test: any) => ({
          ...test,
          status: 'inactive'
        }))
      }))
      
      alert('A/B Testing stopped')
    } catch (error) {
      console.error('Failed to stop A/B test:', error)
      alert('Failed to stop A/B test')
    } finally {
      setLoading(false)
    }
  }

  const getPageTitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Performance Dashboard'
      case 'prompts': return 'System Prompts'
      case 'settings': return 'Configuration'
      case 'testing': return 'A/B Testing'
      case 'analytics': return 'Advanced Analytics'
      default: return 'Dashboard'
    }
  }

  const getPageSubtitle = () => {
    switch (activeTab) {
      case 'dashboard': return 'Monitor your AI system performance and analytics'
      case 'prompts': return 'Manage and optimize your system prompts'
      case 'settings': return 'Configure your AI model parameters and behavior'
      case 'testing': return 'Run A/B tests to optimize performance'
      case 'analytics': return 'Deep insights and advanced metrics'
      default: return ''
    }
  }

  const getBreadcrumbs = () => {
    return [
      { label: 'Admin' },
      { label: getPageTitle() }
    ]
  }

  if (!config) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl shadow-lg p-8 w-96">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <HiCubeTransparent className="w-8 h-8 text-blue-600" />
            </div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Dashboard</h2>
            <p className="text-gray-600">Initializing your AI optimization suite...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className="hidden lg:block">
        <ModernSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
      
      {/* Main Content */}
      <div className="flex-1 lg:pl-72 min-w-0">
        {/* Header */}
        <DashboardHeader
          title={getPageTitle()}
          subtitle={getPageSubtitle()}
          breadcrumbs={getBreadcrumbs()}
        />
        
        {/* Content Area - Preline Style */}
        <main className="flex-1 relative z-0 overflow-y-auto focus:outline-none bg-gray-50">
          <div className="py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
              {/* Dashboard View */}
              {activeTab === 'dashboard' && (
                <div className="space-y-8">
                  {/* Quick Stats Overview */}
                  {metrics && (
                    <div>
                      <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900">Performance Overview</h2>
                        <p className="text-sm text-gray-600 mt-1">Key metrics and system performance indicators</p>
                      </div>
                      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        <StatsCard
                          title="Total Queries"
                          value={Object.values(metrics.strategies).reduce((acc: number, strategy: any) => acc + strategy.totalQueries, 0).toLocaleString()}
                          icon={HiUsers}
                          trend={{
                            value: "+8.2%",
                            type: "increase",
                            label: "from last week"
                          }}
                          color="blue"
                        />
                        <StatsCard
                          title="Data Utilization"
                          value={`${metrics.strategies[config.strategy]?.dataUtilizationRate?.toFixed(1) || '0.0'}%`}
                          icon={HiDatabase}
                          trend={{
                            value: "Above target",
                            type: "increase",
                            label: "85% threshold"
                          }}
                          color="green"
                        />
                        <StatsCard
                          title="Response Time"
                          value={`${metrics.strategies[config.strategy]?.avgResponseTime || '0'}ms`}
                          icon={HiClock}
                          trend={{
                            value: "-15ms",
                            type: "increase",
                            label: "improvement"
                          }}
                          color="purple"
                        />
                        <StatsCard
                          title="Satisfaction"
                          value={metrics.strategies[config.strategy]?.userSatisfaction?.toFixed(1) || '0.0'}
                          icon={HiStar}
                          trend={{
                            value: "4.8/5.0",
                            type: "increase",
                            label: "average rating"
                          }}
                          color="orange"
                        />
                      </div>
                    </div>
                  )}

              {/* Configuration Section */}
              <ConfigurationCard
                title="System Configuration"
                description="Fine-tune your AI model parameters and behavior"
                icon={HiCog}
              >
                <ConfigSection title="Model Configuration">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Strategy
                      </label>
                      <ConfigSelect
                        value={config.strategy}
                        onChange={(value) => updateConfig({ strategy: value as any })}
                        options={[
                          { value: 'data-first', label: 'Data-First Enforcement' },
                          { value: 'structured', label: 'Structured Decision Tree' },
                          { value: 'few-shot', label: 'Few-Shot Learning' },
                          { value: 'chain-of-thought', label: 'Chain of Thought' }
                        ]}
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">Current optimization approach</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        AI Model
                      </label>
                      <ConfigSelect
                        value={config.model}
                        onChange={(value) => updateConfig({ model: value })}
                        options={[
                          { value: 'gpt-4', label: 'GPT-4' },
                          { value: 'gpt-4-turbo-preview', label: 'GPT-4 Turbo' },
                          { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
                        ]}
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">Core AI engine selection</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Creativity (Temperature)
                      </label>
                      <ConfigSlider
                        value={config.temperature}
                        onChange={(value) => updateConfig({ temperature: value })}
                        min={0}
                        max={2}
                        step={0.1}
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">Controls response creativity</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Output Size (Tokens)
                      </label>
                      <ConfigSlider
                        value={config.maxTokens}
                        onChange={(value) => updateConfig({ maxTokens: Math.round(value) })}
                        min={50}
                        max={2000}
                        step={50}
                        disabled={loading}
                      />
                      <p className="text-xs text-gray-500 mt-1">Maximum response length</p>
                    </div>
                  </div>
                </ConfigSection>

                <ConfigSection title="Advanced Features">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <ConfigRow
                      label="Debug Mode"
                      description="Enable detailed system logging and diagnostics"
                    >
                      <ConfigToggle
                        checked={config.debugMode}
                        onChange={(checked) => updateConfig({ debugMode: checked })}
                        disabled={loading}
                      />
                    </ConfigRow>

                    <ConfigRow
                      label="Data Enforcement"
                      description="Require data utilization in all responses"
                    >
                      <ConfigToggle
                        checked={config.features.enforceDataUsage}
                        onChange={(checked) => updateConfig({ 
                          features: { ...config.features, enforceDataUsage: checked }
                        })}
                        disabled={loading}
                      />
                    </ConfigRow>

                    <ConfigRow
                      label="Debug Display"
                      description="Show debug information in interface"
                    >
                      <ConfigToggle
                        checked={config.features.showDebugInfo}
                        onChange={(checked) => updateConfig({ 
                          features: { ...config.features, showDebugInfo: checked }
                        })}
                        disabled={loading}
                      />
                    </ConfigRow>

                    <ConfigRow
                      label="Metrics Logging"
                      description="Record detailed performance analytics"
                    >
                      <ConfigToggle
                        checked={config.features.logPromptMetrics}
                        onChange={(checked) => updateConfig({ 
                          features: { ...config.features, logPromptMetrics: checked }
                        })}
                        disabled={loading}
                      />
                    </ConfigRow>
                  </div>
                </ConfigSection>
              </ConfigurationCard>

              {/* Prompt Testing Section */}
              <ConfigurationCard
                title="Prompt Strategy Testing"
                description="Test and optimize your AI responses in real-time"
                icon={HiBeaker}
              >
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Test Query
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Do you have any pianos in Texas?"
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm transition-colors"
                        value={testQuery}
                        onChange={(e) => setTestQuery(e.target.value)}
                      />
                      <p className="text-xs text-gray-600 mt-2">Enter your test question to evaluate AI response quality</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Sample Data
                      </label>
                      <textarea
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 h-32 font-mono text-sm shadow-sm transition-colors"
                        placeholder="[Piano Record] Austin Music Hall: Beautiful grand piano... (Artist: Maria Santos, Year: 2024, Program: 45, Location: Austin)"
                        value={testData}
                        onChange={(e) => setTestData(e.target.value)}
                      />
                      <p className="text-xs text-gray-600 mt-2">Add sample data entries (one per line) for context-aware testing</p>
                    </div>
                  </div>

                  <div className="flex flex-col justify-center">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6 text-center">
                      <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                        <HiLightningBolt className="h-8 w-8 text-blue-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">Ready to Test</h3>
                      <p className="text-gray-600 mb-4">
                        Current strategy: <span className="font-semibold">{config.strategy}</span>
                      </p>
                      <button
                        className={`w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 font-medium ${loading ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow-md'}`}
                        onClick={testPrompt}
                        disabled={loading || !testQuery}
                      >
                        {loading ? 'Testing Strategy...' : 'Run Test'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Test Results */}
                {testResult && (
                  <div className="mt-8 pt-6 border-t border-gray-100">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Test Results</h4>
                    <div className="bg-gray-50 rounded-xl p-6 border border-gray-200">
                      <pre className="text-sm text-gray-800 whitespace-pre-wrap overflow-x-auto">
                        {JSON.stringify(testResult, null, 2)}
                      </pre>
                    </div>
                  </div>
                )}
              </ConfigurationCard>
                </div>
              )}
              
              {activeTab === 'prompts' && (
                <SystemPromptsEditor />
              )}

              {activeTab === 'settings' && (
                <div className="space-y-8">
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-gray-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <HiCog className="h-10 w-10 text-gray-400" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Settings Panel</h3>
                    <p className="text-gray-600 max-w-md mx-auto">Advanced configuration options and system preferences coming soon.</p>
                  </div>
                </div>
              )}

              {activeTab === 'testing' && (
                <div className="space-y-8">
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <HiBeaker className="h-10 w-10 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">A/B Testing Suite</h3>
                    <p className="text-gray-600 max-w-md mx-auto">Compare different AI strategies and optimize performance with advanced testing features.</p>
                    <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 mt-4">
                      Beta Feature
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'analytics' && (
                <div className="space-y-8">
                  <div className="text-center py-16">
                    <div className="w-20 h-20 bg-purple-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                      <HiTrendingUp className="h-10 w-10 text-purple-600" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-900 mb-3">Advanced Analytics</h3>
                    <p className="text-gray-600 max-w-md mx-auto">Deep insights, detailed metrics, and comprehensive reporting for your AI system performance.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard