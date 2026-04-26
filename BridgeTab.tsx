import { useState } from 'react';

const ARC_TESTNET_CHAIN_ID = 5042002;
const EXPLORER = 'https://testnet.arcscan.app';

const SOURCE_CHAINS = [
  {
    id: 'Ethereum_Sepolia',
    label: 'Ethereum Sepolia',
    chainId: 11155111,
    icon: '⟠',
    color: 'blue',
    type: 'evm',
  },
  {
    id: 'Base_Sepolia',
    label: 'Base Sepolia',
    chainId: 84532,
    icon: '🔵',
    color: 'indigo',
    type: 'evm',
  },
  {
    id: 'Solana_Devnet',
    label: 'Solana Devnet',
    chainId: null,
    icon: '◎',
    color: 'violet',
    type: 'solana',
  },
] as const;

type SourceChainId = typeof SOURCE_CHAINS[number]['id'];

interface BridgeStep {
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  txHash?: string;
}

interface BridgeResult {
  txHash: string;
  explorerUrl: string;
  amount: string;
  sourceChain: string;
}

interface Props {
  address: string | null;
  chainId: number | null;
}

export default function BridgeTab({ address, chainId }: Props) {
  const [sourceChain, setSourceChain] = useState<SourceChainId>('Ethereum_Sepolia');
  const [amount, setAmount] = useState('1.00');
  const [isBridging, setIsBridging] = useState(false);
  const [steps, setSteps] = useState<BridgeStep[]>([]);
  const [result, setResult] = useState<BridgeResult | null>(null);
  const [error, setError] = useState('');

  const selectedSource = SOURCE_CHAINS.find(c => c.id === sourceChain)!;
  const isOnSourceChain = selectedSource.type === 'evm'
    ? chainId === selectedSource.chainId
    : true; // Solana uses Phantom which is separate

  const setStep = (index: number, update: Partial<BridgeStep>) => {
    setSteps(prev => prev.map((s, i) => i === index ? { ...s, ...update } : s));
  };

  const switchToSourceChain = async () => {
    if (selectedSource.type !== 'evm' || !selectedSource.chainId) return;
    const ethereum = (window as any).ethereum;
    if (!ethereum) return;
    const chainIdHex = '0x' + selectedSource.chainId.toString(16);
    try {
      await ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: chainIdHex }] });
    } catch (err: any) {
      if (err.code === 4902) {
        const chainConfigs: Record<number, object> = {
          11155111: {
            chainId: chainIdHex,
            chainName: 'Ethereum Sepolia',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://rpc.sepolia.org'],
            blockExplorerUrls: ['https://sepolia.etherscan.io'],
          },
          84532: {
            chainId: chainIdHex,
            chainName: 'Base Sepolia',
            nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
            rpcUrls: ['https://sepolia.base.org'],
            blockExplorerUrls: ['https://sepolia-explorer.base.org'],
          },
        };
        await ethereum.request({ method: 'wallet_addEthereumChain', params: [chainConfigs[selectedSource.chainId]] });
      }
    }
  };

  const executeBridge = async () => {
    if (!address) {
      setError('Please connect your wallet first');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      setError('Enter a valid amount');
      return;
    }

    const initialSteps: BridgeStep[] = [
      { label: 'Approve USDC spending', status: 'pending' },
      { label: 'Burn USDC on source chain (CCTP)', status: 'pending' },
      { label: 'Waiting for attestation', status: 'pending' },
      { label: 'Mint USDC on Arc Testnet', status: 'pending' },
    ];
    setSteps(initialSteps);
    setIsBridging(true);
    setError('');
    setResult(null);

    try {
      // Dynamic import
      const { AppKit } = await import('@circle-fin/app-kit');

      setStep(0, { status: 'active' });

      if (selectedSource.type === 'evm') {
        const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');

        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error('No wallet provider found');

        // Ensure on correct source chain
        if (!isOnSourceChain) {
          await switchToSourceChain();
        }

        const sourceAdapter = createViemAdapterFromProvider({
          provider: ethereum,
          account: address as `0x${string}`,
        });

        setStep(0, { status: 'done' });
        setStep(1, { status: 'active' });

        // Destination adapter on Arc (switch chain in MetaMask)
        // For forwarder mode we don't need a destination adapter
        const kit = new AppKit();

        kit.on?.('approve', (event: any) => {
          setStep(0, { status: 'done', txHash: event?.values?.txHash });
          setStep(1, { status: 'active' });
        });
        kit.on?.('burn', (event: any) => {
          setStep(1, { status: 'done', txHash: event?.values?.txHash });
          setStep(2, { status: 'active' });
        });
        kit.on?.('attest', () => {
          setStep(2, { status: 'done' });
          setStep(3, { status: 'active' });
        });
        kit.on?.('mint', (event: any) => {
          setStep(3, { status: 'done', txHash: event?.values?.txHash });
        });

        const bridgeResult = await kit.bridge({
          from: {
            adapter: sourceAdapter,
            chain: sourceChain.replace('_', '_') as any,
          },
          to: {
            recipientAddress: address,
            chain: 'Arc_Testnet',
            useForwarder: true,
          },
          amount,
        });

        setSteps(s => s.map(step => ({ ...step, status: step.status === 'pending' ? 'done' : step.status })));

        setResult({
          txHash: bridgeResult.txHash ?? bridgeResult.sourceTxHash ?? '',
          explorerUrl: bridgeResult.explorerUrl ?? `${EXPLORER}/tx/${bridgeResult.destinationTxHash ?? ''}`,
          amount,
          sourceChain: selectedSource.label,
        });
      } else {
        // Solana path
        const { SolanaAdapter } = await import('@circle-fin/adapter-solana');
        const { Connection, PublicKey } = await import('@solana/web3.js');

        const phantom = (window as any).phantom?.solana;
        if (!phantom) throw new Error('Phantom wallet not found. Install Phantom from phantom.app');

        await phantom.connect();
        const publicKey = phantom.publicKey.toString();

        setStep(0, { status: 'done' });
        setStep(1, { status: 'active' });

        const connection = new Connection('https://api.devnet.solana.com', 'confirmed');

        const sourceAdapter = new SolanaAdapter({
          connection,
          wallet: phantom,
        });

        const { createViemAdapterFromProvider } = await import('@circle-fin/adapter-viem-v2');
        const ethereum = (window as any).ethereum;
        if (!ethereum) throw new Error('MetaMask required for Arc destination');

        const destAdapter = createViemAdapterFromProvider({
          provider: ethereum,
          account: address as `0x${string}`,
        });

        const kit = new AppKit();

        kit.on?.('burn', () => {
          setStep(1, { status: 'done' });
          setStep(2, { status: 'active' });
        });
        kit.on?.('attest', () => {
          setStep(2, { status: 'done' });
          setStep(3, { status: 'active' });
        });
        kit.on?.('mint', (event: any) => {
          setStep(3, { status: 'done', txHash: event?.values?.txHash });
        });

        const bridgeResult = await kit.bridge({
          from: {
            adapter: sourceAdapter,
            chain: 'Solana_Devnet',
          },
          to: {
            adapter: destAdapter,
            chain: 'Arc_Testnet',
          },
          amount,
        });

        setSteps(s => s.map(step => ({ ...step, status: 'done' })));
        setResult({
          txHash: bridgeResult.txHash ?? bridgeResult.destinationTxHash ?? '',
          explorerUrl: bridgeResult.explorerUrl ?? `${EXPLORER}/tx/${bridgeResult.destinationTxHash ?? ''}`,
          amount,
          sourceChain: selectedSource.label,
        });
      }
    } catch (err: any) {
      const msg = err?.message ?? String(err);
      if (msg.includes('user rejected') || msg.includes('User denied')) {
        setError('Transaction rejected by user');
      } else if (msg.includes('insufficient')) {
        setError('Insufficient USDC balance on source chain');
      } else {
        setError(msg);
      }
      setSteps(s => s.map(step => step.status === 'active' ? { ...step, status: 'error' } : step));
    } finally {
      setIsBridging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-white">Bridge USDC</h2>
        <p className="text-sm text-gray-500 mt-0.5">Transfer USDC to Arc Testnet via Circle CCTP</p>
      </div>

      {/* Card */}
      <div className="p-6 rounded-2xl bg-white/3 border border-white/10 space-y-5">
        {/* Source chain selector */}
        <div>
          <label className="text-xs text-gray-500 mb-3 block">From</label>
          <div className="grid grid-cols-3 gap-2">
            {SOURCE_CHAINS.map(chain => (
              <button
                key={chain.id}
                onClick={() => { setSourceChain(chain.id); setResult(null); setError(''); setSteps([]); }}
                className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all text-xs font-medium ${
                  sourceChain === chain.id
                    ? 'bg-indigo-500/20 border-indigo-500/40 text-indigo-300'
                    : 'bg-white/3 border-white/8 text-gray-400 hover:bg-white/8 hover:border-white/15'
                }`}
              >
                <span className="text-xl">{chain.icon}</span>
                <span className="text-center leading-tight">{chain.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Arrow */}
        <div className="flex items-center gap-3 text-gray-600">
          <div className="flex-1 h-px bg-white/8"></div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            CCTP Bridge
          </div>
          <div className="flex-1 h-px bg-white/8"></div>
        </div>

        {/* Destination */}
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/20">
          <span className="text-xl">🟢</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-white">Arc Testnet</p>
            <p className="text-xs text-gray-500">Native USDC · Chain ID 5042002</p>
          </div>
          <span className="text-xs text-emerald-400">Destination</span>
        </div>

        {/* Amount */}
        <div>
          <label className="text-xs text-gray-500 mb-2 block">Amount (USDC)</label>
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              step="0.1"
              value={amount}
              onChange={e => { setAmount(e.target.value); setResult(null); setError(''); }}
              placeholder="1.00"
              className="flex-1 px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-lg font-semibold focus:outline-none focus:border-indigo-500/50 transition-colors placeholder-gray-600"
            />
            {['1', '10', '50'].map(v => (
              <button key={v} onClick={() => setAmount(v)} className="px-3 py-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-xs text-gray-400 transition-colors">
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Chain switch warning */}
        {selectedSource.type === 'evm' && address && !isOnSourceChain && (
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs text-amber-400">Switch to {selectedSource.label} to bridge</p>
            <button onClick={switchToSourceChain} className="text-xs text-amber-300 hover:text-amber-200 underline">Switch Now</button>
          </div>
        )}

        {/* Solana notice */}
        {selectedSource.type === 'solana' && (
          <div className="px-3 py-2.5 rounded-xl bg-violet-500/10 border border-violet-500/20 text-xs text-violet-300">
            👻 Phantom wallet will be used for Solana. MetaMask required for receiving on Arc.
          </div>
        )}

        {/* Progress steps */}
        {steps.length > 0 && (
          <div className="space-y-2">
            {steps.map((step, i) => (
              <div key={i} className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                step.status === 'active' ? 'bg-indigo-500/10 border border-indigo-500/20' :
                step.status === 'done' ? 'bg-emerald-500/5 border border-emerald-500/15' :
                step.status === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                'bg-white/3 border border-white/5 opacity-50'
              }`}>
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  {step.status === 'active' && <span className="w-4 h-4 border-2 border-indigo-400/30 border-t-indigo-400 rounded-full spinner"></span>}
                  {step.status === 'done' && <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                  {step.status === 'error' && <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>}
                  {step.status === 'pending' && <span className="w-2 h-2 rounded-full bg-gray-600"></span>}
                </div>
                <span className={`text-xs flex-1 ${
                  step.status === 'active' ? 'text-indigo-300' :
                  step.status === 'done' ? 'text-emerald-400' :
                  step.status === 'error' ? 'text-red-400' : 'text-gray-600'
                }`}>{step.label}</span>
                {step.txHash && (
                  <a href={`https://sepolia.etherscan.io/tx/${step.txHash}`} target="_blank" rel="noopener noreferrer"
                    className="text-xs text-gray-500 hover:text-gray-400">↗</a>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="px-3 py-2.5 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
            <div className="flex items-center gap-2 text-emerald-400">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium text-sm">Bridge Successful!</span>
            </div>
            <p className="text-sm text-gray-300">
              <span className="font-semibold text-white">{result.amount} USDC</span> bridged from {result.sourceChain} → Arc Testnet
            </p>
            {result.txHash && (
              <a
                href={result.explorerUrl || `${EXPLORER}/tx/${result.txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
                View on Explorer: {result.txHash.slice(0, 10)}…{result.txHash.slice(-6)}
              </a>
            )}
          </div>
        )}

        {/* Bridge button */}
        <button
          onClick={executeBridge}
          disabled={isBridging || !address}
          className="w-full py-3.5 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled:opacity-50 text-white font-semibold transition-all flex items-center justify-center gap-2 text-sm"
        >
          {isBridging ? (
            <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spinner"></span>Bridging…</>
          ) : !address ? 'Connect Wallet to Bridge' : `Bridge ${amount || '0'} USDC → Arc Testnet`}
        </button>
      </div>

      {/* Info */}
      <div className="p-4 rounded-xl bg-white/3 border border-white/8 text-xs text-gray-500 space-y-1.5">
        <p className="font-medium text-gray-400">ℹ️ About Bridging</p>
        <p>Uses Circle's Cross-Chain Transfer Protocol (CCTP) — native USDC is burned on the source chain and minted on Arc Testnet. No wrapped tokens.</p>
        <p>Get testnet USDC from the <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="text-indigo-400 hover:underline">Circle Faucet</a>. Fast transfers take ~20s.</p>
      </div>
    </div>
  );
}
