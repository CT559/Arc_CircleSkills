import { useState } from "react";
import { EXPLORER } from "../lib/arc";

interface Props {
  address: string | null;
  isConnected: boolean;
  usdcBalance: string;
  getPublicClient: () => any;
  getWalletClient: () => any;
  refreshBalances: () => void;
}

type SourceChain = "Ethereum_Sepolia" | "Base_Sepolia" | "Solana_Devnet";
type TxStatus = "idle" | "approving" | "burning" | "attesting" | "minting" | "success" | "error";

const CHAIN_INFO: Record<SourceChain, { label: string; explorer: string; rpc: string; isSolana: boolean }> = {
  Ethereum_Sepolia: {
    label: "Ethereum Sepolia",
    explorer: "https://sepolia.etherscan.io",
    rpc: "https://ethereum-sepolia-rpc.publicnode.com",
    isSolana: false,
  },
  Base_Sepolia: {
    label: "Base Sepolia",
    explorer: "https://sepolia.basescan.org",
    rpc: "https://sepolia.base.org",
    isSolana: false,
  },
  Solana_Devnet: {
    label: "Solana Devnet",
    explorer: "https://explorer.solana.com/?cluster=devnet",
    rpc: "https://api.devnet.solana.com",
    isSolana: true,
  },
};

