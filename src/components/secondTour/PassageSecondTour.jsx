import React, { useState } from "react";
import { useElectionState } from "../../hooks/useElectionState";

export default function PassageSecondTour() {
  const {
    electionState,
    autoriserPassageSecondTour,
    bloquerPassageSecondTour,
  } = useElectionState();

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [actionType, setActionType] = useState(null); // "autoriser" | "bloquer"

  const isAutorise = electionState?.secondTourEnabled === true;

  const handleAskAutoriser = () => {
    setActionType("autoriser");
    setConfirmVisible(true);
  };

  const handleAskBloquer = () => {
    setActionType("bloquer");
    setConfirmVisible(true);
  };

  const handleConfirm = async () => {
    if (actionType === "autoriser") {
      await autoriserPassageSecondTour();
    } else if (actionType === "bloquer") {
      await bloquerPassageSecondTour();
    }
    setConfirmVisible(false);
    setActionType(null);
  };

  const handleCancel = () => {
    setConfirmVisible(false);
    setActionType(null);
  };

  return (
    <div className="panel panel-second-tour">
      <h3>🔵 Passage au 2nd tour</h3>

      <p>
        Cette action permet <strong>d’autoriser ou de bloquer</strong> la
        confirmation officielle du passage au 2nd tour.
      </p>

      <p>
        <strong>État actuel :</strong>{" "}
        {isAutorise ? (
          <span className="badge badge-success">Passage autorisé</span>
        ) : (
          <span className="badge badge-danger">Passage bloqué</span>
        )}
      </p>

      {!confirmVisible && (
        <div className="actions">
          {isAutorise ? (
            <button
              className="btn btn-warning"
              onClick={handleAskBloquer}
            >
              Bloquer le passage au 2nd tour
            </button>
          ) : (
            <button
              className="btn btn-primary"
              onClick={handleAskAutoriser}
            >
              Autoriser le passage au 2nd tour
            </button>
          )}
        </div>
      )}

      {confirmVisible && (
        <div className="confirmation-box">
          <p>
            {actionType === "autoriser" ? (
              <>
                ⚠️ Vous êtes sur le point <strong>d’autoriser le passage au 2nd tour</strong>.
                <br />
                Cette action permet la validation officielle du passage T2.
              </>
            ) : (
              <>
                ⚠️ Vous êtes sur le point <strong>de bloquer le passage au 2nd tour</strong>.
                <br />
                La confirmation T2 sera impossible tant que ce blocage est actif.
              </>
            )}
          </p>

          <div className="actions">
            <button className="btn btn-secondary" onClick={handleCancel}>
              Annuler
            </button>
            <button className="btn btn-success" onClick={handleConfirm}>
              {actionType === "autoriser"
                ? "Confirmer l’autorisation"
                : "Confirmer le blocage"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
