const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

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
    sendJson(response, 200, { content: [{ text: reply || "I'm here with you. Can you tell me more?" }] });
  } catch (error) {
    console.error('Chat proxy error:', error);
    sendJson(response, 400, { error: 'Invalid chat request' });
  }
}

const server = http.createServer((request, response) => {
  if (request.method === 'POST' && request.url === '/api/chat') {
    handleChat(request, response);
  } else if (request.method === 'GET') {
    serveFile(request, response);
  } else {
    response.writeHead(405);
    response.end('Method not allowed');
  }
});

server.listen(PORT, () => {
  console.log(`MindChat running at http://localhost:${PORT}`);
});