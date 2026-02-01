// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import authService from "./services/authService";
import googleSheetsService from "./services/googleSheetsService";
import auditService from "./services/auditService";
import uiService from "./services/uiService";
import { useElectionState } from "./hooks/useElectionState";

import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";
import Dashboard from "./components/dashboard/Dashboard";
import ParticipationSaisie from "./components/participation/ParticipationSaisie";
import ParticipationTableau from "./components/participation/ParticipationTableau";
import ParticipationStats from "./components/participation/ParticipationStats";
import ResultatsSaisieBureau from "./components/resultats/ResultatsSaisieBureau";
import ResultatsConsolidation from "./components/resultats/ResultatsConsolidation";
import ResultatsValidation from "./components/resultats/ResultatsValidation";
import ResultatsClassement from "./components/resultats/ResultatsClassement";
import PassageSecondTour from "./components/secondTour/PassageSecondTour";
import ConfigurationT2 from "./components/secondTour/ConfigurationT2";
import SiegesMunicipal from "./components/sieges/SiegesMunicipal";
import SiegesCommunautaire from "./components/sieges/SiegesCommunautaire";
import ConfigBureaux from "./components/admin/ConfigBureaux";
import ConfigCandidats from "./components/admin/ConfigCandidats";
import AuditLog from "./components/admin/AuditLog";
import ExportPDF from "./components/exports/ExportPDF";
import ExportExcel from "./components/exports/ExportExcel";
import { HashRouter } from "react-router-dom";

