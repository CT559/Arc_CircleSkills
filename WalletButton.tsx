import { shortAddr, explorerAddr, EXPLORER } from "../lib/arc";

interface Props {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  usdcBalance: string;
  eurcBalance: string;
  onConnect: () => void;
  onDisconnect: () => void;
}

export default function WalletButton({
  address,
  isConnected,
  isConnecting,
  usdcBalance,
  eurcBalance,
  onConnect,
  onDisconnect,
}: Props) {
  if (!isConnected) {
    return (
      <button
        onClick={onConnect}
        disabled={isConnecting}
        className="btn-primary"
        style={{ width: "auto", padding: "8px 18px", fontSize: 14 }}
      >
        {isConnecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="card px-3 py-2 text-sm hidden sm:flex items-center gap-3">
        <span className="text-gray-400 text-xs">USDC</span>
        <span className="font-semibold text-white">{usdcBalance}</span>
        <span className="text-gray-600">·</span>
        <span className="text-gray-400 text-xs">EURC</span>
        <span className="font-semibold text-white">{eurcBalance}</span>
      </div>
      <a
        href={explorerAddr(address!)}
        target="_blank"
        rel="noreferrer"
        className="card px-3 py-2 text-sm font-mono text-blue-400 hover:text-blue-300 transition-colors"
      >
        {shortAddr(address!)}
      </a>
      <button onClick={onDisconnect} className="btn-secondary text-xs px-3 py-2">
        Disconnect
      </button>
    </div>
  );
}
