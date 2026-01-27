import React from 'react';
import { useElectionState } from '../../hooks/useElectionState';

/**
 * Navigation principale de l'application
 * Menu contextuel selon le tour et l'état de verrouillage
 */
const Navigation = ({ currentPage, onNavigate }) => {
  const { state } = useElectionState();
  const { tourActuel, tour1Verrouille, tour2Verrouille } = state;

  const menuItems = [
    {
      id: 'dashboard',
      label: '📊 Tableau de bord',
      page: 'dashboard',
      always: true
    },
    {
      id: 'participation',
      label: '📋 Participation',
      page: 'participation',
      show: true
    },
    {
      id: 'resultats',
      label: '🗳️ Résultats',
      page: 'resultats',
      show: true
    },
    {
      id: 'passage-t2',
      label: '➡️ Passage T2',
      page: 'passage-t2',
      show: tourActuel === 1 && !tour1Verrouille
    },
    {
      id: 'sieges',
      label: '🪑 Sièges',
      page: 'sieges',
      show: (tourActuel === 1 && tour1Verrouille) || (tourActuel === 2 && tour2Verrouille)
    },
    {
      id: 'exports',
      label: '📄 Exports',
      page: 'exports',
      show: true
    },
    {
      id: 'admin',
      label: '⚙️ Administration',
      page: 'admin',
      show: true
    }
  ];

  return (
    <nav className="main-navigation">
      <div className="nav-header">
        <h1>🗳️ Élections Municipales 2026</h1>
        <div className="election-status">
          <span className={`tour-badge tour-${tourActuel}`}>
            {tourActuel === 1 ? '1er Tour' : '2nd Tour'}
          </span>
          {tourActuel === 1 && (
            <span className={`lock-status ${tour1Verrouille ? 'locked' : 'unlocked'}`}>
              {tour1Verrouille ? '🔒 Verrouillé' : '🔓 En cours'}
            </span>
          )}
          {tourActuel === 2 && (
            <span className={`lock-status ${tour2Verrouille ? 'locked' : 'unlocked'}`}>
              {tour2Verrouille ? '🔒 Verrouillé' : '🔓 En cours'}
            </span>
          )}
        </div>
      </div>

      <ul className="nav-menu">
        {menuItems
          .filter(item => item.always || item.show)
          .map(item => (
            <li key={item.id}>
              <button
                className={`nav-item ${currentPage === item.page ? 'active' : ''}`}
                onClick={() => onNavigate(item.page)}
              >
                {item.label}
              </button>
            </li>
          ))}
      </ul>

      <div className="nav-info">
        <p className="election-dates">
          <strong>1er tour :</strong> Dimanche 15 mars 2026<br />
          <strong>2nd tour :</strong> Dimanche 22 mars 2026<br />
          <strong>Horaires :</strong> 08h00 - 20h00
        </p>
      </div>
    </nav>
  );
};

export default Navigation;
