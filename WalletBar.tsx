import { useState } from 'react';
import { WalletState, ARC_TESTNET } from './useWallet';

interface Props {
  wallet: WalletState & {
    connectMetaMask: () => void;
    connectPhantom: () => void;
    disconnect: () => void;
    switchToChain: (chain: typeof ARC_TESTNET) => Promise<boolean>;
    isConnected: boolean;
    isOnArc: boolean;
  };
  showChainSwitcher?: boolean;
  targetChain?: typeof ARC_TESTNET;
  targetChainLabel?: string;
}

export default function WalletBar({ wallet, showChainSwitcher = false, targetChain, targetChainLabel }: Props) {
  const [showMenu, setShowMenu] = useState(false);
  const { address, chainId, walletType, isConnecting, isConnected, isOnArc } = wallet;

  const short = (addr: string) => addr.slice(0, 6) + '…' + addr.slice(-4);

  const chainName = () => {
    if (!chainId) return 'Unknown';
    const map: Record<number, string> = {
      5042002: 'Arc Testnet',
      11155111: 'Ethereum Sepolia',
      84532: 'Base Sepolia',
      1: 'Ethereum',
      8453: 'Base',
    };
    return map[chainId] ?? `Chain ${chainId}`;
  };

  if (!isConnected) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
          <span className="w-2 h-2 rounded-full bg-gray-500 pulse-dot"></span>
          Not connected
        </div>
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            disabled={isConnecting}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all disabled:opacity-50"
          >
            {isConnecting ? (
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spinner"></span>
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            )}
            Connect Wallet
          </button>
          {showMenu && (
            <div className="absolute right-0 top-full mt-2 w-48 bg-gray-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
              <button
                onClick={() => { wallet.connectMetaMask(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-left transition-colors"
              >
                <img src="/metamask.svg" alt="" className="w-5 h-5" onError={e => (e.currentTarget.style.display='none')} />
                🦊 MetaMask
              </button>
              <button
                onClick={() => { wallet.connectPhantom(); setShowMenu(false); }}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 text-sm text-left transition-colors border-t border-white/5"
              >
                👻 Phantom
              </button>
            </div>
          )}
        </div>
        {wallet.error && (
          <p className="text-xs text-red-400 max-w-xs">{wallet.error}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
        <span className="w-2 h-2 rounded-full bg-emerald-400 pulse-dot"></span>
        {chainName()}
      </div>
      {showChainSwitcher && targetChain && chainId !== targetChain.chainIdDecimal && (
        <button
          onClick={() => wallet.switchToChain(targetChain)}
          className="px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400 hover:bg-amber-500/20 transition-colors"
        >
          Switch to {targetChainLabel ?? targetChain.chainName}
        </button>
      )}
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300">
        {walletType === 'metamask' ? '🦊' : '👻'} {short(address!)}
      </div>
      <button
        onClick={wallet.disconnect}
        className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400 hover:text-red-400 hover:border-red-400/30 transition-colors"
      >
        Disconnect
      </button>
    </div>
  );
}
