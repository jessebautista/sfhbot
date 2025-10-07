# SFH Bot - Non-Profit AI Receptionist

A conversational AI service that provides 24/7 automated customer support for non-profit organizations, handling inquiries about donations, events, and volunteering opportunities.

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your OpenAI API key
   ```

3. **Start development servers**
   ```bash
   npm run dev
   ```

   This runs both the React frontend (port 3000) and Express backend (port 3001).

## Features

- **Conversational AI**: OpenAI GPT-4 powered responses for natural conversations
- **Hybrid Memory Architecture**: 
  - Personal memory via Mem0 API (persistent across sessions)
  - Organizational knowledge via Supabase Vector database (semantic search)
  - Fallback systems for offline capability
- **Advanced Analytics**: Response times, user feedback, conversation tracking
- **Anonymous Support**: UUID-based user identification for privacy
- **Vector Search**: Semantic search through organizational knowledge base
- **Privacy Compliant**: Data cleanup and user deletion capabilities
- **Responsive Design**: Mobile-friendly chat interface

## Architecture

- **Frontend**: React + Vite + TypeScript
- **Backend**: Express.js + TypeScript  
- **AI**: OpenAI GPT-4 + text-embedding-ada-002
- **Personal Memory**: Mem0 API (with in-memory fallback)
- **Knowledge Base**: Supabase Vector DB with pgvector extension
- **Analytics**: Supabase PostgreSQL with custom functions
- **Deployment**: Containerized with Docker support

## Development

```bash
# Run full development stack
npm run dev

# Run components separately
npm run dev:client  # Frontend only
npm run dev:server  # Backend only

# Build for production
npm run build

# Type checking
npm run typecheck

# Linting
npm run lint
```

## Environment Variables

**Required:**
- `OPENAI_API_KEY` - Your OpenAI API key

**Optional (but recommended):**
- `MEM0_API_KEY` - Mem0 API key for persistent personal memory
- `SUPABASE_URL` - Supabase project URL for knowledge base and analytics
- `SUPABASE_ANON_KEY` - Supabase anonymous key
- `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key (for admin functions)
- `PORT` - Server port (default: 3001)

## Database Setup (Optional but Recommended)

For full functionality with vector search and analytics:

1. **Create a Supabase project**
2. **Enable pgvector extension** in your Supabase project
3. **Run the setup SQL**: Copy and paste `supabase_setup.sql` in Supabase SQL Editor
4. **Add credentials** to your `.env` file

See `SUPABASE_SETUP.md` for detailed instructions.

## Project Status

**Current Implementation (Phase 1 Complete):**
- ✅ Core chat API endpoint with detailed logging
- ✅ React chat interface with real-time responses  
- ✅ OpenAI GPT-4 integration
- ✅ Mem0 personal memory integration (with fallback)
- ✅ Supabase vector knowledge base with semantic search
- ✅ Advanced analytics and user session tracking
- ✅ Privacy compliance with data cleanup functions
- ✅ Anonymous user support with session management

**Upcoming phases**:
- Admin dashboard for knowledge management
- Multi-language support
- Enhanced security features
- Real-time notifications

## Testing

The system includes comprehensive fallback mechanisms:
- **Basic mode**: Works with only OpenAI API key
- **Enhanced mode**: Add Mem0 for persistent memory
- **Full mode**: Add Supabase for vector search and analytics

See `SETUP_TESTING.md` for detailed testing scenarios.

## Documentation

- `SETUP_TESTING.md` - Complete testing guide with scenarios
- `SUPABASE_SETUP.md` - Database setup instructions  
- `CLAUDE.md` - Developer documentation for Claude Code
- `PRD.md` & `requirement.md` - Product requirements and roadmap