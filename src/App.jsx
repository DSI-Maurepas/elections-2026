// src/App.jsx
import React, { Suspense, useEffect, useMemo, useState } from "react";
import authService, { loginWithCode, getAuthState, logoutAccess, isBV } from "./services/authService";
import uiService from "./services/uiService";
import { useElectionState } from "./hooks/useElectionState";

import Navigation from "./components/layout/Navigation";
import Footer from "./components/layout/Footer";

// ⚡ Lazy loading : chaque page n'est chargée qu'à la navigation
const Dashboard = React.lazy(() => import("./components/dashboard/Dashboard"));
const ParticipationSaisie = React.lazy(() => import("./components/participation/ParticipationSaisie"));
const ParticipationTableau = React.lazy(() => import("./components/participation/ParticipationTableau"));
const ParticipationStats = React.lazy(() => import("./components/participation/ParticipationStats"));
const ResultatsSaisieBureau = React.lazy(() => import("./components/resultats/ResultatsSaisieBureau"));
const ResultatsConsolidation = React.lazy(() => import("./components/resultats/ResultatsConsolidation"));
const ResultatsValidation = React.lazy(() => import("./components/resultats/ResultatsValidation"));
const ResultatsClassement = React.lazy(() => import("./components/resultats/ResultatsClassement"));
const PassageSecondTour = React.lazy(() => import("./components/secondTour/PassageSecondTour"));
const ConfigurationT2 = React.lazy(() => import("./components/secondTour/ConfigurationT2"));
const SiegesMunicipal = React.lazy(() => import("./components/sieges/SiegesMunicipal"));
const SiegesCommunautaire = React.lazy(() => import("./components/sieges/SiegesCommunautaire"));
const ConfigBureaux = React.lazy(() => import("./components/admin/ConfigBureaux"));
const ConfigCandidats = React.lazy(() => import("./components/admin/ConfigCandidats"));
const AuditLog = React.lazy(() => import("./components/admin/AuditLog"));
const ExportPDF = React.lazy(() => import("./components/exports/ExportPDF"));
const ExportExcel = React.lazy(() => import("./components/exports/ExportExcel"));

import { canAccessPage } from "./config/authConfig";

// CSS: tout est centralisé dans styles/App.css (chargé par main.jsx)

function AccessGate({ onAuthenticated }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    const auth = loginWithCode(code);
    if (!auth) {
      setError("Code invalide");
      return;
    }
    setError(null);
    onAuthenticated(auth);
  };

  return (
    <div style={{ padding: 40, maxWidth: 460, margin: "80px auto" }}>
      <h2>Accès sécurisé</h2>
      <p style={{ marginTop: 8, opacity: 0.85 }}>
        Saisissez votre code d'accès. (Exemples : BV1, BV2, … ou admin.)
      </p>
      <form onSubmit={handleSubmit} style={{ marginTop: 16 }}>
        <input
          type="password"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          placeholder="Code d'accès"
          style={{ width: "100%", padding: 10, marginBottom: 10 }}
          autoFocus
        />
        <button type="submit" style={{ width: "100%", padding: 10 }}>
          Entrer
        </button>
        {error && <div style={{ color: "red", marginTop: 10 }}>{error}</div>}
      </form>
    </div>
  );
}

