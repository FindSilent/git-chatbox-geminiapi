// File: /api/gemini.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { prompt, model, imageBase64, history } = req.body;
  const apiKey = process.env.GEMINI_API_KEY || 'YOUR_API_KEY';
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const headers = {
    'Content-Type': 'application/json',
  };

  const contents = [
    {
      parts: [
        ...(imageBase64 ? [{ inlineData: { mimeType: "image/jpeg", data: imageBase64 } }] : []),
        { text: prompt }
      ]
    }
  ];

  const body = {
    contents,
    ...(Array.isArray(history) && history.length > 0 ? { history } : {})
  };

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    const result = await response.json();

    if (result && result.candidates && result.candidates.length > 0) {
      const reply = result.candidates[0].content?.parts?.[0]?.text || "";
      return res.status(200).json({ reply });
    } else {
      console.error("❌ Gemini API response:", result);
      return res.status(500).json({ error: "Gemini API did not return valid content." });
    }
  } catch (err) {
    console.error("❌ API Error:", err.message);
    return res.status(500).json({ error: "Internal server error." });
  }
}
