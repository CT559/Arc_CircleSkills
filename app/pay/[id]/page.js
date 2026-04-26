"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import WalletBar from "../../../components/WalletBar";
import { useWallet } from "../../../components/WalletContext";
import {
  loadRequests, saveRequests, checkPaidOnChain, sendUsdcTransfer,
  ensureArcNetwork, ARC, shortAddr,
} from "../../../lib/arc";

export default function PayPage() {
  const { id } = useParams();
  const router = useRouter();
  const { wallet, connect, refreshBalance } = useWallet();
  const [request, setRequest] = useState(null);
  const [copied, setCopied] = useState(false);
  const [paying, setPaying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const pollRef = useRef(null);

  // Load request from localStorage
  useEffect(() => {
    const reqs = loadRequests();
    const r = reqs.find((r) => r.id === id);
    setRequest(r || null);
  }, [id]);

  // Mark paid and persist
  const markPaid = useCallback((r, log) => {
    const updated = loadRequests().map((req) =>
      req.id === r.id
        ? { ...req, status: "paid", paidAt: Date.now(), txHash: log.transactionHash }
        : req
    );
    saveRequests(updated);
    setRequest((prev) => ({ ...prev, status: "paid", paidAt: Date.now(), txHash: log.transactionHash }));
  }, []);

  // Poll on-chain every 5 s while pending
  useEffect(() => {
    if (!request || request.status === "paid") {
      clearInterval(pollRef.current);
      return;
    }
    async function poll() {
      const log = await checkPaidOnChain(request);
      if (log) { markPaid(request, log); clearInterval(pollRef.current); }
    }
    poll(); // immediate first check
    pollRef.current = setInterval(poll, 5000);
    return () => clearInterval(pollRef.current);
  }, [request?.id, request?.status, markPaid]);

  const shareLink = `${typeof window !== "undefined" ? window.location.origin : ""}/pay/${id}`;

  function copyLink() {
    navigator.clipboard.writeText(shareLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handlePay() {
    if (!wallet) { await connect(); return; }
    setPaying(true);
    setStatusMsg("");
    try {
      await ensureArcNetwork();
      const txHash = await sendUsdcTransfer(wallet, request.recipient, request.amount);
      setStatusMsg(`Tx sent (${txHash.slice(0, 14)}…) — polling for confirmation…`);
    } catch (e) {
      if (e.code !== 4001) setStatusMsg("Error: " + (e.message || String(e)));
    } finally {
      setPaying(false);
    }
  }

  async function manualCheck() {
    if (!request) return;
    setChecking(true);
    const log = await checkPaidOnChain(request);
    if (log) {
      markPaid(request, log);
      if (wallet) refreshBalance(wallet);
    } else {
      setStatusMsg("Not confirmed yet — keep waiting.");
      setTimeout(() => setStatusMsg(""), 3000);
    }
    setChecking(false);
  }

  // ── Render states ────────────────────────────────
  if (request === null) {
    return (
      <div className="app">
        <div className="empty" style={{ paddingTop: "4rem" }}>
          Payment request not found.
        </div>
      </div>
    );
  }

  const isOwner = wallet && request.recipient.toLowerCase() === wallet.toLowerCase();

  // ── PAID ─────────────────────────────────────────
  if (request.status === "paid") {
    return (
      <div className="app">
        <Header />
        <WalletBar />
        <div className="card">
          <div style={{ textAlign: "center", padding: "0.5rem 0 1rem" }}>
            <div className="success-ring">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div style={{ fontSize: 17, fontWeight: 600 }}>Payment Confirmed</div>
            <div className="pay-amount" style={{ fontSize: "2.4rem" }}>
              {request.amount} <span className="pay-unit">USDC</span>
            </div>
            {request.description && <div className="pay-desc">{request.description}</div>}
          </div>
          <div className="divider" />
          <div className="row">
            <span className="k">Recipient</span>
            <span className="v">{shortAddr(request.recipient)}</span>
          </div>
          {request.txHash && (
            <div className="row">
              <span className="k">Transaction</span>
              <span className="v">
                <a href={`${ARC.EXPLORER}/tx/${request.txHash}`} target="_blank" rel="noreferrer">
                  {request.txHash.slice(0, 14)}…
                </a>
              </span>
            </div>
          )}
          {request.paidAt && (
            <div className="row">
              <span className="k">Paid at</span>
              <span className="v">{new Date(request.paidAt).toLocaleString()}</span>
            </div>
          )}
          <div className="divider" />
          <button className="btn btn-ghost" style={{ width: "100%" }} onClick={() => router.push("/")}>
            ← Back to requests
          </button>
        </div>
      </div>
    );
  }

  // ── PENDING ───────────────────────────────────────
  return (
    <div className="app">
      <Header />
      <WalletBar />
      <div className="card">
        <div className="pay-hero">
          <span className="badge b-pending pulse">● Awaiting Payment</span>
          <div className="pay-amount">
            {request.amount} <span className="pay-unit">USDC</span>
          </div>
          {request.description && <div className="pay-desc">{request.description}</div>}
          <div className="pay-to">To: {request.recipient}</div>
        </div>

        <div className="divider" />

        <div className="row"><span className="k">Network</span><span className="v">Arc Testnet</span></div>
        <div className="row"><span className="k">Chain ID</span><span className="v">5042002</span></div>
        <div className="row">
          <span className="k">USDC contract</span>
          <span className="v">
            <a href={`${ARC.EXPLORER}/address/${ARC.USDC}`} target="_blank" rel="noreferrer">
              {ARC.USDC.slice(0, 10)}…
            </a>
          </span>
        </div>
        <div className="row">
          <span className="k">Created</span>
          <span className="v">{new Date(request.createdAt).toLocaleDateString()}</span>
        </div>

        <div className="divider" />

        <div style={{ fontSize: "11.5px", color: "var(--muted)", marginBottom: 6 }}>Share link</div>
        <div className="link-box">
          <span className="link-url">{shareLink}</span>
          <button className="copy-btn" onClick={copyLink}>
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>

        {isOwner ? (
          <div className="info-box">
            You are the recipient of this request.<br />
            Share the link above to receive payment.
          </div>
        ) : (
          <>
            <button className="btn-pay" onClick={handlePay} disabled={paying}>
              {paying ? "Sending…" : `Pay ${request.amount} USDC`}
            </button>
            <div className="notice">
              Requires MetaMask on Arc Testnet.<br />
              Get test USDC at{" "}
              <a href="https://faucet.circle.com" target="_blank" rel="noreferrer" style={{ color: "#60a5fa" }}>
                faucet.circle.com
              </a>
            </div>
          </>
        )}

        {statusMsg && (
          <div style={{ fontFamily: "var(--mono)", fontSize: 11.5, color: "#60a5fa", marginTop: "0.75rem", lineHeight: 1.6 }}>
            {statusMsg}
          </div>
        )}

        <div className="two-btn">
          <button className="btn btn-ghost" onClick={() => router.push("/")}>← Back</button>
          <button className="btn btn-ghost" onClick={manualCheck} disabled={checking}>
            {checking ? "Checking…" : "Check status"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <div className="header">
      <div className="logo-mark">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="7 17 17 7" />
          <polyline points="7 7 17 7 17 17" />
        </svg>
      </div>
      <div>
        <div className="logo-name">PayFlow</div>
        <div className="logo-sub">USDC Payment Requests</div>
      </div>
      <div className="network-tag">Arc Testnet · 5042002</div>
    </div>
  );
}
