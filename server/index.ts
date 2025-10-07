import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat.js'
import { debugRouter } from './routes/debug.js'
import adminRouter from './routes/admin.js'
import systemPromptsRouter from './routes/system-prompts.js'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', chatRouter)
app.use('/debug', debugRouter)
app.use('/admin', adminRouter)
app.use('/api/system-prompts', systemPromptsRouter)

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// For local development
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
  })
}

// Export for Vercel serverless function
export default app