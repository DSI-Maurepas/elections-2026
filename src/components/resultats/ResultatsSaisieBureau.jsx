// src/components/resultats/ResultatsSaisieBureau.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import googleSheetsService from '../../services/googleSheetsService';
import auditService from '../../services/auditService';
import { getAuthState, isBV } from '../../services/authService';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Normalise les bureauId pour un matching robuste
 */
const normalizeBureauId = (value) => {
  if (value === null || value === undefined) return '';
  const s = String(value).trim().toUpperCase();
  const m = s.match(/(\d+)/);
  return m ? m[1] : s;
};

export default function ResultatsSaisieBureau({ electionState: electionStateProp } = {}) {
  const auth = useMemo(() => getAuthState(), []);
  const forcedBureauId = isBV(auth) ? String(auth.bureauId) : null;

  const { state: electionStateHook } = useElectionState();
  const electionState = electionStateProp || electionStateHook;
  const tourActuel = electionState?.tourActuel === 2 ? 2 : 1;
  const resultatsSheet = tourActuel === 2 ? 'Resultats_T2' : 'Resultats_T1';

  const { data: bureaux } = useGoogleSheets('Bureaux');
  const { data: candidats } = useGoogleSheets('Candidats');
  const { data: resultats, load: reloadResultats, loading: loadingResultats } = useGoogleSheets(resultatsSheet);

  const [selectedBureauId, setSelectedBureauId] = useState(forcedBureauId || '');
  const [row, setRow] = useState(null);

  const [inputsMain, setInputsMain] = useState({
    inscrits: '',
    votants: '',
    blancs: '',
    nuls: '',
    exprimes: '',
  });

  const [inputsVoix, setInputsVoix] = useState({});

  useEffect(() => {
    if (forcedBureauId) setSelectedBureauId(forcedBureauId);
  }, [forcedBureauId]);

  const bureauOptions = useMemo(() => {
    const list = Array.isArray(bureaux) ? bureaux : [];
    return list
      .filter((b) => b && (b.actif === true || b.actif === 'TRUE' || b.actif === 1))
      .map((b) => ({ id: String(b.id ?? ''), nom: String(b.nom ?? b.id ?? '') }));
  }, [bureaux]);

  const candidatsActifs = useMemo(() => {
    const list = Array.isArray(candidats) ? candidats : [];
    const filtered = list.filter((c) => (tourActuel === 1 ? !!c.actifT1 : !!c.actifT2));
    filtered.sort((a, b) => (Number(a.ordre) || 0) - (Number(b.ordre) || 0));
    return filtered;
  }, [candidats, tourActuel]);

  const findRowForBureau = useCallback((bureauId) => {
    const list = Array.isArray(resultats) ? resultats : [];
    const normalized = normalizeBureauId(bureauId);
    return list.find((r) => normalizeBureauId(r?.bureauId ?? '') === normalized) || null;
  }, [resultats]);

  const getInscritsForBureau = useCallback((bureauId) => {
    const list = Array.isArray(bureaux) ? bureaux : [];
    const normalized = normalizeBureauId(bureauId);
    const bureau = list.find((b) => normalizeBureauId(b?.id ?? '') === normalized);
    return bureau ? Number(bureau.inscrits) || 0 : 0;
  }, [bureaux]);

  useEffect(() => {
    if (!selectedBureauId) {
      setRow(null);
      setInputsMain({ inscrits: '', votants: '', blancs: '', nuls: '', exprimes: '' });
      setInputsVoix({});
      return;
    }

    const current = findRowForBureau(selectedBureauId);
    setRow(current);

    const inscritsFromBureaux = getInscritsForBureau(selectedBureauId);

    const nextMain = {
      inscrits: String(inscritsFromBureaux || ''),
      votants: current ? String(current.votants ?? '') : '',
      blancs: current ? String(current.blancs ?? '') : '',
      nuls: current ? String(current.nuls ?? '') : '',
      exprimes: current ? String(current.exprimes ?? '') : '',
    };
    setInputsMain(nextMain);

    const nextVoix = {};
    for (const c of candidatsActifs) {
      const key = String(c?.listeId ?? '').trim();
      if (!key) continue;
      const v = current?.voix?.[key];
      nextVoix[key] = (v === null || v === undefined) ? '' : String(v);
    }
    setInputsVoix(nextVoix);
  }, [selectedBureauId, tourActuel, candidatsActifs, findRowForBureau, getInscritsForBureau]);

  const coerceInt = (v) => {
    const s = String(v ?? '').trim();
    if (s === '') return 0;
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : 0;
  };

  const buildRowData = useCallback(() => {
    const voix = {};
    for (const c of candidatsActifs) {
      const key = String(c?.listeId ?? '').trim();
      if (!key) continue;
      voix[key] = coerceInt(inputsVoix[key]);
    }

    const votants = coerceInt(inputsMain.votants);
    const blancs = coerceInt(inputsMain.blancs);
    const nuls = coerceInt(inputsMain.nuls);
    const exprimes = coerceInt(inputsMain.exprimes);

    return {
      bureauId: selectedBureauId,
      inscrits: coerceInt(inputsMain.inscrits),
      votants: votants,
      blancs: blancs,
      nuls: nuls,
      exprimes: exprimes,
      voix,
      saisiPar: row?.saisiPar ?? '',
      validePar: row?.validePar ?? '',
      timestamp: row?.timestamp ?? '',
    };
  }, [candidatsActifs, inputsMain, inputsVoix, row, selectedBureauId]);

  const saveCurrentRow = useCallback(async (fieldLabelForAudit) => {
    if (!selectedBureauId) return;

    const rowData = buildRowData();

    if (row && (row.rowIndex !== undefined && row.rowIndex !== null)) {
      await googleSheetsService.updateRow(resultatsSheet, row.rowIndex, rowData);
    } else {
      await googleSheetsService.appendRow(resultatsSheet, rowData);
    }

    try {
      await auditService.logAction?.('RESULTATS_SAISIE', {
        tour: tourActuel,
        bureauId: selectedBureauId,
        champ: fieldLabelForAudit || 'SAVE',
      });
    } catch (_) {}

    await reloadResultats();

    const refreshed = findRowForBureau(selectedBureauId);
    setRow(refreshed);
  }, [buildRowData, findRowForBureau, reloadResultats, resultatsSheet, row, selectedBureauId, tourActuel]);

  const onBlurMain = async (field) => {
    try {
      await saveCurrentRow(field);
    } catch (e) {
      console.error(e);
    }
  };

  const onBlurVoix = async (listeId) => {
    try {
      await saveCurrentRow(`voix_${listeId}`);
    } catch (e) {
      console.error(e);
    }
  };

  const loading = loadingResultats;


  const bureauMeta = useMemo(() => {
    const list = Array.isArray(bureaux) ? bureaux : [];
    const normalized = normalizeBureauId(selectedBureauId);
    const b = list.find((x) => normalizeBureauId(x?.id ?? '') === normalized) || null;
    if (!b) return { nom: selectedBureauId || '—', president: '—', secretaire: '—' };

    const nom = String(b?.nom ?? b?.libelle ?? b?.bureau ?? b?.id ?? selectedBureauId ?? '—');

    const president =
      String(
        b?.president ??
          b?.nomPresident ??
          b?.presidentNom ??
          b?.president_prenomNom ??
          b?.pres ??
          ''
      ).trim() || '—';

    const secretaire =
      String(
        b?.secretaire ??
          b?.nomSecretaire ??
          b?.secretaireNom ??
          b?.secret ??
          ''
      ).trim() || '—';

    return { nom, president, secretaire };
  }, [bureaux, selectedBureauId]);

  const controles = useMemo(() => {
    const votants = coerceInt(inputsMain.votants);
    const blancs = coerceInt(inputsMain.blancs);
    const nuls = coerceInt(inputsMain.nuls);
    const exprimes = coerceInt(inputsMain.exprimes);

    const ctrl1Ok = votants === (blancs + nuls + exprimes);

    let sommeVoix = 0;
    for (const c of candidatsActifs) {
      const key = String(c?.listeId ?? '').trim();
      if (!key) continue;
      sommeVoix += coerceInt(inputsVoix[key]);
    }
    const ctrl2Ok = sommeVoix === exprimes;

    return { votants, blancs, nuls, exprimes, sommeVoix, ctrl1Ok, ctrl2Ok };
  }, [candidatsActifs, inputsMain, inputsVoix]);

  return (
    <div style={{ marginTop: 20 }}>
      <style>{`
        /* Responsive pour la grille des champs */
        .resultats-saisie-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(120px, 1fr));
          gap: 10px;
          margin: 10px 0 16px;
        }

        /* Mobile : réorganisation demandée
           Ligne 1 : INSCRITS + EXPRIMÉS
           Ligne 2 : VOTANTS + BLANCS + NULS
        */
        @media (max-width: 768px) {
          .resultats-saisie-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-template-areas:
              "inscrits exprimes exprimes"
              "votants  blancs   nuls";
          }

          .resultats-field-inscrits { grid-area: inscrits; }
          .resultats-field-exprimes { grid-area: exprimes; }
          .resultats-field-votants { grid-area: votants; }
          .resultats-field-blancs { grid-area: blancs; }
          .resultats-field-nuls { grid-area: nuls; }
        }

        /* Très petit écran : on conserve l’ordre logique, mais on évite l’écrasement */
        @media (max-width: 480px) {
          .resultats-saisie-grid {
            /* Toujours 2 lignes : INSCRITS + EXPRIMÉS / VOTANTS + BLANCS + NULS */
            grid-template-columns: repeat(3, minmax(0, 1fr));
            grid-template-areas:
              "inscrits exprimes exprimes"
              "votants  blancs   nuls";
            gap: 8px;
          }
        }

        /* Tableau des voix : wrapper scroll horizontal + 1ère colonne sticky (Liste)
           IMPORTANT : on n’impose aucune couleur, pour respecter le style existant (th bleu, arrondis, ombres, hover…)
        */
        .resultats-voix-scroll {
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
        }

        /* En responsive, on force une largeur minimale pour activer le scroll horizontal */
        @media (max-width: 768px) {
          .resultats-voix-scroll table {
            min-width: 640px;
          }
        }

        .resultats-voix-scroll table th,
        .resultats-voix-scroll table td {
          white-space: nowrap;
        }

        .resultats-voix-box {
          border-radius: 12px;
          box-shadow: 0 10px 24px rgba(0, 0, 0, 0.12);
          overflow: hidden; /* garde les bords arrondis avec le scroll */
        }

        /* Ajustement des largeurs (flexible mais pas "trop large") */
        .resultats-voix-scroll table th:first-child,
        .resultats-voix-scroll table td:first-child {
          max-width: 220px;
          min-width: 140px;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .resultats-voix-scroll table th:nth-child(2),
        .resultats-voix-scroll table td:nth-child(2) {
          min-width: 220px;
        }

        .resultats-voix-scroll table th:nth-child(3),
        .resultats-voix-scroll table td:nth-child(3) {
          min-width: 90px;
        }

        /* Colonne 1 sticky : header inchangé, corps avec fond blanc pour éviter la superposition */
        .resultats-voix-scroll table th:first-child,
        .resultats-voix-scroll table td:first-child {
          position: sticky;
          left: 0;
        }

        .resultats-voix-scroll table thead th:first-child {
          z-index: 4;
        }

        .resultats-voix-scroll table tbody td:first-child {
          z-index: 2;
          background: #fff;
        }

      `}</style>

      <h3>Résultats — Saisie bureau (Tour {tourActuel})</h3>

      {!forcedBureauId && (
        <div style={{ margin: '10px 0' }}>
          <label style={{ marginRight: 8 }}>Bureau :</label>
          <select
            value={selectedBureauId}
            onChange={(e) => setSelectedBureauId(String(e.target.value))}
          >
            <option value="">— Sélectionner —</option>
            {bureauOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.id} — {b.nom}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading ? (
        <p>Chargement…</p>
      ) : !selectedBureauId ? (
        <p>Choisir un bureau pour saisir les résultats.</p>
      ) : (
        <>
          {/* Bloc principaux - RESPONSIVE */}
          <div className="resultats-saisie-grid">
            {/* INSCRITS */}
            <div className="resultats-field-inscrits">
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, fontWeight: 700 }}>INSCRITS</div>
              <input
                type="text"
                inputMode="numeric"
                value={inputsMain.inscrits}
                readOnly
                disabled
                style={{ width: '100%', padding: 6, background: '#f0f0f0', cursor: 'not-allowed', fontWeight: 700 }}
                title="Inscrits pré-remplis depuis l'onglet Bureaux (lecture seule)"
              />
            </div>

            {/* VOTANTS */}
            <div className="resultats-field-votants">
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>VOTANTS</div>
              <input
                type="text"
                inputMode="numeric"
                value={inputsMain.votants}
                onChange={(e) => setInputsMain((prev) => ({ ...prev, votants: e.target.value }))}
                onBlur={() => onBlurMain('votants')}
                style={{ width: '100%', padding: 6 }}
              />
            </div>

            {/* BLANCS */}
            <div className="resultats-field-blancs">
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>BLANCS</div>
              <input
                type="text"
                inputMode="numeric"
                value={inputsMain.blancs}
                onChange={(e) => setInputsMain((prev) => ({ ...prev, blancs: e.target.value }))}
                onBlur={() => onBlurMain('blancs')}
                style={{ width: '100%', padding: 6 }}
              />
            </div>

            {/* NULS */}
            <div className="resultats-field-nuls">
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>NULS</div>
              <input
                type="text"
                inputMode="numeric"
                value={inputsMain.nuls}
                onChange={(e) => setInputsMain((prev) => ({ ...prev, nuls: e.target.value }))}
                onBlur={() => onBlurMain('nuls')}
                style={{ width: '100%', padding: 6 }}
              />
            </div>

            {/* EXPRIMÉS */}
            <div className="resultats-field-exprimes">
              <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, fontWeight: 700 }}>EXPRIMÉS</div>
              <input
                type="text"
                inputMode="numeric"
                value={inputsMain.exprimes}
                readOnly
                disabled
                style={{ width: '100%', padding: 6, background: '#f0f0f0', cursor: 'not-allowed', fontWeight: 700 }}
                title="Exprimés issus du Google Sheet (lecture seule)"
              />
            </div>
          </div>


          {/* Infos bureau + contrôles (BV et ADMIN, écran + responsive) */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, margin: '0 0 14px' }}>
            <div style={{
              flex: '1 1 320px',
              background: '#dbeafe',
              border: '1px solid #bfdbfe',
              borderRadius: 10,
              padding: 10
            }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>ℹ️ Infos bureau</div>
              <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                <div><strong>Bureau :</strong> {bureauMeta.nom}</div>
                <div><strong>Président :</strong> {bureauMeta.president}</div>
                <div><strong>Secrétaire :</strong> {bureauMeta.secretaire}</div>
              </div>
            </div>

            <div style={{
              flex: '1 1 320px',
              background: controles.ctrl1Ok ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${controles.ctrl1Ok ? '#86efac' : '#fca5a5'}`,
              borderRadius: 10,
              padding: 10
            }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>✅ Contrôle</div>
              <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                Votants = Blancs + Nuls + Exprimés<br />
                <strong>{controles.votants.toLocaleString('fr-FR')}</strong>
                {' = '}
                {controles.blancs.toLocaleString('fr-FR')}
                {' + '}
                {controles.nuls.toLocaleString('fr-FR')}
                {' + '}
                {controles.exprimes.toLocaleString('fr-FR')}
              </div>
            </div>

            <div style={{
              flex: '1 1 320px',
              background: controles.ctrl2Ok ? '#dcfce7' : '#fee2e2',
              border: `1px solid ${controles.ctrl2Ok ? '#86efac' : '#fca5a5'}`,
              borderRadius: 10,
              padding: 10
            }}>
              <div style={{ fontWeight: 800, marginBottom: 6 }}>✅ Contrôle</div>
              <div style={{ fontSize: 14, lineHeight: 1.35 }}>
                Somme des voix = Exprimés<br />
                <strong>{controles.sommeVoix.toLocaleString('fr-FR')}</strong>
                {' = '}
                {controles.exprimes.toLocaleString('fr-FR')}
              </div>
            </div>
          </div>

          {/* Tableau voix */}
          <div className="resultats-voix-box"><div className="resultats-voix-scroll">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>Liste</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>Tête de liste</th>
                <th style={{ textAlign: 'left', borderBottom: '1px solid #ddd', padding: 6 }}>Voix</th>
              </tr>
            </thead>
            <tbody>
              {candidatsActifs.map((c) => {
                const listeId = String(c?.listeId ?? '').trim();
                const nomListe = String(c?.nomListe ?? '').trim();
                const tete = `${String(c?.teteListePrenom ?? '').trim()} ${String(c?.teteListeNom ?? '').trim()}`.trim();

                return (
                  <tr key={listeId || nomListe || Math.random().toString(16).slice(2)}>
                    <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{listeId || '—'} {nomListe ? `— ${nomListe}` : ''}</td>
                    <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6 }}>{tete || '—'}</td>
                    <td style={{ borderBottom: '1px solid #f0f0f0', padding: 6, width: 160 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={inputsVoix[listeId] ?? ''}
                        onChange={(e) => setInputsVoix((prev) => ({ ...prev, [listeId]: e.target.value }))}
                        onBlur={() => onBlurVoix(listeId)}
                        style={{ width: '100%', padding: 6 }}
                      />
                    </td>
                  </tr>
                );
              })}
              {candidatsActifs.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 10, opacity: 0.8 }}>
                    Aucun candidat actif pour le tour {tourActuel}.
                  </td>
                </tr>
              )}
            </tbody>
            </table>
          </div>
        </div>
        </>
      )}
    </div>
  );
}
