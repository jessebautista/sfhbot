import dotenv from 'dotenv'
dotenv.config()

import express from 'express'
import cors from 'cors'
import { chatRouter } from './routes/chat'
import { debugRouter } from './routes/debug'
import adminRouter from './routes/admin'
import systemPromptsRouter from './routes/system-prompts'

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.use('/api', chatRouter)
app.use('/debug', debugRouter)
app.use('/admin', adminRouter)
app.use('/api/system-prompts', systemPromptsRouter)

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})