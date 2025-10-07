import express from 'express'
import fs from 'fs/promises'
import path from 'path'

const router = express.Router()

const PROMPTS_FILE = path.join(process.cwd(), 'config', 'system-prompts.json')

/**
 * Get all system prompts
 */
router.get('/', async (req, res) => {
  try {
    const data = await fs.readFile(PROMPTS_FILE, 'utf-8')
    const prompts = JSON.parse(data)
    res.json({
      success: true,
      prompts,
      last_modified: (await fs.stat(PROMPTS_FILE)).mtime
    })
  } catch (error) {
    console.error('Error reading system prompts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to read system prompts'
    })
  }
})

/**
 * Update a specific prompt section
 */
router.put('/:section', async (req, res) => {
  try {
    const { section } = req.params
    const { data } = req.body

    // Read current prompts
    const currentData = await fs.readFile(PROMPTS_FILE, 'utf-8')
    const prompts = JSON.parse(currentData)

    // Validate section exists
    if (!prompts[section]) {
      return res.status(404).json({
        success: false,
        error: `Section '${section}' not found`
      })
    }

    // Update the section
    prompts[section] = { ...prompts[section], ...data }

    // Write back to file
    await fs.writeFile(PROMPTS_FILE, JSON.stringify(prompts, null, 2))

    res.json({
      success: true,
      message: `Section '${section}' updated successfully`,
      updated_section: prompts[section]
    })
  } catch (error) {
    console.error('Error updating system prompts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to update system prompts'
    })
  }
})

/**
 * Get a specific prompt section
 */
router.get('/:section', async (req, res) => {
  try {
    const { section } = req.params
    const data = await fs.readFile(PROMPTS_FILE, 'utf-8')
    const prompts = JSON.parse(data)

    if (!prompts[section]) {
      return res.status(404).json({
        success: false,
        error: `Section '${section}' not found`
      })
    }

    res.json({
      success: true,
      section,
      data: prompts[section]
    })
  } catch (error) {
    console.error('Error reading system prompt section:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to read system prompt section'
    })
  }
})

/**
 * Reset prompts to default
 */
router.post('/reset', async (req, res) => {
  try {
    // Create backup first
    const backupFile = `${PROMPTS_FILE}.backup.${Date.now()}`
    const currentData = await fs.readFile(PROMPTS_FILE, 'utf-8')
    await fs.writeFile(backupFile, currentData)

    // Reset to default (you might want to have a default-prompts.json file)
    const defaultPrompts = {
      "intelligent_query_analysis": {
        "name": "Intelligent Query Analysis",
        "description": "Main prompt for analyzing user queries and determining search strategy",
        "template": "Analyze this user query for a music/piano database search:\\n\\\"{userQuery}\\\"\\n\\nDatabase contains:\\n- pianos: piano_title, artist_name, piano_statement\\n- news: news_title, newscontent, news_excerpt, news_categories  \\n- piano_activations: act_title, act_location, act_content, act_artists\\n\\nRespond with JSON only:\\n{\\n  \\\"type\\\": \\\"piano_search|news_search|activation_search|location_search|artist_search|general\\\",\\n  \\\"reasoning\\\": \\\"brief explanation\\\",\\n  \\\"searchTerms\\\": [\\\"key\\\", \\\"search\\\", \\\"terms\\\"],\\n  \\\"tables\\\": [\\\"primary\\\", \\\"secondary\\\"]\\n}",
        "variables": ["userQuery"],
        "model_settings": {
          "model": "gpt-4",
          "temperature": 0.1,
          "max_tokens": 300
        }
      }
    }

    await fs.writeFile(PROMPTS_FILE, JSON.stringify(defaultPrompts, null, 2))

    res.json({
      success: true,
      message: 'Prompts reset to default',
      backup_file: backupFile
    })
  } catch (error) {
    console.error('Error resetting system prompts:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to reset system prompts'
    })
  }
})

/**
 * Test a prompt with sample data
 */
router.post('/test/:section', async (req, res) => {
  try {
    const { section } = req.params
    const { testInput } = req.body

    const data = await fs.readFile(PROMPTS_FILE, 'utf-8')
    const prompts = JSON.parse(data)

    if (!prompts[section]) {
      return res.status(404).json({
        success: false,
        error: `Section '${section}' not found`
      })
    }

    // For testing, just return the template with test input substituted
    const template = prompts[section].template || ''
    const testOutput = template.replace('{userQuery}', testInput || 'sample query')

    res.json({
      success: true,
      section,
      test_input: testInput,
      generated_prompt: testOutput,
      model_settings: prompts[section].model_settings
    })
  } catch (error) {
    console.error('Error testing prompt:', error)
    res.status(500).json({
      success: false,
      error: 'Failed to test prompt'
    })
  }
})

export default router