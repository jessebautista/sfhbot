---
product: "Non-Profit AI Receptionist"
version: "1.0.0"
author: "Your Team"
date: "2025-09-23"
status: "Draft"
---

# 0. TL;DR
A server-side API service that powers a conversational AI receptionist for our non-profit organization.  
Primary interface is a REST/JSON endpoint so it can be embedded anywhere (web app, mobile app, kiosk).  
Key features: natural-language Q&A, persistent memory per visitor, and integration with our existing Supabase database.

# 1. Goals
- Provide 24/7 automated customer support (donations, events, volunteering).
- Maintain **long-term memory** of repeat visitors for personalized answers.
- Expose a **single `/chat` HTTP endpoint** to integrate with other projects.
- Ensure privacy and compliance with donor data.

# 2. Non-Goals
- Full-fledged CRM replacement.
- Human live-chat module (handled by existing staff tools).
- Custom LLM training (use OpenAI API).

# 3. Architecture Overview
Client (Astro/React) → /api/chat
|
+--> Supabase (Auth + Vector Store for FAQ)
+--> Mem0 (long-term memory per user)
+--> OpenAI GPT-4.1 (LLM)

# 4. Key Features
- **Memory Layer**: Mem0 stores/recalls facts per `user_id` or anonymous `session_id`.
- **Retrieval-Augmented Generation**: Supabase vector DB stores FAQs, schedules, donation info.
- **Single REST Endpoint**: `POST /api/chat` with `{userId, message}` returns `{reply}`.
- **Admin Dashboard (Phase 2)**: View chat logs, update FAQ documents.
- **Analytics**: Track volume, satisfaction (thumbs up/down).

# 5. Functional Requirements
| ID | Requirement |
|----|-------------|
| FR-1 | Accept JSON POST at `/api/chat` and respond within <3 seconds. |
| FR-2 | Retrieve memory from Mem0 before calling OpenAI. |
| FR-3 | Store chat history in Supabase (`chat_logs` table). |
| FR-4 | Update Mem0 memory after each response. |
| FR-5 | Support anonymous visitors with cookie-based UUID. |

# 6. Technical Stack
- **Backend**: Node.js / TypeScript (Astro API routes or standalone Express).
- **Database**: Supabase (PostgreSQL + Vector extension).
- **Memory Engine**: [Mem0](https://github.com/mem0ai/mem0).
- **LLM Provider**: OpenAI GPT-4.1 or GPT-4.1-mini for cost control.
- **Hosting**: Vercel or Supabase Edge Functions.

# 7. Security & Privacy
- Encrypt chat logs at rest.
- Store only minimal personally-identifiable info.
- Allow users to request deletion of their memory.

# 8. Success Metrics
- ≥90% of common questions answered correctly.
- Average response latency ≤3 s.
- 30% reduction in staff time spent on routine inquiries.

# 9. Risks & Mitigations
- **High API cost** → implement caching and smaller models.
- **Memory drift** → periodic summarization/cleanup of Mem0 data.
- **Data privacy** → strict access control and GDPR-style deletion endpoints.

# 10. Milestones
See `roadmap.md`.
