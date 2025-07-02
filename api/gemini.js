// pages/api/gemini.js

import supabase from "../lib/supabase"; // Đảm bảo đúng path lib/supabase
const DEFAULT_MODEL = "gemini-1.5-pro";

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "20mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, model, history, files = [] } = req.body;

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing Gemini API key" });
  }

  if (!prompt?.trim() && files.length === 0) {
    return res.status(400).json({ error: "Prompt or files are required" });
  }

  const modelName = model || DEFAULT_MODEL;
  const contents = Array.isArray(history) ? [...history] : [];

  const parts = [];

  // Gắn tất cả file (ảnh hoặc tài liệu) vào parts nếu có
  for (const file of files) {
    if (file?.data && file?.mimeType) {
      parts.push({
        inlineData: {
          data: file.data,
          mimeType: file.mimeType,
          name: file.name || "file",
        },
      });
    }
  }

  if (prompt?.trim()) {
    parts.push({ text: prompt.trim() });
  }

  contents.push({ role: "user", parts });

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

    const reply = data.candidates[0]?.content?.parts?.[0]?.text ?? "[Không có phản hồi từ Gemini]";

    // Lưu vào Supabase
    await supabase.from("chats").insert([
      {
        session_id: req.headers["x-session-id"] || "anonymous",
        history: [...contents, { role: "model", parts: [{ text: reply }] }],
      },
    ]);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error);
    return res.status(500).json({ error: "Gemini API failed. Try again later." });
  }
}
