// server/vercel/api/generate.js
import fetch from 'node-fetch';

const OPENAI_KEY = process.env.OPENAI_API_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || null;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).send('Method not allowed');
  try {
    const { mode='acid', difficulty=6 } = req.body || {};
    // Basic sanitize
    const d = Math.max(6, Math.min(12, Number(difficulty) || 6));
    const allowedModes = ['acid','skeleton'];
    const m = allowedModes.includes(mode) ? mode : 'acid';

    // Compose a strict instruction to OpenAI to return only JSON with a predictable schema.
    const system = `You are a helpful chemistry question generator that outputs a single JSON object (no code block, no extra text). The JSON schema must be:
{
  "questionPrompt": string,          // prompt to show user
  "canonicalAnswer": string,         // canonical short answer
  "acceptedAnswers": [string],       // acceptable synonyms
  "explanation": string,             // 1-2 sentence explanation
  "remediation": string,             // 1-sentence tip or follow-up mini-question
  "difficulty": integer              // same as requested difficulty (6..12)
}
Be concise and ensure outputs are JSON-parseable.`;

    // small helper to get domain-appropriate examples from server side
    const user = `Generate ONE ${m === 'acid' ? 'acid naming' : 'sentence-equation skeleton'} question at an educational level roughly matching US grade ${d}. 
Return canonicalAnswer and at least 2 acceptedAnswers if possible. 
Prefer real common acids and typical skeleton reactions for skeleton mode. 
Keep questionPrompt short (one line). Keep explanation short (max 40 words). Keep remediation to one sentence.`;

    const body = {
      model: 'gpt-4o-mini', // replace with the exact model you prefer / have access to
      messages: [{role:'system', content: system}, {role:'user', content: user}],
      temperature: 0.2,
      max_tokens: 300
    };

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify(body)
    });

    if (!openaiRes.ok) {
      const text = await openaiRes.text();
      return res.status(502).send('OpenAI error: ' + text);
    }

    const data = await openaiRes.json();
    const content = data?.choices?.[0]?.message?.content || '';
    // try to parse JSON out of content
    let json = null;
    try {
      json = JSON.parse(content);
    } catch (e) {
      // if content contains trailing text, try to extract the first {...}
      const match = content.match(/\{[\s\S]*\}/);
      if (match) {
        try { json = JSON.parse(match[0]); } catch (e2) { json = null; }
      }
    }

    if (!json) {
      // fallback: generate a simple question locally to avoid blocking the client
      const fallback = m === 'acid'
        ? { questionPrompt: 'Name HCl (aqueous)', canonicalAnswer: 'hydrochloric acid', acceptedAnswers: ['hydrochloric acid','hydrogen chloride (aqueous)'], explanation: 'HCl in water is hydrochloric acid (binary acid).', remediation: 'Remember binary acids: hydro- + base name of anion + -ic acid.', difficulty: d }
        : { questionPrompt: 'Write a skeleton: sodium metal reacts with water', canonicalAnswer: '2 Na(s) + 2 H2O(l) -> 2 NaOH(aq) + H2(g)', acceptedAnswers: ['na + h2o -> naoh + h2','2 na(s) + 2 h2o -> 2 naoh + h2'], explanation: 'Sodium reacts with water to form sodium hydroxide and hydrogen gas.', remediation: 'Metals above hydrogen produce H2 gas when reacting with acids/water.', difficulty: d };
      return res.status(200).json(fallback);
    }

    // ensure fields exist and coerce types
    const out = {
      questionPrompt: String(json.questionPrompt || json.prompt || '').trim(),
      canonicalAnswer: String(json.canonicalAnswer || json.answer || '').trim(),
      acceptedAnswers: Array.isArray(json.acceptedAnswers) ? json.acceptedAnswers.map(String) : [String(json.canonicalAnswer || '')],
      explanation: String(json.explanation || '').trim(),
      remediation: String(json.remediation || '').trim(),
      difficulty: Number(json.difficulty) || d
    };

    return res.status(200).json(out);
  } catch (err) {
    console.error(err);
    res.status(500).send('Server error');
  }
}
