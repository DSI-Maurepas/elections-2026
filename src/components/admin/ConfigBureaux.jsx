import React, { useEffect, useState, useCallback } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';
import googleSheetsService from '../../services/googleSheetsService';

const ConfigBureaux = () => {
  const { data: bureaux, load, loading } = useGoogleSheets('Bureaux');

  const [t2Enabled, setT2Enabled] = useState(false);
  const [t2Loading, setT2Loading] = useState(true);
  const [t2Saving, setT2Saving] = useState(false);
  const [t2Error, setT2Error] = useState(null);

  const loadT2Flag = useCallback(async () => {
    try {
      setT2Loading(true);
      setT2Error(null);

      const state = await googleSheetsService.getElectionState();
      const raw = state?.secondTourEnabled;

      // Par convention : true/false ou "true"/"false" ou 1/0
      const enabled =
        raw === true ||
        raw === 1 ||
        raw === '1' ||
        String(raw).toLowerCase() === 'true';

      setT2Enabled(Boolean(enabled));
    } catch (e) {
      console.error('Erreur chargement état T2:', e);
      setT2Error(e?.message || 'Erreur chargement état T2');
    } finally {
      setT2Loading(false);
    }
  }, []);

  const toggleT2Enabled = useCallback(async () => {
    try {
      setT2Saving(true);
      setT2Error(null);

      const next = !t2Enabled;
      await googleSheetsService.updateElectionState('secondTourEnabled', next);

      // Audit (non bloquant)
      try {
        await googleSheetsService.logAudit(
          'TOGGLE_SECOND_TOUR',
          'ELECTION',
          'STATE',
          { secondTourEnabled: t2Enabled },
          { secondTourEnabled: next }
        );
      } catch (auditErr) {
        // L'audit ne doit jamais bloquer une action métier
        console.warn('Audit non bloquant (TOGGLE_SECOND_TOUR):', auditErr);
      }

      setT2Enabled(next);
    } catch (e) {
      console.error('Erreur bascule T2:', e);
      setT2Error(e?.message || 'Erreur bascule T2');
    } finally {
      setT2Saving(false);
    }
  }, [t2Enabled]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadT2Flag();
  }, [loadT2Flag]);

  return (
    <div className="config-bureaux">
      <h3>📍 Configuration des bureaux de vote</h3>

      {/* Bloc de pilotage T2 (admin) */}
      <div
        style={{
          margin: '12px 0 16px',
          padding: '12px',
          border: '1px solid rgba(0,0,0,0.12)',
          borderRadius: 8,
        }}
      >
        <div style={{ fontWeight: 700, marginBottom: 8 }}>➡️ Passage au 2nd tour</div>

        {t2Loading ? (
          <p style={{ margin: 0 }}>Chargement état...</p>
        ) : (
          <>
            <p style={{ margin: '0 0 10px' }}>
              État actuel :{' '}
              <strong style={{ color: t2Enabled ? '#137333' : '#B3261E' }}>
                {t2Enabled ? 'Actif' : 'Inactif'}
              </strong>
            </p>

            {t2Error ? (
              <p style={{ margin: '0 0 10px', color: '#B3261E' }}>{t2Error}</p>
            ) : null}

            <button
              type="button"
              className="btn"
              onClick={toggleT2Enabled}
              disabled={t2Saving}
              aria-label="Activer ou désactiver le passage au second tour"
              title="Active/désactive le passage au second tour (déverrouille le bouton de confirmation)"
            >
              {t2Saving
                ? 'Enregistrement...'
                : t2Enabled
                ? 'Désactiver le passage au 2nd tour'
                : 'Activer le passage au 2nd tour'}
            </button>

            <p style={{ margin: '10px 0 0', opacity: 0.75 }}>
              Tant que ce réglage est <strong>Inactif</strong>, le bouton “Confirmer passage au 2nd tour” reste verrouillé (⛔).
            </p>
          </>
        )}
      </div>

      {loading ? (
        <p>Chargement...</p>
      ) : (
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Nom</th>
              <th>Adresse</th>
              <th>Président</th>
              <th>Secrétaire</th>
              <th>Inscrits</th>
            </tr>
          </thead>
          <tbody>
            {bureaux.map((bureau) => (
              <tr key={bureau.id}>
                <td>{bureau.id}</td>
                <td>
                  <strong>{bureau.nom}</strong>
                </td>
                <td>{bureau.adresse}</td>
                <td>{bureau.president}</td>
                <td>{bureau.secretaire}</td>
                <td>{bureau.inscrits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ConfigBureaux;
