import React, { useState, useEffect, useCallback } from "react";
import {
  initWeb3, getContract, getAccounts,
  weiToEth, ethToWei, formatDate,
  statusLabel, statusColor, shortAddr,
} from "./utils/web3Utils";
import './App.css';

/* ════════════════════════════════════════════════
   TOAST COMPONENT
══════════════════════════════════════════════════ */
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons = { success: "✓", error: "✕", info: "ℹ" };
  return (
    <div className={`toast toast-${type}`}>
      <span>{icons[type]}</span>
      {message}
    </div>
  );
}

/* ════════════════════════════════════════════════
   BADGE COMPONENT
══════════════════════════════════════════════════ */
function StatusBadge({ status }) {
  const classes = ["badge-pending", "badge-active", "badge-expired", "badge-terminated"];
  const dots = ["🟡", "🟢", "⚫", "🔴"];
  return (
    <span className={`badge ${classes[Number(status)] ?? ""}`}>
      {dots[Number(status)]} {statusLabel(status)}
    </span>
  );
}

/* ════════════════════════════════════════════════
   CREATE CONTRACT FORM
══════════════════════════════════════════════════ */
function CreateContractForm({ account, contract, onSuccess, onToast }) {
  const [form, setForm] = useState({
    tenant: "", rentEth: "", durationMonths: "", property: "",
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e) =>
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async () => {
    if (!form.tenant || !form.rentEth || !form.durationMonths || !form.property) {
      onToast("Veuillez remplir tous les champs.", "error"); return;
    }
    try {
      setLoading(true);
      const weiAmount = ethToWei(form.rentEth);
      await contract.methods
        .createContract(form.tenant, weiAmount, Number(form.durationMonths), form.property)
        .send({ from: account });
      onToast("Contrat créé avec succès !", "success");
      setForm({ tenant: "", rentEth: "", durationMonths: "", property: "" });
      onSuccess();
    } catch (e) {
      onToast("Erreur : " + (e.message || e), "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="page-title">Créer un Contrat</h2>
      <p className="page-desc">En tant que propriétaire, créez un nouveau contrat de location.</p>

      <div style={{ maxWidth: 520 }}>
        <div className="card">
          <p className="card-title">Nouveau contrat</p>
          <p className="card-subtitle">Les informations seront enregistrées de manière immuable sur la blockchain.</p>

          <div className="form-group">
            <label>Adresse du locataire</label>
            <input
              name="tenant" value={form.tenant} onChange={handleChange}
              placeholder="0x..."
            />
          </div>

          <div className="form-group">
            <label>Bien immobilier</label>
            <input
              name="property" value={form.property} onChange={handleChange}
              placeholder="Ex: 12 Rue Mohammed V, Casablanca"
            />
          </div>

          <div className="form-group">
            <label>Loyer mensuel (ETH)</label>
            <input
              name="rentEth" type="number" step="0.001" min="0"
              value={form.rentEth} onChange={handleChange}
              placeholder="Ex: 0.05"
            />
          </div>

          <div className="form-group">
            <label>Durée (mois)</label>
            <input
              name="durationMonths" type="number" min="1" max="120"
              value={form.durationMonths} onChange={handleChange}
              placeholder="Ex: 12"
            />
          </div>

          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            style={{ width: "100%", justifyContent: "center", marginTop: 8 }}
          >
            {loading ? <><div className="spinner" /> Déploiement…</> : "⛓ Créer le contrat"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   CONTRACT DETAIL VIEW
══════════════════════════════════════════════════ */
function ContractDetail({ contractId, account, contract, adminAddr, onBack, onToast, onRefresh }) {
  const [data, setData] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const c = await contract.methods.getContract(contractId).call();
      const p = await contract.methods.getPayments(contractId).call();
      setData(c);
      setPayments(p);
    } catch (e) {
      onToast("Erreur de chargement : " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [contract, contractId, onToast]);

  useEffect(() => { load(); }, [load]);

  const handleSign = async () => {
    try {
      setActionLoading(true);
      await contract.methods.signContract(contractId).send({ from: account });
      onToast("Contrat signé avec succès !", "success");
      load(); onRefresh();
    } catch (e) { onToast("Erreur : " + e.message, "error"); }
    finally { setActionLoading(false); }
  };

  const handlePay = async () => {
    try {
      setActionLoading(true);
      await contract.methods.payRent(contractId)
        .send({ from: account, value: data.rentAmount });
      onToast("Paiement effectué !", "success");
      load(); onRefresh();
    } catch (e) { onToast("Erreur : " + e.message, "error"); }
    finally { setActionLoading(false); }
  };

  const handleExpiry = async () => {
    try {
      setActionLoading(true);
      await contract.methods.checkAndUpdateExpiry(contractId).send({ from: account });
      onToast("Statut mis à jour.", "info");
      load();
    } catch (e) { onToast("Erreur : " + e.message, "error"); }
    finally { setActionLoading(false); }
  };

  const handleTerminate = async () => {
    if (!window.confirm("Résilier ce contrat définitivement ?")) return;
    try {
      setActionLoading(true);
      await contract.methods.terminateContract(contractId).send({ from: account });
      onToast("Contrat résilié.", "success");
      load(); onRefresh();
    } catch (e) { onToast("Erreur : " + e.message, "error"); }
    finally { setActionLoading(false); }
  };

  const acctLower = account?.toLowerCase();
  const isOwner  = data && data.owner.toLowerCase()  === acctLower;
  const isTenant = data && data.tenant.toLowerCase() === acctLower;
  const isAdmin  = acctLower === adminAddr?.toLowerCase();

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40 }}>
      <div className="spinner" /> Chargement du contrat…
    </div>
  );

  if (!data) return null;

  const status = Number(data.status);

  return (
    <div>
      <div className="detail-header">
        <button className="detail-back" onClick={onBack}>←</button>
        <div>
          <h2 className="page-title" style={{ margin: 0 }}>{data.propertyAddress}</h2>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
            <span className="contract-id">Contrat #{contractId}</span>
            <StatusBadge status={status} />
          </div>
        </div>
      </div>

      <div className="detail-grid">
        {/* LEFT: Info */}
        <div className="card">
          <p className="card-title">Informations du contrat</p>
          {[
            ["Propriétaire", <span className="mono">{shortAddr(data.owner)}{isOwner ? " (vous)" : ""}</span>],
            ["Locataire",    <span className="mono">{shortAddr(data.tenant)}{isTenant ? " (vous)" : ""}</span>],
            ["Loyer",        <span style={{ color: "var(--accent2)" }}>{weiToEth(data.rentAmount)} ETH / mois</span>],
            ["Durée",        `${data.durationMonths} mois`],
            ["Début",        formatDate(data.startDate)],
            ["Fin",          formatDate(data.endDate)],
            ["Total payé",   <span style={{ color: "var(--success)" }}>{weiToEth(data.totalPaid)} ETH</span>],
            ["Signé",        data.tenantSigned ? "✓ Oui" : "✕ Non"],
          ].map(([k, v]) => (
            <div className="info-row" key={k}>
              <span className="info-key">{k}</span>
              <span className="info-val">{v}</span>
            </div>
          ))}
        </div>

        {/* RIGHT: Actions */}
        <div style={{ display: "flex", flex: "column", gap: 16 }}>
          <div className="card" style={{ marginBottom: 16 }}>
            <p className="card-title">Actions</p>

            {isTenant && status === 0 && (
              <button className="btn btn-success" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
                onClick={handleSign} disabled={actionLoading}>
                ✍️ Signer le contrat
              </button>
            )}

            {isTenant && status === 1 && (
              <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
                onClick={handlePay} disabled={actionLoading}>
                💸 Payer le loyer ({weiToEth(data.rentAmount)} ETH)
              </button>
            )}

            {(isOwner || isTenant) && status === 1 && (
              <button className="btn btn-ghost" style={{ width: "100%", justifyContent: "center", marginBottom: 10 }}
                onClick={handleExpiry} disabled={actionLoading}>
                🔄 Vérifier expiration
              </button>
            )}

            {isAdmin && (status === 0 || status === 1) && (
              <button className="btn btn-danger" style={{ width: "100%", justifyContent: "center" }}
                onClick={handleTerminate} disabled={actionLoading}>
                ⚠️ Résilier (Admin)
              </button>
            )}

            {!isTenant && !isOwner && !isAdmin && (
              <p style={{ color: "var(--muted)", fontSize: 13 }}>
                Vous n'êtes pas participant de ce contrat.
              </p>
            )}

            {actionLoading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
                <div className="spinner" /> Transaction en cours…
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="card" style={{ background: "rgba(245,158,11,0.05)", borderColor: "rgba(245,158,11,0.2)" }}>
              <span className="role-tag role-admin">👑 Admin</span>
              <p style={{ fontSize: 12, color: "var(--muted)", marginTop: 8 }}>
                Vous supervisez ce contrat en tant qu'administrateur.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Payments */}
      <div className="card">
        <p className="card-title">Historique des paiements</p>
        {payments.length === 0 ? (
          <p style={{ color: "var(--muted)", fontSize: 13 }}>Aucun paiement enregistré.</p>
        ) : (
          <div className="payment-list">
            {[...payments].reverse().map((p, i) => (
              <div className="payment-item" key={i}>
                <div>
                  <div className="payment-amount">+{weiToEth(p.amount)} ETH</div>
                  <div style={{ fontSize: 11, color: "var(--muted)" }}>par {shortAddr(p.payer)}</div>
                </div>
                <div className="payment-date">{formatDate(p.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   CONTRACT LIST VIEW
══════════════════════════════════════════════════ */
function ContractList({ account, contract, onSelect, onToast, title, emptyMsg, fetchFn }) {
  const [ids, setIds] = useState([]);
  const [contracts, setContracts] = useState({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const idList = await fetchFn();
      setIds(idList.map(Number));

      const details = {};
      for (const id of idList) {
        const c = await contract.methods.getContract(id).call();
        details[Number(id)] = c;
      }
      setContracts(details);
    } catch (e) {
      onToast("Erreur : " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [contract, fetchFn, onToast]);

  useEffect(() => { load(); }, [load]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40 }}>
      <div className="spinner" /> Chargement…
    </div>
  );

  return (
    <div>
      <h2 className="page-title">{title}</h2>
      <p className="page-desc">Adresse : <span style={{ color: "var(--accent2)" }}>{account}</span></p>

      {ids.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📄</div>
          <div className="empty-text">Aucun contrat trouvé</div>
          <div className="empty-sub">{emptyMsg}</div>
        </div>
      ) : (
        <div className="contracts-grid">
          {ids.map((id) => {
            const c = contracts[id];
            if (!c) return null;
            return (
              <div className="contract-card" key={id} onClick={() => onSelect(id)}>
                <div className="contract-id">CONTRAT #{id}</div>
                <div className="contract-property">{c.propertyAddress}</div>
                <div className="contract-meta">
                  <div className="meta-item">
                    <span className="meta-label">Loyer</span>
                    <span className="meta-value eth">{weiToEth(c.rentAmount)} ETH</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Durée</span>
                    <span className="meta-value">{c.durationMonths} mois</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Propriétaire</span>
                    <span className="meta-value">{shortAddr(c.owner)}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">Locataire</span>
                    <span className="meta-value">{shortAddr(c.tenant)}</span>
                  </div>
                </div>
                <StatusBadge status={Number(c.status)} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   ADMIN PANEL
══════════════════════════════════════════════════ */
function AdminPanel({ account, contract, onSelect, onToast }) {
  const [total, setTotal] = useState(null);
  const [allContracts, setAllContracts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const count = await contract.methods.contractCount().call();
        setTotal(Number(count));
        const list = [];
        for (let i = 1; i <= Number(count); i++) {
          const c = await contract.methods.getContract(i).call();
          list.push({ ...c, id: i });
        }
        setAllContracts(list);
      } catch (e) {
        onToast("Erreur : " + e.message, "error");
      } finally {
        setLoading(false);
      }
    })();
  }, [contract, onToast]);

  if (loading) return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 40 }}>
      <div className="spinner" /> Chargement du panneau admin…
    </div>
  );

  const byStatus = [0,1,2,3].map(s => allContracts.filter(c => Number(c.status) === s).length);
  const labels = ["En attente", "Actifs", "Expirés", "Résiliés"];
  const colors = ["var(--gold)", "var(--success)", "var(--muted)", "var(--danger)"];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
        <h2 className="page-title" style={{ margin: 0 }}>Panneau Admin</h2>
        <span className="role-tag role-admin">👑 Administrateur</span>
      </div>
      <p className="page-desc">Supervisez tous les contrats sur la plateforme.</p>

      {/* Stats */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Total", value: total, color: "var(--accent)" },
          ...labels.map((l, i) => ({ label: l, value: byStatus[i], color: colors[i] })),
        ].map(({ label, value, color }) => (
          <div className="card" key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 32, fontFamily: "var(--font-head)", fontWeight: 800, color }}>
              {value}
            </div>
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      {/* All contracts */}
      <h3 style={{ fontFamily: "var(--font-head)", fontWeight: 700, marginBottom: 12 }}>
        Tous les contrats
      </h3>
      {allContracts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🏛</div>
          <div className="empty-text">Aucun contrat déployé</div>
        </div>
      ) : (
        <div className="contracts-grid">
          {allContracts.map((c) => (
            <div className="contract-card" key={c.id} onClick={() => onSelect(c.id)}>
              <div className="contract-id">CONTRAT #{c.id}</div>
              <div className="contract-property">{c.propertyAddress}</div>
              <div className="contract-meta">
                <div className="meta-item">
                  <span className="meta-label">Loyer</span>
                  <span className="meta-value eth">{weiToEth(c.rentAmount)} ETH</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Durée</span>
                  <span className="meta-value">{c.durationMonths} mois</span>
                </div>
              </div>
              <StatusBadge status={Number(c.status)} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════
   CONNECT SCREEN
══════════════════════════════════════════════════ */
function ConnectScreen({ onConnect, error }) {
  const [connecting, setConnecting] = useState(false);

  const handleConnect = async () => {
    setConnecting(true);
    await onConnect();
    setConnecting(false);
  };

  return (
    <div className="connect-screen">
      <div className="connect-logo">Block<span>Lease</span></div>
      <p className="connect-subtitle">
        Système de gestion des contrats de location immobilière via blockchain.
        Transparence, sécurité et immuabilité garanties.
      </p>
      <div className="connect-card">
        <p style={{ fontFamily: "var(--font-head)", fontWeight: 700, fontSize: 18, marginBottom: 8 }}>
          Connexion requise
        </p>
        <p style={{ color: "var(--muted)", fontSize: 13, marginBottom: 24, lineHeight: 1.7 }}>
          Connectez votre portefeuille MetaMask pour accéder à la plateforme.
          Votre adresse blockchain sera votre identité unique.
        </p>
        {error && (
          <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
            borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "var(--danger)", marginBottom: 16 }}>
            {error}
          </div>
        )}
        <button className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }}
          onClick={handleConnect} disabled={connecting}>
          {connecting ? <><div className="spinner" /> Connexion…</> : "🦊 Connecter MetaMask"}
        </button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════
   ROOT APP
══════════════════════════════════════════════════ */
export default function App() {
  const [account, setAccount]     = useState(null);
  const [contract, setContract]   = useState(null);
  const [adminAddr, setAdminAddr] = useState(null);
  const [tab, setTab]             = useState("mes-contrats");
  const [selectedId, setSelectedId] = useState(null);
  const [toast, setToast]         = useState(null);
  const [connectErr, setConnectErr] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const showToast = useCallback((message, type = "info") => {
    setToast({ message, type });
  }, []);

  const handleConnect = async () => {
    try {
      await initWeb3();
      const accounts = await getAccounts();
      const ct = await getContract();
      const admin = await ct.methods.admin().call();
      setAccount(accounts[0]);
      setContract(ct);
      setAdminAddr(admin);
    } catch (e) {
      setConnectErr(e.message);
    }
  };

  // Listen for account changes
  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on("accountsChanged", (accs) => {
        setAccount(accs[0] ?? null);
        setSelectedId(null);
      });
    }
  }, []);

  if (!account || !contract) {
    return <ConnectScreen onConnect={handleConnect} error={connectErr} />;
  }

  const isAdmin = account?.toLowerCase() === adminAddr?.toLowerCase();

  const tabs = [
    { id: "mes-contrats", label: "Mes Contrats" },
    { id: "creer",        label: "Créer un Contrat" },
    { id: "locataire",    label: "En tant que Locataire" },
    ...(isAdmin ? [{ id: "admin", label: "👑 Admin" }] : []),
  ];

  const handleSelect = (id) => {
    setSelectedId(id);
  };

  const handleBack = () => {
    setSelectedId(null);
    setRefreshKey(k => k + 1);
  };

  return (
    <div className="app-shell">
      {/* HEADER */}
      <header>
        <div className="header-inner">
          <div className="logo">
            <div className="logo-icon">⛓</div>
            Block<span>Lease</span>
          </div>
          <div className="wallet-pill">
            <div className="wallet-dot" />
            <span className="wallet-addr">{account}</span>
            {isAdmin && <span className="role-tag role-admin" style={{ marginLeft: 4 }}>Admin</span>}
          </div>
        </div>
      </header>

      {/* NAV */}
      <nav>
        {tabs.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? "active" : ""}
            onClick={() => { setTab(t.id); setSelectedId(null); }}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* CONTENT */}
      <main className="main-content">
        {selectedId !== null ? (
          <ContractDetail
            key={selectedId}
            contractId={selectedId}
            account={account}
            contract={contract}
            adminAddr={adminAddr}
            onBack={handleBack}
            onToast={showToast}
            onRefresh={() => setRefreshKey(k => k + 1)}
          />
        ) : tab === "creer" ? (
          <CreateContractForm
            account={account}
            contract={contract}
            onSuccess={() => { setTab("mes-contrats"); setRefreshKey(k => k + 1); }}
            onToast={showToast}
          />
        ) : tab === "mes-contrats" ? (
          <ContractList
            key={`owner-${refreshKey}`}
            account={account}
            contract={contract}
            onSelect={handleSelect}
            onToast={showToast}
            title="Mes Contrats (Propriétaire)"
            emptyMsg="Créez votre premier contrat via l'onglet « Créer un Contrat »."
            fetchFn={() => contract.methods.getOwnerContracts(account).call()}
          />
        ) : tab === "locataire" ? (
          <ContractList
            key={`tenant-${refreshKey}`}
            account={account}
            contract={contract}
            onSelect={handleSelect}
            onToast={showToast}
            title="Contrats (Locataire)"
            emptyMsg="Aucun contrat ne vous est assigné en tant que locataire."
            fetchFn={() => contract.methods.getTenantContracts(account).call()}
          />
        ) : tab === "admin" && isAdmin ? (
          <AdminPanel
            key={`admin-${refreshKey}`}
            account={account}
            contract={contract}
            onSelect={handleSelect}
            onToast={showToast}
          />
        ) : null}
      </main>

      {/* TOAST */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}
