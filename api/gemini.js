const DEFAULT_MODEL = "gemini-1.5-flash";
import supabase from "../lib/supabase";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed", route: "gemini.js", code: "METHOD_NOT_ALLOWED" });
  }

  const { prompt, model, history, parts } = req.body;

  if (!prompt?.trim() && !parts) {
    return res.status(400).json({ error: "Prompt or parts required", route: "gemini.js", code: "MISSING_INPUT" });
  }

  if (prompt?.length > 10000) {
    return res.status(400).json({ error: "Prompt exceeds 10,000 characters", route: "gemini.js", code: "PROMPT_TOO_LONG" });
  }

  if (parts && parts.some(p => p.inlineData && p.inlineData.data?.length > 5 * 1024 * 1024)) {
    return res.status(400).json({ error: "Image size exceeds 5MB limit", route: "gemini.js", code: "IMAGE_TOO_LARGE" });
  }

  const modelName = model || DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "Missing Gemini API key", route: "gemini.js", code: "MISSING_API_KEY" });
  }

  const contents = Array.isArray(history) ? [...history] : [];
  const userParts = [];

  if (parts) {
    userParts.push(...parts);
  } else if (prompt?.trim()) {
    userParts.push({ text: prompt.trim() });
  }

  contents.push({ role: "user", parts: userParts });

  console.log("Sending to Gemini API:", { model: modelName, contents });

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
    console.log("Gemini API response:", JSON.stringify(data, null, 2));

    if (!response.ok) {
      if (response.status === 429) {
        return res.status(429).json({
          error: "Quota exceeded. Try gemini-1.5-flash or upgrade to pay-as-you-go.",
          route: "gemini.js",
          code: "QUOTA_EXCEEDED",
          details: data?.error?.details || null,
        });
      }
      return res.status(response.status).json({
        error: data?.error?.message || "Gemini API request failed",
        route: "gemini.js",
        code: data?.error?.code || "API_RESPONSE_ERROR",
        details: data?.error?.details || null,
      });
    }

    if (!data?.candidates?.length || !data.candidates[0]?.content?.parts?.length) {
      return res.status(500).json({
        error: "No valid response from Gemini API",
        route: "gemini.js",
        code: "NO_CANDIDATE_RESPONSE",
        response: data,
      });
    }

    const reply = data.candidates[0].content.parts[0].text ?? "[Gemini không có phản hồi]";

    const { error } = await supabase.from("chats").insert([
      {
        session_id: req.headers["x-session-id"] || "anonymous",
        history: [...contents, { role: "model", parts: [{ text: reply }] }],
      },
    ]);

    if (error) {
      console.error("Supabase error:", { message: error.message, code: error.code, details: error.details });
      return res.status(500).json({
        error: `Failed to save chat: ${error.message}`,
        route: "gemini.js",
        code: "SUPABASE_ERROR",
        details: error.details || null,
      });
    }

    return res.status(200).json({ reply, history: [...contents, { role: "model", parts: [{ text: reply }] }] });
  } catch (error) {
    console.error("Gemini API error:", error.message || error);
    return res.status(500).json({
      error: "Gemini API failed. Try again later.",
      route: "gemini.js",
      code: "API_REQUEST_FAILED",
      details: error.message,
    });
  }
}
