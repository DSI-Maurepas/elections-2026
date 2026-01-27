import React, { useEffect, useState } from 'react';
import { useElectionState } from '../../hooks/useElectionState';
import { useGoogleSheets } from '../../hooks/useGoogleSheets';

/**
 * Statistiques temps réel de la participation
 * Graphiques et analyses
 */
const ParticipationStats = () => {
  const { state: electionState } = useElectionState();
  const { data: bureaux } = useGoogleSheets('Bureaux');
  const { 
    data: participation, 
    load: loadParticipation 
  } = useGoogleSheets(electionState.tourActuel === 1 ? 'Participation_T1' : 'Participation_T2');

  const [stats, setStats] = useState({
    totalInscrits: 0,
    totalVotants: 0,
    tauxParticipation: 0,
    evolution: [],
    bureauMax: null,
    bureauMin: null
  });

  useEffect(() => {
    loadParticipation();
  }, [loadParticipation]);

  useEffect(() => {
    if (participation.length === 0) return;

    // Calculer totaux
    const totalInscrits = participation.reduce((sum, p) => sum + (p.inscrits || 0), 0);
    const totalVotants = participation.reduce((sum, p) => sum + (p.votants20h || 0), 0);
    const tauxParticipation = totalInscrits > 0 ? (totalVotants / totalInscrits) * 100 : 0;

    // Calculer évolution par heure
    const heures = ['08h', '09h', '10h', '11h', '12h', '13h', '14h', '15h', '16h', '17h', '18h', '19h', '20h'];
    const evolution = heures.map(heure => {
      const votants = participation.reduce((sum, p) => {
        const field = `votants${heure}`;
        return sum + (p[field] || 0);
      }, 0);
      
      return {
        heure,
        votants,
        taux: totalInscrits > 0 ? (votants / totalInscrits) * 100 : 0
      };
    });

    // Trouver bureau avec taux max et min
    const bureauxAvecTaux = participation
      .map(p => {
        const bureau = bureaux.find(b => b.id === p.bureauId);
        return {
          bureauId: p.bureauId,
          bureauNom: bureau?.nom || p.bureauId,
          inscrits: p.inscrits || 0,
          votants: p.votants20h || 0,
          taux: (p.inscrits > 0) ? ((p.votants20h || 0) / p.inscrits) * 100 : 0
        };
      })
      .filter(b => b.inscrits > 0);

    const bureauMax = bureauxAvecTaux.reduce((max, b) => 
      b.taux > (max?.taux || 0) ? b : max, null);
    
    const bureauMin = bureauxAvecTaux.reduce((min, b) => 
      b.taux < (min?.taux || 100) ? b : min, null);

    setStats({
      totalInscrits,
      totalVotants,
      tauxParticipation,
      evolution,
      bureauMax,
      bureauMin
    });
  }, [participation, bureaux]);

  return (
    <div className="participation-stats">
      <h2>📈 Statistiques de participation - Tour {electionState.tourActuel}</h2>

      {/* Chiffres clés */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalInscrits.toLocaleString('fr-FR')}</div>
          <div className="stat-label">Inscrits</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{stats.totalVotants.toLocaleString('fr-FR')}</div>
          <div className="stat-label">Votants (20h)</div>
        </div>

        <div className="stat-card highlight">
          <div className="stat-value">{stats.tauxParticipation.toFixed(2)}%</div>
          <div className="stat-label">Taux de participation</div>
        </div>

        <div className="stat-card">
          <div className="stat-value">{(stats.totalInscrits - stats.totalVotants).toLocaleString('fr-FR')}</div>
          <div className="stat-label">Abstentions</div>
        </div>
      </div>

      {/* Évolution horaire */}
      <div className="evolution-section">
        <h3>Évolution horaire</h3>
        <div className="evolution-chart">
          {stats.evolution.map((point, index) => (
            <div key={point.heure} className="chart-bar">
              <div 
                className="bar"
                style={{ 
                  height: `${point.taux}%`,
                  backgroundColor: `hsl(${120 - point.taux}, 70%, 50%)`
                }}
              >
                <span className="bar-value">{point.taux.toFixed(1)}%</span>
              </div>
              <div className="bar-label">{point.heure}</div>
              <div className="bar-votants">{point.votants.toLocaleString('fr-FR')}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bureaux extrêmes (diagrammes) */}
      <div className="extremes-section">
        <h3>🎯 Bureaux extrêmes</h3>

        <div className="extremes-table" role="table" aria-label="Participation maximale et minimale">
          <div className="extremes-row max" role="row">
            <div className="extremes-type" role="cell">
              🏆 <span>Max</span>
            </div>

            <div className="extremes-bureau" role="cell">
              <div className="bureau-name">{stats.bureauMax?.bureauNom || '—'}</div>
              <div className="bureau-details">
                {stats.bureauMax
                  ? `${stats.bureauMax.votants.toLocaleString('fr-FR')} votants / ${stats.bureauMax.inscrits.toLocaleString('fr-FR')} inscrits`
                  : 'Aucune donnée'}
              </div>
            </div>

            <div className="extremes-metric" role="cell">
              <div className="meter" aria-hidden="true">
                <div
                  className="meter-fill"
                  style={{ width: `${Math.min(100, Math.max(0, stats.bureauMax?.taux || 0))}%` }}
                />
              </div>
              <div className="meter-value">{(stats.bureauMax?.taux || 0).toFixed(2)}%</div>
            </div>
          </div>

          <div className="extremes-row min" role="row">
            <div className="extremes-type" role="cell">
              📉 <span>Min</span>
            </div>

            <div className="extremes-bureau" role="cell">
              <div className="bureau-name">{stats.bureauMin?.bureauNom || '—'}</div>
              <div className="bureau-details">
                {stats.bureauMin
                  ? `${stats.bureauMin.votants.toLocaleString('fr-FR')} votants / ${stats.bureauMin.inscrits.toLocaleString('fr-FR')} inscrits`
                  : 'Aucune donnée'}
              </div>
            </div>

            <div className="extremes-metric" role="cell">
              <div className="meter" aria-hidden="true">
                <div
                  className="meter-fill"
                  style={{ width: `${Math.min(100, Math.max(0, stats.bureauMin?.taux || 0))}%` }}
                />
              </div>
              <div className="meter-value">{(stats.bureauMin?.taux || 0).toFixed(2)}%</div>
            </div>
          </div>
        </div>
      </div>

      {/* Analyse (diagrammes) */}
      <div className="analysis-section">
        <h3>📊 Analyse</h3>

        {(() => {
          const progressionMoy = stats.evolution.length > 0
            ? (stats.tauxParticipation / stats.evolution.length)
            : 0;

          const ecart = (stats.bureauMax && stats.bureauMin)
            ? (stats.bureauMax.taux - stats.bureauMin.taux)
            : 0;

          const declares = participation.length;
          const total = bureaux.length;

          return (
            <div className="analysis-diagrams">
              <div className="metric-card">
                <div className="metric-head">
                  <span className="metric-emoji">📈</span>
                  <span className="metric-title">Progression moyenne</span>
                </div>
                <div className="metric-value">Progression moyenne par heure : {progressionMoy.toFixed(2)}% / heure</div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, progressionMoy))}%` }} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-head">
                  <span className="metric-emoji">📊</span>
                  <span className="metric-title">Écart max / min</span>
                </div>
                <div className="metric-value">Écart max/min : {ecart.toFixed(2)}%</div>
                <div className="meter">
                  <div className="meter-fill" style={{ width: `${Math.min(100, Math.max(0, ecart))}%` }} />
                </div>
              </div>

              <div className="metric-card">
                <div className="metric-head">
                  <span className="metric-emoji">🗳️</span>
                  <span className="metric-title">Bureaux déclarés</span>
                </div>
                <div className="metric-value">Bureaux déclarés : {declares} / {total}</div>
                <div className="meter">
                  <div
                    className="meter-fill"
                    style={{ width: `${total > 0 ? Math.min(100, Math.max(0, (declares / total) * 100)) : 0}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
};

export default ParticipationStats;