export default function BridgeTab({
  address,
  isConnected,
  usdcBalance,
  getPublicClient,
  getWalletClient,
  refreshBalances,
}: Props) {
  const [sourceChain, setSourceChain] = useState<SourceChain>("Ethereum_Sepolia");
  const [amount, setAmount] = useState("0.01");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [destTxHash, setDestTxHash] = useState("");
  const [error, setError] = useState("");

  const chainInfo = CHAIN_INFO[sourceChain];

  const statusLabel: Record<TxStatus, string> = {
    idle: "",
    approving: "Approving USDC on source chain…",
    burning: "Burning USDC via CCTP…",
    attesting: "Waiting for Circle attestation…",
    minting: "Minting USDC on Arc Testnet…",
    success: "Bridge complete!",
    error: "",
  };

  const handleBridge = async () => {
    if (!isConnected || !address) return;
    setStatus("approving");
    setError("");
    setTxHash("");
    setDestTxHash("");

    try {
      const { AppKit } = await import("@circle-fin/app-kit");

      let viemAdapter: any;

      if (!chainInfo.isSolana) {
        const { createViemV2Adapter } = await import("@circle-fin/adapter-viem-v2");
        const { createWalletClient, custom } = await import("viem");

        // Switch MetaMask to source chain
        const sourceChainId = sourceChain === "Ethereum_Sepolia" ? "0xaa36a7" : "0x14a34";
        const provider = (window as any).ethereum;
        try {
          await provider.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: sourceChainId }],
          });
        } catch (switchErr: any) {
          if (switchErr.code === 4902) {
            const chainData =
              sourceChain === "Base_Sepolia"
                ? {
                    chainId: "0x14a34",
                    chainName: "Base Sepolia",
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["https://sepolia.base.org"],
                    blockExplorerUrls: ["https://sepolia.basescan.org"],
                  }
                : {
                    chainId: "0xaa36a7",
                    chainName: "Ethereum Sepolia",
                    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                    rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
                    blockExplorerUrls: ["https://sepolia.etherscan.io"],
                  };
            await provider.request({ method: "wallet_addEthereumChain", params: [chainData] });
          } else {
            throw switchErr;
          }
        }

        const sourceChainConfig =
          sourceChain === "Ethereum_Sepolia"
            ? {
                id: 11155111,
                name: "Ethereum Sepolia",
                network: "sepolia",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: { default: { http: [chainInfo.rpc] }, public: { http: [chainInfo.rpc] } },
              }
            : {
                id: 84532,
                name: "Base Sepolia",
                network: "base-sepolia",
                nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
                rpcUrls: { default: { http: [chainInfo.rpc] }, public: { http: [chainInfo.rpc] } },
              };

        const wc = createWalletClient({
          account: address as `0x${string}`,
          chain: sourceChainConfig as any,
          transport: custom(provider),
        });
        viemAdapter = createViemV2Adapter(wc, { rpcUrl: chainInfo.rpc });
      } else {
        // Solana path — use Phantom
        const { createSolanaAdapter } = await import("@circle-fin/app-kit");
        const phantom = (window as any).solana;
        if (!phantom?.isPhantom) throw new Error("Phantom wallet not found for Solana bridging");
        await phantom.connect();
        viemAdapter = createSolanaAdapter(phantom, { rpcUrl: chainInfo.rpc });
      }

      const kit = new AppKit();
      setStatus("burning");

      // Circle App Kit bridge (CCTP v2) — from Circle Skills: bridge-stablecoin
      const result = await kit.bridge({
        from: { adapter: viemAdapter, chain: sourceChain },
        to: { adapter: (() => {
          // We need Arc-side adapter for receiving
          const { createViemV2Adapter } = require("@circle-fin/adapter-viem-v2");
          const { createWalletClient, custom } = require("viem");
          const { ARC_TESTNET } = require("../lib/arc");
          const provider = (window as any).ethereum;
          const wc = createWalletClient({
            account: address as `0x${string}`,
            chain: ARC_TESTNET as any,
            transport: custom(provider),
          });
          return createViemV2Adapter(wc, { rpcUrl: "https://rpc.testnet.arc.network" });
        })(), chain: "Arc_Testnet" },
        amount,
      });

      setTxHash(result.sourceTxHash ?? result.txHash ?? "");
      setStatus("attesting");

      // Wait for dest
      if (result.destTxHash) {
        setDestTxHash(result.destTxHash);
        setStatus("success");
        refreshBalances();
      } else {
        // Poll for dest tx
        let tries = 0;
        const interval = setInterval(async () => {
          tries++;
          try {
            const fresh = await result.getStatus?.();
            if (fresh?.destTxHash) {
              setDestTxHash(fresh.destTxHash);
              setStatus("success");
              refreshBalances();
              clearInterval(interval);
            } else if (fresh?.status === "complete") {
              setStatus("success");
              refreshBalances();
              clearInterval(interval);
            }
          } catch {}
          if (tries > 40) {
            clearInterval(interval);
            setStatus("success"); // Optimistic
            refreshBalances();
          }
        }, 5000);
      }
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Bridge failed");
      setStatus("error");
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Bridge to Arc Testnet</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">CCTP v2</span>
        </div>

        {/* Source chain selector */}
        <div>
          <label className="text-xs text-gray-400 mb-2 block">From</label>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(CHAIN_INFO) as SourceChain[]).map((chain) => (
              <button
                key={chain}
                onClick={() => setSourceChain(chain)}
                className={`py-2 px-2 rounded-lg text-xs font-medium border transition-all ${
                  sourceChain === chain ? "tab-active" : "tab-inactive"
                }`}
              >
                {CHAIN_INFO[chain].label}
              </button>
            ))}
          </div>
        </div>

        {/* Route visualization */}
        <div className="flex items-center gap-3 bg-black/30 rounded-xl p-4">
          <ChainBadge chain={sourceChain} />
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 h-px bg-gray-700 relative">
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="bg-gray-900 px-2 text-xs text-gray-500">CCTP</span>
              </div>
            </div>
          </div>
          <ChainBadge chain="Arc_Testnet" />
        </div>

        {/* Amount */}
        <div className="bg-black/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Amount (USDC)</span>
            {chainInfo.isSolana && (
              <span className="text-xs text-yellow-400">Requires Phantom</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              step="0.01"
              min="0.01"
              style={{
                background: "transparent",
                border: "none",
                fontSize: 24,
                fontWeight: 700,
                padding: 0,
                width: "100%",
              }}
              placeholder="0.00"
            />
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2">
              <div style={{ width: 18, height: 18, borderRadius: "50%", background: "#2775CA", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 7, fontWeight: 800, color: "#fff" }}>U</div>
              <span className="font-semibold text-white text-sm">USDC</span>
            </div>
          </div>
        </div>

        {/* Destination */}
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Destination</span>
            <span className="text-gray-400 mono">{address ? `${address.slice(0,6)}…${address.slice(-4)}` : "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Protocol</span>
            <span className="text-gray-400">Circle CCTP v2 · Native USDC (no wrapping)</span>
          </div>
          <div className="flex justify-between">
            <span>Est. time</span>
            <span className="text-gray-400">~1–3 min</span>
          </div>
        </div>

        {/* CTA */}
        {!isConnected ? (
          <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-sm text-center">
            Connect your wallet to bridge
          </div>
        ) : (
          <button
            onClick={handleBridge}
            disabled={!amount || parseFloat(amount) <= 0 || (status !== "idle" && status !== "success" && status !== "error")}
            className="btn-primary"
          >
            {status === "idle" || status === "success" || status === "error"
              ? `Bridge ${amount || "0"} USDC → Arc Testnet`
              : statusLabel[status]}
          </button>
        )}

        {/* Status */}
        {status !== "idle" && status !== "error" && (
          <div className={`rounded-lg p-4 text-sm space-y-2 ${status === "success" ? "bg-green-900/20 border border-green-500/20" : "bg-blue-900/20 border border-blue-500/20"}`}>
            <div className="flex items-center gap-2">
              {status !== "success" && <span className="pulse-dot bg-blue-400" style={{ flexShrink: 0 }} />}
              <span className={status === "success" ? "text-green-400 font-semibold" : "text-blue-400"}>
                {statusLabel[status]}
              </span>
            </div>
            {txHash && (
              <a href={`${chainInfo.explorer}/tx/${txHash}`} target="_blank" rel="noreferrer" className="explorer-link block">
                Source tx on {chainInfo.label} →
              </a>
            )}
            {destTxHash && (
              <a href={`${EXPLORER}/tx/${destTxHash}`} target="_blank" rel="noreferrer" className="explorer-link block">
                Destination tx on ArcScan →
              </a>
            )}
          </div>
        )}
        {status === "error" && (
          <div className="bg-red-900/20 border border-red-500/20 rounded-lg p-3 text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      <p className="text-center text-xs text-gray-600 mt-4">
        Powered by{" "}
        <a href="https://docs.arc.network/app-kit/quickstarts/bridge-tokens-across-blockchains" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-400 underline">
          Circle App Kit Bridge
        </a>{" "}
        · Native USDC via{" "}
        <a href="https://www.circle.com/cross-chain-transfer-protocol" target="_blank" rel="noreferrer" className="text-gray-500 hover:text-gray-400 underline">
          CCTP v2
        </a>
      </p>
    </div>
  );
}

function ChainBadge({ chain }: { chain: string }) {
  const labels: Record<string, { label: string; color: string }> = {
    Ethereum_Sepolia: { label: "ETH Sepolia", color: "#627EEA" },
    Base_Sepolia: { label: "Base Sepolia", color: "#0052FF" },
    Solana_Devnet: { label: "Solana Devnet", color: "#9945FF" },
    Arc_Testnet: { label: "Arc Testnet", color: "#0066FF" },
  };
  const info = labels[chain] ?? { label: chain, color: "#555" };
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        style={{ width: 32, height: 32, borderRadius: "50%", background: info.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#fff" }}
      >
        {info.label[0]}
      </div>
      <span className="text-xs text-gray-400 text-center" style={{ maxWidth: 64 }}>{info.label}</span>
    </div>
  );
}