import "./styles/App.css";
import "./styles/variables.css";
import "./styles/components/navigation.css";
import "./styles/components/dashboard.css";
import "./styles/components/components.css";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [authToken, setAuthToken] = useState(() => authService.getAccessToken());
  const [isAdminAuthenticated, setIsAdminAuthenticated] = useState(() =>
    Boolean(authService.isAdminAuthenticated?.())
  );
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  // UI (toasts + confirm modal) — remplace les alert/confirm du navigateur
  const [uiToasts, setUiToasts] = useState([]);
  const [uiConfirm, setUiConfirm] = useState({ open: false, title: '', message: '', confirmText: 'Confirmer', cancelText: 'Annuler', _resolve: null });

  const showToast = ({ type = 'info', title = '', message = '', durationMs = 4000 }) => {
    const id = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    setUiToasts((prev) => [...prev, { id, type, title, message }]);
    window.setTimeout(() => {
      setUiToasts((prev) => prev.filter((t) => t.id !== id));
    }, Math.max(1500, durationMs));
  };

  const showConfirm = ({ title, message, confirmText, cancelText }) => {
    return new Promise((resolve) => {
      setUiConfirm({ open: true, title, message, confirmText, cancelText, _resolve: resolve });
    });
  };

  useEffect(() => {
    uiService.init({ showToast, showConfirm });
  }, []);

  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState(null);

  // État global élection (pour afficher / rafraîchir dans Administration)
  const { state: electionState, loadState } = useElectionState();

  // Optionnel : si authService persiste le token, on le relit au montage
  useEffect(() => {
    setAuthToken(authService.getAccessToken());
    setIsAdminAuthenticated(Boolean(authService.isAdminAuthenticated?.()));
  }, []);

  const isAuthenticated = useMemo(() => Boolean(authToken), [authToken]);

  const handleSignIn = async () => {
    try {
      await authService.signIn(); // authService gère lui-même le chargement GIS
      setAuthToken(authService.getAccessToken());
    } catch (e) {
      console.error("Connexion Google échouée:", e);
    }
  };

  const handleSignOut = async () => {
    try {
      await authService.signOut();
    } catch (e) {
      console.warn("Déconnexion: avertissement:", e);
    } finally {
      setAuthToken(null);
      setCurrentPage("dashboard");
    }
  };

  // Pages qui nécessitent un token OAuth
  const authRequiredPages = new Set([
    "participation",
    "resultats",
    "passage-t2",
    "sieges",
    "exports",
    "admin",
  ]);

  useEffect(() => {
    if (!isAuthenticated && authRequiredPages.has(currentPage)) {
      setCurrentPage("dashboard");
    }
  }, [isAuthenticated, currentPage]);

  // Admin : modal mot de passe (en plus du token Google)
  useEffect(() => {
    if (currentPage !== "admin") {
      setAdminModalOpen(false);
      setAdminError(null);
      setAdminPassword("");
      return;
    }

    // Si l'utilisateur n'est pas connecté Google, on laisse renderAuthGate gérer.
    if (!isAuthenticated) return;

    if (!isAdminAuthenticated) {
      setAdminModalOpen(true);
    }
  }, [currentPage, isAuthenticated, isAdminAuthenticated]);

  // Quand on est en admin et authentifié, on recharge l'état élection (pour afficher le tour courant)
  useEffect(() => {
    if (currentPage === "admin" && isAuthenticated && isAdminAuthenticated) {
      loadState?.();
    }
  }, [currentPage, isAuthenticated, isAdminAuthenticated, loadState]);

  const handleAdminLogin = (evt) => {
    evt?.preventDefault?.();
    const ok = authService.adminSignIn(adminPassword);
    if (!ok) {
      setAdminError("Mot de passe invalide");
      return;
    }
    setIsAdminAuthenticated(true);
    setAdminError(null);
    setAdminPassword("");
    setAdminModalOpen(false);
  };

  const handleAdminLogout = () => {
    authService.adminSignOut();
    setIsAdminAuthenticated(false);
    setAdminModalOpen(true);
  };

  // 🔄 Retour au 1er tour (admin uniquement) — non destructif (ne purge pas les feuilles T2)
  const handleRetourPremierTour = async () => {
    if (!isAuthenticated || !isAdminAuthenticated) return;

    const confirm1 = await uiService.confirm({
      title: "Retour au 1er tour",
      message:
        "Revenir au 1er tour ?\n\nCette action réinitialise l\'état global (tour actuel, verrous, candidats qualifiés).\n\nAucune feuille (résultats/participation) ne sera effacée.",
      confirmText: "Continuer",
      cancelText: "Annuler"
    });
    if (!confirm1) return;

    const confirm2 = await uiService.confirm({
      title: "Confirmation finale",
      message:
        "Confirmation finale :\n\n- tourActuel -> 1\n- passage T2 -> Inactif\n- verrous T1/T2 -> levés\n- candidats qualifiés -> vidés\n\nContinuer ?",
      confirmText: "Oui, confirmer",
      cancelText: "Annuler"
    });
    if (!confirm2) return;

    try {
      await googleSheetsService.updateElectionState({
        tourActuel: 1,
        tour1Verrouille: false,
        tour2Verrouille: false,
        secondTourEnabled: false,
        candidatsQualifies: ""
      });

      // Audit non bloquant
      try {
        await auditService.log("RETOUR_T1", {
          from: {
            tourActuel: electionState?.tourActuel ?? null,
            secondTourEnabled: electionState?.secondTourEnabled ?? null
          }
        });
      } catch (e) {
        console.warn("Audit RETOUR_T1 échoué:", e);
      }

      await loadState?.();
      uiService.toast('success', { message: "✅ Retour au 1er tour effectué." });
} catch (e) {
      console.error("Erreur RETOUR_T1:", e);
      uiService.toast('info', { message: `Erreur : ${e?.message || "Erreur inconnue"}` });
}
  };

  // 🟧/🟩 Activer/Désactiver le passage au 2nd tour (admin uniquement)
  const handleSetSecondTourEnabled = async (enabled) => {
    if (!isAuthenticated || !isAdminAuthenticated) return;

    const label = enabled ? "ACTIVER" : "DÉSACTIVER";
    const confirm1 = await uiService.confirm({
      title: "Passage au 2nd tour",
      message: `${label} le passage au 2nd tour ?

Cette action n'exécute pas le passage au tour 2 : elle autorise ou bloque la confirmation dans 'Passage au 2nd tour'.`,
      confirmText: label === "ACTIVER" ? "Activer" : "Désactiver",
      cancelText: "Annuler"
    });
    if (!confirm1) return;

    try {
      await googleSheetsService.updateElectionState({
        secondTourEnabled: Boolean(enabled)
      });

      try {
        await auditService.log("SECOND_TOUR_TOGGLE", {
          enabled: Boolean(enabled),
          from: electionState?.secondTourEnabled ?? null
        });
      } catch (e) {
        console.warn("Audit SECOND_TOUR_TOGGLE échoué:", e);
      }

      await loadState?.();
    } catch (e) {
      console.error("Erreur toggle secondTourEnabled:", e);
      uiService.toast('info', { message: `Erreur : ${e?.message || "Erreur inconnue"}` });
}
  };

  // ====== Styles (inline) : largeur au contenu + cohérence visuelle ======
  const styles = {
    smallBtn: {
      padding: "0.34rem 0.62rem",
      borderRadius: 10,
      fontWeight: 900,
      fontSize: 13,
      lineHeight: 1.1,
      boxShadow: "0 6px 18px rgba(0,0,0,0.06)",
      border: "1px solid rgba(0,0,0,0.10)",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      width: "fit-content"
    },
    btnDanger: {
      background: "rgba(220, 38, 38, 0.14)",
      border: "1px solid rgba(220, 38, 38, 0.60)"
    },
    btnSuccess: {
      background: "rgba(34, 197, 94, 0.14)",
      border: "1px solid rgba(34, 197, 94, 0.60)"
    },
    // Retour T1 = vert (comme le header 1er tour)
    btnT1: {
      background: "rgba(34, 197, 94, 0.14)",
      border: "1px solid rgba(34, 197, 94, 0.75)"
    },
    // Retour T2 = orange (comme le header 2nd tour)
    btnT2: {
      background: "rgba(245, 158, 11, 0.16)",
      border: "1px solid rgba(194, 120, 3, 0.85)"
    },

    // Tour 2 = bleu (charté T2)
    btnT2Blue: {
      background: "rgba(59, 130, 246, 0.14)",
      border: "1px solid rgba(59, 130, 246, 0.75)"
    },
    sectionCard: {
      marginBottom: "1rem",
      padding: "1rem",
      borderRadius: 14,
      boxShadow: "0 10px 26px rgba(0,0,0,0.08)",
      border: "1px solid rgba(0,0,0,0.06)"
    },
    chip: (tone) => {
      const base = {
        padding: "0.25rem 0.6rem",
        borderRadius: 999,
        fontWeight: 900,
        fontSize: 13,
        display: "inline-flex",
        alignItems: "center",
        gap: 6
      };
      if (tone === "green") return { ...base, background: "rgba(34, 197, 94, 0.12)", border: "1px solid rgba(34, 197, 94, 0.40)" };
      if (tone === "red") return { ...base, background: "rgba(220, 38, 38, 0.12)", border: "1px solid rgba(220, 38, 38, 0.40)" };
      return { ...base, background: "rgba(0,0,0,0.05)", border: "1px solid rgba(0,0,0,0.08)" };
    },
    duoBlock: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
      gap: 12,
      padding: 12,
      borderRadius: 14,
      boxShadow: "0 10px 26px rgba(0,0,0,0.08)",
      border: "1px solid rgba(0,0,0,0.06)",
      background: "#fff",
      marginBottom: "1rem"
    },
    panel: (bg) => ({
      borderRadius: 14,
      padding: 12,
      border: "1px solid rgba(0,0,0,0.06)",
      boxShadow: "0 8px 18px rgba(0,0,0,0.06)",
      background: bg
    }),
    panelTitle: {
      marginTop: 0,
      marginBottom: 6,
      fontSize: 16,
      fontWeight: 900
    },
    panelText: {
      marginTop: 0,
      opacity: 0.9
    }
  };

  const renderAdminModal = () => {
    if (!adminModalOpen) return null;

    // IMPORTANT : tourActuel doit être défini dans ce scope (sinon crash en Admin)
    // On tolère plusieurs clés possibles dans ElectionsState et on sécurise en 1/2.
    const tourActuelRaw =
      electionState?.tourActuel ??
      electionState?.currentTour ??
      electionState?.tour ??
      electionState?.tourActif ??
      electionState?.activeTour ??
      electionState?.round ??
      electionState?.roundActive ??
      electionState?.currentRound;

    const tourActuel = Number(tourActuelRaw) === 2 ? 2 : 1;
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="modal-backdrop"
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.55)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
          padding: '1rem'
        }}
        onClick={() => {
          setAdminModalOpen(false);
          setCurrentPage('dashboard');
        }}
      >
        <div
          className="card"
          style={{ maxWidth: 520, width: '100%', padding: '1rem', maxHeight: '90vh', overflowY: 'auto' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0 }}>⚙️ Accès Administration</h2>
          <p style={{ marginTop: 0 }}>
            Saisissez le mot de passe pour accéder aux fonctions d'administration.
          </p>

          {adminError && (
            <div className="message error" style={{ margin: '0.75rem 0' }}>
              {adminError}
            </div>
          )}

          <label style={{ display: 'block', marginBottom: '0.25rem' }}>
            Mot de passe
          </label>
          <input
            type="password"
            value={adminPassword}
            onChange={(e) => {
              setAdminPassword(e.target.value);
              if (adminError) setAdminError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdminLogin();
              if (e.key === 'Escape') {
                setAdminModalOpen(false);
                setCurrentPage('dashboard');
              }
            }}
            style={{ width: '100%', padding: '0.6rem', marginBottom: '0.75rem' }}
            autoFocus
          />

          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
            <button
              type="button"
              className="action-btn"
              style={styles.smallBtn}
              onClick={() => {
                setAdminModalOpen(false);
                setCurrentPage('dashboard');
              }}
            >
              Annuler
            </button>
            <button
              type="button"
              className="action-btn"
              style={{ ...styles.smallBtn, ...styles.btnSuccess }}
              onClick={handleAdminLogin}
            >
              Connexion
            </button>
          </div>
        </div>
