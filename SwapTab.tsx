import { useState } from 'react';

const ARC_TESTNET_CHAIN_ID = 5042002;
const EXPLORER = 'https://testnet.arcscan.app';

interface SwapResult {
  txHash: string;
  explorerUrl: string;
  amountIn: string;
  amountOut: string;
  tokenIn: string;
  tokenOut: string;
  fees?: { token: string; amount: string; type: string }[];
}

interface Props {
  address: string | null;
  chainId: number | null;
}

export default function SwapTab({ address, chainId }: Props) {
  const [tokenIn, setTokenIn] = useState<'USDC' | 'EURC'>('USDC');
  const [tokenOut, setTokenOut] = useState<'USDC' | 'EURC'>('EURC');
  const [amountIn, setAmountIn] = useState('0.01');
  const [isSwapping, setIsSwapping] = useState(false);
  const [result, setResult] = useState<SwapResult | null>(null);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const kitKey = process.env.NEXT_PUBLIC_KIT_KEY;

  const isOnArc = chainId === ARC_TESTNET_CHAIN_ID;

  const flipTokens = () => {
    setTokenIn(tokenOut);
    setTokenOut(tokenIn);
    setResult(null);
    setError('');
  };

  const executeSwap = async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }
    if (!isOnArc) {
      setError('Please switch to Arc Testnet to swap');
      return;
    }
    if (!amountIn || parseFloat(amountIn) <= 0) {
      setError('Enter a valid amount');
      return;
    }
    if (!kitKey) {
      setError('NEXT_PUBLIC_KIT_KEY environment variable is not set. Please add it in your Vercel dashboard.');
      return;
    }

    setIsSwapping(true);
    setError('');
    setResult(null);
    setStatus('Initializing App Kit…');

    try {
      // Dynamic import to avoid SSR issues
      const { AppKit } = await import('@circle-fin/app-kit');
      const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');

      setStatus('Connecting to your wallet…');

      const ethereum = (window as any).ethereum;
      if (!ethereum) throw new Error('No wallet provider found');

      // Create viem adapter from the browser provider (MetaMask)
      const adapter = createViemAdapterFromProvider({
        provider: ethereum,
        account: address as `0x${string}`,
      });

      setStatus(`Swapping ${amountIn} ${tokenIn} → ${tokenOut}…`);

      const kit = new AppKit();
      const swapResult = await kit.swap({
        from: {
          adapter,
          chain: 'Arc_Testnet',
        },
        tokenIn,
        tokenOut,
        amountIn,
        config: {
          kitKey,
        },
      });

      setResult({
        txHash: swapResult.txHash,
        explorerUrl: swapResult.explorerUrl ?? `${EXPLORER}/tx/${swapResult.txHash}`,
        amountIn: swapResult.amountIn,
        amountOut: swapResult.amountOut,
        tokenIn: swapResult.tokenIn,
        tokenOut: swapResult.tokenOut,
        fees: swapResult.fees,
      });
      setStatus('');
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      // Friendly messages
      if (msg.includes('user rejected') || msg.includes('User denied')) {
        setError('Transaction rejected by user');
      } else if (msg.includes('insufficient')) {
        setError('Insufficient USDC balance for this swap');
      } else if (msg.includes('createViemAdapterFromProvider')) {
        // Fallback: the adapter function name may differ
        setError('Adapter initialisation failed. Ensure @circle-fin/adapter-viem-v2 supports browser providers.');
      } else {
        setError(msg);
      }
      setStatus('');
    } finally {
      setIsSwapping(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Swap Tokens</h2>
        <p className="text-sm text-gray-500 mt-0.5">Swap USDC ↔ EURC directly on Arc Testnet</p>
      </div>

      {/* Swap card */}
      <div className="p-6 rounded-2xl bg-white/3 border border-white/10 space-y-4">
        {/* From */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">From</label>
          <div className="flex gap-3">
            <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tokenIn === 'USDC' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {tokenIn === 'USDC' ? '$' : '€'}
              </div>
              <div>
                <p className="text-white font-medium text-sm">{tokenIn}</p>
                <p className="text-gray-500 text-xs">{tokenIn === 'USDC' ? 'USD Coin' : 'Euro Coin'}</p>
              </div>
            </div>
            <input
              type="number"
              min="0"
              step="0.01"
              value={amountIn}
              onChange={e => { setAmountIn(e.target.value); setResult(null); setError(''); }}
              placeholder="0.01"
              className="w-36 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-right text-lg font-semibold focus:outline-none focus:border-indigo-500/50 transition-colors placeholder-gray-600"
            />
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            onClick={flipTokens}
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 hover:bg-indigo-500/20 hover:border-indigo-500/30 flex items-center justify-center transition-all group"
          >
            <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
            </svg>
          </button>
        </div>

        {/* To */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">To (estimated)</label>
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-white/5 border border-white/10">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${tokenOut === 'USDC' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {tokenOut === 'USDC' ? '$' : '€'}
            </div>
            <div className="flex-1">
              <p className="text-white font-medium text-sm">{tokenOut}</p>
              <p className="text-gray-500 text-xs">{tokenOut === 'USDC' ? 'USD Coin' : 'Euro Coin'}</p>
            </div>
            <span className="text-gray-400 text-lg font-semibold">~{(parseFloat(amountIn || '0') * 0.99).toFixed(4)}</span>
          </div>
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>Network</span>
          <span className="text-emerald-400">Arc Testnet</span>
        </div>
        <div className="flex items-center justify-between text-xs text-gray-500 px-1">
          <span>Provider fee</span>
          <span>~0.1%</span>
        </div>

        {/* Status */}
        {status && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-sm text-indigo-300">
            <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full spinner flex-shrink-0"></span>
            {status}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Success */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-sm">Swap Successful!</span>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-gray-500 text-xs">Sent</p>
                <p className="text-white font-semibold">{result.amountIn} {result.tokenIn}</p>
              </div>
              <div>
                <p className="text-gray-500 text-xs">Received</p>
                <p className="text-white font-semibold">{result.amountOut} {result.tokenOut}</p>
              </div>
            </div>
            {result.fees && result.fees.length > 0 && (
              <p className="text-xs text-gray-500">
                Fee: {result.fees.map(f => `${f.amount} ${f.token}`).join(', ')}
              </p>
            )}
            <a
              href={result.explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on ArcScan: {result.txHash.slice(0, 10)}…{result.txHash.slice(-6)}
            </a>
          </div>
        )}

        {/* Swap button */}
        {!isOnArc && address && (
          <div className="px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-400">
            ⚠️ Please switch your wallet to Arc Testnet to swap
          </div>
        )}
        <button
          onClick={executeSwap}
          disabled={isSwapping || !address}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white font-semibold transition-all flex items-center justify-center gap-2 text-sm"
        >
          {isSwapping ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spinner"></span>Swapping…</>
          ) : !address ? 'Connect Wallet to Swap' : `Swap ${amountIn || '0'} ${tokenIn} → ${tokenOut}`}
        </button>
      </div>

      {/* Info box */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8 text-xs text-gray-500 space-y-1.5">
        <p className="font-medium text-gray-400">ℹ️ About Swap</p>
        <p>Swaps use Circle's App Kit on Arc Testnet. USDC is the native gas token on Arc, so you need USDC to pay fees.</p>
        <p>Get testnet USDC from the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Circle Faucet</a>.</p>
      </div>
    </div>
  );
}
