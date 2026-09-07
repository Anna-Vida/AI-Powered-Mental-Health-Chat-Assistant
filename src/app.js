// ─── MindChat — AI Mental Health Companion ───────────────────
// Powered by Claude (claude-sonnet-4-6) via Anthropic API
// ─────────────────────────────────────────────────────────────

const CHAT_API_URL = '/api/chat';

const SYSTEM_PROMPT = `You are MindChat, a warm, empathetic AI mental health companion. Your role is to:
- Listen deeply and validate feelings without judgment
- Offer calm, supportive, and compassionate responses
- Ask one thoughtful follow-up question to keep the conversation going
- Suggest gentle coping strategies when appropriate
- NEVER diagnose, prescribe, or replace professional therapy
- If someone seems in crisis, gently encourage them to call or text 988 (US Suicide & Crisis Lifeline)

Keep responses concise (2–4 sentences). Use a calm, caring tone. Respond in plain text only — no markdown formatting.`;

// ─── State ───────────────────────────────────────────────────
let conversationHistory = [];
let currentMood = null;

// ─── DOM References ───────────────────────────────────────────
const messagesEl = document.getElementById('messages');
const inputEl    = document.getElementById('chat-input');
const sendBtn    = document.getElementById('send-btn');
const consentEl  = document.getElementById('save-consent');
const conversationId = localStorage.getItem('mindchat-conversation-id') || crypto.randomUUID();
localStorage.setItem('mindchat-conversation-id', conversationId);

// ─── Mood Selection ───────────────────────────────────────────
document.querySelectorAll('.mood-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentMood = btn.dataset.mood;
  });
});

// ─── Input Handling ───────────────────────────────────────────
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

inputEl.addEventListener('input', () => autoResize(inputEl));

function autoResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 100) + 'px';
}

// ─── DOM Helpers ──────────────────────────────────────────────
function scrollToBottom() {
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addMessage(role, html, resourcesHtml = '') {
  const div = document.createElement('div');
  div.className = `msg ${role}`;

  if (role === 'bot') {
    div.innerHTML = `
      <div class="msg-avatar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
          <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
        </svg>
      </div>
      <div>
        <div class="bubble">${html}</div>
        ${resourcesHtml}
      </div>`;
  } else {
    div.innerHTML = `<div class="bubble">${html}</div>`;
  }

  messagesEl.appendChild(div);
  scrollToBottom();
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'msg bot';
  div.id = 'typing-indicator';
  div.innerHTML = `
    <div class="msg-avatar">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.44 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.98-3A2.5 2.5 0 0 1 9.5 2Z"/>
        <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.44 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.98-3A2.5 2.5 0 0 0 14.5 2Z"/>
      </svg>
    </div>
    <div class="typing">
      <div class="dot"></div>
      <div class="dot"></div>
      <div class="dot"></div>
    </div>`;
  messagesEl.appendChild(div);
  scrollToBottom();
}

function removeTyping() {
  document.getElementById('typing-indicator')?.remove();
}

function buildResourcesHtml(text) {
  const lower = text.toLowerCase();
  const showCrisis = lower.includes('988') || lower.includes('crisis') || lower.includes('professional');
  if (!showCrisis) return '';
  return `
    <div class="resources">
      <a class="resource-pill" href="tel:988">📞 988 Lifeline</a>
      <a class="resource-pill" href="https://www.crisistextline.org" target="_blank" rel="noopener">💬 Crisis Text Line</a>
    </div>`;
}

// ─── Core: Send Message ───────────────────────────────────────
async function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;

  if (!consentEl.checked) {
    addMessage('bot', 'Please check the consent box below if you want this conversation saved.');
    return;
  }

  addMessage('user', text.replace(/\n/g, '<br>'));
  conversationHistory.push({ role: 'user', content: text });

  inputEl.value = '';
  inputEl.style.height = 'auto';
  sendBtn.disabled = true;
  showTyping();

  const moodContext = currentMood
    ? `\n\nNote: The user's current mood is "${currentMood}". Acknowledge this naturally if relevant.`
    : '';

  try {
    const response = await fetch(CHAT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        system: SYSTEM_PROMPT + moodContext,
        messages: conversationHistory,
        conversationId,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text?.trim()
      || "I'm here with you. Can you tell me more about what's going on?";

    conversationHistory.push({ role: 'assistant', content: reply });
    removeTyping();
    addMessage('bot', reply.replace(/\n/g, '<br>'), buildResourcesHtml(reply));

  } catch (err) {
    console.error('MindChat error:', err);
    removeTyping();
    const errorText = err.message.toLowerCase();
    let errorMessage = "I'm having a little trouble connecting right now. Please try again in a moment — I'm still here for you. 💚";
    if (errorText.includes('gemini_api_key is missing')) {
      errorMessage = 'Add GEMINI_API_KEY to .env, then restart the server.';
    } else if (errorText.includes('api key not valid') || errorText.includes('invalid_argument')) {
      errorMessage = 'The Gemini API key is invalid. Check the key in .env and restart the server.';
    } else if (errorText.includes('quota') || errorText.includes('resource_exhausted')) {
      errorMessage = 'The Gemini free quota has been reached. Check your Google AI Studio usage and limits.';
    }
    addMessage('bot', errorMessage);
  }

  sendBtn.disabled = false;
  inputEl.focus();
}

// ─── Send Button ─────────────────────────────────────────────
sendBtn.addEventListener('click', sendMessage);