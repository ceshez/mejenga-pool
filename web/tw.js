import { Networks, StrKey } from '@stellar/stellar-sdk';
import { StellarWalletsKit } from '@creit-tech/stellar-wallets-kit/sdk';
import { AlbedoModule } from '@creit-tech/stellar-wallets-kit/modules/albedo';
import { VarialModule } from '@creit-tech/stellar-wallets-kit/modules/varial';
import { RabetModule } from '@creit-tech/stellar-wallets-kit/modules/rabet';
import { xBullModule } from '@creit-tech/stellar-wallets-kit/modules/xbull';
import { LobstrModule } from '@creit-tech/stellar-wallets-kit/modules/lobstr';
import { HanaModule } from '@creit-tech/stellar-wallets-kit/modules/hana';
import { KleverModule } from '@creit-tech/stellar-wallets-kit/modules/klever';
import { KitEventType, Networks as KitNetworks } from '@creit-tech/stellar-wallets-kit/types';

const $ = (id) => document.getElementById(id);
const demoSigner = 'GDXK3KSXBR4SYHJJMRF3EVQKRLZCH3CDSDAT2WJFJBK4IC2PXAMM3ZWL';
const demoId = 'CADIYI2MPDEMH7EBYSAMDKC5E44FN4FIQ4EBXJB2R234WIVIKVNOKZ4Z';
const short = (value) => `${value.slice(0, 5)}…${value.slice(-5)}`;
const format = (number) => Number(number || 0).toLocaleString('es-CR', { maximumFractionDigits: 7 });
const query = new URLSearchParams(location.search);
let selectedId = StrKey.isValidContract(query.get('escrow') || '') ? query.get('escrow') : demoId;
let selectedOwner = StrKey.isValidEd25519PublicKey(query.get('signer') || '') ? query.get('signer') : demoSigner;
let wallet = '';
let escrows = [];
let busy = false;
const justCreated = new Map();

StellarWalletsKit.init({
  modules: [new VarialModule(), new xBullModule(), new AlbedoModule(), new RabetModule(), new LobstrModule(), new HanaModule(), new KleverModule()],
  network: KitNetworks.TESTNET,
});
StellarWalletsKit.on(KitEventType.STATE_UPDATED, ({ payload }) => {
  const next = payload.address || '';
  if (next !== wallet) { wallet = next; showWallet(); refresh().catch(report); }
});
StellarWalletsKit.on(KitEventType.DISCONNECT, () => { wallet = ''; showWallet(); });

function report(error, target = 'tx-message') {
  $(target).textContent = error.message || String(error);
  $(target).classList.add('error');
}
function note(text, target = 'tx-message') {
  $(target).textContent = text;
  $(target).classList.remove('error');
}
function showWallet() {
  $('wallet-button-label').textContent = wallet ? short(wallet) : 'Conectar wallet';
  $('wallet-button').classList.toggle('connected', Boolean(wallet));
  $('wallet-state').textContent = wallet ? `Wallet conectada: ${short(wallet)}` : 'Conectá una wallet en Testnet para aportar';
  updateActions();
}
async function connect() {
  if (!wallet) {
    const connected = await StellarWalletsKit.authModal();
    wallet = connected.address;
    showWallet();
    await refresh();
  }
  const network = await StellarWalletsKit.getNetwork();
  if (network.networkPassphrase !== Networks.TESTNET) throw new Error('Seleccioná Stellar Testnet en tu wallet.');
  return wallet;
}
$('wallet-button').addEventListener('click', async () => {
  try { if (wallet) await StellarWalletsKit.profileModal(); else await connect(); }
  catch (error) { report(error); }
});

