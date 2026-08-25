import { mkdir, readFile, writeFile } from 'node:fs/promises';

let html = await readFile('dist/index.html', 'utf8');
const scriptMatch = html.match(/<script type="module" crossorigin src="([^"]+)"><\/script>/);
const styleMatch = html.match(/<link rel="stylesheet" crossorigin href="([^"]+)">/);

if (!scriptMatch || !styleMatch) {
  throw new Error('Could not find Vite entry assets in dist/index.html');
}

const script = await readFile(`dist${scriptMatch[1]}`, 'utf8');
const style = await readFile(`dist${styleMatch[1]}`, 'utf8');

html = html
  .replace(styleMatch[0], `<style>${style}</style>`)
  .replace(scriptMatch[0], `<script type="module">${script}</script>`);

const worker = `const appHtml = ${JSON.stringify(html)};
const immutableAsset = /\\\\.[a-f0-9]{8,}\\\\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i;
const htmlHeaders = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'no-store',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'GET' && !url.pathname.includes('.')) {
      return new Response(appHtml, { headers: htmlHeaders });
    }

    const response = await env.ASSETS.fetch(request);
    if (response.ok && immutableAsset.test(url.pathname)) {
      const cached = new Response(response.body, response);
      cached.headers.set('cache-control', 'public, max-age=31536000, immutable');
      return cached;
    }

    return response;
  },
};
`;

await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', worker);
