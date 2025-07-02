const DEFAULT_MODEL = "gemini-2.0-flash";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { prompt, model, history } = req.body;

  if (!prompt) {
    return res.status(400).json({ error: "Prompt is required" });
  }

  const modelName = model || DEFAULT_MODEL;
  const apiKey = process.env.GEMINI_API_KEY;

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

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text || "[Empty Gemini reply]";

    res.status(200).json({ reply });
  } catch (error) {
    console.error("Gemini API error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
