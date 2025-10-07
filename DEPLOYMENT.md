# Deployment Guide

## Vercel Deployment

### Prerequisites
1. GitHub repository (✅ Done: https://github.com/jessebautista/sfhbot)
2. Vercel account

### Deployment Steps

1. **Import Project to Vercel:**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import from GitHub: `jessebautista/sfhbot`

2. **Configure Build Settings:**
   - Framework Preset: `Other`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Install Command: `npm install`

3. **Environment Variables (Required):**
   Add these in Vercel dashboard → Settings → Environment Variables:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   NODE_ENV=production
   ```

4. **Optional Environment Variables:**
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
   MEM0_API_KEY=your_mem0_api_key
   ```

### File Structure for Vercel
- `vercel.json` - Deployment configuration
- Frontend builds to `/dist` (static files)
- Backend runs as serverless function from `/server/index.ts`
- API routes accessible at `/api/*`

### Post-Deployment
1. Test the chat widget functionality
2. Verify API endpoints are working
3. Check logs in Vercel dashboard for any issues

### Environment Variables Setup
Copy values from your local `.env` file to Vercel's environment variables dashboard. Never commit real API keys to the repository.