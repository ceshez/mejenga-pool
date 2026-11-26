import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createServer as createViteServer } from 'vite';

const root = process.cwd();
const text = await readFile(resolve(root, '.env'), 'utf8').catch(() => '');
const env = Object.fromEntries(text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !line.startsWith('#') && line.includes('=')).map((line) => {
  const index = line.indexOf('=');
  return [line.slice(0, index).trim(), line.slice(index + 1).trim().replace(/^["']|["']$/g, '')];
}));
const trustlessKey = env.TRUSTLESS_WORK_API_KEY || env.TRUSTLESS_WORK_API_KEY_ID || '';
const trustlessConfigured = Boolean(trustlessKey);
const trustlessSigner = 'GDXK3KSXBR4SYHJJMRF3EVQKRLZCH3CDSDAT2WJFJBK4IC2PXAMM3ZWL';
const trustlessEscrowId = 'CADIYI2MPDEMH7EBYSAMDKC5E44FN4FIQ4EBXJB2R234WIVIKVNOKZ4Z';
const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'mpa' });

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/') {
    response.writeHead(302, { location: '/web/' }); response.end(); return;
  }
  if (url.pathname === '/api/trustless/status') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ configured: trustlessConfigured, network: 'testnet' })); return;
  }
  if (url.pathname === '/api/trustless/escrow') {
    if (!trustlessConfigured) { response.writeHead(503); response.end(); return; }
    try {
      const endpoint = new URL('https://dev.api.trustlesswork.com/helper/get-escrows-by-signer');
      endpoint.searchParams.set('signer', trustlessSigner);
      const upstream = await fetch(endpoint, { headers: { 'x-api-key': trustlessKey } });
      if (!upstream.ok) throw new Error('Trustless Work rechazó la consulta.');
      const items = await upstream.json();
      const escrow = Array.isArray(items) ? items.find((item) => item.contractId === trustlessEscrowId) : null;
      response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(JSON.stringify(escrow ? { found: true, contractId: escrow.contractId, title: escrow.title, amount: escrow.amount, balance: escrow.balance, isActive: escrow.isActive } : { found: false }));
    } catch {
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'No se pudo consultar el escrow de Trustless Work.' }));
    }
    return;
  }
  if (url.pathname === '/api/stellar') {
    if (request.method !== 'POST') { response.writeHead(405); response.end(); return; }
    let body = '';
    for await (const chunk of request) {
      body += chunk;
      if (body.length > 1_000_000) { response.writeHead(413); response.end(); return; }
    }
    try {
      const upstream = await fetch('https://soroban-testnet.stellar.org', {
        method: 'POST', headers: { 'content-type': 'application/json' }, body,
      });
      response.writeHead(upstream.status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
      response.end(await upstream.text());
    } catch {
      response.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ error: 'No se pudo conectar con Stellar Testnet.' }));
    }
    return;
  }
  vite.middlewares(request, response, () => {
    response.writeHead(404); response.end('No encontrado');
  });
}).listen(4173, '127.0.0.1', () => console.log('MejengaPool: http://localhost:4173/web/'));
