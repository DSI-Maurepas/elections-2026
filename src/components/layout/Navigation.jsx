import React, { useEffect, useState, useRef, useLayoutEffect } from "react";
/**
 * Navigation principale de l'application
 * Menu contextuel selon le tour et l'état de verrouillage
 *
 * NOTE : Cette version ne change aucune logique métier.
 * - L'état "Scrutin ouvert/clos" est informatif (heure locale).
 * - Les couleurs Tour 1 / Tour 2 s'inversent après la date du 1er tour.
 */
const Navigation = ({ currentPage, onNavigate, isAuthenticated, onSignIn, onSignOut, electionState }) => {
  const { tourActuel, tour1Verrouille, tour2Verrouille } = electionState || {};

  const isTourLocked = (tourActuel === 1 && tour1Verrouille) || (tourActuel === 2 && tour2Verrouille);

  const getScrutinStatus = () => {
    // Statut purement informatif : Avant ouverture / Ouvert / Clos (heure locale)
    const now = new Date();

    // Dates officielles : Dimanche 15 mars 2026 et Dimanche 22 mars 2026
    const tour1Date = new Date(2026, 2, 15); // mois 0-based (2 = mars)
    const tour2Date = new Date(2026, 2, 22);

    const electionDate = tourActuel === 2 ? tour2Date : tour1Date;

    // Fenêtre horaire 08:00 - 20:00
    const start = new Date(electionDate);
    start.setHours(8, 0, 0, 0);
    const end = new Date(electionDate);
    end.setHours(20, 0, 0, 0);

    const sameDay =
      now.getFullYear() === electionDate.getFullYear() &&
      now.getMonth() === electionDate.getMonth() &&
      now.getDate() === electionDate.getDate();

    if (!sameDay) {
      if (now < start) return { label: 'Avant ouverture', tone: 'warn' };
      return { label: 'Scrutin clos', tone: 'danger' };
    }

    if (now < start) return { label: 'Avant ouverture', tone: 'warn' };
    if (now <= end) return { label: 'Scrutin ouvert', tone: 'ok' };
    return { label: 'Scrutin clos', tone: 'danger' };
  };

  const scrutinStatus = isTourLocked ? { label: 'Tour verrouillé', tone: 'locked' } : getScrutinStatus();

  // Inversion des couleurs T1/T2 après la date du 1er tour (15 mars 2026)
  const isAfterTour1Date = (() => {
    const now = new Date();
    const tour1Date = new Date(2026, 2, 15);
    const cutoff = new Date(tour1Date);
    cutoff.setHours(0, 0, 0, 0);
    return now >= cutoff;
  })();

  const t1Tone = isAfterTour1Date ? 'warn' : 'ok';  // T1 vert avant, orange après
  const t2Tone = isAfterTour1Date ? 'ok' : 'warn';  // T2 orange avant, vert après

  const menuItems = [
    { id: 'dashboard', label: '📊 Tableau de bord', page: 'dashboard', always: true },
    { id: 'participation', label: '📋 Participation', page: 'participation', show: true },
    { id: 'resultats', label: '🗳️ Résultats', page: 'resultats', show: true },
    { id: 'passage-t2', label: '➡️ Passage T2', page: 'passage-t2', show: true, disabled: !(tourActuel === 1 && !tour1Verrouille), disabledHint: 'Disponible uniquement en Tour 1 (non verrouillé).' },
    { id: 'sieges', label: '🪑 Sièges', page: 'sieges', show: true },
    { id: 'exports', label: '📄 Exports', page: 'exports', show: true },
    { id: 'admin', label: '⚙️ Administration', page: 'admin', show: true }
  ];

  const renderStatusIcon = () => {
    if (scrutinStatus.tone === 'ok') return '🟢';
    if (scrutinStatus.tone === 'warn') return '🟠';
    if (scrutinStatus.tone === 'locked') return '⚪';
    return '🔴';
  };


  // === Responsive nav buttons: même largeur (celle du plus grand) en mobile uniquement ===
  const btnRefs = useRef([]);
  const [mobileBtnWidth, setMobileBtnWidth] = useState(null);

  useLayoutEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)');
    const compute = () => {
      if (!mq.matches) {
        setMobileBtnWidth(null);
        return;
      }
      const widths = btnRefs.current
        .filter(Boolean)
        .map((el) => Math.ceil(el.getBoundingClientRect().width));
      const max = widths.length ? Math.max(...widths) : null;
      setMobileBtnWidth(max);
    };

    compute();
    window.addEventListener('resize', compute);
    mq.addEventListener?.('change', compute);

    return () => {
      window.removeEventListener('resize', compute);
      mq.removeEventListener?.('change', compute);
    };
  }, [currentPage]);

  return (
    <nav className="main-navigation" aria-label="Navigation principale">
      <div className="nav-header">
        <h1 className="app-title" aria-label="Élections Municipales 2026">
          <span className="app-title-main">Élections Municipales</span>
          <span className="app-title-year">2026</span>
        </h1>

        <div className="nav-header-right">
          <div className="election-status" role="status" aria-live="polite">
            <span
              className={['tour-pill','tour-pill--t1', tourActuel === 1 ? 'is-active' : 'is-inactive'].join(' ')}
              aria-label="Tour 1"
            >
              1er Tour
            </span>

            <span
              className={['tour-pill','tour-pill--t2', tourActuel === 2 ? 'is-active' : 'is-inactive'].join(' ')}
              aria-label="Tour 2"
            >
              2nd Tour
            </span>

            <span
              className={[
                'scrutin-status',
                scrutinStatus.tone,
                scrutinStatus.tone === 'ok' ? 'is-pulsing' : ''
              ].join(' ')}
            >
              {renderStatusIcon()} {scrutinStatus.label}
            </span>
          </div>

          <div className="scrutin-legend scrutin-legend--right" aria-label="Légende état du scrutin">
            <div className="scrutin-legend-row">
              <span className="legend-item"><span className="legend-dot ok" aria-hidden="true"></span> Scrutin ouvert</span>
              <span className="legend-item"><span className="legend-dot warn" aria-hidden="true"></span> Avant ouverture</span>
              <span className="legend-item"><span className="legend-dot danger" aria-hidden="true"></span> Scrutin clos</span>
              <span className="legend-item"><span className="legend-dot locked" aria-hidden="true"></span> Tour verrouillé</span>
            </div>
            <div className="scrutin-legend-note">
              État basé sur : <strong>Tour 1</strong> 15 mars 2026 (08:00–20:00) · <strong>Tour 2</strong> 22 mars 2026 (08:00–20:00) · heure locale
            </div>
          </div>
        </div>
      </div>

      {/* Badge TOUR X flottant (RESPONSIVE UNIQUEMENT)
          - Visible en haut à droite
          - Ne perturbe pas la grille 2x2 des 4 boutons
      */}
      <div className="tour-indicator-floating" aria-hidden="true">
        <div className={`tour-indicator-badge tour-indicator-badge--${tourActuel || 1}`}>
          <span className="tour-indicator-icon">{tourActuel === 2 ? '🔵' : '🟢'}</span>
          <span className="tour-indicator-text">TOUR {tourActuel || 1}</span>
        </div>
      </div>

      <ul className="nav-menu" style={mobileBtnWidth ? { "--nav-btn-w": `${mobileBtnWidth}px` } : undefined}>
        {/* Indicateur de tour EN PREMIER dans la liste */}
        <li key="tour-indicator" data-menu-id="tour-indicator">
          <div className={`tour-indicator-badge tour-indicator-badge--${tourActuel}`}>
            <span className="tour-indicator-icon">{tourActuel === 2 ? '🔵' : '🟢'}</span>
            <span className="tour-indicator-text">TOUR {tourActuel}</span>
          </div>
        </li>
        
        {menuItems
          .filter((item) => item.always || item.show)
          .map((item, idx) => (
            <li key={item.id} data-menu-id={item.id}>
              <button
                data-menu-id={item.id}
                ref={(el) => { btnRefs.current[idx] = el; }}
                className={`nav-item nav-item--${item.id} ${currentPage === item.page ? 'active' : ''} ${item.disabled ? 'is-disabled' : ''}`}
                  onClick={() => { if (!item.disabled) onNavigate(item.page); }}
                  type="button"
                  disabled={!!item.disabled}
                  title={item.disabled ? (item.disabledHint || 'Indisponible') : ''}
              >
                {item.label}
              </button>
            </li>
          ))}
      </ul>

      <div className="nav-info">
        <div className="top-info-row" role="region" aria-label="Informations scrutin et connexion">
          <div className="info-block">
            <div className="info-label">1er tour</div>
            <div className="info-value">Dimanche 15 mars 2026</div>
          </div>

          <div className="info-block">
            <div className="info-label">2nd tour</div>
            <div className="info-value">Dimanche 22 mars 2026</div>
          </div>

          <div className="info-block">
            <div className="info-label">Horaires</div>
            <div className="info-value">08h00 – 20h00</div>
          </div>

          <div className="info-block info-block--auth">
            <div className="info-label">Base de données</div>
            <div className="auth-row">
              <span className={`db-status ${isAuthenticated ? 'db-status--on' : 'db-status--off'}`} aria-live="polite">
                <span className="db-dot" aria-hidden="true" />
                {isAuthenticated ? 'Connectée' : 'Déconnectée'}
              </span>

              {isAuthenticated ? (
                <button className="auth-btn auth-btn--off" onClick={onSignOut} type="button">
                  Se déconnecter
                </button>
              ) : (
                <button className="auth-btn auth-btn--on" onClick={onSignIn} type="button">
                  Connexion Google
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;