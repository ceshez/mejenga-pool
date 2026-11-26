import { createServer } from 'node:http';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { Networks, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
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
const usdcContract = 'CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA';
const usdcIssuer = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';
const contributionsFile = resolve(root, 'data', 'contributions.json');
const contributions = await readFile(contributionsFile, 'utf8').then(JSON.parse).catch(() => ({}));
const pending = new Map();
const vite = await createViteServer({ root, server: { middlewareMode: true }, appType: 'mpa' });

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) {
    body += chunk;
    if (body.length > 200_000) throw new Error('Solicitud demasiado grande.');
  }
  return JSON.parse(body || '{}');
}

async function trustless(path, body) {
  if (!trustlessConfigured) throw new Error('Falta TRUSTLESS_WORK_API_KEY en .env.');
  const response = await fetch(`https://dev.api.trustlesswork.com${path}`, {
    method: body ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json', 'x-api-key': trustlessKey },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(20_000),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Trustless Work respondió ${response.status}: ${String(result.message || result.error || 'revisá los datos').slice(0, 180)}`);
  return result;
}

async function escrowsOf(signer) {
  if (!StrKey.isValidEd25519PublicKey(signer)) throw new Error('Wallet pública inválida.');
  const items = await trustless(`/helper/get-escrows-by-signer?signer=${encodeURIComponent(signer)}`);
  return Array.isArray(items) ? items.filter((item) => item?.trustline?.address === usdcIssuer || item?.trustline?.contractId === usdcContract) : [];
}

function publicEscrow(item) {
  return {
    contractId: item.contractId, signer: item.signer, engagementId: item.engagementId,
    title: item.title, description: item.description, amount: item.amount,
    balance: item.balance, roles: item.roles, flags: item.flags,
    trustline: item.trustline, isActive: item.isActive,
    playersHere: Object.keys(contributions[item.contractId] || {}).length,
    contributors: Object.keys(contributions[item.contractId] || {}),
  };
}

function usdcAmount(value) {
  const text = String(value);
  if (!/^\d+(\.\d{1,7})?$/.test(text)) throw new Error('Ingresá un monto válido de USDC.');
  const amount = Number(text);
  if (amount <= 0 || !Number.isSafeInteger(Math.round(amount * 1e7))) throw new Error('Monto fuera de rango.');
  return amount;
}

const transactionHash = (xdr) => TransactionBuilder.fromXDR(xdr, Networks.TESTNET).hash().toString('hex');

createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname === '/') {
    response.writeHead(302, { location: '/web/' }); response.end(); return;
  }
  if (url.pathname === '/api/trustless/status') {
    response.writeHead(200, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ configured: trustlessConfigured, network: 'testnet' })); return;
  }
  if (url.pathname === '/api/trustless/escrows' && request.method === 'GET') {
    try { sendJson(response, 200, { escrows: (await escrowsOf(url.searchParams.get('signer') || '')).map(publicEscrow) }); }
    catch (error) { sendJson(response, 502, { error: error.message }); }
    return;
  }
  if (url.pathname === '/api/trustless/prepare' && request.method === 'POST') {
    try {
      const data = await readBody(request);
      const signer = String(data.signer || '');
      if (!StrKey.isValidEd25519PublicKey(signer)) throw new Error('Conectá una wallet pública válida.');
      let path, payload, escrowId = null, amount, owner = null, deadline = null;
      if (data.kind === 'create') {
        const home = String(data.home || '').trim();
        const away = String(data.away || '').trim();
        const receiver = String(data.receiver || '');
        const players = Number(data.players);
        deadline = Number(data.deadline);
        amount = usdcAmount(data.amount);
        if (!home || !away || `${home} vs ${away}`.length > 40 || !StrKey.isValidEd25519PublicKey(receiver) || receiver === signer || !Number.isInteger(players) || players < 2 || players > 100 || !Number.isInteger(deadline) || deadline < Date.now() / 1000 + 60) throw new Error('Revisá equipos, cancha, cupo y fecha límite.');
        path = '/deployer/single-release';
        payload = {
          signer, engagementId: `mejenga-${randomUUID()}`, title: `${home} vs ${away}`,
          description: `MejengaPool|limite=${deadline}|cupo=${players}`,
          roles: { approver: signer, serviceProvider: receiver, platformAddress: signer, releaseSigner: signer, disputeResolver: signer, receiver },
          amount, platformFee: 0, trustline: { address: usdcIssuer, symbol: 'USDC' },
          milestones: [{ description: `Reserva de cancha para ${home} vs ${away}` }],
        };
      } else if (data.kind === 'fund') {
        escrowId = String(data.contractId || '');
        owner = String(data.owner || '');
        if (!StrKey.isValidContract(escrowId)) throw new Error('Escrow inválido.');
        amount = usdcAmount(data.amount);
        const escrow = (await escrowsOf(owner)).find((item) => item.contractId === escrowId);
        if (!escrow) throw new Error('El escrow no aparece en el índice de Trustless Work.');
        const remaining = Math.round((Number(escrow.amount) - Number(escrow.balance || 0)) * 1e7);
        if (Math.round(amount * 1e7) > remaining) throw new Error('El aporte supera lo que falta para la meta.');
        deadline = Number(String(escrow.description || '').match(/limite=(\d+)/)?.[1] || 0) || null;
        if (deadline && Date.now() / 1000 >= deadline) throw new Error('El plazo de esta mejenga venció.');
        const cupo = Number(String(escrow.description || '').match(/cupo=(\d+)/)?.[1] || 0);
        const current = contributions[escrowId] || {};
        if (cupo && !current[signer] && Object.keys(current).length >= cupo) throw new Error('El cupo de jugadores está lleno.');
        path = '/escrow/single-release/fund-escrow';
        payload = { contractId: escrowId, signer, amount };
      } else throw new Error('Operación desconocida.');
      const prepared = await trustless(path, payload);
      if (typeof prepared.unsignedTransaction !== 'string') throw new Error('Trustless Work no devolvió una transacción para firmar.');
      const ticket = randomUUID();
      pending.set(ticket, { hash: transactionHash(prepared.unsignedTransaction), signer, kind: data.kind, escrowId, owner, amount, deadline, expires: Date.now() + 120_000 });
      sendJson(response, 200, { unsignedTransaction: prepared.unsignedTransaction, ticket });
    } catch (error) { sendJson(response, 400, { error: error.message }); }
    return;
  }
  if (url.pathname === '/api/trustless/send' && request.method === 'POST') {
    try {
      const { signedXdr, ticket } = await readBody(request);
      const entry = pending.get(ticket);
      if (!entry || Date.now() > entry.expires || typeof signedXdr !== 'string' || signedXdr.length > 100_000 || transactionHash(signedXdr) !== entry.hash) throw new Error('La firma no corresponde a la operación preparada.');
      pending.delete(ticket);
      if (entry.deadline && Date.now() / 1000 >= entry.deadline) throw new Error('El plazo venció antes de enviar la transacción.');
      if (entry.kind === 'fund') {
        const escrow = (await escrowsOf(entry.owner)).find((item) => item.contractId === entry.escrowId);
        if (!escrow || Math.round(entry.amount * 1e7) > Math.round((Number(escrow.amount) - Number(escrow.balance || 0)) * 1e7)) throw new Error('La meta cambió; revisá el saldo antes de firmar de nuevo.');
      }
      const result = await trustless('/helper/send-transaction', { signedXdr });
      if (result.status !== 'SUCCESS') throw new Error(String(result.message || 'La transacción no se confirmó.'));
      if (entry.kind === 'fund') {
        contributions[entry.escrowId] ||= {};
        contributions[entry.escrowId][entry.signer] = true;
        await mkdir(resolve(root, 'data'), { recursive: true });
        await writeFile(contributionsFile, JSON.stringify(contributions, null, 2));
      }
      sendJson(response, 200, { status: result.status, contractId: result.contractId || entry.escrowId, escrow: result.escrow ? publicEscrow(result.escrow) : null });
    } catch (error) { sendJson(response, 400, { error: error.message }); }
    return;
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
}).listen(Number(process.env.PORT || 4173), '127.0.0.1', () => console.log(`MejengaPool: http://127.0.0.1:${process.env.PORT || 4173}/web/`));
