const DEFAULT_MODEL = "gemini-2.0-flash"; // Fixed to gemini-2.0-flash
import supabase from "../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, history, image } = req.body;

  if (!prompt?.trim() && !image) {
    return res.status(400).json({ error: "Prompt or image is required" });
  }

  const modelName = DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Missing Gemini API key" });

  const contents = Array.isArray(history) ? [...history] : [];

  const parts = [];

  if (image?.data && image?.mimeType) {
    parts.push({
      inlineData: {
        mimeType: image.mimeType,
        data: image.data,
      },
    });
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

    const reply = data.candidates[0]?.content?.parts?.[0]?.text ?? "[Gemini không có phản hồi]";

    await supabase.from("chats").insert([
      {
        session_id: req.headers["x-session-id"] || "anonymous",
        history: [...contents, { role: "model", parts: [{ text: reply }] }],
      },
    ]);

    return res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error.message || error);
    return res.status(500).json({ error: "Gemini API failed. Try again later." });
  }
}
