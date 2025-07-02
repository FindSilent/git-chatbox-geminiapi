// pages/api/gemini.js (Next.js)

import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const DEFAULT_MODEL = "gemini-2.0-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, model, history } = req.body;

  if (!prompt?.trim()) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const modelName = model || DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: "Missing Gemini API key" });
  }

  const contents = Array.isArray(history) ? [...history] : [];
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  try {
    // Gọi Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contents }),
      }
    );

    const data = await response.json();

    if (!response.ok || !data?.candidates?.length) {
      console.error("Gemini API error:", data);
      return res
        .status(500)
        .json({ error: data?.error?.message || "No candidate reply" });
    }

    const reply =
      data.candidates[0]?.content?.parts?.[0]?.text ?? "[Empty Gemini reply]";

    // Lưu vào Supabase
    const session_id = req.headers["x-session-id"] || "anonymous";

    const { error: dbError } = await supabase.from("chats").insert([
      {
        session_id,
        history: [...contents, { role: "model", parts: [{ text: reply }] }],
      },
    ]);

    if (dbError) {
      console.error("Supabase error:", dbError.message);
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini Handler Exception:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
}
