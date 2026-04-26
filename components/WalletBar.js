"use client";
import { useWallet } from "./WalletContext";
import { shortAddr } from "../lib/arc";

export default function WalletBar() {
  const { wallet, balance, connecting, connect } = useWallet();

  return (
    <div className="wallet-bar">
      <div className="wallet-left">
        <span className={`dot ${wallet ? "on" : ""}`} />
        <span className="wallet-addr">
          {wallet ? shortAddr(wallet) : "Not connected"}
        </span>
        {balance != null && (
          <span className="wallet-bal">{balance} USDC</span>
        )}
      </div>
      {!wallet && (
        <button className="btn btn-primary btn-sm" onClick={connect} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Wallet"}
        </button>
      )}
    </div>
  );
}
