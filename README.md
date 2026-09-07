# 🧠 MindChat — AI-Powered Mental Health Chat Assistant

**Live demo:** https://ai-powered-mental-health-chat-assistant.onrender.com/

> A compassionate AI companion that offers empathetic, judgment-free conversations to support emotional well-being — powered by Gemini.

---

## ✨ Features

- 💬 **Real-time AI chat** — powered by Google Gemini
- 😊 **Mood selector** — log how you're feeling before chatting
- 🌿 **Calm UI** — teal-green palette with full dark mode support
- 🆘 **Crisis resources** — 988 Lifeline surfaces automatically when needed
- 📱 **Fully responsive** — mobile, tablet, and desktop ready
- 🔒 **No data stored** — conversation lives only in-memory

---

## 🚀 Getting Started

### 1. Clone the repo
```bash
git clone https://github.com/Anna-Vida/AI-Powered-Mental-Health-Chat-Assistant.git
cd AI-Powered-Mental-Health-Chat-Assistant
```

### 2. Add your Gemini API key
Put your key in `.env`:
```js
GEMINI_API_KEY=your_key_here
```

> ⚠️ Never commit your real API key to GitHub. The server reads it from `.env`; it is never sent to browser code.

### 3. Run locally
```bash
node server.js
```
Then open `http://localhost:3000`.

### 4. Publish for mobile and web browsers
The chat needs a Node server because the Gemini key must remain private. To publish it:

1. Create a web service on [Render](https://render.com) from this GitHub repository.
2. Render will detect `render.yaml` and use `node server.js`.
3. Add `GEMINI_API_KEY` under the service's environment variables.
4. Deploy and open the generated `onrender.com` URL on any phone or computer.

GitHub Pages cannot run the chat server, so it is not suitable for the complete app.

---

## 🗂 Project Structure

Mental Health/
├── index.html # App shell & markup
├── src/
│ ├── app.js # Chat logic & API calls
│ └── style.css # All styles (light + dark mode)
├── public/
│ └── favicon.svg # App icon
├── .gitignore
└── README.md


---

## ⚠️ Disclaimer

MindChat is **not a replacement** for professional mental health care. If you or someone you know is in crisis:

- 📞 **988 Suicide & Crisis Lifeline** — call or text `988` (US)
- 💬 **Crisis Text Line** — text `HOME` to `741741`
- 🌍 **International** — [findahelpline.com](https://findahelpline.com)

---

## 📄 License

MIT © Anna Vida