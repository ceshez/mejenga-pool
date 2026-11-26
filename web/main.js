import {
  Address, BASE_FEE, Contract, Networks, Operation, TransactionBuilder,
  StrKey, nativeToScVal, rpc, scValToNative,
} from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk';
import { AlbedoModule } from '@creit-tech/stellar-wallets-kit/modules/albedo';
import { VarialModule } from '@creit-tech/stellar-wallets-kit/modules/varial';
import { RabetModule } from '@creit-tech/stellar-wallets-kit/modules/rabet';
import { xBullModule } from '@creit-tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit-tech/stellar-wallets-kit/modules/lobstr';
import { HanaModule } from '@creit-tech/stellar-wallets-kit/modules/hana';
import { KleverModule } from '@creit-tech/stellar-wallets-kit/modules/klever';
import { KitEventType, Networks as KitNetworks } from '@creit-tech/stellar-wallets-kit/types';
import { MEJENGA_CONFIG } from './config.js';

const cfg = MEJENGA_CONFIG;
const $ = (id) => document.getElementById(id);
const server = new rpc.Server(`${location.origin}/api/stellar`, { allowHttp: true });
const stroops = 10_000_000n;
const money = (n) => (Number(n) / Number(stroops)).toLocaleString('es-CR', { maximumFractionDigits: 7 });
const short = (a) => `${a.slice(0, 5)}…${a.slice(-5)}`;
const explorer = (id) => `https://stellar.expert/explorer/testnet/contract/${id}`;
const txExplorer = (hash) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
const savedIds = JSON.parse(localStorage.getItem('mejenga-contracts') || '[]').filter((id) => StrKey.isValidContract(id));
let activeId = new URLSearchParams(location.search).get('contract') || cfg.contractId;
if (!StrKey.isValidContract(activeId)) activeId = cfg.contractId;
let address = '';
let state = null;
let ownContribution = 0n;
let busy = false;

StellarWalletsKit.init({
  modules: [new VarialModule(), new xBullModule(), new AlbedoModule(), new RabetModule(), new LobstrModule(), new HanaModule(), new KleverModule()],
  network: KitNetworks.TESTNET,
});
StellarWalletsKit.on(KitEventType.STATE_UPDATED, ({ payload }) => {
  address = payload.address || '';
  updateWallet();
  if (state) refreshOwn().catch(() => {});
});
StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
  address = '';
  ownContribution = 0n;
  updateWallet();
});

function message(value, error = false, target = 'tx-message') {
  $(target).textContent = value;
  $(target).classList.toggle('error', error);
}

function updateWallet() {
  $('wallet-button-label').textContent = address ? short(address) : 'Conectar wallet';
  $('wallet-button').classList.toggle('connected', Boolean(address));
  $('wallet-state').textContent = address ? `Wallet conectada: ${short(address)}` : 'Conectá una wallet en Testnet para aportar';
  updateActions();
}

async function connect() {
  if (address) {
    await StellarWalletsKit.profileModal();
    return address;
  }
  const connected = await StellarWalletsKit.authModal();
  address = connected.address;
  updateWallet();
  await assertTestnet();
  await refreshOwn();
  return address;
}

async function assertTestnet() {
  const network = await StellarWalletsKit.getNetwork();
  if (network.networkPassphrase !== Networks.TESTNET) {
    throw new Error('Seleccioná Stellar Testnet en tu wallet antes de firmar.');
  }
}

$('wallet-button').addEventListener('click', () => connect().catch((error) => message(error.message, true)));

function parseXlm(value) {
  const text = String(value).trim();
  if (!/^\d+(\.\d{1,7})?$/.test(text)) throw new Error('Ingresá un monto con hasta 7 decimales.');
  const [whole, fraction = ''] = text.split('.');
  const amount = BigInt(whole) * stroops + BigInt(fraction.padEnd(7, '0'));
  if (amount <= 0n) throw new Error('El monto debe ser mayor que cero.');
  return amount;
}

function hexBytes(hex) {
  if (!/^[a-f0-9]{64}$/i.test(hex)) throw new Error('Hash WASM inválido.');
  return Uint8Array.from(hex.match(/../g), (part) => parseInt(part, 16));
}

async function simulate(contractId, method, args = []) {
  const source = await server.getAccount(cfg.organizer);
  const tx = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(new Contract(contractId).call(method, ...args)).setTimeout(30).build();
  const result = await server.simulateTransaction(tx);
  if (!rpc.Api.isSimulationSuccess(result) || !result.result?.retval) {
    throw new Error(result.error || 'No se pudo leer el contrato de Testnet.');
  }
  return scValToNative(result.result.retval);
}

