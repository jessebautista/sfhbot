# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SFH Bot is a Non-Profit AI Receptionist service that provides 24/7 automated customer support for donations, events, and volunteering inquiries. The project consists of a React frontend and Express.js backend with OpenAI integration, Supabase database storage, and memory management for personalized conversations.

## Development Commands

```bash
# Install dependencies
npm install

# Development (runs both client and server)
npm run dev

# Run client only (port 3000)
npm run dev:client

# Run server only (port 3001)
npm run dev:server

# Build the project
npm run build

# Build server only
npm run build:server

# Type checking
npm run typecheck

# Linting
npm run lint

# Production start
npm start
```

## Architecture

### Frontend (React + Vite)
- **Location**: `/src`
- **Entry Point**: `src/main.tsx`
- **Main Component**: `src/App.tsx`
- **Chat Widget**: `src/components/ChatWidget.tsx`
- **Types**: `src/types/index.ts`

### Backend (Express.js + TypeScript)
- **Location**: `/server`
- **Entry Point**: `server/index.ts`
- **API Routes**: `server/routes/chat.ts`
- **Services**:
  - `ChatService.ts` - Main chat processing with OpenAI integration
  - `VectorKnowledgeService.ts` - Supabase vector search for organizational knowledge
  - `Mem0PersonalMemory.ts` - Personal memory management via Mem0 API
  - `SupabaseService.ts` - Database operations for chat logs

### Key Features
- **Single REST Endpoint**: `POST /api/chat` with `{userId, message}` returns `{reply}`
- **Hybrid Memory Architecture**:
  - **Mem0**: Personal conversation memory per user (persistent across sessions)
  - **Supabase Vector**: Organizational knowledge base with semantic search
  - **Fallback Systems**: In-memory storage when external services unavailable
- **Anonymous Users**: UUID-based user identification via localStorage
- **Advanced Analytics**: Chat logs, user sessions, response times, feedback tracking

### Environment Setup
1. Copy `.env.example` to `.env`
2. **Required**: Add your OpenAI API key
3. **Optional but recommended**: 
   - Mem0 API key for persistent personal memory
   - Supabase credentials for vector knowledge search and analytics
4. Run `supabase_setup.sql` in your Supabase project (if using Supabase)
5. Server runs on port 3001, client on port 3000

### Deployment Architecture
- Frontend: Static build can be deployed to Vercel, Netlify, etc.
- Backend: Can be deployed to Vercel Functions, Railway, or similar
- Database: Supabase for chat logs and future knowledge base storage

### Claude Code Integration
- **Agent Directory**: `.claude/` contains custom agents and configurations
- **Structure**:
  - `.claude/agents/` - Custom agent implementations
  - `.claude/configs/` - Agent configuration files  
  - `.claude/prompts/` - Reusable prompt templates
- Agent files are tracked in git by default (uncomment `.claude/` in `.gitignore` to exclude)

### Database Schema (Supabase)
**Required Tables** (created by `supabase_setup.sql`):
- `knowledge_documents` - Vector embeddings for organizational knowledge
  - Columns: id, title, content, category, embedding(vector), metadata, priority, tags
- `chat_logs` - Conversation history and analytics
  - Columns: id, user_id, session_id, message, reply, response_time_ms, model_used, feedback
- `user_sessions` - Anonymous user tracking and preferences  
  - Columns: id, user_id, session_data, preferences, total_messages, first_seen, last_seen

**Functions**: `search_knowledge_documents()`, `get_chat_analytics()`, `update_user_session()`, `cleanup_old_data()`

### Implementation Status
- ✅ **Mem0 Personal Memory**: Implemented with API integration + fallback
- ✅ **Vector Knowledge Search**: Implemented with OpenAI embeddings + Supabase vector
- ✅ **Analytics & Logging**: Chat logs, user sessions, response times, feedback
- ✅ **Privacy Compliance**: Data cleanup functions, user data deletion
- 🔄 **Admin Dashboard**: Not yet implemented (future enhancement)
- 🔄 **Multi-language Support**: Not yet implemented (future enhancement)