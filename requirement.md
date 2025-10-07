# Non-Profit AI Receptionist – Roadmap

## Phase 0 – Prep (Week 0-1)
- Define FAQ/knowledge-base schema in Supabase.
- Set up GitHub repo with Astro + Node API skeleton.

## Phase 1 – Core API (Week 2-3)
- Build `/api/chat` endpoint.
- Integrate OpenAI GPT-4.1.
- Add Mem0 memory read/write.
- Store chat logs in Supabase.

## Phase 2 – Frontend UI (Week 4-5)
- Minimal React/Astro chat widget.
- Cookie-based UUID generator for anonymous users.
- Basic styling + mobile responsiveness.

## Phase 3 – Retrieval-Augmented Knowledge (Week 6)
- Supabase vector search for FAQs/events/donation info.
- Admin upload page for updating FAQ documents.

## Phase 4 – Observability & Security (Week 7)
- Add logging & analytics dashboard.
- Implement memory-deletion API for privacy requests.
- Encrypt sensitive Supabase tables.

## Phase 5 – Enhancements (Future)
- Multi-language support.
- Slack/Email fallback to staff.
- Integration with donation/payment APIs.

**Target Launch**: MVP in ~6–7 weeks.