async function refreshOwn() {
  if (!address || !state) { ownContribution = 0n; updateActions(); return; }
  ownContribution = BigInt(await simulate(activeId, 'aporte_de', [new Address(address).toScVal()]));
  updateActions();
}

function updateActions() {
  const now = Date.now() / 1000;
  const open = state && !state.pagado && now < Number(state.limite) && BigInt(state.recaudado) < BigInt(state.meta);
  $('contribute-button').disabled = !address || !open || busy;
  $('contribution').disabled = !open || busy;
  $('pay-button').hidden = !state || state.pagado || BigInt(state.recaudado) !== BigInt(state.meta);
  $('refund-button').hidden = !state || state.pagado || now < Number(state.limite) || BigInt(state.recaudado) === BigInt(state.meta) || ownContribution === 0n;
  $('pay-button').disabled = busy;
  $('refund-button').disabled = busy;
  $('create-preview').disabled = busy;
}

function render(s) {
  state = s;
  const raised = BigInt(s.recaudado);
  const goal = BigInt(s.meta);
  const pct = goal ? Math.min(100, Number(raised * 10000n / goal) / 100) : 0;
  $('raised-xlm').textContent = money(raised);
  $('goal-display').textContent = money(goal);
  $('players-count').textContent = s.jugadores;
  $('players-count-detail').textContent = s.jugadores;
  $('player-limit-detail').textContent = s.cupo;
  $('progress').setAttribute('aria-valuenow', String(pct));
  $('progress').querySelector('.progress-fill').style.width = `${pct}%`;
  $('progress-percent').textContent = `${pct.toLocaleString('es-CR', { maximumFractionDigits: 1 })}% completado`;
  $('remaining-xlm').textContent = raised >= goal ? 'Meta completada' : `Faltan ${money(goal - raised)} XLM`;
  $('field-display').textContent = short(s.cancha);
  $('field-display').title = s.cancha;
  const deadline = new Date(Number(s.limite) * 1000);
  $('deadline-display').textContent = deadline.toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' });
  $('fixture-time').firstChild.textContent = deadline.toLocaleTimeString('es-CR', { hour: '2-digit', minute: '2-digit' });
  $('detail-title').textContent = `Cuota de la cancha · ${s.nombre}`;
  $('match-status').textContent = s.pagado ? 'Cancha pagada · Testnet' : raised === goal ? 'Meta completa · pendiente de pago' : Date.now() >= deadline.getTime() ? 'Plazo vencido · reembolsos disponibles' : 'Reserva abierta · Testnet';
  $('funding-caption').textContent = `${money(raised)} XLM confirmados en Testnet. Los XLM de prueba no tienen valor monetario.`;
  $('contract-link').href = explorer(activeId);
  $('contract-link').hidden = false;
  $('contract-pending').hidden = true;
  updateActions();
}

async function refresh() {
  try {
    render(await simulate(activeId, 'estado'));
    await refreshOwn();
    message('Estado actualizado desde Testnet.');
  } catch (error) {
    message(`No se pudo leer Testnet: ${error.message}`, true);
    $('match-status').textContent = 'Sin conexión a Testnet';
  }
}

async function submitOperation(operation) {
  if (!address) await connect();
  await assertTestnet();
  const source = await server.getAccount(address);
  const raw = new TransactionBuilder(source, { fee: BASE_FEE, networkPassphrase: Networks.TESTNET })
    .addOperation(operation).setTimeout(180).build();
  const prepared = await server.prepareTransaction(raw);
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.toXDR(), {
    networkPassphrase: Networks.TESTNET, address,
  });
  const signed = TransactionBuilder.fromXDR(signedTxXdr, Networks.TESTNET);
  const sent = await server.sendTransaction(signed);
  if (sent.status === 'ERROR') throw new Error('La red rechazó la transacción. Revisá el saldo y los datos.');
  for (let i = 0; i < 24; i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    const result = await server.getTransaction(sent.hash);
    if (result.status === 'SUCCESS') return { result, hash: sent.hash };
    if (result.status === 'FAILED') throw new Error(`La transacción falló. Revisala en ${txExplorer(sent.hash)}`);
  }
  throw new Error(`La transacción se envió; verificá su estado en ${txExplorer(sent.hash)}`);
}

async function runAction(label, operation, target = 'tx-message') {
  if (busy) return null;
  busy = true; updateActions();
  message(`${label}: esperando firma de la wallet…`, false, target);
  try {
    const receipt = await submitOperation(operation);
    message(`${label}: confirmada en Testnet. TX ${short(receipt.hash)}.`, false, target);
    return receipt;
  } catch (error) {
    message(error.message || 'No se pudo completar la operación.', true, target);
    return null;
  } finally { busy = false; updateActions(); }
}

