// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import authService from "./services/authService";
import googleSheetsService from "./services/googleSheetsService";
import auditService from "./services/auditService";
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

    const confirm1 = window.confirm(
      "Revenir au 1er tour ?\n\nCette action réinitialise l'état global (tour actuel, verrous, candidats qualifiés).\n\nAucune feuille (résultats/participation) ne sera effacée."
    );
    if (!confirm1) return;

    const confirm2 = window.confirm(
      "Confirmation finale :\n\n- tourActuel -> 1\n- passage T2 -> Inactif\n- verrous T1/T2 -> levés\n- candidats qualifiés -> vidés\n\nContinuer ?"
    );
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
      alert("✅ Retour au 1er tour effectué.");
    } catch (e) {
      console.error("Erreur RETOUR_T1:", e);
      alert(`Erreur : ${e?.message || "Erreur inconnue"}`);
    }
  };

  // 🟧/🟩 Activer/Désactiver le passage au 2nd tour (admin uniquement)
  const handleSetSecondTourEnabled = async (enabled) => {
    if (!isAuthenticated || !isAdminAuthenticated) return;

    const label = enabled ? "ACTIVER" : "DÉSACTIVER";
    const confirm1 = window.confirm(
      `${label} le passage au 2nd tour ?\n\nCette action n'exécute pas le passage au tour 2 : elle autorise ou bloque la confirmation dans 'Passage au 2nd tour'.`
    );
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
      alert(`Erreur : ${e?.message || "Erreur inconnue"}`);
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
    </div>
  );

  // Bloc combiné : Retour T1 + Passage T2 côte à côte, couleurs distinctes
  const renderAdminTourControls = () => {
    if (!isAdminAuthenticated) return null;

    const tourActuel = electionState?.tourActuel ?? 1;
    const secondTourEnabled = Boolean(electionState?.secondTourEnabled);

    return (
      <div style={styles.duoBlock}>
        <div style={styles.panel("rgba(34, 197, 94, 0.08)")}>
          <h3 style={styles.panelTitle}>🔄 Retour 1er tour</h3>
          <p style={styles.panelText}>
            Réinitialise l’état global en mode <strong>T1</strong> (non destructif).
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={styles.chip("red")}>
              Tour actuel : <strong>{tourActuel}</strong>
            </span>
          </div>

          <button
            type="button"
            className="action-btn btn-compact"
            style={{ ...styles.smallBtn, ...styles.btnT1 }}
            disabled={tourActuel === 1 && !secondTourEnabled}
            onClick={handleRetourPremierTour}
            title={tourActuel === 1 && !secondTourEnabled ? "Déjà en mode 1er tour" : "Revenir au 1er tour"}
          >
            Retour T1
          </button>
        </div>

        <div style={styles.panel("rgba(245, 158, 11, 0.08)")}>
          <h3 style={styles.panelTitle}>🟧 Passage 2nd tour</h3>
          <p style={styles.panelText}>
            Autorise / bloque la confirmation du passage au 2nd tour (écran Passage T2).
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
            <span style={styles.chip(secondTourEnabled ? "green" : "red")}>
              Passage T2 : <strong>{secondTourEnabled ? "Actif" : "Inactif"}</strong>
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              type="button"
              className="action-btn btn-compact"
              style={{ ...styles.smallBtn, ...styles.btnT2 }}
              onClick={() => handleSetSecondTourEnabled(true)}
              disabled={secondTourEnabled === true}
              title={secondTourEnabled ? "Déjà actif" : "Activer"}
            >
              Actif
            </button>

            <button
              type="button"
              className="action-btn btn-compact"
              style={{ ...styles.smallBtn, ...styles.btnDanger }}
              onClick={() => handleSetSecondTourEnabled(false)}
              disabled={secondTourEnabled === false}
              title={!secondTourEnabled ? "Déjà inactif" : "Désactiver"}
            >
              Inactif
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Wrapper visuel sans rajouter de titres (évite les doublons avec les composants internes)
  const CardSection = ({ children }) => (
    <div className="card" style={styles.sectionCard}>
      {children}
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
        return <Dashboard onNavigate={setCurrentPage} />;

      case "participation":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <ParticipationSaisie />
            <ParticipationTableau />
            <ParticipationStats />
          </div>
        );

      case "resultats":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <ResultatsSaisieBureau />
            <ResultatsConsolidation />
            <ResultatsValidation />
            <ResultatsClassement />
          </div>
        );

      case "passage-t2":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <PassageSecondTour />
            <ConfigurationT2 />
          </div>
        );

      case "sieges":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <SiegesMunicipal />
            <SiegesCommunautaire />
          </div>
        );

      case "exports":
        if (!isAuthenticated) return renderAuthGate();
        return (
          <div className="page-container">
            <ExportPDF />
            <ExportExcel />
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
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className={`app ${electionState?.tourActuel === 2 ? "theme-tour-2" : "theme-tour-1"}`}>
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} isAuthenticated={isAuthenticated} onSignIn={handleSignIn} onSignOut={handleSignOut} />

      <main className="main-content">{renderPage()}</main>

      <Footer />
    </div>
  );
}

export default App;