async function api(path, body) {
  const response = await fetch(path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

function rules(item) {
  const desc = String(item.description || '');
  return {
    deadline: Number(desc.match(/limite=(\d+)/)?.[1] || 0),
    players: Number(desc.match(/cupo=(\d+)/)?.[1] || 0),
  };
}
function teams(item) {
  const parts = String(item.title || 'Mejenga de prueba').split(/\s+vs\s+/i);
  return parts.length === 2 ? parts : [parts[0], 'La cancha'];
}
function current() { return escrows.find((item) => item.contractId === selectedId); }
function remaining(item) { return Math.max(0, Math.round((Number(item.amount) - Number(item.balance || 0)) * 1e7)) / 1e7; }

function updateActions() {
  const item = current();
  const { deadline, players } = item ? rules(item) : { deadline: 0, players: 0 };
  const open = item && remaining(item) > 0 && (!deadline || Date.now() / 1000 < deadline)
    && (!players || item.playersHere < players || wallet && item.contributors?.includes(wallet));
  $('contribute-button').disabled = !wallet || !open || busy;
  $('contribution').disabled = !open || busy;
  $('create-preview').disabled = busy;
}

function renderList() {
  $('extra-matches').replaceChildren();
  for (const item of escrows) {
    const [home, away] = teams(item);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `extra-match match-row${item.contractId === selectedId ? ' selected' : ''}`;
    button.setAttribute('role', 'listitem');
    button.setAttribute('aria-current', String(item.contractId === selectedId));
    const title = document.createElement('strong');
    title.textContent = `${home}  ·  ${away}`;
    const detail = document.createElement('span');
    detail.textContent = `${format(item.balance)} / ${format(item.amount)} USDC · ${short(item.contractId)}`;
    button.append(title, detail);
    button.addEventListener('click', () => select(item));
    $('extra-matches').append(button);
  }
}

function setCrest(side, name) {
  const image = $(`${side}-crest`);
  const initial = $(`${side}-initial`);
  const known = name.toLowerCase() === 'real madrid' ? 'real-madrid.png' : name.toLowerCase() === 'barcelona' ? 'barcelona.png' : null;
  image.hidden = !known;
  initial.hidden = Boolean(known);
  if (known) image.src = `./assets/${known}`;
  else initial.textContent = name.slice(0, 2).toUpperCase();
  $(`${side}-name`).textContent = name;
}

function select(item) {
  if (!item) return;
  selectedId = item.contractId;
  selectedOwner = item.signer;
  const params = new URLSearchParams({ escrow: selectedId, signer: selectedOwner });
  history.replaceState(null, '', `${location.pathname}?${params}#partido`);
  renderList();
  const [home, away] = teams(item);
  setCrest('home', home); setCrest('away', away);
  const { deadline, players } = rules(item);
  const balance = Number(item.balance || 0);
  const goal = Number(item.amount || 0);
  const pct = goal > 0 ? Math.min(100, balance / goal * 100) : 0;
  $('detail-title').textContent = `Cuota de la cancha · ${item.title}`;
  $('detail-location').textContent = `Escrow ${short(item.contractId)}`;
  $('players-count-detail').textContent = item.playersHere || 0;
  $('player-limit-detail').textContent = players || '—';
  $('raised-xlm').textContent = format(balance);
  $('goal-display').textContent = format(goal);
  $('progress').setAttribute('aria-valuenow', String(pct));
  $('progress').querySelector('.progress-fill').style.width = `${pct}%`;
  $('progress-percent').textContent = `${format(pct)}% completado`;
  $('remaining-xlm').textContent = `Faltan ${format(remaining(item))} USDC`;
  $('contribution').max = String(remaining(item));
  $('field-display').textContent = item.roles?.receiver ? short(item.roles.receiver) : '—';
  $('field-display').title = item.roles?.receiver || '';
  $('deadline-display').textContent = deadline ? new Date(deadline * 1000).toLocaleString('es-CR', { dateStyle: 'medium', timeStyle: 'short' }) : 'No definido en el ejemplo';
  $('match-status').textContent = item.flags?.released ? 'Pago liberado · Testnet' : deadline && Date.now() / 1000 >= deadline ? 'Plazo anunciado vencido' : balance >= goal ? 'Meta completa' : 'Recibiendo aportes · Testnet';
  $('funding-caption').textContent = `${format(balance)} USDC en el escrow según Trustless Work. ${item.playersHere || 0} wallet(s) aportaron mediante esta demo.`;
  $('contract-link').href = `https://stellar.expert/explorer/testnet/contract/${selectedId}`;
  $('contract-link').hidden = false;
  $('contract-pending').hidden = true;
  $('tw-escrow-id').textContent = selectedId;
  $('tw-contract-link').href = $('contract-link').href;
  $('tw-contract-link').hidden = false;
  $('tw-status').textContent = `${item.title} · Meta ${format(goal)} USDC · Saldo ${format(balance)} USDC. Abrí el dashboard con la wallet ${short(selectedOwner)} en Testnet.`;
  validateAmount();
  updateActions();
}

function validateAmount() {
  const item = current();
  if (!item) return;
  const left = remaining(item);
  const input = $('contribution');
  const tooMuch = input.value && Number(input.value) > left;
  input.setCustomValidity(tooMuch ? `El máximo disponible es ${format(left)} USDC.` : '');
  $('amount-help').textContent = tooMuch ? `Superás el límite. Máximo: ${format(left)} USDC.` : `Máximo disponible ahora: ${format(left)} USDC.`;
  $('amount-help').classList.toggle('error', Boolean(tooMuch));
}
$('contribution').addEventListener('input', validateAmount);

async function refresh() {
  const signers = [...new Set([demoSigner, selectedOwner, wallet].filter((value) => StrKey.isValidEd25519PublicKey(value)))];
  const settled = await Promise.allSettled(signers.map((signer) => api(`/api/trustless/escrows?signer=${signer}`)));
  const list = new Map();
  let failures = 0;
  for (const result of settled) {
    if (result.status === 'fulfilled') for (const item of result.value.escrows) list.set(item.contractId, item);
    else failures += 1;
  }
  for (const [id, item] of justCreated) {
    if (list.has(id)) justCreated.delete(id);
    else list.set(id, item);
  }
  if (list.size) escrows = [...list.values()].filter((item) => item.engagementId?.startsWith('mejenga-') || item.contractId === demoId);
  $('list-status').textContent = failures ? 'No se pudo consultar todo el índice de Trustless Work. Revisá tu conexión y la clave del servidor.' : escrows.length ? 'Seleccioná una mejenga para ver sus datos y aportar.' : 'Todavía no hay mejengas para esta wallet. Creá una con el botón de arriba.';
  const item = current() || escrows[0];
  if (item) select(item);
  else { renderList(); updateActions(); }
}

async function signAndSend(prepared) {
  const { signedTxXdr } = await StellarWalletsKit.signTransaction(prepared.unsignedTransaction, { networkPassphrase: Networks.TESTNET, address: wallet });
  return api('/api/trustless/send', { signedXdr: signedTxXdr, ticket: prepared.ticket });
}

const shifted = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
$('deadline').min = shifted(new Date(Date.now() + 3_600_000));
$('deadline').value = shifted(new Date(Date.now() + 24 * 3_600_000));
$('field-address').value = 'GDNQ3VMW4VBHJ7PMP26YRRG4WWMEZPTQ52MBAH7N6A3M4LKR4FBU6AG3';
function showForm(show) { $('create-form').hidden = !show; $('create-toggle').setAttribute('aria-expanded', String(show)); if (show) $('home-team').focus(); }
$('create-toggle').addEventListener('click', () => showForm($('create-form').hidden));
$('create-close').addEventListener('click', () => showForm(false));

$('create-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  try {
    await connect();
    const home = $('home-team').value.trim();
    const away = $('away-team').value.trim();
    const deadline = Math.floor(new Date($('deadline').value).getTime() / 1000);
    busy = true; updateActions();
    note('Trustless Work prepara el escrow. Luego confirmá la firma en tu wallet…', 'create-note');
    const prepared = await api('/api/trustless/prepare', { kind: 'create', signer: wallet, home, away, receiver: $('field-address').value.trim(), amount: $('goal-usdc').value, players: $('player-limit').value, deadline });
    const result = await signAndSend(prepared);
    if (!StrKey.isValidContract(result.contractId || '')) throw new Error('El escrow se envió, pero falta su ID. Revisá el dashboard de Trustless Work.');
    selectedId = result.contractId;
    selectedOwner = wallet;
    justCreated.set(result.contractId, {
      contractId: result.contractId, signer: wallet,
      engagementId: result.escrow?.engagementId || `mejenga-${result.contractId}`,
      title: `${home} vs ${away}`, description: `MejengaPool|limite=${deadline}|cupo=${$('player-limit').value}`,
      amount: Number($('goal-usdc').value), balance: 0,
      roles: { receiver: $('field-address').value.trim() }, playersHere: 0, contributors: [],
      ...result.escrow,
    });
    showForm(false);
    note(`Escrow ${short(selectedId)} creado en Trustless Work. Puede tardar en aparecer en el índice.`);
    await refresh();
  } catch (error) { report(error, 'create-note'); }
  finally { busy = false; updateActions(); }
});