<div style={{ marginTop: 14, ...styles.panel("rgba(239, 68, 68, 0.10)") }}>
  <h3 style={styles.panelTitle}>🚨 Bascule Tour (admin)</h3>
  <p style={styles.panelText}>
    Bascule <strong>uniquement</strong> le <strong>tour actif</strong> (sans recalcul / sans modifier les données).
    À utiliser en dernier recours.
  </p>

  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
    <span style={styles.chip(tourActuel === 2 ? "green" : "red")}>
      T2 : <strong>{tourActuel === 2 ? "Actif" : "Inactif"}</strong>
    </span>
    <span style={styles.chip(tourActuel === 1 ? "green" : "red")}>
      T1 : <strong>{tourActuel === 1 ? "Actif" : "Inactif"}</strong>
    </span>
  </div>

  <button
    type="button"
    className="action-btn"
    style={{ ...styles.smallBtn, ...(tourActuel === 1 ? styles.btnT2Blue : styles.btnT1), padding: "12px 18px", fontWeight: 900 }}
    onClick={async () => {
      const target = tourActuel === 1 ? 2 : 1;
      const ok = await uiService.confirm(
        target === 2
          ? "Basculer l'application en TOUR 2 (actif) ?\n\nCette action ne confirme pas le passage officiel : elle change seulement le tour actif."
          : "Basculer l'application en TOUR 1 (actif) ?\n\nCette action ne modifie pas les données : elle change seulement le tour actif."
      );
      if (!ok) return;
      try {
        await googleSheetsService.updateElectionState({ tourActuel: target });
        await loadState?.();
        uiService.toast("success", target === 2 ? "✅ TOUR 2 : Actif" : "✅ TOUR 1 : Actif");
      } catch (e) {
        uiService.toast("error", e?.message || "Erreur lors de la bascule");
      }
    }}
  >
    {tourActuel === 1 ? "Basculer vers Passage T2 : Autorisé" : "Basculer vers {tourActuel === 1 ? 'T1 : Actif (tour courant)' : 'T1 : Inactif'}"}
  </button>
