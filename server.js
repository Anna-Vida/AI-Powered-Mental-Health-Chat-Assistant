const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Pool } = require('pg');

const ROOT_DIR = __dirname;
const PORT = process.env.PORT || 3000;
const MODEL = 'gemini-2.5-flash';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

function loadEnv() {
  const envPath = path.join(ROOT_DIR, '.env');
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
    }
  }
}

loadEnv();

const database = process.env.DATABASE_URL
  ? new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  })
  : null;

async function initializeDatabase() {
  if (!database) return;
  await database.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id UUID NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);
}

async function saveMessages(conversationId, userMessage, assistantMessage) {
  if (!database || !conversationId) return;
  await database.query(
    'INSERT INTO chat_messages (conversation_id, role, content) VALUES ($1, $2, $3), ($1, $4, $5)',
    [conversationId, 'user', userMessage, 'assistant', assistantMessage],
  );
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

function serveFile(request, response) {
  const requestedPath = request.url === '/' ? '/index.html' : request.url;
  const filePath = path.resolve(ROOT_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(ROOT_DIR) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    response.writeHead(404);
    response.end('Not found');
    return;
  }

  const contentTypes = {
    '.css': 'text/css',
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.svg': 'image/svg+xml',
  };
  response.writeHead(200, { 'Content-Type': contentTypes[path.extname(filePath)] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(response);
}

function readBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', chunk => { body += chunk; });
    request.on('end', () => resolve(JSON.parse(body)));
    request.on('error', reject);
  });
}

async function handleChat(request, response) {
  if (!process.env.GEMINI_API_KEY) {
    sendJson(response, 500, { error: 'GEMINI_API_KEY is missing from .env' });
    return;
  }

  try {
    const requestBody = await readBody(request);
    const contents = requestBody.messages.map(message => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: message.content }],
    }));
    const geminiResponse = await fetch(
      `${GEMINI_API_URL}/${MODEL}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`,
      {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: requestBody.system }] },
        contents,
        generationConfig: { maxOutputTokens: 1000 },
      }),
      },
    );

    const responseBody = await geminiResponse.json();
    if (!geminiResponse.ok) {
      sendJson(response, geminiResponse.status, responseBody);
      return;
    }

    const reply = responseBody.candidates?.[0]?.content?.parts
      ?.map(part => part.text || '')
      .join('')
      .trim();
    const finalReply = reply || "I'm here with you. Can you tell me more?";
    sendJson(response, 200, { content: [{ text: finalReply }] });
    saveMessages(requestBody.conversationId, requestBody.messages.at(-1)?.content, finalReply)
      .catch(error => console.error('Message save error:', error));
  } catch (error) {
    console.error('Chat proxy error:', error);
    sendJson(response, 400, { error: 'Invalid chat request' });
  }
}

async function handleAdminConversations(request, response) {
  if (!database) {
    sendJson(response, 503, { error: 'DATABASE_URL is missing from the server environment' });
    return;
  }
  if (!process.env.ADMIN_TOKEN || request.headers['x-admin-token'] !== process.env.ADMIN_TOKEN) {
    sendJson(response, 401, { error: 'Unauthorized' });
    return;
  }

  const result = await database.query(
    'SELECT id, conversation_id, role, content, created_at FROM chat_messages ORDER BY created_at DESC LIMIT 500',
  );
  sendJson(response, 200, result.rows);
}

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/chat') {
    handleChat(request, response);
  } else if (request.method === 'GET' && request.url === '/api/admin/conversations') {
    handleAdminConversations(request, response).catch(error => {
      console.error('Admin query error:', error);
      sendJson(response, 500, { error: 'Could not load conversations' });
    });
  } else if (request.method === 'GET') {
    serveFile(request, response);
  } else {
    response.writeHead(405);
    response.end('Method not allowed');
  }
});

initializeDatabase()
  .then(() => server.listen(PORT, () => {
    console.log(`MindChat running at http://localhost:${PORT}`);
  }))
  .catch(error => {
    console.error('Database initialization error:', error);
    process.exit(1);
  });