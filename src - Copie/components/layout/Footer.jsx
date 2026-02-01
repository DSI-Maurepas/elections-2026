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
            DSI - Mairie de Maurepas<br />
			📧 j.matrat@maurepas.fr <br />
            📞 <strong>06 79 93 18 91</strong>
		 </p>
        </div>

        <div className="footer-section">
          <h4>🔐 Sécurité & Traçabilité</h4>
          <p>
            Toutes les actions sont tracées<br />
            Audit complet disponible<br />
            Données sécurisées<br />
			Validation - Consolidation
          </p>
        </div>

        <div className="footer-section">
          <h4>ℹ️ Informations</h4>
          <p>
            Version 3.6.4<br />
            13 bureaux de vote configurés<br />
            Premier tour : 15 mars 2026<br />
            Second tour : 22 mars 2026
          </p>
        </div>
      </div>

      <div className="footer-bottom">
        <p>
          © {currentYear} - DSI - Mairie de MAUREPAS - Tous droits réservés<br />
          Application développée par la DSI pour les élections municipales 2026
        </p>
      </div>
    </footer>
  );
};

export default Footer;
