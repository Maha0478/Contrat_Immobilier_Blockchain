import Web3 from "web3";
import RentalManagerArtifact from "../contracts/RentalManager.json";

let web3Instance = null;
let contractInstance = null;

/**
 * Initialise Web3 avec MetaMask
 */
export async function initWeb3() {
  if (window.ethereum) {
    web3Instance = new Web3(window.ethereum);
    await window.ethereum.request({ method: "eth_requestAccounts" });
    return web3Instance;
  } else {
    throw new Error("MetaMask non détecté. Veuillez l'installer.");
  }
}

export function getWeb3() {
  return web3Instance;
}

/**
 * Retourne l'instance du contrat déployé sur le réseau courant
 */
export async function getContract() {
  if (contractInstance) return contractInstance;

  const web3 = getWeb3();
  if (!web3) throw new Error("Web3 non initialisé");

  const networkId = await web3.eth.net.getId();
  const deployedNetwork = RentalManagerArtifact.networks[networkId];

  if (!deployedNetwork) {
    throw new Error(
      `Contrat non déployé sur le réseau ${networkId}. Lancez: truffle migrate --reset`
    );
  }

  contractInstance = new web3.eth.Contract(
    RentalManagerArtifact.abi,
    deployedNetwork.address
  );
  return contractInstance;
}

/**
 * Retourne les comptes disponibles
 */
export async function getAccounts() {
  const web3 = getWeb3();
  return web3.eth.getAccounts();
}

/**
 * Convertit wei → ETH (formaté)
 */
export function weiToEth(wei) {
  const web3 = getWeb3();
  return web3 ? web3.utils.fromWei(String(wei), "ether") : "0";
}

/**
 * Convertit ETH → wei
 */
export function ethToWei(eth) {
  const web3 = getWeb3();
  return web3 ? web3.utils.toWei(String(eth), "ether") : "0";
}

/**
 * Formate un timestamp unix en date lisible
 */
export function formatDate(timestamp) {
  if (!timestamp || timestamp === "0") return "—";
  return new Date(Number(timestamp) * 1000).toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Retourne le label d'un statut
 */
export function statusLabel(status) {
  const labels = ["En attente", "Actif", "Expiré", "Résilié"];
  return labels[Number(status)] ?? "Inconnu";
}

export function statusColor(status) {
  const colors = ["#f59e0b", "#10b981", "#6b7280", "#ef4444"];
  return colors[Number(status)] ?? "#6b7280";
}

/**
 * Tronque une adresse Ethereum
 */
export function shortAddr(addr) {
  if (!addr) return "—";
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}
