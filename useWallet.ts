import { useState, useEffect, useCallback } from "react";
import { createPublicClient, createWalletClient, custom, http } from "viem";
import { ARC_TESTNET, CONTRACTS, ERC20_ABI, formatUsdc } from "./arc";

export interface WalletState {
  address: string | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  usdcBalance: string;
  eurcBalance: string;
  walletType: "metamask" | "phantom" | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    isConnected: false,
    isConnecting: false,
    error: null,
    usdcBalance: "0.00",
    eurcBalance: "0.00",
    walletType: null,
  });

  const getPublicClient = useCallback(() => {
    return createPublicClient({
      chain: ARC_TESTNET as any,
      transport: http("https://rpc.testnet.arc.network"),
    });
  }, []);

  const fetchBalances = useCallback(async (address: string) => {
    try {
      const client = getPublicClient();
      const [usdcRaw, eurcRaw] = await Promise.all([
        client.readContract({
          address: CONTRACTS.USDC,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }) as Promise<bigint>,
        client.readContract({
          address: CONTRACTS.EURC,
          abi: ERC20_ABI,
          functionName: "balanceOf",
          args: [address as `0x${string}`],
        }) as Promise<bigint>,
      ]);
      setState((s) => ({
        ...s,
        usdcBalance: formatUsdc(usdcRaw),
        eurcBalance: formatUsdc(eurcRaw),
      }));
    } catch {
      // balance fetch non-critical
    }
  }, [getPublicClient]);

  const switchToArc = useCallback(async (provider: any) => {
    const chainIdHex = "0x4CE952";
    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: chainIdHex,
              chainName: "Arc Testnet",
              nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
              rpcUrls: ["https://rpc.testnet.arc.network"],
              blockExplorerUrls: ["https://testnet.arcscan.app"],
            },
          ],
        });
      } else {
        throw switchError;
      }
    }
  }, []);

  const connect = useCallback(
    async (walletType: "metamask" | "phantom" = "metamask") => {
      setState((s) => ({ ...s, isConnecting: true, error: null }));
      try {
        const provider = (window as any).ethereum;
        if (!provider) {
          throw new Error(
            "No wallet found. Please install MetaMask or Phantom."
          );
        }
        await switchToArc(provider);
        const accounts = await provider.request({
          method: "eth_requestAccounts",
        });
        const address = accounts[0];
        setState((s) => ({
          ...s,
          address,
          isConnected: true,
          isConnecting: false,
          walletType,
        }));
        await fetchBalances(address);
      } catch (err: any) {
        setState((s) => ({
          ...s,
          isConnecting: false,
          error: err.message || "Connection failed",
        }));
      }
    },
    [switchToArc, fetchBalances]
  );

  const disconnect = useCallback(() => {
    setState({
      address: null,
      isConnected: false,
      isConnecting: false,
      error: null,
      usdcBalance: "0.00",
      eurcBalance: "0.00",
      walletType: null,
    });
  }, []);

  const refreshBalances = useCallback(() => {
    if (state.address) fetchBalances(state.address);
  }, [state.address, fetchBalances]);

  // Listen for account changes
  useEffect(() => {
    const provider = (window as any).ethereum;
    if (!provider) return;
    const handleAccountsChanged = (accounts: string[]) => {
      if (accounts.length === 0) disconnect();
      else {
        setState((s) => ({ ...s, address: accounts[0] }));
        fetchBalances(accounts[0]);
      }
    };
    provider.on?.("accountsChanged", handleAccountsChanged);
    return () => provider.removeListener?.("accountsChanged", handleAccountsChanged);
  }, [disconnect, fetchBalances]);

  const getWalletClient = useCallback(() => {
    const provider = (window as any).ethereum;
    if (!provider || !state.address) return null;
    return createWalletClient({
      account: state.address as `0x${string}`,
      chain: ARC_TESTNET as any,
      transport: custom(provider),
    });
  }, [state.address]);

  return {
    ...state,
    connect,
    disconnect,
    refreshBalances,
    getPublicClient,
    getWalletClient,
  };
}
