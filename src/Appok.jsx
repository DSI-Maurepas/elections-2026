// src/App.jsx
import React, { useEffect, useMemo, useState } from "react";
import authService from "./services/authService";

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
          // clic backdrop = fermeture + retour dashboard (évite un admin semi-ouvert)
          setAdminModalOpen(false);
          setCurrentPage('dashboard');
        }}
      >
        <div
          className="card"
          style={{ maxWidth: 520, width: '100%', padding: '1rem' }}
          onClick={(e) => e.stopPropagation()}
        >
          <h2 style={{ marginTop: 0 }}>⚙️ Accès Administration</h2>
          <p style={{ marginTop: 0 }}>
            Saisissez le mot de passe pour accéder aux fonctions d'administration (dont le déverrouillage du passage T2).
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
              onClick={() => {
                setAdminModalOpen(false);
                setCurrentPage('dashboard');
              }}
            >
              Annuler
            </button>
            <button type="button" className="action-btn primary" onClick={handleAdminLogin}>
              Se connecter
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
            <div className="card" style={{ marginBottom: "1rem", padding: "1rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0 }}>⚙️ Administration</h2>
                {isAdminAuthenticated && (
                  <button type="button" className="action-btn" onClick={handleAdminLogout}>
                    Déconnexion admin
                  </button>
                )}
              </div>
              <p style={{ margin: "0.5rem 0 0 0" }}>
                Accès protégé par mot de passe. Les actions ici impactent l’état officiel (Sheets) et doivent être tracées.
              </p>
            </div>
            {isAdminAuthenticated ? (
              <>
                <ConfigBureaux />
                <ConfigCandidats />
                <AuditLog />
              </>
            ) : null}
          </div>
        );

      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} isAuthenticated={isAuthenticated} onSignIn={handleSignIn} onSignOut={handleSignOut} />

      <main className="main-content">{renderPage()}</main>

      <Footer />
    </div>
  );
}

export default App;
