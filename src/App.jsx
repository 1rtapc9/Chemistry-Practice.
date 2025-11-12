import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { normalizeAnswer, decideNextState } from './lib/adaptive';
import { fetchQuestion, postAttempt } from './lib/api';

// INIT SUPABASE - replace with env-based injection by your build (e.g. VITE_, or use direct env in deployment)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || (window.__ENV && window.__ENV.SUPABASE_URL);
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || (window.__ENV && window.__ENV.SUPABASE_ANON_KEY);

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [mode, setMode] = useState('acid'); // 'acid' or 'skeleton'
  const [grade, setGrade] = useState(6);
  const [streak, setStreak] = useState(0);
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);

  useEffect(() => {
    // restore supabase session
    const session = supabase.auth.getSession().then(r => r.data?.session).catch(()=>null);
    session.then(s=>{
      if(s?.user) setUser(s.user);
    });
  }, []);

  // load initial question
  useEffect(() => {
    loadQuestion(grade, mode);
    // eslint-disable-next-line
  }, [grade, mode]);

  async function loadQuestion(d,gMode) {
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      const q = await fetchQuestion({ mode: gMode, difficulty: d, token });
      setQuestion(q);
      setFeedback(null);
      setAnswer('');
    } catch (e) {
      console.error(e);
      setQuestion({ questionPrompt: 'Error loading question. Try again later.', canonicalAnswer: '' });
    }
  }

  async function submit() {
    if (!question) return;
    const userNormalized = normalizeAnswer(answer);
    const canonicalNormalized = normalizeAnswer(question.canonicalAnswer);
    // server also includes acceptedAnswers array for more flexible grading
    const accepted = (question.acceptedAnswers || []).map(normalizeAnswer);
    const correct = (userNormalized === canonicalNormalized) || accepted.includes(userNormalized);
    // prepare feedback
    setFeedback({ correct, expected: question.canonicalAnswer, explanation: question.explanation, remediation: question.remediation });

    // update adaptive
    const { nextGrade, nextStreak } = decideNextState({ currentGrade: grade, currentStreak: streak, wasCorrect: correct });
    setGrade(nextGrade);
    setStreak(nextStreak);

    // append history
    setHistory(h => [{ q: question.questionPrompt, ans: answer, ok: correct, expected: question.canonicalAnswer }, ...h].slice(0, 50));

    // send attempt to server to persist & for server-side grading (optional)
    try {
      const token = (await supabase.auth.getSession()).data?.session?.access_token;
      await postAttempt({ token, mode, difficulty: grade, question: question.questionPrompt, userAnswer: answer, correct });
    } catch (e) {
      // non-fatal
    }

    // queue next question (loadQuestion uses grade state)
    setTimeout(()=> loadQuestion(nextGrade, mode), 700);
  }

  async function signUpDemo() {
    // quick demo sign up (email prompt)
    const email = prompt('Enter email for a demo account (you will receive no email; demo only).');
    if (!email) return;
    const { error } = await supabase.auth.signUp({ email });
    if (error) alert('Sign-up error: ' + error.message);
    else alert('Signed up (check email for links if using real email).');
  }

  return (
    <div className="app" role="main">
      <div className="header">
        <h1>Acid Namer — Adaptive Practice</h1>
        <div className="small">Grade: <strong>{grade}</strong> &nbsp; Streak: <strong>{streak}</strong></div>
      </div>

      <div style={{display:'flex', gap:12, marginTop:8}}>
        <select value={mode} onChange={e=>setMode(e.target.value)} aria-label="Practice mode">
          <option value="acid">Name acids</option>
          <option value="skeleton">Sentence-equation skeletons</option>
        </select>
        <button onClick={()=>{ setGrade(6); setStreak(0); }}>Reset to Grade 6</button>
        <button onClick={signUpDemo}>Sign up (demo)</button>
      </div>

      <div className="questionBox" role="region" aria-live="polite">
        <div className="small">Question (Grade {grade})</div>
        <div style={{marginTop:6, fontWeight:600}}>{question ? question.questionPrompt : 'Loading...'}</div>

        <div className="inputRow">
          <input value={answer} onChange={e=>setAnswer(e.target.value)} placeholder="Type your answer" aria-label="Answer input" onKeyDown={(e)=>{ if(e.key==='Enter'){ submit(); }}} />
          <button onClick={submit}>Submit</button>
        </div>

        {feedback && (
          <div style={{marginTop:12}} className={feedback.correct ? 'feedback-correct' : 'feedback-wrong'} role="alert">
            <div style={{fontWeight:700}}>{feedback.correct ? 'Correct' : 'Not quite'}</div>
            <div className="small" style={{marginTop:6}}><strong>Expected:</strong> {feedback.expected}</div>
            <div className="small" style={{marginTop:6}}><strong>Explanation:</strong> {feedback.explanation}</div>
            {feedback.remediation && <div className="small" style={{marginTop:6}}><strong>Try this:</strong> {feedback.remediation}</div>}
          </div>
        )}
      </div>

      <div className="history">
        <div className="small">Recent attempts</div>
        <ul>
          {history.map((h, i) => (
            <li key={i} style={{marginTop:8}}>
              <div style={{fontWeight:600}}>{h.q}</div>
              <div className="small">You: {h.ans} — {h.ok ? '✓ correct' : '✕ wrong'} (expected: {h.expected})</div>
            </li>
          ))}
        </ul>
      </div>

      <footer style={{marginTop:18}} className="small">
        Tips: this app fetches each question from the server. Server returns `acceptedAnswers` (synonyms), `explanation`, and a short `remediation` hint to mimic IXL-style help.
      </footer>
    </div>
  );
}
