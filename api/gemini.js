import formidable from 'formidable';
import supabase from '../lib/supabase';

const DEFAULT_MODEL = "gemini-2.0-flash";

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-session-id');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const form = formidable({ multiples: false });
  form.parse(req, async (err, fields, files) => {
    if (err) return res.status(500).json({ error: 'Failed to parse form data' });

    const prompt = fields.prompt?.[0]?.trim() || '';
    let history = [];
    try {
      // Kiểm tra và parse history an toàn
      if (fields.history?.[0]) {
        const historyRaw = fields.history[0];
        history = typeof historyRaw === 'string' && historyRaw !== '[object Object]'
          ? JSON.parse(historyRaw)
          : [];
      }
    } catch (parseError) {
      console.error('History parse error:', parseError.message);
      history = []; // Fallback to empty array if parsing fails
    }

    const image = files.image?.[0];

    if (!prompt && !image) return res.status(400).json({ error: 'Prompt or image is required' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'Missing Gemini API key' });

    const contents = Array.isArray(history) ? [...history] : [];
    const parts = [];

    if (image) {
      const fs = require('fs');
      const imageData = fs.readFileSync(image.filepath, { encoding: 'base64' });
      parts.push({ inlineData: { mimeType: image.mimetype, data: imageData } });
    }
    if (prompt) parts.push({ text: prompt });
    contents.push({ role: 'user', parts });

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_MODEL}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents }),
        }
      );

      const data = await response.json();
      if (!response.ok || !data?.candidates?.length) {
        throw new Error(data?.error?.message || 'No candidate response');
      }

      const reply = data.candidates[0]?.content?.parts?.[0]?.text ?? '[Gemini không có phản hồi]';

      await supabase.from('chats').insert([
        {
          session_id: req.headers['x-session-id'] || 'anonymous',
          history: [...contents, { role: 'model', parts: [{ text: reply }] }],
        },
      ]);

      return res.status(200).json({ reply });
    } catch (error) {
      console.error('Gemini API error:', error.message || error);
      return res.status(500).json({ error: 'Gemini API failed. Try again later.' });
    }
  });
}
