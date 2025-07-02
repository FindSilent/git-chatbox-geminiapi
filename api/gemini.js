const DEFAULT_MODEL = "gemini-1.5-pro"; // hỗ trợ ảnh tốt hơn
import supabase from "../lib/supabase"; // chỉnh đúng path nếu cần

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", code: "METHOD_NOT_ALLOWED" });
  }

  const { prompt, model, history, image } = req.body;

  // Kiểm tra input
  if (!prompt?.trim() && !image) {
    return res.status(400).json({ error: "Prompt or image is required", code: "MISSING_INPUT" });
  }

  // Giới hạn kích thước
  if (prompt?.length > 10000) {
    return res.status(400).json({ error: "Prompt exceeds 10,000 characters", code: "PROMPT_TOO_LONG" });
  }
  if (image?.data?.length > 5 * 1024 * 1024) {
    return res.status(400).json({ error: "Image size exceeds 5MB limit", code: "IMAGE_TOO_LARGE" });
  }

  const modelName = model || DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing Gemini API key", code: "MISSING_API_KEY" });
  }

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
      return res.status(response.status).json({
        error: data?.error?.message || "No candidate response",
        code: data?.error?.code || "API_RESPONSE_ERROR",
      });
    }

    const reply = data.candidates[0]?.content?.parts?.[0]?.text ?? "[Gemini không có phản hồi]";

    // Lưu vào Supabase (chỉ lưu tin nhắn mới)
    const { error } = await supabase.from("messages").insert([
      {
        session_id: req.headers["x-session-id"] || "anonymous",
        user_message: prompt?.trim() || "[Image uploaded]",
        bot_reply: reply,
        timestamp: new Date().toISOString(),
      },
    ]);

    if (error) {
      console.error("Supabase error:", error.message);
      return res.status(500).json({ error: "Failed to save chat to database", code: "SUPABASE_ERROR" });
    }

    return res.status(200).json({ reply, history: [...contents, { role: "model", parts: [{ text: reply }] }] });
  } catch (error) {
    console.error("Gemini API error:", error.message || error);
    return res.status(500).json({ error: "Gemini API failed. Try again later.", code: "API_REQUEST_FAILED" });
  }
}
