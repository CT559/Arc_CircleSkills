import { useState, useEffect, useCallback } from 'react';

// Arc Testnet chain config
export const ARC_TESTNET = {
  chainId: '0x4CE252', // 5042002 in hex
  chainIdDecimal: 5042002,
  chainName: 'Arc Testnet',
  nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 6 },
  rpcUrls: ['https://rpc.testnet.arc.network'],
  blockExplorerUrls: ['https://testnet.arcscan.app'],
};

export const ETHEREUM_SEPOLIA = {
  chainId: '0xaa36a7',
  chainIdDecimal: 11155111,
  chainName: 'Ethereum Sepolia',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://rpc.sepolia.org'],
  blockExplorerUrls: ['https://sepolia.etherscan.io'],
};

export const BASE_SEPOLIA = {
  chainId: '0x14a34',
  chainIdDecimal: 84532,
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://sepolia.base.org'],
  blockExplorerUrls: ['https://sepolia-explorer.base.org'],
};

export interface WalletState {
  address: string | null;
  chainId: number | null;
  walletType: 'metamask' | 'phantom' | null;
  isConnecting: boolean;
  error: string | null;
}

export function useWallet() {
  const [state, setState] = useState<WalletState>({
    address: null,
    chainId: null,
    walletType: null,
    isConnecting: false,
    error: null,
  });

  const getEthereum = () => {
    if (typeof window === 'undefined') return null;
    return (window as any).ethereum;
  };

  const getPhantomEthereum = () => {
    if (typeof window === 'undefined') return null;
    const phantom = (window as any).phantom;
    return phantom?.ethereum ?? null;
  };

  const updateChain = useCallback(async (provider: any) => {
    try {
      const chainIdHex = await provider.request({ method: 'eth_chainId' });
      const chainId = parseInt(chainIdHex, 16);
      setState(prev => ({ ...prev, chainId }));
    } catch {}
  }, []);

  const connectMetaMask = useCallback(async () => {
    const ethereum = getEthereum();
    if (!ethereum) {
      setState(prev => ({ ...prev, error: 'MetaMask not installed. Please install it from metamask.io' }));
      return;
    }
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    try {
      const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await ethereum.request({ method: 'eth_chainId' });
      setState({
        address: accounts[0],
        chainId: parseInt(chainIdHex, 16),
        walletType: 'metamask',
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, isConnecting: false, error: err.message ?? 'Connection rejected' }));
    }
  }, []);

  const connectPhantom = useCallback(async () => {
    const phantomEth = getPhantomEthereum();
    if (!phantomEth) {
      setState(prev => ({ ...prev, error: 'Phantom wallet not installed. Please install it from phantom.app' }));
      return;
    }
    setState(prev => ({ ...prev, isConnecting: true, error: null }));
    try {
      const accounts = await phantomEth.request({ method: 'eth_requestAccounts' });
      const chainIdHex = await phantomEth.request({ method: 'eth_chainId' });
      setState({
        address: accounts[0],
        chainId: parseInt(chainIdHex, 16),
        walletType: 'phantom',
        isConnecting: false,
        error: null,
      });
    } catch (err: any) {
      setState(prev => ({ ...prev, isConnecting: false, error: err.message ?? 'Connection rejected' }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setState({ address: null, chainId: null, walletType: null, isConnecting: false, error: null });
  }, []);

  const switchToChain = useCallback(async (chain: typeof ARC_TESTNET) => {
    const ethereum = getEthereum();
    if (!ethereum) return false;
    try {
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chain.chainId }],
      });
      return true;
    } catch (switchError: any) {
      if (switchError.code === 4902) {
        try {
          await ethereum.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chain.chainId,
              chainName: chain.chainName,
              nativeCurrency: chain.nativeCurrency,
              rpcUrls: chain.rpcUrls,
              blockExplorerUrls: chain.blockExplorerUrls,
            }],
          });
          return true;
        } catch { return false; }
      }
      return false;
    }
  }, []);

  // Listen for account / chain changes
  useEffect(() => {
    const ethereum = getEthereum();
    if (!ethereum) return;

    const handleAccounts = (accounts: string[]) => {
      if (accounts.length === 0) {
        setState(prev => ({ ...prev, address: null, walletType: null }));
      } else {
        setState(prev => ({ ...prev, address: accounts[0] }));
      }
    };
    const handleChain = (chainIdHex: string) => {
      setState(prev => ({ ...prev, chainId: parseInt(chainIdHex, 16) }));
    };

    ethereum.on('accountsChanged', handleAccounts);
    ethereum.on('chainChanged', handleChain);

    // Auto-reconnect if already authorised
    ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
      if (accounts.length > 0) {
        updateChain(ethereum);
        setState(prev => ({
          ...prev,
          address: accounts[0],
          walletType: 'metamask',
        }));
      }
    }).catch(() => {});

    return () => {
      ethereum.removeListener('accountsChanged', handleAccounts);
      ethereum.removeListener('chainChanged', handleChain);
    };
  }, [updateChain]);

  return {
    ...state,
    connectMetaMask,
    connectPhantom,
    disconnect,
    switchToChain,
    isConnected: !!state.address,
    isOnArc: state.chainId === ARC_TESTNET.chainIdDecimal,
  };
}
