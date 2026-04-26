import { useState } from 'react';
import Head from 'next/head';
import { useWallet, ARC_TESTNET, ETHEREUM_SEPOLIA, BASE_SEPOLIA } from '../components/useWallet';
import WalletBar from '../components/WalletBar';
import PaymentsTab from '../components/PaymentsTab';
import SwapTab from '../components/SwapTab';
import BridgeTab from '../components/BridgeTab';

type Tab = 'payments' | 'swap' | 'bridge';

const TABS: { id: Tab; label: string; icon: JSX.Element }[] = [
  {
    id: 'payments',
    label: 'Payments',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    id: 'swap',
    label: 'Swap',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
      </svg>
    ),
  },
  {
    id: 'bridge',
    label: 'Bridge',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('payments');
  const wallet = useWallet();

  const targetChain = activeTab === 'bridge'
    ? (wallet.chainId === ETHEREUM_SEPOLIA.chainIdDecimal ? ETHEREUM_SEPOLIA : BASE_SEPOLIA)
    : ARC_TESTNET;

  return (
    <>
      <Head>
        <title>PayFlow — USDC on Arc Testnet</title>
        <meta name="description" content="USDC Payments, Swap, and Bridge on Arc Testnet" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className="min-h-screen">
        {/* Top gradient bar */}
        <div className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500"></div>

        <div className="max-w-xl mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <h1 className="text-2xl font-bold text-white tracking-tight">PayFlow</h1>
                </div>
                <div className="flex items-center gap-2 ml-11">
                  <span className="text-xs text-gray-500">Arc Testnet · 5042002</span>
                  <span className="w-1 h-1 rounded-full bg-gray-700"></span>
                  <span className="text-xs text-indigo-400">USDC Native</span>
                </div>
              </div>
              <WalletBar
                wallet={wallet}
                showChainSwitcher={activeTab !== 'bridge'}
                targetChain={activeTab === 'swap' ? ARC_TESTNET : undefined}
                targetChainLabel={activeTab === 'swap' ? 'Arc Testnet' : undefined}
              />
            </div>
          </div>

          {/* Tab navigation */}
          <div className="flex items-center gap-1 p-1 rounded-xl bg-white/3 border border-white/8 mb-6">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white/10 text-white shadow-lg'
                    : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="min-h-96">
            {activeTab === 'payments' && (
              <PaymentsTab address={wallet.address} chainId={wallet.chainId} />
            )}
            {activeTab === 'swap' && (
              <SwapTab address={wallet.address} chainId={wallet.chainId} />
            )}
            {activeTab === 'bridge' && (
              <BridgeTab address={wallet.address} chainId={wallet.chainId} />
            )}
          </div>

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-white/5 flex items-center justify-between text-xs text-gray-600">
            <span>PayFlow v2 · Arc Testnet</span>
            <div className="flex items-center gap-4">
              <a href="https://faucet.circle.com" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Faucet</a>
              <a href="https://testnet.arcscan.app" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Explorer</a>
              <a href="https://docs.arc.network" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400 transition-colors">Docs</a>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