$('contribute-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    if (!address) { await connect(); if (!address) return; }
    if (!state) throw new Error('Esperá a que cargue el contrato.');
    const amount = parseXlm($('contribution').value);
    if (amount > BigInt(state.meta) - BigInt(state.recaudado)) throw new Error('El aporte supera lo que falta de la meta.');
    const operation = new Contract(activeId).call('aportar', new Address(address).toScVal(), nativeToScVal(amount, { type: 'i128' }));
    if (await runAction('Aporte', operation)) { $('contribution').value = ''; await refresh(); }
  } catch (error) { message(error.message, true); }
});

$('pay-button').addEventListener('click', async () => {
  if (await runAction('Pago a la cancha', new Contract(activeId).call('pagar_cancha'))) await refresh();
});
$('refund-button').addEventListener('click', async () => {
  try {
    if (!address) await connect();
    if (await runAction('Reembolso', new Contract(activeId).call('reembolsar', new Address(address).toScVal()))) await refresh();
  } catch (error) { message(error.message, true); }
});

function localDatetime(date) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return shifted.toISOString().slice(0, 16);
}
const nextHour = new Date(Date.now() + 3600000);
$('deadline').min = localDatetime(nextHour);
$('deadline').value = localDatetime(new Date(Date.now() + 24 * 3600000));
$('field-address').value = cfg.cancha;

function showForm(show) {
  $('create-form').hidden = !show;
  $('create-toggle').setAttribute('aria-expanded', String(show));
  if (show) $('match-name').focus();
}
$('create-toggle').addEventListener('click', () => showForm($('create-form').hidden));
$('create-close').addEventListener('click', () => showForm(false));

$('create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    if (!address) { await connect(); if (!address) return; }
    const name = $('match-name').value.trim();
    const goal = parseXlm($('goal-xlm').value);
    const cupo = Number($('player-limit').value);
    const cancha = $('field-address').value.trim();
    const limite = Math.floor(new Date($('deadline').value).getTime() / 1000);
    if (!name || name.length > 40 || !Number.isInteger(cupo) || cupo < 2 || cupo > 100 || !StrKey.isValidEd25519PublicKey(cancha) || cancha === address || limite <= Date.now() / 1000) throw new Error('Revisá nombre, cupo, cuenta de la cancha y fecha límite.');
    const operation = Operation.createCustomContract({
      address: new Address(address), wasmHash: hexBytes(cfg.wasmHash),
      salt: crypto.getRandomValues(new Uint8Array(32)),
      constructorArgs: [nativeToScVal(name, { type: 'string' }), new Address(address).toScVal(), new Address(cancha).toScVal(), new Address(cfg.tokenId).toScVal(), nativeToScVal(goal, { type: 'i128' }), nativeToScVal(BigInt(limite), { type: 'u64' }), nativeToScVal(cupo, { type: 'u32' })],
    });
    const receipt = await runAction('Nueva mejenga', operation, 'create-note');
    if (!receipt) return;
    const id = receipt.result.returnValue ? scValToNative(receipt.result.returnValue) : '';
    if (!StrKey.isValidContract(id)) throw new Error(`Contrato creado, pero no se pudo leer su ID. Transacción: ${txExplorer(receipt.hash)}`);
    if (!savedIds.includes(id)) savedIds.push(id);
    localStorage.setItem('mejenga-contracts', JSON.stringify(savedIds));
    activeId = id;
    history.replaceState(null, '', `${location.pathname}?contract=${id}#partido`);
    showForm(false);
    renderExtraMatches();
    await refresh();
  } catch (error) { message(error.message, true, 'create-note'); }
});

function renderExtraMatches() {
  $('extra-matches').replaceChildren();
  for (const id of savedIds) {
    const button = document.createElement('button');
    button.type = 'button'; button.className = `extra-match${id === activeId ? ' selected' : ''}`;
    button.textContent = `⚽ Mejenga creada · ${short(id)}   →`;
    button.addEventListener('click', () => { activeId = id; history.replaceState(null, '', `${location.pathname}?contract=${id}#partido`); refresh(); renderExtraMatches(); });
    $('extra-matches').append(button);
  }
}

fetch('/api/trustless/status').then((res) => res.json()).then((data) => {
  $('tw-status').textContent = data.configured ? 'Clave de API configurada en el servidor local. El BackOffice permite gestionar escrows de Testnet por separado.' : 'La API key no está configurada. Agregá TRUSTLESS_WORK_API_KEY al .env local para la integración complementaria.';
}).catch(() => { $('tw-status').textContent = 'La integración local no está disponible.'; });

renderExtraMatches();
updateWallet();
refresh();
setInterval(refresh, 20000);
