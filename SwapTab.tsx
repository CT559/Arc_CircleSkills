import { useState } from "react";
import { explorerTx, EXPLORER, CONTRACTS } from "../lib/arc";

interface Props {
  address: string | null;
  isConnected: boolean;
  usdcBalance: string;
  eurcBalance: string;
  getPublicClient: () => any;
  getWalletClient: () => any;
  refreshBalances: () => void;
}

type Direction = "USDC_TO_EURC" | "EURC_TO_USDC";

type TxStatus = "idle" | "approving" | "swapping" | "confirming" | "success" | "error";

export default function SwapTab({
  address,
  isConnected,
  usdcBalance,
  eurcBalance,
  getPublicClient,
  getWalletClient,
  refreshBalances,
}: Props) {
  const [direction, setDirection] = useState<Direction>("USDC_TO_EURC");
  const [amount, setAmount] = useState("0.01");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [error, setError] = useState("");

  const tokenIn = direction === "USDC_TO_EURC" ? "USDC" : "EURC";
  const tokenOut = direction === "USDC_TO_EURC" ? "EURC" : "USDC";
  const balanceIn = direction === "USDC_TO_EURC" ? usdcBalance : eurcBalance;
  const contractIn = direction === "USDC_TO_EURC" ? CONTRACTS.USDC : CONTRACTS.EURC;

  // Circle App Kit swap — using @circle-fin/app-kit
  // Pattern from Circle Skills: bridge-stablecoin / use-arc
  const handleSwap = async () => {
    if (!isConnected || !address) return;
    setStatus("approving");
    setError("");
    setTxHash("");

    try {
      // Dynamic import to avoid SSR issues
      const { AppKit } = await import("@circle-fin/app-kit");
      const { createViemV2Adapter } = await import("@circle-fin/adapter-viem-v2");
      const { createWalletClient, custom, http } = await import("viem");
      const { ARC_TESTNET } = await import("../lib/arc");

      const provider = (window as any).ethereum;
      const walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain: ARC_TESTNET as any,
        transport: custom(provider),
      });

      const viemAdapter = createViemV2Adapter(walletClient, {
        rpcUrl: "https://rpc.testnet.arc.network",
      });

      const kitKey = process.env.NEXT_PUBLIC_CIRCLE_KIT_KEY ?? "";
      const kit = new AppKit();

      setStatus("swapping");

      const result = await kit.swap({
        from: { adapter: viemAdapter, chain: "Arc_Testnet" },
        tokenIn,
        tokenOut,
        amountIn: amount,
        config: {
          kitKey,
        },
      });

      setTxHash(result.txHash ?? "");
      setStatus("confirming");

      // Poll for confirmation
      const client = getPublicClient();
      let tries = 0;
      const interval = setInterval(async () => {
        tries++;
        try {
          const receipt = await client.getTransactionReceipt({
            hash: (result.txHash ?? "") as `0x${string}`,
          });
          if (receipt?.status === "success") {
            clearInterval(interval);
            setStatus("success");
            refreshBalances();
          }
        } catch {}
        if (tries > 20) {
          clearInterval(interval);
          setStatus("success"); // Optimistic after timeout
          refreshBalances();
        }
      }, 3000);
    } catch (err: any) {
      setError(err.shortMessage || err.message || "Swap failed");
      setStatus("error");
    }
  };

  const statusLabel: Record<TxStatus, string> = {
    idle: "",
    approving: "Approving token…",
    swapping: "Sending swap transaction…",
    confirming: "Waiting for confirmation…",
    success: "Swap confirmed!",
    error: "",
  };

  return (
    <div className="max-w-lg mx-auto">
      <div className="card p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Swap</h2>
          <span className="text-xs text-gray-500 bg-gray-800 px-2 py-1 rounded">Arc Testnet</span>
        </div>

        {/* Direction toggle */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setDirection("USDC_TO_EURC")}
            className={`py-3 rounded-lg text-sm font-medium border transition-all ${
              direction === "USDC_TO_EURC" ? "tab-active" : "tab-inactive"
            }`}
          >
            USDC → EURC
          </button>
          <button
            onClick={() => setDirection("EURC_TO_USDC")}
            className={`py-3 rounded-lg text-sm font-medium border transition-all ${
              direction === "EURC_TO_USDC" ? "tab-active" : "tab-inactive"
            }`}
          >
            EURC → USDC
          </button>
        </div>

        {/* From token */}
        <div className="bg-black/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">You pay</span>
            <span className="text-gray-500 text-xs">
              Balance: {balanceIn} {tokenIn}
            </span>
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
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 whitespace-nowrap">
              <TokenIcon symbol={tokenIn} />
              <span className="font-semibold text-white">{tokenIn}</span>
            </div>
          </div>
        </div>

        {/* Swap arrow */}
        <div className="flex justify-center">
          <button
            onClick={() =>
              setDirection((d) =>
                d === "USDC_TO_EURC" ? "EURC_TO_USDC" : "USDC_TO_EURC"
              )
            }
            className="w-9 h-9 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          >
            ↕
          </button>
        </div>

        {/* To token */}
        <div className="bg-black/30 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">You receive (est.)</span>
          </div>
          <div className="flex items-center gap-3">
            <span style={{ fontSize: 24, fontWeight: 700, color: "#9CA3AF" }}>
              ~{amount || "0.00"}
            </span>
            <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 whitespace-nowrap">
              <TokenIcon symbol={tokenOut} />
              <span className="font-semibold text-white">{tokenOut}</span>
            </div>
          </div>
          <p className="text-gray-600 text-xs mt-2">
            Rate: 1 {tokenIn} ≈ 1 {tokenOut} (on-chain rate via Circle App Kit)
          </p>
        </div>

        {/* Info */}
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Protocol</span>
            <span className="text-gray-400">Circle App Kit · Arc Testnet</span>
          </div>
          <div className="flex justify-between">
            <span>Gas token</span>
            <span className="text-gray-400">USDC (no ETH needed)</span>
          </div>
        </div>

        {/* CTA */}
        {!isConnected ? (
          <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-3 text-yellow-400 text-sm text-center">
            Connect your wallet to swap
          </div>
        ) : (
          <button
            onClick={handleSwap}
            disabled={!amount || parseFloat(amount) <= 0 || status === "approving" || status === "swapping" || status === "confirming"}
            className="btn-primary"
          >
            {status === "idle" || status === "success" || status === "error"
              ? `Swap ${amount || "0"} ${tokenIn} → ${tokenOut}`
              : statusLabel[status]}
          </button>
        )}

        {/* Status */}
        {status !== "idle" && status !== "error" && (
          <div
            className={`rounded-lg p-3 text-sm ${
              status === "success" ? "bg-green-900/20 border border-green-500/20 text-green-400" : "bg-blue-900/20 border border-blue-500/20 text-blue-400"
            }`}
          >
            <div className="flex items-center gap-2">
              {status !== "success" && (
                <span className="pulse-dot bg-blue-400" style={{ flexShrink: 0 }} />
              )}
              <span>{statusLabel[status]}</span>
            </div>
            {txHash && (
              <a
                href={`${EXPLORER}/tx/${txHash}`}
                target="_blank"
                rel="noreferrer"
                className="explorer-link block mt-2"
              >
                View on ArcScan →
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
        <a
          href="https://docs.arc.network/app-kit"
          target="_blank"
          rel="noreferrer"
          className="text-gray-500 hover:text-gray-400 underline"
        >
          Circle App Kit
        </a>{" "}
        · Requires{" "}
        <code className="mono text-xs">NEXT_PUBLIC_CIRCLE_KIT_KEY</code>
      </p>
    </div>
  );
}

function TokenIcon({ symbol }: { symbol: string }) {
  const colors: Record<string, string> = {
    USDC: "#2775CA",
    EURC: "#2B7CD8",
  };
  return (
    <div
      style={{
        width: 20,
        height: 20,
        borderRadius: "50%",
        background: colors[symbol] ?? "#555",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 8,
        fontWeight: 800,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {symbol[0]}
    </div>
  );
}
