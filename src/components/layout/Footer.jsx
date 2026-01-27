import React from 'react';

/**
 * Pied de page de l'application
 * Informations légales, contacts, version
 */
const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="main-footer">
      <div className="footer-content">
        <div className="footer-section">
          <h4>⚖️ Conformité légale</h4>
          <p>
            Application conforme au Code électoral français<br />
            Élections municipales et communautaires<br />
            Décret n° 2001-213 du 8 mars 2001
          </p>
        </div>

        <div className="footer-section">
          <h4>📞 Support technique</h4>
          <p>
            DSI - Mairie<br />
            En cas de problème le jour du scrutin :<br />
            <strong>Contactez immédiatement le DSI</strong>
          </p>
        </div>

        <div className="footer-section">
          <h4>🔐 Sécurité & Traçabilité</h4>
          <p>
            Toutes les actions sont tracées<br />
            Audit complet disponible<br />
            Données sécurisées (Google Sheets API)
          </p>
        </div>

        <div className="footer-section">
          <h4>ℹ️ Informations</h4>
          <p>
            Version 1.0.0<br />
            React 18 + Vite<br />
            13 bureaux de vote configurés
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          © {currentYear} - Mairie - Tous droits réservés<br />
          Application développée pour les élections municipales du 15 mars 2026
        </p>
      </div>
    </footer>
  );
};

export default Footer;
