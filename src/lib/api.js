// client-side API wrapper
export async function fetchQuestion({ mode, difficulty, token }) {
  const res = await fetch('/api/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify({ mode, difficulty })
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error('Server error: ' + text);
  }
  return res.json();
}

export async function postAttempt(attempt) {
  const res = await fetch('/api/attempt', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(attempt)
  });
  return res.json();
}
