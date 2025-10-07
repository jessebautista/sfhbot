import { useState, useEffect } from 'react'
import { 
  HiSave, 
  HiRefresh, 
  HiBeaker, 
  HiExclamation,
  HiCheckCircle,
  HiCode,
  HiSearch
} from 'react-icons/hi'

interface SystemPrompts {
  intelligent_query_analysis: {
    name: string
    description: string
    template: string
    variables: string[]
    model_settings: {
      model: string
      temperature: number
      max_tokens: number
    }
  }
  search_term_extraction: {
    name: string
    description: string
    config: Record<string, string[]>
  }
  debugging: {
    name: string
    description: string
    settings: Record<string, boolean>
  }
}

export default function SystemPromptsEditor() {
  const [prompts, setPrompts] = useState<SystemPrompts | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testing, setTesting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testResult, setTestResult] = useState<any>(null)

  useEffect(() => {
    fetchPrompts()
  }, [])

  const fetchPrompts = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/system-prompts')
      const data = await response.json()
      
      if (data.success) {
        setPrompts(data.prompts)
        setMessage({ type: 'success', text: 'Prompts loaded successfully' })
      } else {
        setMessage({ type: 'error', text: 'Failed to load prompts' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading prompts' })
    } finally {
      setLoading(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const saveSection = async (section: string, data: any) => {
    try {
      setSaving(true)
      const response = await fetch(`/api/system-prompts/${section}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      })
      
      const result = await response.json()
      
      if (result.success) {
        setMessage({ type: 'success', text: `${section} updated successfully` })
        fetchPrompts()
      } else {
        setMessage({ type: 'error', text: `Failed to update ${section}` })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving changes' })
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 3000)
    }
  }

  const testPrompt = async (section: string) => {
    try {
      setTesting(true)
      const response = await fetch(`/api/system-prompts/test/${section}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ testInput })
      })
      
      const result = await response.json()
      setTestResult(result)
    } catch (error) {
      setMessage({ type: 'error', text: 'Error testing prompt' })
    } finally {
      setTesting(false)
    }
  }

  const updatePromptTemplate = (template: string) => {
    if (prompts) {
      setPrompts({
        ...prompts,
        intelligent_query_analysis: {
          ...prompts.intelligent_query_analysis,
          template
        }
      })
    }
  }

  const updateModelSettings = (field: string, value: any) => {
    if (prompts) {
      setPrompts({
        ...prompts,
        intelligent_query_analysis: {
          ...prompts.intelligent_query_analysis,
          model_settings: {
            ...prompts.intelligent_query_analysis.model_settings,
            [field]: value
          }
        }
      })
    }
  }

  const updateKeywords = (category: string, keywords: string[]) => {
    if (prompts) {
      setPrompts({
        ...prompts,
        search_term_extraction: {
          ...prompts.search_term_extraction,
          config: {
            ...prompts.search_term_extraction.config,
            [`${category}_keywords`]: keywords
          }
        }
      })
    }
  }

  const updateDebuggingSetting = (setting: string, value: boolean) => {
    if (prompts) {
      setPrompts({
        ...prompts,
        debugging: {
          ...prompts.debugging,
          settings: {
            ...prompts.debugging.settings,
            [setting]: value
          }
        }
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mr-3"></div>
        <span className="text-gray-600">Loading system prompts...</span>
      </div>
    )
  }

  if (!prompts) {
    return (
      <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 flex items-center gap-3">
        <HiExclamation className="h-5 w-5 text-red-500" />
        <span>Failed to load system prompts. Please try refreshing the page.</span>
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-6 space-y-6" data-theme="corporate">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">System Prompts Configuration</h2>
          <p className="text-base-content/70">
            Configure how the AI system analyzes queries and finds data
          </p>
        </div>
        <div className="flex gap-2">
          <button
            className={`btn btn-ghost ${loading ? 'loading' : ''}`}
            onClick={fetchPrompts}
            disabled={loading}
          >
            {!loading && <HiRefresh className="h-4 w-4 mr-2" />}
            Refresh
          </button>
        </div>
      </div>

      {message && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message.type === 'error' ? 
            <HiExclamation className="h-6 w-6" /> : 
            <HiCheckCircle className="h-6 w-6" />
          }
          <span>{message.text}</span>
        </div>
      )}

      <div className="space-y-8">
        {/* Query Analysis Section */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <div className="flex items-center gap-3 mb-4">
              <HiCode className="h-6 w-6 text-primary" />
              <div>
                <h3 className="card-title text-xl">{prompts.intelligent_query_analysis.name}</h3>
                <p className="text-base-content/70">{prompts.intelligent_query_analysis.description}</p>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="form-control">
                <label className="label">
                  <span className="label-text font-semibold">Prompt Template</span>
                </label>
                <textarea
                  className="textarea textarea-bordered h-32 font-mono text-sm"
                  value={prompts.intelligent_query_analysis.template}
                  onChange={(e) => updatePromptTemplate(e.target.value)}
                  placeholder="Enter prompt template..."
                ></textarea>
                <label className="label">
                  <span className="label-text-alt">
                    Use {"{userQuery}"} as a placeholder for the user's query
                  </span>
                </label>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Model</span>
                  </label>
                  <input
                    type="text"
                    className="input input-bordered"
                    value={prompts.intelligent_query_analysis.model_settings.model}
                    onChange={(e) => updateModelSettings('model', e.target.value)}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Temperature</span>
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="2"
                    className="input input-bordered"
                    value={prompts.intelligent_query_analysis.model_settings.temperature}
                    onChange={(e) => updateModelSettings('temperature', parseFloat(e.target.value))}
                  />
                </div>
                <div className="form-control">
                  <label className="label">
                    <span className="label-text">Max Tokens</span>
                  </label>
                  <input
                    type="number"
                    className="input input-bordered"
                    value={prompts.intelligent_query_analysis.model_settings.max_tokens}
                    onChange={(e) => updateModelSettings('max_tokens', parseInt(e.target.value))}
                  />
                </div>
              </div>

              <div className="divider"></div>
              <div className="form-control">
                <label className="label">
                  <span className="label-text">Test Input</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter a test query..."
                  className="input input-bordered mb-4"
                  value={testInput}
                  onChange={(e) => setTestInput(e.target.value)}
                />
                <div className="flex gap-2">
                  <button
                    className={`btn btn-primary ${testing ? 'loading' : ''}`}
                    onClick={() => testPrompt('intelligent_query_analysis')}
                    disabled={testing || !testInput}
                  >
                    {!testing && <HiBeaker className="h-4 w-4 mr-2" />}
                    Test Prompt
                  </button>
                  <button
                    className={`btn btn-success ${saving ? 'loading' : ''}`}
                    onClick={() => saveSection('intelligent_query_analysis', prompts.intelligent_query_analysis)}
                    disabled={saving}
                  >
                    {!saving && <HiSave className="h-4 w-4 mr-2" />}
                    Save Changes
                  </button>
                </div>
              </div>

              {testResult && (
                <div className="card bg-base-200">
                  <div className="card-body">
                    <h4 className="card-title">Test Result</h4>
                    <div className="mockup-code">
                      <pre data-prefix="$"><code>{JSON.stringify(testResult, null, 2)}</code></pre>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Search Keywords Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <HiSearch className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{prompts.search_term_extraction.name}</h3>
                <p className="text-sm text-gray-600">{prompts.search_term_extraction.description}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            
            <div className="space-y-6">
              {Object.entries(prompts.search_term_extraction.config).map(([category, keywords]) => (
                <div key={category}>
                  <label className="block text-sm font-medium text-gray-700 mb-2 capitalize">
                    {category.replace('_', ' ')}
                  </label>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {keywords.map((keyword, index) => (
                      <span key={index} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {keyword}
                      </span>
                    ))}
                  </div>
                  <textarea
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    value={keywords.join(', ')}
                    onChange={(e) => {
                      const newKeywords = e.target.value.split(',').map(k => k.trim()).filter(k => k)
                      updateKeywords(category.replace('_keywords', ''), newKeywords)
                    }}
                    placeholder="Enter keywords separated by commas"
                    rows={2}
                  />
                </div>
              ))}
              
              <button
                className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => saveSection('search_term_extraction', prompts.search_term_extraction)}
                disabled={saving}
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <HiSave className="h-4 w-4" />
                )}
                Save Keywords
              </button>
            </div>
          </div>
        </div>

        {/* Debug Settings Section */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <HiExclamation className="h-6 w-6 text-orange-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{prompts.debugging.name}</h3>
                <p className="text-sm text-gray-600">{prompts.debugging.description}</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            
            <div className="space-y-4">
              {Object.entries(prompts.debugging.settings).map(([setting, enabled]) => (
                <div key={setting} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <label className="cursor-pointer">
                    <span className="text-sm font-medium text-gray-900 capitalize">
                      {setting.replace(/_/g, ' ')}
                    </span>
                  </label>
                  <button
                    type="button"
                    onClick={() => updateDebuggingSetting(setting, !enabled)}
                    className={`
                      relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                      ${enabled ? 'bg-green-600' : 'bg-gray-200'}
                    `}
                  >
                    <span
                      className={`
                        inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                        ${enabled ? 'translate-x-6' : 'translate-x-1'}
                      `}
                    />
                  </button>
                </div>
              ))}
              
              <button
                className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors mt-6 ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => saveSection('debugging', prompts.debugging)}
                disabled={saving}
              >
                {saving ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                ) : (
                  <HiSave className="h-4 w-4" />
                )}
                Save Debug Settings
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}