$('contribute-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (busy) return;
  try {
    await connect();
    const item = current();
    if (!item) throw new Error('Seleccioná una mejenga.');
    validateAmount();
    if (!$('contribution').reportValidity()) return;
    busy = true; updateActions();
    note('Trustless Work prepara tu aporte de USDC. Confirmá la firma en la wallet…');
    const prepared = await api('/api/trustless/prepare', { kind: 'fund', signer: wallet, owner: item.signer, contractId: item.contractId, amount: $('contribution').value });
    const before = Number(item.balance || 0);
    await signAndSend(prepared);
    $('contribution').value = '';
    note('Aporte confirmado por Trustless Work. Actualizando saldo…');
    await refresh();
    if (Number(current()?.balance || 0) <= before) note('Aporte confirmado. El índice de Trustless Work aún no actualiza el saldo; volveremos a consultarlo.');
  } catch (error) { report(error); }
  finally { busy = false; updateActions(); }
});

$('tw-copy').addEventListener('click', async () => {
  if (!current()) return;
  try { await navigator.clipboard.writeText(selectedId); $('tw-copy').textContent = 'ID copiado ✓'; }
  catch { $('tw-copy').textContent = 'Seleccioná el ID para copiarlo'; }
});

showWallet();
refresh().catch(report);
setInterval(() => refresh().catch(report), 30_000);
