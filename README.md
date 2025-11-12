# Acid Namer — Adaptive Practice App

Overview
- Two practice modes: `acid` (naming acids) and `skeleton` (sentence/equation skeletons).
- Adaptive difficulty from Grade 6 → Grade 12.
- Serverless OpenAI generator for questions & explanations.
- Supabase for auth & progress persistence.

Environment variables (server & client):
- OPENAI_API_KEY (server)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY (server, optional)

Deployment (recommended)
- Vercel: push repo, set env vars, Vercel auto-deploys both frontend and serverless functions in `/api`.
- Netlify: use `netlify/functions` for serverless, set env vars in Netlify dashboard.

See the `server/` folder for serverless examples and `src/` for the client.
