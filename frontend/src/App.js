import React, { useEffect, useState, useCallback } from "react";
import "./App.css";

/* ============================================================
   All API paths are IDENTICAL to the original so K8s Ingress
   rules (/api/* → backend service) require zero changes.
   ============================================================ */
const API = "/api";

/* Stable avatar color from username hash */
const AV_COLORS = ["av-purple", "av-teal", "av-gold", "av-red", "av-sky"];
function avatarColor(name) {
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % AV_COLORS.length;
  return AV_COLORS[h];
}
function initials(name) {
  return name.slice(0, 2).toUpperCase();
}

/* Ripple helper */
function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height) * 1.6;
  const span = document.createElement("span");
  span.className = "ripple-span";
  span.style.cssText = `
    width:${size}px;height:${size}px;
    left:${e.clientX - rect.left - size / 2}px;
    top:${e.clientY - rect.top - size / 2}px;
  `;
  btn.appendChild(span);
  setTimeout(() => span.remove(), 600);
}

/* Format number */
function fmt(n) {
  return Number(n).toLocaleString("en-EG", { maximumFractionDigits: 2 });
}

/* Format timestamp */
function fmtTime(ts) {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleString("en-EG", {
      month: "short", day: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return ts; }
}

/* ============================================================
   MAIN COMPONENT
   ============================================================ */
export default function App() {
  const [accounts, setAccounts]       = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [txFilter, setTxFilter]       = useState("all");

  /* Form state — create account */
  const [newUser, setNewUser]   = useState("");
  const [newBal,  setNewBal]    = useState("");

  /* Form state — transfer */
  const [fromUser,   setFromUser]   = useState("");
  const [toUser,     setToUser]     = useState("");
  const [txAmount,   setTxAmount]   = useState("");

  /* Deposit amounts per account id */
  const [depAmounts, setDepAmounts] = useState({});

  /* Toast */
  const [toast, setToast] = useState({ show: false, msg: "", type: "success" });

  /* -------- Data loading -------- */
  const load = useCallback(async () => {
    try {
      const [accRes, txRes] = await Promise.all([
        fetch(`${API}/accounts`),
        fetch(`${API}/transactions`),
      ]);
      const accData = await accRes.json();
      const txData  = await txRes.json();
      if (Array.isArray(accData)) setAccounts(accData);
      if (Array.isArray(txData))  setTransactions(txData);
    } catch {
      showToast("Network error — could not reach backend", "error");
    }
  }, []);

  useEffect(() => {
    /* Seed once then load — identical to original behaviour */
    fetch(`${API}/seed`, { method: "POST" }).finally(load);
  }, [load]);

  /* -------- Toast -------- */
  function showToast(msg, type = "success") {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3200);
  }

  /* -------- Actions -------- */
  async function handleCreateAccount(e) {
    addRipple(e);
    if (!newUser.trim()) { showToast("Enter a username", "error"); return; }
    const balance = parseFloat(newBal) || 0;
    try {
      const res  = await fetch(
        `${API}/create-account?username=${encodeURIComponent(newUser.trim())}&balance=${balance}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.error) { showToast(data.error, "error"); return; }
      showToast(`Account "${newUser.trim()}" created`, "success");
      setNewUser("");
      setNewBal("");
      await load();
    } catch { showToast("Request failed", "error"); }
  }

  async function handleTransfer(e) {
    addRipple(e);
    if (!fromUser.trim() || !toUser.trim()) { showToast("Fill both usernames", "error"); return; }
    const amount = parseFloat(txAmount);
    if (!amount || amount <= 0) { showToast("Enter a valid amount", "error"); return; }
    try {
      const res  = await fetch(
        `${API}/transfer?from_user=${encodeURIComponent(fromUser.trim())}&to_user=${encodeURIComponent(toUser.trim())}&amount=${amount}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.error) { showToast(data.error, "error"); return; }
      showToast(`Transferred ${fmt(amount)} EGP successfully`, "success");
      setFromUser(""); setToUser(""); setTxAmount("");
      await load();
    } catch { showToast("Request failed", "error"); }
  }

  async function handleDeposit(username, accountId, e) {
    addRipple(e);
    const amount = parseFloat(depAmounts[accountId]);
    if (!amount || amount <= 0) { showToast("Enter a deposit amount", "error"); return; }
    try {
      const res  = await fetch(
        `${API}/deposit?user=${encodeURIComponent(username)}&amount=${amount}`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.error) { showToast(data.error, "error"); return; }
      showToast(`Deposited ${fmt(amount)} EGP to ${username}`, "success");
      setDepAmounts(prev => ({ ...prev, [accountId]: "" }));
      await load();
    } catch { showToast("Request failed", "error"); }
  }

  /* -------- Derived values -------- */
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0);

  const filteredTx = [...transactions].reverse().filter(t => {
    if (txFilter === "dep")  return t.from === "BANK";
    if (txFilter === "send") return t.from !== "BANK";
    return true;
  });

  /* ============================================================
     RENDER
     ============================================================ */
  return (
    <div className="layout">

      {/* ---- SIDEBAR ---- */}
      <aside className="sidebar">
        <div className="logo-wrap">
          <div className="logo-icon">
            {/* Banky logo — house with upward arrow + speed lines = fast transactions */}
            <svg viewBox="0 0 26 26" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M4 13.5 L13 5 L22 13.5"
                stroke="white" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"
              />
              <path
                d="M7 12 L7 21 L19 21 L19 12"
                stroke="white" strokeWidth="2"
                strokeLinecap="round" strokeLinejoin="round"
              />
              <path
                d="M10 21 L10 16.5 L16 16.5 L16 21"
                stroke="white" strokeWidth="1.6"
                strokeLinecap="round" strokeLinejoin="round"
              />
              {/* Speed spark — represents fast transactions */}
              <circle cx="20.5" cy="6.5" r="3.8" fill="#F5C842" />
              <path
                d="M19.5 6.5 L20.3 7.4 L22 5.5"
                stroke="#0D0F1E" strokeWidth="1.3"
                strokeLinecap="round" strokeLinejoin="round"
              />
            </svg>
          </div>
          <div className="logo-text-wrap">
            <div className="logo-name">Banky</div>
            <div className="logo-tag">Fast · Secure · Smart</div>
          </div>
        </div>

        <div className="nav-section-label">Main</div>

        <div className="nav-item active">
          <i className="ti ti-layout-dashboard" aria-hidden="true" />
          Dashboard
          <div className="nav-pip" />
        </div>
        <div className="nav-item">
          <i className="ti ti-arrow-left-right" aria-hidden="true" />
          Transfers
        </div>
        <div className="nav-item">
          <i className="ti ti-users" aria-hidden="true" />
          Accounts
        </div>

        <div className="nav-section-label">Reports</div>

        <div className="nav-item">
          <i className="ti ti-chart-line" aria-hidden="true" />
          Analytics
        </div>
        <div className="nav-item">
          <i className="ti ti-history" aria-hidden="true" />
          History
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-footer-label">System Status</div>
          <div className="sidebar-footer-val">
            <div className="status-dot" />
            All systems normal
          </div>
        </div>
      </aside>

      {/* ---- MAIN ---- */}
      <div className="main">

        {/* Topbar */}
        <div className="topbar">
          <div className="topbar-left">
            <h2>Dashboard</h2>
            <p>Your full financial overview at a glance</p>
          </div>
          <div className="topbar-right">
            <div className="icon-btn" aria-label="Notifications">
              <i className="ti ti-bell" aria-hidden="true" />
            </div>
            <div className="avatar-btn" aria-label="User menu">BK</div>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-grid">
          <div className="stat-card s1">
            <div className="stat-icon">
              <i className="ti ti-users" aria-hidden="true" />
            </div>
            <div className="stat-label">Total Accounts</div>
            <div className="stat-value">{accounts.length}</div>
          </div>

          <div className="stat-card s2">
            <div className="stat-icon">
              <i className="ti ti-coin" aria-hidden="true" />
            </div>
            <div className="stat-label">Total Balance</div>
            <div className="stat-value">
              {fmt(totalBalance)}
              <span className="unit">EGP</span>
            </div>
          </div>

          <div className="stat-card s3">
            <div className="stat-icon">
              <i className="ti ti-receipt" aria-hidden="true" />
            </div>
            <div className="stat-label">Transactions</div>
            <div className="stat-value">{transactions.length}</div>
          </div>
        </div>

        {/* Panel grid */}
        <div className="panel-grid">

          {/* Create Account */}
          <div className="panel">
            <div className="panel-head">
              <i className="ti ti-user-plus" aria-hidden="true" />
              <h3>Create Account</h3>
            </div>
            <div className="field">
              <label>Username</label>
              <input
                value={newUser}
                onChange={e => setNewUser(e.target.value)}
                placeholder="Enter username…"
              />
            </div>
            <div className="field">
              <label>Initial Balance (EGP)</label>
              <input
                type="number"
                value={newBal}
                onChange={e => setNewBal(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button className="btn btn-purple" onClick={handleCreateAccount}>
              <i className="ti ti-plus" aria-hidden="true" />
              Create Account
            </button>
          </div>

          {/* Transfer */}
          <div className="panel">
            <div className="panel-head">
              <i className="ti ti-send" aria-hidden="true" />
              <h3>Transfer Funds</h3>
            </div>
            <div className="field">
              <label>From</label>
              <input
                value={fromUser}
                onChange={e => setFromUser(e.target.value)}
                placeholder="Sender username…"
              />
            </div>
            <div className="field">
              <label>To</label>
              <input
                value={toUser}
                onChange={e => setToUser(e.target.value)}
                placeholder="Receiver username…"
              />
            </div>
            <div className="field">
              <label>Amount (EGP)</label>
              <input
                type="number"
                value={txAmount}
                onChange={e => setTxAmount(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <button className="btn btn-teal" onClick={handleTransfer}>
              <i className="ti ti-arrow-right" aria-hidden="true" />
              Send Transfer
            </button>
          </div>

          {/* Accounts + Deposit — full width */}
          <div className="panel full-width">
            <div className="panel-head">
              <i className="ti ti-wallet" aria-hidden="true" />
              <h3>Accounts &amp; Deposits</h3>
            </div>

            {accounts.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-users-group" aria-hidden="true" />
                No accounts yet
              </div>
            ) : (
              <div className="acc-list">
                {accounts.map(acc => (
                  <div className="acc-row" key={acc.id}>
                    <div className={`acc-avatar ${avatarColor(acc.username)}`}>
                      {initials(acc.username)}
                    </div>

                    <div className="acc-info">
                      <div className="acc-name">{acc.username}</div>
                      <div className="acc-balance">
                        Balance: <strong>{fmt(acc.balance)} EGP</strong>
                      </div>
                    </div>

                    <div className="dep-section">
                      <input
                        className="dep-input"
                        type="number"
                        placeholder="Amount"
                        value={depAmounts[acc.id] || ""}
                        onChange={e =>
                          setDepAmounts(prev => ({
                            ...prev,
                            [acc.id]: e.target.value,
                          }))
                        }
                      />
                      <button
                        className="dep-btn"
                        onClick={e => handleDeposit(acc.username, acc.id, e)}
                      >
                        <i className="ti ti-plus" aria-hidden="true" />
                        Deposit
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Transactions — full width */}
          <div className="panel full-width">
            <div className="panel-head">
              <i className="ti ti-history" aria-hidden="true" />
              <h3>Recent Transactions</h3>
            </div>

            <div className="tx-tabs">
              {["all", "dep", "send"].map(f => (
                <div
                  key={f}
                  className={`tx-tab${txFilter === f ? " active" : ""}`}
                  onClick={() => setTxFilter(f)}
                >
                  {f === "all" ? "All" : f === "dep" ? "Deposits" : "Transfers"}
                </div>
              ))}
            </div>

            {filteredTx.length === 0 ? (
              <div className="empty-state">
                <i className="ti ti-receipt-off" aria-hidden="true" />
                No transactions
              </div>
            ) : (
              <div className="tx-list">
                {filteredTx.slice(0, 20).map((t, i) => {
                  const isDep  = t.from === "BANK";
                  const iconCls = isDep ? "dep" : "send";
                  const iconName = isDep ? "ti-download" : "ti-arrow-up-right";
                  const label  = isDep
                    ? `Deposit → ${t.to}`
                    : `${t.from} → ${t.to}`;
                  return (
                    <div className="tx-row" key={i}>
                      <div className={`tx-icon ${iconCls}`}>
                        <i className={`ti ${iconName}`} aria-hidden="true" />
                      </div>
                      <div className="tx-meta">
                        <div className="tx-who">{label}</div>
                        <div className="tx-time">{fmtTime(t.time)}</div>
                      </div>
                      <div className={`tx-amount ${isDep ? "pos" : "neg"}`}>
                        {isDep ? "+" : "-"}{fmt(t.amount)} EGP
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>{/* /panel-grid */}
      </div>{/* /main */}

      {/* ---- TOAST ---- */}
      <div className={`toast ${toast.type}${toast.show ? " show" : ""}`} role="status" aria-live="polite">
        <i
          className={`ti ${toast.type === "success" ? "ti-circle-check" : "ti-alert-circle"}`}
          aria-hidden="true"
        />
        {toast.msg}
      </div>

    </div>
  );
}