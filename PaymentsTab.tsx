import { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';

const ARC_TESTNET_CHAIN_ID = 5042002;
const USDC_CONTRACT = '0x3600000000000000000000000000000000000000';
const EXPLORER = 'https://testnet.arcscan.app';

// Minimal ERC-20 ABI for transfer + balanceOf
const ERC20_ABI = [
  { name: 'transfer', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }] },
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ name: 'account', type: 'address' }], outputs: [{ name: '', type: 'uint256' }] },
];

interface PaymentRequest {
  id: string;
  amount: string;
  description: string;
  recipient: string;
  createdAt: number;
  status: 'pending' | 'paid';
  txHash?: string;
}

interface Props {
  address: string | null;
  chainId: number | null;
}

const STORAGE_KEY = 'payflow_requests_v2';

export default function PaymentsTab({ address, chainId }: Props) {
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amount: '', description: '', recipient: '' });
  const [formError, setFormError] = useState('');
  const [shareId, setShareId] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payError, setPayError] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState<string | null>(null);

  // Load from localStorage
  useEffect(() => {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { setRequests(JSON.parse(raw)); } catch {}
    }

    // Check URL for shared payment
    const params = new URLSearchParams(window.location.search);
    const rid = params.get('request');
    if (rid) {
      const raw2 = localStorage.getItem(STORAGE_KEY);
      if (raw2) {
        const reqs: PaymentRequest[] = JSON.parse(raw2);
        const found = reqs.find(r => r.id === rid);
        if (found) setShareId(rid);
      }
    }
  }, []);

  const save = (updated: PaymentRequest[]) => {
    setRequests(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const createRequest = () => {
    if (!form.amount || isNaN(parseFloat(form.amount)) || parseFloat(form.amount) <= 0) {
      setFormError('Enter a valid amount');
      return;
    }
    if (!form.recipient || !/^0x[0-9a-fA-F]{40}$/.test(form.recipient)) {
      setFormError('Enter a valid Ethereum address');
      return;
    }
    const req: PaymentRequest = {
      id: uuidv4(),
      amount: parseFloat(form.amount).toFixed(6),
      description: form.description || 'Payment Request',
      recipient: form.recipient,
      createdAt: Date.now(),
      status: 'pending',
    };
    save([req, ...requests]);
    setForm({ amount: '', description: '', recipient: '' });
    setFormError('');
    setShowForm(false);
    setShareId(req.id);
  };

  const getShareLink = (id: string) => {
    return `${window.location.origin}${window.location.pathname}?request=${id}`;
  };

  const copyLink = (id: string) => {
    navigator.clipboard.writeText(getShareLink(id));
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const payRequest = useCallback(async (req: PaymentRequest) => {
    if (!address) return;
    const eth = (window as any).ethereum;
    if (!eth) return;

    if (chainId !== ARC_TESTNET_CHAIN_ID) {
      setPayError(prev => ({ ...prev, [req.id]: 'Please switch to Arc Testnet first' }));
      return;
    }

    setPayingId(req.id);
    setPayError(prev => ({ ...prev, [req.id]: '' }));

    try {
      // Encode ERC-20 transfer(address, uint256)
      const amountUnits = BigInt(Math.round(parseFloat(req.amount) * 1_000_000)).toString(16).padStart(64, '0');
      const recipientHex = req.recipient.replace('0x', '').padStart(64, '0');
      const data = '0xa9059cbb' + recipientHex + amountUnits;

      const txHash = await eth.request({
        method: 'eth_sendTransaction',
        params: [{
          from: address,
          to: USDC_CONTRACT,
          data,
          gas: '0x30D40', // 200000
        }],
      });

      const updated = requests.map(r =>
        r.id === req.id ? { ...r, status: 'paid' as const, txHash } : r
      );
      save(updated);
    } catch (err: any) {
      setPayError(prev => ({ ...prev, [req.id]: err.message ?? 'Transaction failed' }));
    } finally {
      setPayingId(null);
    }
  }, [address, chainId, requests]);

  const focusedRequest = shareId ? requests.find(r => r.id === shareId) : null;

  return (
    <div className="space-y-6">
      {/* Focused shared request */}
      {focusedRequest && (
        <div className="p-6 rounded-2xl bg-indigo-500/10 border border-indigo-500/30">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-xs text-indigo-400 mb-1 uppercase tracking-wider">Payment Request</p>
              <h2 className="text-xl font-semibold text-white">{focusedRequest.description}</h2>
            </div>
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${focusedRequest.status === 'paid' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {focusedRequest.status}
            </span>
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-4xl font-bold text-white">{parseFloat(focusedRequest.amount).toFixed(2)}</span>
            <span className="text-gray-400">USDC</span>
          </div>
          <p className="text-xs text-gray-500 mb-4 font-mono break-all">To: {focusedRequest.recipient}</p>
          {focusedRequest.status === 'pending' && address && (
            <button
              onClick={() => payRequest(focusedRequest)}
              disabled={payingId === focusedRequest.id}
              className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              {payingId === focusedRequest.id ? (
                <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full spinner"></span>Processing…</>
              ) : `Pay ${parseFloat(focusedRequest.amount).toFixed(2)} USDC`}
            </button>
          )}
          {focusedRequest.txHash && (
            <a href={`${EXPLORER}/tx/${focusedRequest.txHash}`} target="_blank" rel="noopener noreferrer"
              className="mt-3 flex items-center gap-2 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              View on ArcScan
            </a>
          )}
        </div>
      )}

      {/* Header + create button */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-white">
          Requests <span className="text-gray-500 font-normal text-sm">({requests.length})</span>
        </h2>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-sm text-gray-300 transition-all"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Request
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-6 rounded-2xl bg-white/3 border border-white/10 space-y-4">
          <h3 className="text-sm font-medium text-gray-300">Create Payment Request</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Amount (USDC)</label>
              <input
                type="number" min="0" step="0.01"
                value={form.amount}
                onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="10.00"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Description</label>
              <input
                type="text"
                value={form.description}
                onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                placeholder="Invoice #001"
                className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:border-indigo-500/50 transition-colors"
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Recipient Address</label>
            <input
              type="text"
              value={form.recipient}
              onChange={e => setForm(p => ({ ...p, recipient: e.target.value }))}
              placeholder="0x..."
              className="w-full px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-600 text-sm font-mono focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
          {formError && <p className="text-xs text-red-400">{formError}</p>}
          <div className="flex gap-3">
            <button
              onClick={createRequest}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
            >
              Create Payment Request
            </button>
            <button
              onClick={() => { setShowForm(false); setFormError(''); }}
              className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-sm text-gray-400 transition-all"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Requests list */}
      {requests.length === 0 && !showForm && (
        <div className="py-16 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <p className="text-gray-500 text-sm mb-1">No requests yet.</p>
          <p className="text-gray-600 text-xs">Create one to generate a shareable payment link.</p>
          <button
            onClick={() => setShowForm(true)}
            className="mt-4 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium transition-all"
          >
            Create Payment Request
          </button>
        </div>
      )}

      <div className="space-y-3">
        {requests.map(req => (
          <div key={req.id} className="p-4 rounded-xl bg-white/3 border border-white/8 hover:border-white/15 transition-all group">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full ${req.status === 'paid' ? 'bg-emerald-400' : 'bg-amber-400'}`}></span>
                  <p className="text-sm font-medium text-white truncate">{req.description}</p>
                </div>
                <p className="text-xs text-gray-500 font-mono truncate">{req.recipient}</p>
              </div>
              <div className="text-right flex-shrink-0">
                <p className="text-lg font-bold text-white">{parseFloat(req.amount).toFixed(2)} <span className="text-xs font-normal text-gray-500">USDC</span></p>
                <p className="text-xs text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <button
                onClick={() => copyLink(req.id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 transition-colors"
              >
                {copied === req.id ? '✓ Copied!' : (
                  <><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>Copy Link</>
                )}
              </button>
              {req.status === 'pending' && address && (
                <button
                  onClick={() => payRequest(req)}
                  disabled={payingId === req.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/40 text-indigo-400 text-xs transition-colors disabled:opacity-50"
                >
                  {payingId === req.id
                    ? <><span className="w-3 h-3 border border-indigo-400/30 border-t-indigo-400 rounded-full spinner"></span>Paying…</>
                    : 'Pay Now'}
                </button>
              )}
              {req.status === 'paid' && (
                <span className="px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 text-xs">✓ Paid</span>
              )}
              {req.txHash && (
                <a href={`${EXPLORER}/tx/${req.txHash}`} target="_blank" rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-xs text-gray-400 transition-colors">
                  View tx ↗
                </a>
              )}
              {payError[req.id] && <p className="text-xs text-red-400 w-full">{payError[req.id]}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
