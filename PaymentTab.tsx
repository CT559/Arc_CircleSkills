import { useState, useEffect, useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  CONTRACTS,
  ERC20_ABI,
  explorerTx,
  parseUsdc,
  formatUsdc,
  shortAddr,
  EXPLORER,
} from "../lib/arc";
import {
  saveRequest,
  getRequest,
  updateRequest,
  getAllRequests,
  PaymentRequest,
} from "../lib/storage";

interface Props {
  address: string | null;
  isConnected: boolean;
  getPublicClient: () => any;
  getWalletClient: () => any;
  refreshBalances: () => void;
}

export default function PaymentTab({
  address,
  isConnected,
  getPublicClient,
  getWalletClient,
  refreshBalances,
}: Props) {
  const [tab, setTab] = useState<"create" | "list" | "pay">("create");
  const [amount, setAmount] = useState("0.01");
  const [description, setDescription] = useState("");
  const [recipient, setRecipient] = useState("");
  const [createdReq, setCreatedReq] = useState<PaymentRequest | null>(null);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [payReqId, setPayReqId] = useState("");
  const [payReq, setPayReq] = useState<PaymentRequest | null>(null);
  const [status, setStatus] = useState("");
  const [txHash, setTxHash] = useState("");
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const reloadRequests = useCallback(() => {
    setRequests(Object.values(getAllRequests()).sort((a, b) => b.createdAt - a.createdAt));
  }, []);

  useEffect(() => {
    reloadRequests();
  }, [reloadRequests]);

  const createRequest = () => {
    if (!recipient || !amount || !description) return;
    const req: PaymentRequest = {
      id: uuidv4(),
      amount,
      description,
      recipient,
      status: "pending",
      createdAt: Date.now(),
    };
    saveRequest(req);
    setCreatedReq(req);
    reloadRequests();
  };

  const copyLink = () => {
    if (!createdReq) return;
    navigator.clipboard.writeText(
      `${window.location.origin}?pay=${createdReq.id}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const loadPayRequest = () => {
    const req = getRequest(payReqId.trim());
    if (req) setPayReq(req);
    else setStatus("Request not found.");
  };

  const pollForPayment = useCallback(
    async (req: PaymentRequest, hash: string) => {
      const client = getPublicClient();
      let tries = 0;
      const interval = setInterval(async () => {
        tries++;
        try {
          const receipt = await client.getTransactionReceipt({ hash: hash as `0x${string}` });
          if (receipt?.status === "success") {
            updateRequest(req.id, {
              status: "paid",
              txHash: hash,
              paidAt: Date.now(),
            });
            setPayReq((r) => r ? { ...r, status: "paid", txHash: hash } : r);
            reloadRequests();
            clearInterval(interval);
          }
        } catch {}
        if (tries > 30) clearInterval(interval);
      }, 3000);
    },
    [getPublicClient, reloadRequests]
  );

  const payRequest = async () => {
    if (!payReq || !isConnected) return;
    setLoading(true);
    setStatus("Sending USDC…");
    setTxHash("");
    try {
      const walletClient = getWalletClient();
      const hash = await walletClient.writeContract({
        address: CONTRACTS.USDC,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [payReq.recipient as `0x${string}`, parseUsdc(payReq.amount)],
      });
      setTxHash(hash);
      setStatus("Confirming on-chain…");
      pollForPayment(payReq, hash);
      refreshBalances();
    } catch (err: any) {
      setStatus(`Error: ${err.shortMessage || err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Auto-load pay request from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const payId = params.get("pay");
    if (payId) {
      setPayReqId(payId);
      const req = getRequest(payId);
      if (req) {
        setPayReq(req);
        setTab("pay");
      }
    }
  }, []);

  return (
    <div>
      {/* Sub-tabs */}
      <div className="flex gap-2 mb-6">
        {(["create", "list", "pay"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${
              tab === t ? "tab-active" : "tab-inactive"
            }`}
          >
            {t === "create" ? "Create Request" : t === "list" ? "My Requests" : "Pay a Request"}
          </button>
        ))}
      </div>

      {/* Create */}
      {tab === "create" && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">New Payment Request</h2>
          {createdReq ? (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-4">
                <p className="text-green-400 font-semibold text-sm mb-1">Request created!</p>
                <p className="text-2xl font-bold text-white">{createdReq.amount} USDC</p>
                <p className="text-gray-400 text-sm mt-1">{createdReq.description}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">Recipient</p>
                <p className="mono text-sm text-gray-300">{createdReq.recipient}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-2">Shareable link</p>
                <div className="flex gap-2">
                  <div className="flex-1 bg-black/40 rounded-lg px-3 py-2 mono text-xs text-blue-400 truncate">
                    {typeof window !== "undefined"
                      ? `${window.location.origin}?pay=${createdReq.id}`
                      : `…?pay=${createdReq.id}`}
                  </div>
                  <button onClick={copyLink} className="btn-secondary whitespace-nowrap">
                    {copied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <button
                onClick={() => {
                  setCreatedReq(null);
                  setAmount("0.01");
                  setDescription("");
                  setRecipient("");
                }}
                className="btn-secondary w-full"
              >
                Create another
              </button>
            </div>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Amount (USDC)</label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.01"
                  step="0.01"
                  min="0.01"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Description</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Invoice #001 – Web design services"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Recipient wallet address</label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  className="mono"
                />
              </div>
              <button
                onClick={createRequest}
                disabled={!amount || !description || !recipient}
                className="btn-primary"
              >
                Generate Payment Link
              </button>
            </>
          )}
        </div>
      )}

      {/* List */}
      {tab === "list" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">My Requests</h2>
            <button onClick={reloadRequests} className="btn-secondary text-xs">Refresh</button>
          </div>
          {requests.length === 0 && (
            <div className="card p-8 text-center text-gray-500">
              No requests yet. Create one above!
            </div>
          )}
          {requests.map((req) => (
            <div key={req.id} className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xl font-bold text-white">{req.amount} USDC</span>
                <span
                  className={`status-badge ${req.status === "paid" ? "status-paid" : "status-pending"}`}
                >
                  <span
                    className={`pulse-dot ${req.status === "paid" ? "bg-green-500" : "bg-yellow-500"}`}
                    style={{ animation: req.status === "paid" ? "none" : undefined }}
                  />
                  {req.status === "paid" ? "Paid" : "Pending"}
                </span>
              </div>
              <p className="text-gray-400 text-sm mb-1">{req.description}</p>
              <p className="mono text-xs text-gray-600">{shortAddr(req.recipient)}</p>
              {req.txHash && (
                <a
                  href={explorerTx(req.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="explorer-link block mt-2"
                >
                  View on ArcScan →
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pay */}
      {tab === "pay" && (
        <div className="card p-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">Pay a Request</h2>
          {!payReq ? (
            <>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Request ID</label>
                <input
                  type="text"
                  value={payReqId}
                  onChange={(e) => setPayReqId(e.target.value)}
                  placeholder="Paste request ID or visit the shared link"
                />
              </div>
              <button onClick={loadPayRequest} disabled={!payReqId} className="btn-primary">
                Load Request
              </button>
              {status && <p className="text-red-400 text-sm">{status}</p>}
            </>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-3xl font-bold text-white">{payReq.amount} USDC</p>
                  <p className="text-gray-400 text-sm mt-1">{payReq.description}</p>
                </div>
                <span
                  className={`status-badge ${payReq.status === "paid" ? "status-paid" : "status-pending"}`}
                >
                  {payReq.status === "paid" ? "Paid" : "Pending"}
                </span>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">To</p>
                <p className="mono text-sm text-gray-300">{payReq.recipient}</p>
              </div>
              {payReq.status === "paid" ? (
                <div className="bg-green-900/20 border border-green-500/20 rounded-lg p-4">
                  <p className="text-green-400 font-semibold">✓ Payment confirmed on Arc Testnet</p>
                  {payReq.txHash && (
                    <a
                      href={explorerTx(payReq.txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="explorer-link block mt-2"
                    >
                      View on ArcScan →
                    </a>
                  )}
                </div>
              ) : (
                <>
                  {!isConnected && (
                    <p className="text-yellow-400 text-sm">Connect your wallet to pay</p>
                  )}
                  <button
                    onClick={payRequest}
                    disabled={!isConnected || loading}
                    className="btn-primary"
                  >
                    {loading ? "Processing…" : `Pay ${payReq.amount} USDC`}
                  </button>
                  {status && (
                    <p className={`text-sm ${txHash ? "text-blue-400" : "text-gray-400"}`}>
                      {status}
                    </p>
                  )}
                  {txHash && (
                    <a
                      href={explorerTx(txHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="explorer-link block"
                    >
                      View on ArcScan →
                    </a>
                  )}
                </>
              )}
              <button onClick={() => { setPayReq(null); setPayReqId(""); setStatus(""); }} className="btn-secondary w-full">
                Load different request
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