</div>

      </div>
    );
  };

  const renderAuthGate = () => (
    <div className="page-container" style={{ padding: "1rem" }}>
      <div className="card" style={{ maxWidth: 720, margin: "0 auto", padding: "1rem" }}>
        <h2 style={{ marginTop: 0 }}>Connexion requise</h2>
        <p>
          Pour accéder aux saisies et aux données (Google Sheets), vous devez vous connecter avec le compte
          Google autorisé.
        </p>
        <button className="action-btn primary" onClick={handleSignIn}>
          Se connecter avec Google
        </button>
      </div>
      {/* UI Toasts */}
      <div className="ui-toast-container" aria-live="polite" aria-relevant="additions removals">
        {uiToasts.map((t) => (
          <div key={t.id} className={`ui-toast ${t.type}`}>
            {t.title ? <div className="ui-toast-title">{t.title}</div> : null}
            {t.message ? <div className="ui-toast-message">{t.message}</div> : null}
          </div>
        ))}
      </div>

      {/* UI Confirm Modal */}
      {uiConfirm.open ? (
        <div className="ui-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ui-modal">
            <div className="ui-modal-title">{uiConfirm.title || "Confirmation"}</div>
            <div className="ui-modal-message">{uiConfirm.message}</div>
            <div className="ui-modal-actions">
              <button
                type="button"
                className="action-btn btn-compact"
                onClick={() => {
                  uiConfirm._resolve?.(false);
                  setUiConfirm((prev) => ({ ...prev, open: false, _resolve: null }));
                }}
              >
                {uiConfirm.cancelText || "Annuler"}
              </button>
              <button
                type="button"
                className="action-btn primary btn-compact"
                onClick={() => {
                  uiConfirm._resolve?.(true);
                  setUiConfirm((prev) => ({ ...prev, open: false, _resolve: null }));
                }}
              >
                {uiConfirm.confirmText || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );

  // Bloc combiné : Retour T1 + Passage T2 côte à côte, couleurs distinctes
  const renderAdminTourControls = () => {
    if (!isAdminAuthenticated) return null;

    // Source unique de vérité pour l'UI (Tour actif)
    const tourActuel = Number(electionState?.tourActuel) === 2 ? 2 : 1;

    // Autorisation (indépendante du tour actif) : autorise/bloque la confirmation du passage T2
    const secondTourEnabled = Boolean(electionState?.secondTourEnabled);

    return (
      <div style={{ ...styles.panel("rgba(239, 68, 68, 0.10)"), width: "100%" }}>
        <h3 style={styles.panelTitle}>🚨 Bascule Tour (admin)</h3>
        <p style={styles.panelText}>
          Bascule <strong>uniquement</strong> le <strong>tour actif</strong> (sans recalcul / sans modifier les données). À utiliser en dernier recours.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10, alignItems: "center" }}>
          <span style={styles.chip(tourActuel === 1 ? "green" : "red")}>
            T1 : <strong>{tourActuel === 1 ? "Actif" : "Inactif"}</strong>
          </span>
          <span style={styles.chip(tourActuel === 2 ? "green" : "red")}>
            T2 : <strong>{tourActuel === 2 ? "Actif" : "Inactif"}</strong>
          </span>

          <span style={{ ...styles.chip(secondTourEnabled ? "green" : "red"), marginLeft: 8 }}>
            Passage T2 : <strong>{secondTourEnabled ? "Autorisé" : "Bloqué"}</strong>
          </span>
        </div>

        <button
          type="button"
          className="action-btn"
          style={{ ...styles.smallBtn, ...styles.btnDanger, padding: "12px 18px", fontWeight: 900 }}
          onClick={async () => {
            const target = tourActuel === 1 ? 2 : 1;
            const ok = await uiService.confirm(
              target === 2
                ? "Basculer l'application en TOUR 2 (actif) ?\n\nCette action ne confirme pas le passage officiel : elle change seulement le tour actif."
                : "Basculer l'application en TOUR 1 (actif) ?\n\nCette action ne modifie pas les données : elle change seulement le tour actif."
            );
            if (!ok) return;

            try {
              await googleSheetsService.updateElectionState({ tourActuel: target });
              await loadState?.(); // rafraîchit l'état en mémoire => UI & navigation sans F5
              uiService.toast("success", target === 2 ? "✅ TOUR 2 : Actif" : "✅ TOUR 1 : Actif");
            } catch (e) {
              uiService.toast("error", e?.message || "Erreur lors de la bascule");
            }
          }}
          title={tourActuel === 1 ? "Basculer vers Passage T2 : Autorisé" : "Basculer vers Passage T1 : Autorisé"}
        >
          {tourActuel === 1 ? "Basculer vers Passage T2 : Autorisé" : "Basculer vers Passage T1 : Autorisé"}
        </button>
      </div>
    );
  };

  // Wrapper visuel sans rajouter de titres (évite les doublons avec les composants internes)
  const CardSection = ({ children }) => (
    <div className="card" style={styles.sectionCard}>
      {children}
      {/* UI Toasts */}
      <div className="ui-toast-container" aria-live="polite" aria-relevant="additions removals">
        {uiToasts.map((t) => (
          <div key={t.id} className={`ui-toast ${t.type}`}>
            {t.title ? <div className="ui-toast-title">{t.title}</div> : null}
            {t.message ? <div className="ui-toast-message">{t.message}</div> : null}
          </div>
        ))}
      </div>

      {/* UI Confirm Modal */}
      {uiConfirm.open ? (
        <div className="ui-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ui-modal">
            <div className="ui-modal-title">{uiConfirm.title || "Confirmation"}</div>
            <div className="ui-modal-message">{uiConfirm.message}</div>
            <div className="ui-modal-actions">
              <button
                type="button"
                className="action-btn btn-compact"
                onClick={() => {
                  uiConfirm._resolve?.(false);
                  setUiConfirm((prev) => ({ ...prev, open: false, _resolve: null }));
                }}
              >
                {uiConfirm.cancelText || "Annuler"}
              </button>
              <button
                type="button"
                className="action-btn primary btn-compact"
                onClick={() => {
                  uiConfirm._resolve?.(true);
                  setUiConfirm((prev) => ({ ...prev, open: false, _resolve: null }));
                }}
              >
                {uiConfirm.confirmText || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );

  const renderAdminTablesStyle = () => (
    <style>{`
      /* ====== Boutons : même taille en responsive ====== */
      .btn-compact{ width: fit-content; }
      @media (max-width: 640px){
        .btn-compact{ width: 100% !important; justify-content: center; }
      }

      /* ====== TABLES ADMIN: lisibilité + arrondis + zébrage ====== */
      .admin-table, .audit-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        overflow: hidden;
        border-radius: 14px;
        border: 1px solid rgba(0,0,0,0.08);
      }
      .admin-table thead th, .audit-table thead th {
        background: rgba(156, 163, 175, 0.95); /* gris clair */
        color: #fff; /* police blanche */
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        font-size: 12px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(0,0,0,0.10);
      }
      .admin-table tbody td, .audit-table tbody td {
        padding: 10px 12px;
        border-bottom: 1px solid rgba(0,0,0,0.06);
        vertical-align: top;
      }
      .admin-table tbody tr:nth-child(even),
      .audit-table tbody tr:nth-child(even) {
        background: rgba(0,0,0,0.03); /* 1 ligne sur 2 contrastée */
      }
      .admin-table tbody tr:last-child td,
      .audit-table tbody tr:last-child td {
        border-bottom: none;
      }

      .audit-table-container {
        overflow-x: auto;
      }

      /* ===== Tableau admin responsive (bureaux/candidats) ===== */
      .table-scroll{ overflow-x:auto; }
      .table-scroll .admin-table{ min-width: 900px; }
      .sticky-first-col th:first-child,
      .sticky-first-col td.sticky-col{
        position: sticky;
        left: 0;
        background: #fff;
        z-index: 2;
        border-right: 1px solid rgba(0,0,0,0.10);
      }
      .sticky-first-col tbody tr:nth-child(even) td.sticky-col{
        background: rgba(0,0,0,0.03);
      }
    `}</style>
  );

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard onNavigate={setCurrentPage} electionState={electionState} />;

      case "participation":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <ParticipationSaisie electionState={electionState} reloadElectionState={loadState} />
            <ParticipationTableau electionState={electionState} />
            <ParticipationStats electionState={electionState} />
          </div>
        );

      case "resultats":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <ResultatsSaisieBureau electionState={electionState} />
            <ResultatsConsolidation electionState={electionState} />
            <ResultatsValidation electionState={electionState} />
            <ResultatsClassement electionState={electionState} />
          </div>
        );

      case "passage-t2":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <PassageSecondTour electionState={electionState} reloadElectionState={loadState} isAdminAuthenticated={isAdminAuthenticated} />
            <ConfigurationT2 electionState={electionState} />
          </div>
        );

      case "sieges":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <SiegesMunicipal electionState={electionState} />
            <SiegesCommunautaire electionState={electionState} />
          </div>
        );

      case "exports":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <ExportPDF electionState={electionState} />
            <ExportExcel electionState={electionState} />
          </div>
        );

      case "admin":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            {renderAdminModal()}
            {renderAdminTablesStyle()}

            <div className="card" style={styles.sectionCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>⚙️ Administration</h2>
                {isAdminAuthenticated && (
                  <button
                    type="button"
                    className="action-btn btn-compact"
                    style={{ ...styles.smallBtn, ...styles.btnDanger }}
                    onClick={handleAdminLogout}
                  >
                    Déconnexion
                  </button>
                )}
              </div>
              <p style={{ margin: "0.5rem 0 0 0" }}>
                Accès protégé par mot de passe. Les actions ici impactent l’état officiel (Sheets) et doivent être tracées.
              </p>
            </div>

            {isAdminAuthenticated ? (
              <>
                {renderAdminTourControls()}

                <CardSection>
                  <ConfigBureaux />
                </CardSection>

                <CardSection>
                  <ConfigCandidats />
                </CardSection>

                <CardSection>
                  <AuditLog />
                </CardSection>
              </>
            ) : null}
          </div>
        );

      default:
        return <Dashboard onNavigate={setCurrentPage} electionState={electionState} />;
    }
  };

  return (
    <div className={`app ${electionState?.tourActuel === 2 ? "theme-tour-2" : "theme-tour-1"}`}>
      <Navigation key={`${electionState?.tourActuel ?? 1}-${electionState?.secondTourEnabled ? 1 : 0}`} currentPage={currentPage} onNavigate={setCurrentPage} isAuthenticated={isAuthenticated} onSignIn={handleSignIn} onSignOut={handleSignOut} electionState={electionState} />

      <div className="tour-banner">
        {electionState?.tourActuel === 2 ? (
          <>
            <span className="tour-badge">🔵</span>
            <span>TOUR 2 – BLEU</span>
          </>
        ) : (
          <>
            <span className="tour-badge">🟢</span>
            <span>TOUR 1 – VERT FONCÉ</span>
          </>
        )}
      </div>
<main className="main-content">{renderPage()}</main>

      <Footer />
      {/* UI Toasts */}
      <div className="ui-toast-container" aria-live="polite" aria-relevant="additions removals">
        {uiToasts.map((t) => (
          <div key={t.id} className={`ui-toast ${t.type}`}>
            {t.title ? <div className="ui-toast-title">{t.title}</div> : null}
            {t.message ? <div className="ui-toast-message">{t.message}</div> : null}
          </div>
        ))}
      </div>

      {/* UI Confirm Modal */}
      {uiConfirm.open ? (
        <div className="ui-modal-backdrop" role="dialog" aria-modal="true">
          <div className="ui-modal">
            <div className="ui-modal-title">{uiConfirm.title || "Confirmation"}</div>
            <div className="ui-modal-message">{uiConfirm.message}</div>
            <div className="ui-modal-actions">
              <button
                type="button"
                className="action-btn btn-compact"
                onClick={() => {
                  uiConfirm._resolve?.(false);
                  setUiConfirm((prev) => ({ ...prev, open: false, _resolve: null }));
                }}
              >
                {uiConfirm.cancelText || "Annuler"}
              </button>
              <button
                type="button"
                className="action-btn primary btn-compact"
                onClick={() => {
                  uiConfirm._resolve?.(true);
                  setUiConfirm((prev) => ({ ...prev, open: false, _resolve: null }));
                }}
              >
                {uiConfirm.confirmText || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

export default App;
