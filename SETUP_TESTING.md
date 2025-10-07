# SFH Bot - Setup and Testing Guide

## Overview

Our chatbot now uses a **hybrid memory architecture**:

- **Supabase Vector DB** - Organizational knowledge (FAQs, policies, procedures)
- **Mem0** - Personal conversation memory per user  
- **Fallback Systems** - Works even without external services

## Quick Setup

### 1. Environment Variables

Your `.env` file should have:

```env
# Required
OPENAI_API_KEY=your-openai-api-key

# Optional for enhanced features
MEM0_API_KEY=your-mem0-api-key-here
SUPABASE_URL=your-supabase-project-url
SUPABASE_ANON_KEY=your-supabase-anon-key

# Server config
PORT=3001
NODE_ENV=development
```

### 2. Start the Application

```bash
npm install
npm run dev
```

- Frontend: http://localhost:3000
- Backend: http://localhost:3001

## Testing Scenarios

### Scenario 1: Basic Functionality (No External Services)

**What it tests**: Fallback knowledge base and in-memory personal memory

**Test Steps**:
1. Start the app with only `OPENAI_API_KEY` set
2. Ask: "How can I donate to your organization?"
3. Expected: Response about donation methods using fallback knowledge
4. Ask: "What did I just ask about?"
5. Expected: References your previous donation question

**What you'll see in logs**:
```
Supabase not configured, using fallback knowledge base
MEM0_API_KEY not found, using fallback memory storage
Memory service available: false
Fallback memories stored: 0
```

### Scenario 2: Enhanced Knowledge (With Supabase)

**What it tests**: Vector-based organizational knowledge search

**Prerequisites**: 
- Supabase project with Vector extension enabled
- Database schema setup (see Database Setup below)

**Test Steps**:
1. Configure Supabase credentials in `.env`
2. Ask: "Tell me about your volunteer programs"
3. Expected: More detailed, contextual response from vector search

### Scenario 3: Personal Memory (With Mem0)

**What it tests**: Persistent personal conversation memory

**Prerequisites**: 
- Mem0 API key from https://mem0.ai

**Test Steps**:
1. Configure `MEM0_API_KEY` in `.env`
2. Say: "I'm interested in volunteering for educational programs"
3. Ask something else, then later ask: "What volunteering was I interested in?"
4. Expected: Bot remembers your specific interest in educational programs

### Scenario 4: Full System (Supabase + Mem0)

**What it tests**: Complete hybrid memory system

**Test Steps**:
1. Configure both Supabase and Mem0
2. Have a conversation about donations, remember personal details
3. Close browser, return later with same user ID
4. Ask: "What do you remember about me?"
5. Expected: Personalized response with conversation history

## Database Setup (Optional - Supabase Vector)

### Quick Setup
1. **Run the complete setup**: Copy and paste `supabase_setup.sql` in your Supabase SQL Editor
2. **Click "Run"** - This will create all tables, functions, indexes, and sample data

### What Gets Created
- **3 Tables**: `knowledge_documents`, `chat_logs`, `user_sessions`
- **4 Functions**: Vector search, analytics, session management, data cleanup
- **8 Initial Documents**: Pre-populated organizational knowledge
- **Security Policies**: Row-level security and proper permissions
- **Performance Indexes**: Optimized for fast queries

See `SUPABASE_SETUP.md` for detailed setup instructions.

## API Endpoints for Testing

### Chat Endpoint
```bash
curl -X POST http://localhost:3001/api/chat \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-123",
    "message": "How can I volunteer?"
  }'
```

### Health Check
```bash
curl http://localhost:3001/health
```

## Testing Checklist

### ✅ Basic Functionality
- [ ] Bot responds to greetings
- [ ] Bot answers donation questions
- [ ] Bot remembers previous question in conversation
- [ ] Error handling works when API keys are invalid

### ✅ Knowledge Base
- [ ] Bot provides specific organizational information
- [ ] Responses are relevant to user queries
- [ ] Multiple related questions get consistent answers

### ✅ Personal Memory
- [ ] Bot remembers user preferences across messages
- [ ] Conversation context is maintained
- [ ] User-specific information is recalled

### ✅ Privacy & Data Management
- [ ] User data can be cleared (for privacy compliance)
- [ ] System works with fallbacks when services are unavailable
- [ ] No sensitive information is logged

## Common Issues & Solutions

### Issue: "OpenAI API key missing"
**Solution**: Ensure `OPENAI_API_KEY` is set in `.env` file

### Issue: Bot responses are generic
**Possible causes**:
- Supabase not configured → Using fallback knowledge
- Knowledge base not initialized → Check server logs

### Issue: Bot doesn't remember previous conversation
**Possible causes**:
- Different user ID used → Use same user ID in browser localStorage
- Mem0 not configured → Using in-memory fallback that resets on server restart

### Issue: Vector search not working
**Possible causes**:
- Vector extension not enabled in Supabase → Run `supabase_setup.sql`
- Database schema not created → Check if tables exist in Supabase dashboard
- OpenAI API key missing for embeddings → Required for generating embeddings

### Issue: Analytics not working
**Possible causes**:
- Supabase functions not created → Run the complete `supabase_setup.sql` setup
- Permissions not set correctly → RLS policies may need adjustment

## Performance Notes

- **Basic Mode** (OpenAI only): ~200ms response time
- **Enhanced Mode** (+ Mem0): ~300ms response time  
- **Full Mode** (+ Supabase Vector): ~500ms response time (includes embedding generation)
- **Analytics Overhead**: +50ms for detailed logging
- **First Request**: May take longer due to service initialization

## Next Steps

1. **Test with your specific organizational content**
2. **Add more knowledge documents** through the API or database
3. **Configure production environment** with proper error monitoring
4. **Set up user privacy controls** for data deletion requests

The system is designed to be **resilient** - it will work even if external services are unavailable, gracefully degrading to fallback systems while maintaining core functionality.