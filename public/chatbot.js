const messagesDiv = document.getElementById("messages");
const promptInput = document.getElementById("prompt");
const fileInput = document.getElementById("fileInput");
const localKey = "chat_history";
let history = [];

window.onload = () => {
  const saved = localStorage.getItem(localKey);
  if (saved) {
    const parsed = JSON.parse(saved);
    parsed.forEach(msg => {
      addMessage(msg.sender, formatMarkdown(msg.text), true);
    });
    history = parsed
      .filter(m => m.sender === "You" || m.sender === "Bot")
      .map(m => ({
        role: m.sender === "You" ? "user" : "model",
        parts: [{ text: m.text }],
      }));
  }
  if (localStorage.getItem("darkMode") === "true") {
    document.body.classList.add("dark");
  }
};

// Handle Enter to send, Shift+Enter to newline
promptInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

async function sendMessage() {
  const prompt = promptInput.value.trim();
  const model = document.getElementById("model").value;
  const files = Array.from(fileInput.files);

  if (!prompt && files.length === 0) return;

  addMessage("You", prompt || "[Đã gửi tệp/ảnh]");
  promptInput.value = "";
  fileInput.value = "";

  const thinking = addMessage("Bot", "<em>Đang suy nghĩ...</em>", true);

  // Convert all files to base64
  const encodedFiles = await Promise.all(
    files.map(file => toBase64(file).then(data => ({
      data,
      mimeType: file.type,
      name: file.name,
    })))
  );

  try {
    const res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, model, history, files: encodedFiles }),
    });

    const data = await res.json();
    const reply = data.reply || "Không có phản hồi.";
    updateMessage(thinking, formatMarkdown(reply));

    history.push({ role: "user", parts: [{ text: prompt }] });
    history.push({ role: "model", parts: [{ text: reply }] });

    saveToLocal();
  } catch (err) {
    updateMessage(thinking, "❌ Lỗi khi gọi API.");
  }
}

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function addMessage(sender, text, isHTML = false) {
  const msgDiv = document.createElement("div");
  msgDiv.className = "msg";

  const avatar = document.createElement("span");
  avatar.style.fontSize = "1.5em";
  avatar.style.marginRight = "8px";
  avatar.textContent = sender === "You" ? "🧑" : "🤖";

  const senderSpan = document.createElement("div");
  senderSpan.className = "user";
  senderSpan.textContent = `${sender}:`;

  const contentDiv = document.createElement("div");
  contentDiv.className = "bot";
  contentDiv.innerHTML = isHTML ? text : escapeHTML(text);

  // Detect image URLs and append preview
  if (sender === "You" && fileInput.files.length > 0) {
    Array.from(fileInput.files).forEach(file => {
      if (file.type.startsWith("image/")) {
        const img = document.createElement("img");
        img.src = URL.createObjectURL(file);
        img.style.maxWidth = "100%";
        img.style.marginTop = "10px";
        contentDiv.appendChild(img);
      }
    });
  }

  if (sender === "Bot") {
    const copyBtn = document.createElement("button");
    copyBtn.className = "copy-btn";
    copyBtn.textContent = "📋 Copy";
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(contentDiv.textContent);
      copyBtn.textContent = "✅ Copied!";
      setTimeout(() => (copyBtn.textContent = "📋 Copy"), 1500);
    };
    msgDiv.appendChild(copyBtn);
  }

  msgDiv.appendChild(avatar);
  msgDiv.appendChild(senderSpan);
  msgDiv.appendChild(contentDiv);
  messagesDiv.appendChild(msgDiv);

  window.scrollTo(0, document.body.scrollHeight);
  return contentDiv;
}

function updateMessage(node, newText) {
  node.innerHTML = newText;
  window.scrollTo(0, document.body.scrollHeight);
}

function resetChat() {
  messagesDiv.innerHTML = "";
  history = [];
  localStorage.removeItem(localKey);
}

function toggleDarkMode() {
  document.body.classList.toggle("dark");
  localStorage.setItem("darkMode", document.body.classList.contains("dark"));
}

function formatMarkdown(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\n/g, "<br>");
}

function escapeHTML(str) {
  return str.replace(/[&<>'"]/g, tag => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;',
    "'": '&#39;', '"': '&quot;',
  }[tag]));
}

function saveToLocal() {
  const saved = history.map(h => ({
    sender: h.role === "user" ? "You" : "Bot",
    text: h.parts[0].text
  }));
  localStorage.setItem(localKey, JSON.stringify(saved));
}

function exportChat() {
  const saved = localStorage.getItem(localKey);
  if (!saved) return alert("Không có hội thoại để xuất.");
  const messages = JSON.parse(saved);
  const lines = messages.map(m => `${m.sender}: ${m.text}`).join("\n\n");
  const blob = new Blob([lines], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chat_history.txt";
  a.click();
  URL.revokeObjectURL(url);
}

