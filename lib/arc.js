// Arc Testnet configuration
export const ARC = {
  CHAIN_ID_HEX: "0x4CE952",       // 5042002
  CHAIN_ID_DEC: 5042002,
  RPC: "https://rpc.testnet.arc.network",
  EXPLORER: "https://testnet.arcscan.app",
  USDC: "0x3600000000000000000000000000000000000000",
  CURRENCY: "USDC",
  NAME: "Arc Testnet",
};

// ERC-20 Transfer(address indexed from, address indexed to, uint256 value)
export const TRANSFER_SIG =
  "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";

// USDC uses 6 decimals on the ERC-20 interface (18 for native gas balance)
export const USDC_DECIMALS = 6;
export const USDC_UNIT = BigInt(10 ** USDC_DECIMALS);

/** Convert human USDC amount → raw BigInt (6 decimals) */
export function toRaw(amount) {
  return BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
}

/** Convert raw BigInt → display string */
export function fromRaw(raw) {
  return (Number(raw) / 10 ** USDC_DECIMALS).toFixed(2);
}

/** JSON-RPC call to Arc Testnet */
export async function arcRpc(method, params = []) {
  const res = await fetch(ARC.RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

/** Fetch USDC balance (ERC-20 balanceOf) for an address */
export async function fetchUsdcBalance(address) {
  const selector = "0x70a08231";
  const padded = address.slice(2).toLowerCase().padStart(64, "0");
  const result = await arcRpc("eth_call", [
    { to: ARC.USDC, data: selector + padded },
    "latest",
  ]);
  return fromRaw(BigInt(result));
}

/** Get current block number */
export async function currentBlock() {
  try {
    return await arcRpc("eth_blockNumber");
  } catch {
    return "0x0";
  }
}

/** Check if a payment request has been paid on-chain */
export async function checkPaidOnChain(request) {
  const toTopic =
    "0x" + "0".repeat(24) + request.recipient.toLowerCase().slice(2);
  const logs = await arcRpc("eth_getLogs", [
    {
      address: ARC.USDC,
      topics: [TRANSFER_SIG, null, toTopic],
      fromBlock: request.fromBlock || "0x0",
      toBlock: "latest",
    },
  ]);
  if (!logs || logs.length === 0) return null;
  const expected = toRaw(request.amount);
  const hit = logs.find((log) => {
    try {
      return BigInt(log.data) === expected;
    } catch {
      return false;
    }
  });
  return hit || null;
}

/** Ask MetaMask to send an ERC-20 USDC transfer */
export async function sendUsdcTransfer(from, recipient, amount) {
  const sel = "0xa9059cbb"; // transfer(address,uint256)
  const to = recipient.slice(2).toLowerCase().padStart(64, "0");
  const amt = toRaw(amount).toString(16).padStart(64, "0");
  const txHash = await window.ethereum.request({
    method: "eth_sendTransaction",
    params: [{ from, to: ARC.USDC, data: "0x" + sel.slice(2) + to + amt }],
  });
  return txHash;
}

/** Add / switch MetaMask to Arc Testnet */
export async function ensureArcNetwork() {
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: ARC.CHAIN_ID_HEX }],
    });
  } catch (e) {
    if (e.code === 4902) {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: ARC.CHAIN_ID_HEX,
            chainName: ARC.NAME,
            nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
            rpcUrls: [ARC.RPC],
            blockExplorerUrls: [ARC.EXPLORER],
          },
        ],
      });
    } else {
      throw e;
    }
  }
}

/** localStorage key */
const LS_KEY = "payflow_requests";

export function loadRequests() {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || "[]");
  } catch {
    return [];
  }
}

export function saveRequests(reqs) {
  localStorage.setItem(LS_KEY, JSON.stringify(reqs));
}

export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function shortAddr(addr) {
  return addr.slice(0, 6) + "…" + addr.slice(-4);
}
