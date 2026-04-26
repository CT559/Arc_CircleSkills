import { useState } from "react";
import Head from "next/head";
import dynamic from "next/dynamic";
import { useWallet } from "../lib/useWallet";
import WalletButton from "../components/WalletButton";

// Dynamic imports to avoid SSR issues with wallet libs
const PaymentTab = dynamic(() => import("../components/PaymentTab"), { ssr: false });
const SwapTab = dynamic(() => import("../components/SwapTab"), { ssr: false });
const BridgeTab = dynamic(() => import("../components/BridgeTab"), { ssr: false });

type Tab = "payments" | "swap" | "bridge";

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>("payments");
  const wallet = useWallet();

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: "payments", label: "Payment Requests", icon: "⚡" },
    { id: "swap", label: "Swap", icon: "↔" },
    { id: "bridge", label: "Bridge", icon: "⛓" },
  ];

  return (
    <>
      <Head>
        <title>PayFlow – USDC Payments on Arc</title>
        <meta name="description" content="USDC payment requests, swaps, and cross-chain bridging on Arc Testnet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>⚡</text></svg>" />
      </Head>

      <div style={{ minHeight: "100vh", background: "#0A0B14" }}>
        {/* Header */}
        <header
          style={{
            borderBottom: "1px solid #1E2035",
            background: "rgba(10,11,20,0.8)",
            backdropFilter: "blur(12px)",
            position: "sticky",
            top: 0,
            zIndex: 50,
          }}
        >
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>⚡ PayFlow</span>
                <span style={{ fontSize: 11, background: "#1E2035", color: "#6B7280", padding: "2px 8px", borderRadius: 99 }}>
                  Arc Testnet
                </span>
              </div>
              <WalletButton
                address={wallet.address}
                isConnected={wallet.isConnected}
                isConnecting={wallet.isConnecting}
                usdcBalance={wallet.usdcBalance}
                eurcBalance={wallet.eurcBalance}
                onConnect={() => wallet.connect("metamask")}
                onDisconnect={wallet.disconnect}
              />
            </div>
          </div>
        </header>

        {/* Navigation tabs */}
        <div style={{ borderBottom: "1px solid #1E2035", background: "#0A0B14" }}>
          <div style={{ maxWidth: 960, margin: "0 auto", padding: "0 20px" }}>
            <nav style={{ display: "flex", gap: 0 }}>
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    padding: "14px 20px",
                    fontSize: 14,
                    fontWeight: 500,
                    border: "none",
                    background: "transparent",
                    cursor: "pointer",
                    borderBottom: activeTab === tab.id ? "2px solid #0066FF" : "2px solid transparent",
                    color: activeTab === tab.id ? "#60a5fa" : "#6B7280",
                    transition: "all 0.2s",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Main content */}
        <main style={{ maxWidth: 960, margin: "0 auto", padding: "32px 20px" }}>
          {/* Wallet error */}
          {wallet.error && (
            <div className="status-error" style={{ marginBottom: 16, padding: "10px 16px", borderRadius: 8, fontSize: 14 }}>
              {wallet.error}
            </div>
          )}

          {/* Arc info banner */}
          {!wallet.isConnected && (
            <div
              style={{
                background: "linear-gradient(135deg, rgba(0,102,255,0.08) 0%, rgba(0,102,255,0.02) 100%)",
                border: "1px solid rgba(0,102,255,0.2)",
                borderRadius: 12,
                padding: "16px 20px",
                marginBottom: 28,
                display: "flex",
                alignItems: "center",
                gap: 16,
                flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 200 }}>
                <p style={{ color: "#60a5fa", fontWeight: 600, marginBottom: 4 }}>
                  Arc Testnet — USDC is the gas token
                </p>
                <p style={{ color: "#6B7280", fontSize: 13 }}>
                  No ETH needed. Connect MetaMask to get started. Get test USDC from{" "}
                  <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
                    faucet.circle.com
                  </a>
                </p>
              </div>
              <button
                onClick={() => wallet.connect("metamask")}
                disabled={wallet.isConnecting}
                className="btn-primary"
                style={{ width: "auto", padding: "10px 20px", flexShrink: 0 }}
              >
                {wallet.isConnecting ? "Connecting…" : "Connect Wallet"}
              </button>
            </div>
          )}

          {/* Tab content */}
          {activeTab === "payments" && (
            <PaymentTab
              address={wallet.address}
              isConnected={wallet.isConnected}
              getPublicClient={wallet.getPublicClient}
              getWalletClient={wallet.getWalletClient}
              refreshBalances={wallet.refreshBalances}
            />
          )}
          {activeTab === "swap" && (
            <SwapTab
              address={wallet.address}
              isConnected={wallet.isConnected}
              usdcBalance={wallet.usdcBalance}
              eurcBalance={wallet.eurcBalance}
              getPublicClient={wallet.getPublicClient}
              getWalletClient={wallet.getWalletClient}
              refreshBalances={wallet.refreshBalances}
            />
          )}
          {activeTab === "bridge" && (
            <BridgeTab
              address={wallet.address}
              isConnected={wallet.isConnected}
              usdcBalance={wallet.usdcBalance}
              getPublicClient={wallet.getPublicClient}
              getWalletClient={wallet.getWalletClient}
              refreshBalances={wallet.refreshBalances}
            />
          )}
        </main>

        {/* Footer */}
        <footer style={{ borderTop: "1px solid #1E2035", padding: "20px", textAlign: "center", marginTop: 40 }}>
          <p style={{ color: "#374151", fontSize: 12 }}>
            Built with{" "}
            <a href="https://github.com/circlefin/skills" target="_blank" rel="noreferrer" style={{ color: "#4B5563" }}>
              Circle Skills
            </a>{" "}
            · Deployed on{" "}
            <a href="https://vercel.com" target="_blank" rel="noreferrer" style={{ color: "#4B5563" }}>
              Vercel
            </a>{" "}
            ·{" "}
            <a href="https://testnet.arcscan.app" target="_blank" rel="noreferrer" style={{ color: "#4B5563" }}>
              ArcScan
            </a>
          </p>
        </footer>
      </div>
    </>
  );
}
