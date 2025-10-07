import { Router } from 'express'
import { ExternalDataService } from '../services/ExternalDataService'

const router = Router()
// Don't create the service here - create it inside the route to avoid timing issues

router.get('/external-db-check', async (req, res) => {
  try {
    console.log('🔍 Debug endpoint: Checking external database...')
    
    // Check environment variables first
    const envCheck = {
      EXTERNAL_SUPABASE_URL: process.env.EXTERNAL_SUPABASE_URL ? 'SET' : 'MISSING',
      EXTERNAL_SUPABASE_ANON_KEY: process.env.EXTERNAL_SUPABASE_ANON_KEY ? 'SET' : 'MISSING',
      url_length: process.env.EXTERNAL_SUPABASE_URL?.length || 0,
      key_length: process.env.EXTERNAL_SUPABASE_ANON_KEY?.length || 0
    }
    
    console.log('🔑 Environment variables check:', envCheck)
    
    // Create service instance HERE after env vars are loaded
    const externalService = new ExternalDataService()
    
    if (!externalService.isAvailable()) {
      return res.json({
        status: 'error',
        message: 'External database not configured',
        available: false,
        env_check: envCheck
      })
    }

    const testResult = await externalService.testConnection()
    
    // Also try a simple query
    const searchResults = await externalService.searchPianoRecords('piano', 5)
    
    res.json({
      status: 'success',
      connection_test: testResult,
      sample_search: {
        query: 'piano',
        results_count: searchResults.length,
        sample_results: searchResults.slice(0, 2)
      },
      debug_info: {
        service_available: externalService.isAvailable(),
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    res.status(500).json({
      status: 'error',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

export { router as debugRouter }