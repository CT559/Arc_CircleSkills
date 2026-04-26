"use client";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { ensureArcNetwork, fetchUsdcBalance, shortAddr, ARC } from "../lib/arc";

const WalletCtx = createContext(null);

export function WalletProvider({ children }) {
  const [wallet, setWallet] = useState(null);
  const [balance, setBalance] = useState(null);
  const [connecting, setConnecting] = useState(false);

  const refreshBalance = useCallback(async (addr) => {
    try {
      const bal = await fetchUsdcBalance(addr);
      setBalance(bal);
    } catch {
      setBalance(null);
    }
  }, []);

  // Auto-reconnect on load
  useEffect(() => {
    if (!window.ethereum) return;
    window.ethereum.request({ method: "eth_accounts" }).then(async (accs) => {
      if (accs[0]) {
        setWallet(accs[0]);
        await refreshBalance(accs[0]);
      }
    });
    window.ethereum.on("accountsChanged", async (accs) => {
      const addr = accs[0] || null;
      setWallet(addr);
      if (addr) await refreshBalance(addr);
      else setBalance(null);
    });
    window.ethereum.on("chainChanged", () => window.location.reload());
  }, [refreshBalance]);

  const connect = useCallback(async () => {
    if (!window.ethereum) {
      alert("Please install MetaMask to continue.");
      return;
    }
    setConnecting(true);
    try {
      const accs = await window.ethereum.request({ method: "eth_requestAccounts" });
      await ensureArcNetwork();
      setWallet(accs[0]);
      await refreshBalance(accs[0]);
    } catch (e) {
      if (e.code !== 4001) console.error(e);
    } finally {
      setConnecting(false);
    }
  }, [refreshBalance]);

  return (
    <WalletCtx.Provider value={{ wallet, balance, connecting, connect, refreshBalance }}>
      {children}
    </WalletCtx.Provider>
  );
}

export function useWallet() {
  return useContext(WalletCtx);
}
