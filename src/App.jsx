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

import "./styles/App.css";
import "./styles/variables.css";
import "./styles/components/navigation.css";
import "./styles/components/dashboard.css";
import "./styles/components/components.css";

function App() {
  const [currentPage, setCurrentPage] = useState("dashboard");
  const [authToken, setAuthToken] = useState(() => authService.getAccessToken());

  // Optionnel : si authService persiste le token, on le relit au montage
  useEffect(() => {
    setAuthToken(authService.getAccessToken());
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
            <ConfigBureaux />
            <ConfigCandidats />
            <AuditLog />
          </div>
        );

      default:
        return <Dashboard onNavigate={setCurrentPage} />;
    }
  };

  return (
    <div className="app">
      <Navigation currentPage={currentPage} onNavigate={setCurrentPage} />

      <div style={{ display: "flex", justifyContent: "flex-end", padding: "0 1rem" }}>
        {isAuthenticated ? (
          <button className="action-btn" onClick={handleSignOut}>
            Déconnexion
          </button>
        ) : (
          <button className="action-btn primary" onClick={handleSignIn}>
            Connexion Google
          </button>
        )}
      </div>

      <main className="main-content">{renderPage()}</main>

      <Footer />
    </div>
  );
}

export default App;
