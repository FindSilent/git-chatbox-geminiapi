// File: main.js
const chatBox = document.getElementById("chat-box");
const form = document.getElementById("chat-form");
const promptInput = document.getElementById("prompt");
const thinking = document.getElementById("thinking");
const imageUpload = document.getElementById("image-upload");
const exportBtn = document.getElementById("export-txt");
const resetBtn = document.getElementById("reset-chat");
const toggleDark = document.getElementById("toggle-dark");
const recordBtn = document.getElementById("record-btn");

const sessionId = localStorage.getItem("session_id") || crypto.randomUUID();
localStorage.setItem("session_id", sessionId);

let chatHistory = [];
let selectedImage = null;
let recognition;

function renderMessage(role, text) {
  const div = document.createElement("div");
  div.className = `message ${role}`;
  div.textContent = `${text}`;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage(prompt) {
  renderMessage("user", prompt);
  thinking.textContent = "Thinking...";

  const res = await fetch("/api/gemini", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt,
      model: "gemini-2.0-flash",
      imageBase64: selectedImage,
      history: chatHistory,
      sessionId,
    }),
  });

  const data = await res.json();
  if (data.reply) {
    renderMessage("bot", data.reply);
    chatHistory.push({ role: "user", parts: [{ text: prompt }] });
    chatHistory.push({ role: "model", parts: [{ text: data.reply }] });
  } else {
    renderMessage("bot", "❌ Lỗi API");
  }

  thinking.textContent = "";
  selectedImage = null;
}

form.addEventListener("submit", (e) => {
  e.preventDefault();
  const prompt = promptInput.value.trim();
  if (!prompt) return;
  sendMessage(prompt);
  promptInput.value = "";
});

imageUpload.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => selectedImage = reader.result.split(",")[1];
  reader.readAsDataURL(file);
});

exportBtn.addEventListener("click", () => {
  const text = chatHistory.map(h => `${h.role === "user" ? "You" : "Bot"}: ${h.parts[0].text}`).join("\n\n");
  const blob = new Blob([text], { type: "text/plain" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `chat-${sessionId}.txt`;
  link.click();
});

resetBtn.addEventListener("click", () => {
  chatHistory = [];
  chatBox.innerHTML = "";
});

toggleDark.addEventListener("click", () => {
  document.body.classList.toggle("dark-mode");
});

recordBtn.addEventListener("click", () => {
  if (!('webkitSpeechRecognition' in window)) {
    alert("Trình duyệt không hỗ trợ ghi âm.");
    return;
  }
  recognition = new webkitSpeechRecognition();
  recognition.lang = 'vi-VN';
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    promptInput.value = transcript;
  };
  recognition.start();
});

// Load lịch sử từ Supabase nếu có session
(async function loadHistory() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/chats?session_id=eq.${sessionId}&order=created_at.asc`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    },
  });
  const chats = await res.json();
  if (chats.length > 0) {
    const history = JSON.parse(chats[chats.length - 1].history);
    history.forEach(h => renderMessage(h.role === "user" ? "user" : "bot", h.parts[0].text));
    chatHistory = history;
  }
})();