export default function App() {
  // ⚠️ IMPORTANT: Tous les hooks doivent être appelés à chaque rendu, sans return anticipé,
  // sinon React déclenche "Rendered fewer hooks than expected" (ex: lors d'une déconnexion).

  // Accès applicatif (BV / GLOBAL / ADMIN)
  const [accessAuth, setAccessAuth] = useState(() => getAuthState());

  // App V3 (navigation interne)
  const [currentPage, setCurrentPage] = useState("dashboard");

  // OAuth Google (token)
  const [authToken, setAuthToken] = useState(() => authService.getAccessToken());

  // UI (toasts + confirm modal)
  const [uiToasts, setUiToasts] = useState([]);
  const [uiConfirm, setUiConfirm] = useState({
    open: false,
    title: "",
    message: "",
    confirmText: "Confirmer",
    cancelText: "Annuler",
    _resolve: null,
  });

  const showToast = ({ type = "info", title = "", message = "", durationMs = 4000 }) => {
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

  // État global élection (source de vérité V3)
  const { state: electionState, loadState, passerSecondTour, revenirPremierTour } = useElectionState();

  const safeElectionState = electionState || { tourActuel: 1, tour1Verrouille: false, tour2Verrouille: false };
  
  // Synchronisation OAuth au montage
  useEffect(() => {
    setAuthToken(authService.getAccessToken());
  }, []);

  const isAuthenticated = useMemo(() => Boolean(authToken), [authToken]);

  // ⚠️ CORRECTION : Détecter si l'utilisateur est un BV
  const isBureauVote = useMemo(() => isBV(accessAuth), [accessAuth]);

  // --- Mapping page -> pageKey (utilisé pour la restriction d'accès) ---
  const pageKeyFor = (page) => {
    switch (page) {
      case "participation":
        return "participation_saisie";
      case "resultats":
        return "resultats_saisie_bureau";
      case "passage-t2":
        return "passage_second_tour";
      case "admin":
        return "admin_bureaux";
      case "dashboard":
      default:
        return "dashboard";
    }
  };

  const navigateSafe = (page) => {
    // Si pas d'accès applicatif (déconnexion), on ne navigue pas
    if (!accessAuth) return;

    const key = pageKeyFor(page);
    if (!canAccessPage(accessAuth, key)) {
      // BV : forcer Participation
      if (accessAuth?.role === "BV") {
        setCurrentPage("participation");
      } else {
        setCurrentPage("dashboard");
      }
      return;
    }
    setCurrentPage(page);
  };

  // Au changement d'accès: BV => participation, Global/Admin => dashboard
  useEffect(() => {
    if (!accessAuth) return;
    if (accessAuth.role === "BV") {
      setCurrentPage("participation");
    } else {
      setCurrentPage("dashboard");
    }
  }, [accessAuth]);

  // Bloque pages sensibles si non connecté OAuth
  const authRequiredPages = new Set(["participation", "resultats", "passage-t2", "sieges", "exports", "admin"]);
  useEffect(() => {
    if (!isAuthenticated && authRequiredPages.has(currentPage)) {
      setCurrentPage("dashboard");
    }
  }, [isAuthenticated, currentPage]);

  const handleSignIn = async () => {
    try {
      await authService.signIn();
      setAuthToken(authService.getAccessToken());
    } catch (e) {
      console.error("Connexion Google échouée:", e);
    }
  };

  const handleSignOut = () => {
    try {
      authService.signOut();
    } finally {
      setAuthToken(null);
      setCurrentPage("dashboard");
    }
  };

  const handleAccessLogout = () => {
    logoutAccess();
    setAccessAuth(null);
    setCurrentPage("dashboard");
    // volontairement: on ne touche pas OAuth
  };

  const renderAuthGate = () => {
    if (isAuthenticated) return null;
    return (
      <div className="auth-gate">
        <p>Connexion Google requise pour accéder aux fonctions de saisie / export.</p>
        <button className="btn btn-primary" onClick={handleSignIn} type="button">
          Se connecter avec Google
        </button>
      </div>
    );
  };

  const renderPage = () => {
    switch (currentPage) {
      case "dashboard":
        return <Dashboard electionState={safeElectionState} onNavigate={navigateSafe} />;
      case "participation":
        return (
          <>
            {renderAuthGate()}
            {isAuthenticated && (
              <>
                {/* ⚠️ CORRECTION : Layout côte à côte pour BV avec STYLE INLINE */}
                {isBureauVote ? (
                  <>
                    <style>{`
                      @media (min-width: 1025px) {
                        .participation-bv-grid {
                          display: grid !important;
                          grid-template-columns: 1fr 1fr !important;
                          gap: 24px !important;
                          margin-bottom: 24px !important;
                        }
                      }
                    `}</style>
                    <div className="participation-bv-grid">
                      <ParticipationSaisie electionState={safeElectionState} reloadElectionState={loadState} />
                      <ParticipationTableau electionState={safeElectionState} />
                    </div>
                  </>
                ) : (
                  <>
                    <ParticipationSaisie electionState={safeElectionState} reloadElectionState={loadState} />
                    <ParticipationTableau electionState={safeElectionState} />
                  </>
                )}
                <ParticipationStats electionState={safeElectionState} isBureauVote={isBureauVote} />
              </>
            )}
          </>
        );
      case "resultats":
        return (
          <>
            {renderAuthGate()}
            {isAuthenticated && (
              <>
                <ResultatsSaisieBureau electionState={safeElectionState} />
                <ResultatsConsolidation electionState={safeElectionState} />
                {/* ⚠️ CORRECTION : Masquer Validation et Classement pour les BV */}
                {!isBureauVote && (
                  <>
                    <ResultatsValidation electionState={safeElectionState} />
                    <ResultatsClassement electionState={safeElectionState} />
                  </>
                )}
              </>
            )}
          </>
        );
      case "passage-t2":
        return (
          <>
            {renderAuthGate()}
            {isAuthenticated && (
              <>
                <PassageSecondTour
                  electionState={safeElectionState}
                  passerSecondTour={passerSecondTour}
                  revenirPremierTour={revenirPremierTour}
                  accessAuth={accessAuth}
                />
                <ConfigurationT2 electionState={safeElectionState} />
              </>
            )}
          </>
        );
      case "sieges":
        return (
          <>
            {renderAuthGate()}
            {isAuthenticated && (
              <>
                <SiegesMunicipal electionState={safeElectionState} />
                <SiegesCommunautaire electionState={safeElectionState} />
              </>
            )}
          </>
        );
      case "exports":
        return (
          <>
            {renderAuthGate()}
            {isAuthenticated && (
              <>
                <ExportPDF />
                <ExportExcel />
              </>
            )}
          </>
        );
      case "admin":
        return (
          <>
            {renderAuthGate()}
            {isAuthenticated && (
              <>
                {/* === GESTION DES TOURS === */}
                <div className="card" style={{ marginBottom: 24, border: '2px solid #e74c3c', background: '#fdf2f2' }}>
                  <h2 style={{ color: '#c0392b', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
                    🔄 Gestion des Tours
                  </h2>
                  <p style={{ marginBottom: 16, color: '#555' }}>
                    Tour actuel : <strong style={{ fontSize: '1.2em', color: safeElectionState.tourActuel === 1 ? '#2563eb' : '#dc2626' }}>
                      Tour {safeElectionState.tourActuel}
                    </strong>
                    {safeElectionState.tour1Verrouille && safeElectionState.tourActuel === 1 && (
                      <span style={{ marginLeft: 12, color: '#e67e22' }}>🔒 Tour 1 verrouillé</span>
                    )}
                    {safeElectionState.tour2Verrouille && safeElectionState.tourActuel === 2 && (
                      <span style={{ marginLeft: 12, color: '#e67e22' }}>🔒 Tour 2 verrouillé</span>
                    )}
                  </p>
                  <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    {safeElectionState.tourActuel === 2 && (
                      <button
                        className="btn btn-warning"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: '1em', fontWeight: 600 }}
                        onClick={async () => {
                          const ok = await uiService.confirm({
                            title: '⚠️ Retour au Tour 1',
                            message: 'Voulez-vous vraiment revenir au Tour 1 ?\n\nLes données du Tour 2 seront conservées mais le tour actif sera le Tour 1.',
                            confirmText: 'Oui, revenir au Tour 1',
                            cancelText: 'Annuler'
                          });
                          if (!ok) return;
                          try {
                            await revenirPremierTour();
                            uiService.toast('success', { title: 'Tour 1 actif', message: 'Retour au premier tour effectué.' });
                          } catch (e) {
                            uiService.toast('error', { title: 'Erreur', message: 'Retour Tour 1 échoué : ' + (e?.message || e) });
                          }
                        }}
                      >
                        ⬅️ Retour au Tour 1
                      </button>
                    )}
                    {safeElectionState.tourActuel === 1 && (
                      <button
                        className="btn btn-danger"
                        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 20px', fontSize: '1em', fontWeight: 600 }}
                        onClick={async () => {
                          const ok = await uiService.confirm({
                            title: '⚠️ Passage au Tour 2',
                            message: 'Voulez-vous vraiment passer au Tour 2 ?\n\nCette action changera le tour actif de l\'élection.',
                            confirmText: 'Oui, passer au Tour 2',
                            cancelText: 'Annuler'
                          });
                          if (!ok) return;
                          try {
                            await passerSecondTour();
                            uiService.toast('success', { title: 'Tour 2 actif', message: 'Passage au second tour effectué.' });
                          } catch (e) {
                            uiService.toast('error', { title: 'Erreur', message: 'Passage Tour 2 échoué : ' + (e?.message || e) });
                          }
                        }}
                      >
                        ➡️ Forcer passage Tour 2
                      </button>
                    )}
                  </div>
                </div>
                <ConfigBureaux />
                <ConfigCandidats />
                <AuditLog />
              </>
            )}
          </>
        );
      default:
        return <Dashboard electionState={safeElectionState} onNavigate={navigateSafe} />;
    }
  };

  // --- Rendu conditionnel sans return anticipé (évite bug hooks) ---
  if (!accessAuth) {
    return <AccessGate onAuthenticated={(a) => setAccessAuth(a)} />;
  }

  return (
    <div className={`app-root theme-tour-${safeElectionState.tourActuel}`}>
      <Navigation
        currentPage={currentPage}
        onNavigate={navigateSafe}
        isAuthenticated={isAuthenticated}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
        electionState={safeElectionState}
        accessAuth={accessAuth}
        onAccessLogout={handleAccessLogout}
      />

      <main className="app-main" role="main">
        <Suspense fallback={<div style={{ padding: 40, textAlign: 'center' }}>Chargement…</div>}>
          {currentPage === "dashboard" ? renderPage() : (
            <div className="page-container">
              {renderPage()}
            </div>
          )}
        </Suspense>
      </main>

      <Footer />

      {uiConfirm?.open && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true">
          <div className="ui-modal">
            <div className="ui-modal-title">{uiConfirm.title}</div>
            <div className="ui-modal-message" style={{ whiteSpace: "pre-wrap" }}>
              {uiConfirm.message}
            </div>
            <div className="ui-modal-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  const r = uiConfirm._resolve;
                  setUiConfirm((p) => ({ ...p, open: false, _resolve: null }));
                  r?.(false);
                }}
              >
                {uiConfirm.cancelText || "Annuler"}
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  const r = uiConfirm._resolve;
                  setUiConfirm((p) => ({ ...p, open: false, _resolve: null }));
                  r?.(true);
                }}
              >
                {uiConfirm.confirmText || "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="ui-toasts" aria-live="polite" aria-relevant="additions">
        {uiToasts.map((t) => (
          <div key={t.id} className={`ui-toast ${t.type || "info"}`}>
            {t.title ? <div className="ui-toast-title">{t.title}</div> : null}
            {t.message ? <div className="ui-toast-message">{t.message}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
