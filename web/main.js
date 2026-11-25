const config = window.MEJENGA_CONFIG || {};
const contractId = String(config.contractId || "").trim();
const contractLink = document.getElementById("contract-link");
const pending = document.getElementById("contract-pending");

if (/^C[A-Z2-7]{55}$/.test(contractId)) {
  contractLink.href = `https://stellar.expert/explorer/testnet/contract/${contractId}`;
  contractLink.hidden = false;
  pending.hidden = true;
}

const escrowId = String(config.trustlessEscrowId || "").trim();
const trustlessLink = document.getElementById("tw-link");
if (/^C[A-Z2-7]{55}$/.test(escrowId)) {
  trustlessLink.href = `https://stellar.expert/explorer/testnet/contract/${escrowId}`;
  trustlessLink.firstChild.textContent = "Ver escrow en Testnet ";
}
