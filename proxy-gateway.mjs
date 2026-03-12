#!/usr/bin/env node
/**
 * Mini API Gateway - substitui o Nginx para testes locais.
 * Roteia /auth/v1/ → GoTrue (9999) e /rest/v1/ → PostgREST (3000)
 * 
 * Uso: node proxy-gateway.mjs [porta]
 * Padrão: porta 54321
 */

import http from 'http';

const PORT = parseInt(process.argv[2] || '54321', 10);

const ROUTES = {
  '/auth/v1/': { host: '127.0.0.1', port: 9999, strip: '/auth/v1' },
  '/rest/v1/': { host: '127.0.0.1', port: 3000, strip: '/rest/v1' },
  '/functions/v1/': { host: '127.0.0.1', port: 8000, strip: '/functions/v1' },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
};

function findRoute(url) {
  for (const [prefix, config] of Object.entries(ROUTES)) {
    if (url.startsWith(prefix)) {
      return { ...config, path: url.replace(config.strip, '') || '/' };
    }
  }
  return null;
}

const server = http.createServer((req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS_HEADERS);
    res.end();
    return;
  }

  const route = findRoute(req.url || '/');
  if (!route) {
    res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found', available: Object.keys(ROUTES) }));
    return;
  }

  const options = {
    hostname: route.host,
    port: route.port,
    path: route.path,
    method: req.method,
    headers: { ...req.headers, host: `${route.host}:${route.port}` },
  };

  const proxy = http.request(options, (proxyRes) => {
    const headers = { ...proxyRes.headers, ...CORS_HEADERS };
    res.writeHead(proxyRes.statusCode || 500, headers);
    proxyRes.pipe(res);
  });

  proxy.on('error', (err) => {
    console.error(`[Proxy] Error → ${route.host}:${route.port}${route.path}:`, err.message);
    res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Service unavailable', target: `${route.host}:${route.port}`, detail: err.message }));
  });

  req.pipe(proxy);
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 API Gateway rodando em http://0.0.0.0:${PORT}`);
  console.log(`   /auth/v1/      → 127.0.0.1:9999 (GoTrue)`);
  console.log(`   /rest/v1/      → 127.0.0.1:3000 (PostgREST)`);
  console.log(`   /functions/v1/ → 127.0.0.1:8000 (Deno)\n`);
});
