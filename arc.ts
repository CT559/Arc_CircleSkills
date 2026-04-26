// Arc Testnet chain configuration (Circle Skills: use-arc)
export const ARC_TESTNET = {
  id: 5042002,
  name: "Arc Testnet",
  network: "arc-testnet",
  nativeCurrency: {
    name: "USDC",
    symbol: "USDC",
    decimals: 6,
  },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public: { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: {
      name: "ArcScan",
      url: "https://testnet.arcscan.app",
    },
  },
  testnet: true,
};

// Contract addresses (Circle Skills: use-arc + use-usdc)
export const CONTRACTS = {
  USDC: "0x3600000000000000000000000000000000000000" as `0x${string}`,
  EURC: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a" as `0x${string}`,
};

export const EXPLORER = "https://testnet.arcscan.app";

export const ERC20_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: "from", type: "address" },
      { indexed: true, name: "to", type: "address" },
      { indexed: false, name: "value", type: "uint256" },
    ],
    name: "Transfer",
    type: "event",
  },
] as const;

export const USDC_DECIMALS = 6;

export function formatUsdc(raw: bigint): string {
  return (Number(raw) / 10 ** USDC_DECIMALS).toFixed(2);
}

export function parseUsdc(amount: string): bigint {
  return BigInt(Math.round(parseFloat(amount) * 10 ** USDC_DECIMALS));
}

export function shortAddr(addr: string): string {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export function explorerTx(hash: string): string {
  return `${EXPLORER}/tx/${hash}`;
}

export function explorerAddr(addr: string): string {
  return `${EXPLORER}/address/${addr}`;
}
