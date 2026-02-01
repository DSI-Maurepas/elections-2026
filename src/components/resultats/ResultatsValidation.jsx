import React, { useEffect, useMemo } from 'react';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

const ResultatsValidation = ({ electionState}) => {
  const { data: bureaux, load: loadBureaux } = useGoogleSheets('Bureaux');
  const { data: resultats, load: loadResultats } = useGoogleSheets(
    electionState.tourActuel === 1 ? 'Resultats_T1' : 'Resultats_T2'
  );

  useEffect(() => {
    loadBureaux();
    loadResultats();
  }, [loadBureaux, loadResultats]);

  const validation = useMemo(() => {
    const declaredSet = new Set(resultats.map((r) => r.bureauId));
    return bureaux.map((bureau) => {
      const declared = declaredSet.has(bureau.id);
      const bureauResultat = resultats.find((r) => r.bureauId === bureau.id);

      let errors = [];
      let warnings = [];

      if (declared && bureauResultat) {
        const inscrits = Number(bureau.inscrits) || 0;
        const votants = Number(bureauResultat.votants) || 0;
        const blancs = Number(bureauResultat.blancs) || 0;
        const nuls = Number(bureauResultat.nuls) || 0;
        const exprimes = Number(bureauResultat.exprimes) || 0;

        if (votants > inscrits) errors.push('Votants > inscrits');
        if (blancs + nuls + exprimes !== votants) errors.push('Somme ≠ votants');
        if (exprimes === 0 && votants > 0) warnings.push('Aucun exprimé');
      }

      const status = !declared
        ? 'pending'
        : errors.length > 0
        ? 'error'
        : warnings.length > 0
        ? 'warning'
        : 'success';

      return {
        ...bureau,
        declared,
        errors,
        warnings,
        status
      };
    });
  }, [bureaux, resultats]);

  const stats = useMemo(() => {
    const declaredCount = validation.filter((v) => v.declared).length;
    const errorCount = validation.filter((v) => v.errors.length > 0).length;
    const warningCount = validation.filter((v) => v.warnings.length > 0).length;
    return { declaredCount, errorCount, warningCount };
  }, [validation]);

  const allValid = stats.declaredCount === bureaux.length && stats.errorCount === 0;

  // Classe de bandeau (visuel uniquement):
  // - is-valid : tout est OK
  // - is-error : au moins une erreur
  // - is-warning : pas d'erreur mais avertissements ou déclarations manquantes
  const bannerStateClass = allValid ? 'is-valid' : stats.errorCount > 0 ? 'is-error' : 'is-warning';
  const bannerIcon = allValid ? '🟢' : stats.errorCount > 0 ? '🔴' : '🟠';

  return (
    <div className="resultats-validation modern-card">

            <style>{`
        /* ===== ResultatsValidation — responsive lisible (scopé) ===== */
        .resultats-validation .validation-table.modern{
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
        }

        /* Desktop/tablette large : tableau compact (sans chevauchement) */
        @media (min-width: 901px){
          .resultats-validation .validation-table.modern{
            table-layout: fixed;
          }
          .resultats-validation .validation-table.modern th,
          .resultats-validation .validation-table.modern td{
            padding: 10px 10px;
            box-sizing: border-box;
          }
          .resultats-validation .validation-table.modern th:nth-child(1),
          .resultats-validation .validation-table.modern td:nth-child(1){
            width: 36%;
          }
          .resultats-validation .validation-table.modern th:nth-child(2),
          .resultats-validation .validation-table.modern td:nth-child(2){
            width: 64px;
            text-align: center;
          }
          .resultats-validation .validation-table.modern th:nth-child(3),
          .resultats-validation .validation-table.modern td:nth-child(3),
          .resultats-validation .validation-table.modern th:nth-child(4),
          .resultats-validation .validation-table.modern td:nth-child(4){
            width: 32%;
          }
          .resultats-validation .cell-bureau{
            white-space: normal;
            word-break: normal;
            overflow-wrap: break-word; /* wrap sur mots, pas lettre par lettre */
          }
          .resultats-validation .cell-erreurs,
          .resultats-validation .cell-avert{
            white-space: normal;
            word-break: break-word;
          }
          .resultats-validation .status-emoji{
            justify-content: center;
            padding: 6px 8px;
          }
        }

        /* Mobile/tablette : rendu en cartes (0 scroll horizontal, lisible) */
        @media (max-width: 900px){
          .resultats-validation .validation-table.modern thead{
            display: none;
          }

          .resultats-validation .validation-table.modern,
          .resultats-validation .validation-table.modern tbody,
          .resultats-validation .validation-table.modern tr,
          .resultats-validation .validation-table.modern td{
            display: block;
            width: 100%;
          }

          .resultats-validation .validation-table.modern tr{
            margin: 10px 0 14px;
            padding: 10px 10px 6px;
            border-radius: 16px;
            border: 1px solid rgba(15, 23, 42, 0.12);
            box-shadow: 0 12px 24px rgba(2, 6, 23, 0.08);
            background: rgba(255,255,255,0.96);
          }

          .resultats-validation .validation-table.modern td{
            border: none;
            padding: 8px 10px;
            box-sizing: border-box;
          }

          /* Bureau en en-tête de carte */
          .resultats-validation .validation-table.modern td.cell-bureau{
            padding: 6px 10px 10px;
            border-bottom: 1px solid rgba(15, 23, 42, 0.08);
            margin-bottom: 8px;
          }

          .resultats-validation .bureau-main{
            display: flex;
            align-items: baseline;
            gap: 8px;
            flex-wrap: wrap;
          }
          .resultats-validation .bureau-sep{
            opacity: 0.65;
            font-weight: 900;
          }
          .resultats-validation .bureau-nom{
            font-weight: 800;
          }

          /* Lignes label/valeur */
          .resultats-validation .validation-table.modern td[data-label]{
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
          }
          .resultats-validation .validation-table.modern td[data-label]::before{
            content: attr(data-label);
            font-weight: 900;
            opacity: 0.75;
            white-space: nowrap;
          }

          /* Statut centré */
          .resultats-validation .cell-statut{
            justify-content: flex-end;
          }
          .resultats-validation .status-emoji{
            padding: 6px 10px;
          }
        }
      `}</style>

      <h2 className="validation-title">
        ✅ Validation des résultats — <span>Tour {electionState.tourActuel}</span>
      </h2>

      {/* Bandeau global */}
      <div className={`validation-banner ${bannerStateClass}`}>
        <div className="banner-icon">{bannerIcon}</div>
        <div className="banner-content">
          <div className="banner-title">
            {allValid ? 'Tous les résultats sont validés' : stats.errorCount > 0 ? 'Erreurs à corriger' : 'Validation requise'}
          </div>

          {/* Petits blocs (chips) : 1 ligne en écran / wrap en mobile (géré par CSS) */}
          <div className="banner-chips">
            <span className="chip">🏛️ Bureaux : {stats.declaredCount} / {bureaux.length}</span>
            <span className="chip chip-error">🔴 Erreurs : {stats.errorCount}</span>
            <span className="chip chip-warning">🟠 Avertissements : {stats.warningCount}</span>
          </div>
        </div>
      </div>

      {/* Tableau */}
      <div className="validation-table-wrap">
        <table className="validation-table modern">
          <thead>
            <tr>
              <th>Bureau</th>
              <th>Statut</th>
              <th>Erreurs</th>
              <th>Avertissements</th>
            </tr>
          </thead>
          <tbody>
            {validation.map((v) => (
              <tr key={v.id} className={`row-${v.status}`}>
                <td data-label="Bureau" className="cell-bureau">
                  <div className="bureau-main">
                    <strong>{v.id}</strong><span className="bureau-sep">—</span><span className="bureau-nom">{v.nom}</span>
                  </div>
                </td>
                <td data-label="Statut" className="cell-statut">
                  {v.status === 'success' && <span className="status-emoji" title="Conforme" aria-label="Conforme">🟢</span>}
                  {v.status === 'error' && <span className="status-emoji" title="Erreurs" aria-label="Erreurs">🔴</span>}
                  {v.status === 'warning' && <span className="status-emoji" title="À vérifier" aria-label="À vérifier">🟠</span>}
                  {v.status === 'pending' && <span className="status-emoji" title="En attente" aria-label="En attente">⏳</span>}
                </td>
                <td data-label="Erreurs" className="cell-erreurs">{v.errors.length ? v.errors.join(', ') : '—'}</td>
                <td data-label="Avertissements" className="cell-avert">{v.warnings.length ? v.warnings.join(', ') : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResultatsValidation;
