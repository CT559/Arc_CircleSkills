"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WalletBar from "../components/WalletBar";
import { loadRequests, saveRequests, genId, currentBlock, ARC, shortAddr } from "../lib/arc";

export default function Home() {
  const router = useRouter();
  const [tab, setTab] = useState("list"); // list | create
  const [requests, setRequests] = useState([]);
  const [form, setForm] = useState({ amount: "", description: "", recipient: "" });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setRequests(loadRequests());
  }, []);

  function updateForm(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
    setError("");
  }

  async function handleCreate(e) {
    e.preventDefault();
    setError("");
    const amount = parseFloat(form.amount);
    if (!amount || amount <= 0) return setError("Enter a valid USDC amount.");
    if (!/^0x[0-9a-fA-F]{40}$/.test(form.recipient))
      return setError("Enter a valid 0x wallet address.");

    setCreating(true);
    try {
      const fromBlock = await currentBlock();
      const req = {
        id: genId(),
        amount,
        description: form.description.trim(),
        recipient: form.recipient.trim(),
        status: "pending",
        createdAt: Date.now(),
        fromBlock,
      };
      const updated = [...loadRequests(), req];
      saveRequests(updated);
      router.push(`/pay/${req.id}`);
    } catch (e) {
      setError("Failed to create request: " + e.message);
      setCreating(false);
    }
  }

  return (
    <div className="app">
      {/* Header */}
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

      <WalletBar />

      {/* Tabs */}
      <div className="tabs">
        <div className={`tab ${tab === "list" ? "active" : ""}`} onClick={() => setTab("list")}>
          Requests ({requests.length})
        </div>
        <div className={`tab ${tab === "create" ? "active" : ""}`} onClick={() => setTab("create")}>
          + New Request
        </div>
      </div>

      {/* LIST */}
      {tab === "list" && (
        <>
          {requests.length === 0 ? (
            <div className="empty">
              No requests yet.<br />
              Create one to generate a shareable payment link.
            </div>
          ) : (
            [...requests].reverse().map((r) => (
              <div key={r.id} className="req-item" onClick={() => router.push(`/pay/${r.id}`)}>
                <div className="req-top">
                  <div>
                    <span className="req-amount">{r.amount}</span>
                    <span className="req-unit"> USDC</span>
                    <div className="req-desc">{r.description || "—"}</div>
                  </div>
                  <span className={`badge ${r.status === "paid" ? "b-paid" : "b-pending"}`}>
                    {r.status === "paid" ? "✓ Paid" : "Pending"}
                  </span>
                </div>
                <div className="req-addr">→ {shortAddr(r.recipient)}</div>
              </div>
            ))
          )}
          {requests.length === 0 && (
            <div style={{ textAlign: "center", marginTop: "1.5rem" }}>
              <button className="btn btn-primary" onClick={() => setTab("create")}>
                Create Payment Request
              </button>
            </div>
          )}
        </>
      )}

      {/* CREATE */}
      {tab === "create" && (
        <div className="card">
          <div className="card-title">Payment Details</div>
          <form onSubmit={handleCreate}>
            <div className="field">
              <label>Amount (USDC)</label>
              <div className="inp-wrap">
                <span className="inp-pre">USDC</span>
                <input
                  type="number"
                  placeholder="10.00"
                  min="0.000001"
                  step="any"
                  value={form.amount}
                  onChange={(e) => updateForm("amount", e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                placeholder="Invoice #42, consulting fee, coffee…"
                value={form.description}
                onChange={(e) => updateForm("description", e.target.value)}
              />
            </div>
            <div className="field">
              <label>Recipient Wallet Address</label>
              <input
                type="text"
                placeholder="0x…"
                autoComplete="off"
                spellCheck={false}
                value={form.recipient}
                onChange={(e) => updateForm("recipient", e.target.value)}
                required
              />
            </div>
            {error && (
              <div style={{ color: "#f87171", fontSize: 12, marginBottom: "0.8rem", fontFamily: "var(--mono)" }}>
                {error}
              </div>
            )}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: "0.3rem" }} type="submit" disabled={creating}>
              {creating ? "Creating…" : "Generate Payment Link"}
            </button>
          </form>
        </div>
      )}

      {tab === "create" && (
        <div className="notice">
          Anyone with the link can view and pay.<br />
          No wallet required to view the request.
        </div>
      )}
    </div>
  );
}
