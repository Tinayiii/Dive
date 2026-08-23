import { mkdir, writeFile } from 'node:fs/promises';

const worker = `const immutableAsset = /\\\\.[a-f0-9]{8,}\\\\.(css|js|png|jpg|jpeg|webp|svg|woff2?)$/i;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    let response = await env.ASSETS.fetch(request);

    if (response.status === 404 && request.method === 'GET' && !url.pathname.includes('.')) {
      response = await env.ASSETS.fetch(new Request(new URL('/index.html', url), request));
    }

    if (response.ok && immutableAsset.test(url.pathname)) {
      response = new Response(response.body, response);
      response.headers.set('cache-control', 'public, max-age=31536000, immutable');
    }

    return response;
  },
};
`;

await mkdir('dist/server', { recursive: true });
await writeFile('dist/server/index.js', worker);
