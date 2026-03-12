#!/usr/bin/env node
/**
 * Mini API Gateway - substitui o Nginx para testes locais.
 * Roteia /auth/v1/ → GoTrue (9999), /rest/v1/ → PostgREST (3000)
 * e /functions/v1/ → Lovable Cloud (HTTPS proxy)
 * 
 * Uso: node proxy-gateway.mjs [porta]
 * Padrão: porta 54321
 */

import http from 'http';
import https from 'https';

const PORT = parseInt(process.argv[2] || '54321', 10);

// Cloud URL for edge functions (change if using local Deno)
const CLOUD_FUNCTIONS_HOST = 'pbjyudhxnhtxiblhkwgh.supabase.co';

const LOCAL_ROUTES = {
  '/auth/v1/': { host: '127.0.0.1', port: 9999, strip: '/auth/v1' },
  '/rest/v1/': { host: '127.0.0.1', port: 3000, strip: '/rest/v1' },
};

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'authorization,x-client-info,apikey,content-type,x-supabase-client-platform,x-supabase-client-platform-version,x-supabase-client-runtime,x-supabase-client-runtime-version',
};

function findLocalRoute(url) {
  for (const [prefix, config] of Object.entries(LOCAL_ROUTES)) {
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

  const url = req.url || '/';

  // Route /functions/v1/* → Cloud via HTTPS
  if (url.startsWith('/functions/v1/')) {
    const options = {
      hostname: CLOUD_FUNCTIONS_HOST,
      port: 443,
      path: url,
      method: req.method,
      headers: {
        ...req.headers,
        host: CLOUD_FUNCTIONS_HOST,
      },
    };
    // Remove connection-specific headers
    delete options.headers['connection'];
    delete options.headers['keep-alive'];

    const proxy = https.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers, ...CORS_HEADERS };
      res.writeHead(proxyRes.statusCode || 500, headers);
      proxyRes.pipe(res);
    });

    proxy.on('error', (err) => {
      console.error(`[Proxy] Cloud error → ${url}:`, err.message);
      res.writeHead(502, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Cloud function unavailable', detail: err.message }));
    });

    req.pipe(proxy);
    return;
  }

  // Local routes (auth, rest)
  const route = findLocalRoute(url);
  if (!route) {
    res.writeHead(404, { ...CORS_HEADERS, 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Route not found', available: [...Object.keys(LOCAL_ROUTES), '/functions/v1/'] }));
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
  console.log(`   /functions/v1/ → ${CLOUD_FUNCTIONS_HOST} (Cloud HTTPS)\n`);
});
