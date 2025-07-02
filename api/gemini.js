// api/gemini.js

import supabase from "../../lib/supabase"; // sửa đường dẫn nếu không dùng alias

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

  // Build chat history
  const contents = Array.isArray(history) ? [...history] : [];
  contents.push({
    role: "user",
    parts: [{ text: prompt }],
  });

  try {
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
      throw new Error(data?.error?.message || "No candidate response");
    }

    const reply =
      data.candidates[0]?.content?.parts?.[0]?.text ?? "[Empty Gemini reply]";

    // Ghi lịch sử vào Supabase
    const session_id = req.headers["x-session-id"] || "anonymous";
    const fullHistory = contents.concat({
      role: "model",
      parts: [{ text: reply }],
    });

    const { error: dbError } = await supabase.from("chats").insert([
      {
        session_id,
        history: fullHistory,
      },
    ]);

    if (dbError) {
      console.error("Supabase insert error:", dbError.message);
    }

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error.message || error);
    return res
      .status(500)
      .json({ error: "Gemini API failed. Try again later." });
  }
}
