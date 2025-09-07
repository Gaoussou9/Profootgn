// src/pages/MatchEventsEditor.jsx
import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../api/client";

/* -------------------- Utils -------------------- */
const toInt = (v, def = 0) => {
  const n = parseInt(v, 10);
  return Number.isFinite(n) && n >= 0 ? n : def;
};
const toast = (msg) => window.alert(msg);

/* -------------------- Autocomplete joueur -------------------- */
function PlayerPicker({ clubId, label, value, onChange, required = false }) {
  const [q, setQ] = useState("");
  const [opts, setOpts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);

  // Lance la recherche avec un petit debounce
  useEffect(() => {
    if (!q || q.trim().length < 1 || !clubId) {
      setOpts([]);
      return;
    }
    let stop = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await api.get(
          `players/search/?club=${clubId}&q=${encodeURIComponent(q)}&limit=8`
        );
        if (!stop) setOpts(Array.isArray(r.data) ? r.data : r.data.results || []);
      } catch {
        if (!stop) setOpts([]);
      } finally {
        if (!stop) setLoading(false);
      }
    }, 220);
    return () => {
      stop = true;
      clearTimeout(id);
    };
  }, [q, clubId]);

  return (
    <div className="relative">
      <label className="text-xs text-gray-600">{label}</label>
      {value?.id ? (
        <div className="mt-1 flex items-center gap-2">
          <span className="inline-flex px-2 py-1 rounded bg-gray-100 text-gray-700 text-sm">
            {value.name || `#${value.id}`}
          </span>
          <button
            type="button"
            className="text-xs text-blue-600 underline"
            onClick={() => onChange(null)}
          >
            changer
          </button>
        </div>
      ) : (
        <>
          <input
            className="mt-1 w-full border rounded px-3 py-2 text-sm"
            placeholder={required ? "Rechercher un joueur (obligatoire)" : "Rechercher un joueur (ou laisser vide)"}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && (opts.length > 0 || loading) && (
            <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
              {loading && (
                <div className="px-3 py-2 text-sm text-gray-500">Recherche…</div>
              )}
              {opts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-gray-50 text-sm"
                  onClick={() => {
                    onChange({ id: p.id, name: p.name });
                    setQ("");
                    setOpen(false);
                  }}
                >
                  {p.name}
                  {p.club_name ? (
                    <span className="text-xs text-gray-500"> — {p.club_name}</span>
                  ) : null}
                </button>
              ))}
            </div>
          )}
          {/* Possibilité de valider un nom libre si non requis */}
          {!required && q && (
            <div className="mt-1 text-xs text-gray-500">
              Aucun résultat ? Le buteur/passeur sera créé automatiquement si possible.
            </div>
          )}
          {!required && q && (
            <button
              type="button"
              className="mt-1 text-xs text-blue-600 underline"
              onClick={() => {
                onChange({ id: null, name: q.trim() });
                setQ("");
                setOpen(false);
              }}
            >
              Utiliser “{q.trim()}”
            </button>
          )}
        </>
      )}
    </div>
  );
}

/* -------------------- Page -------------------- */
export default function MatchEventsEditor() {
  const { id } = useParams();
  const matchId = toInt(id, null);

  const [m, setMatch] = useState(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  // Formulaire BUT
  const [goalClub, setGoalClub] = useState("home"); // "home" | "away"
  const [goalMinute, setGoalMinute] = useState("");
  const [scorer, setScorer] = useState(null);
  const [assist, setAssist] = useState(null);

  // Formulaire CARTON
  const [cardClub, setCardClub] = useState("home");
  const [cardMinute, setCardMinute] = useState("");
  const [cardPlayer, setCardPlayer] = useState(null);
  const [cardType, setCardType] = useState("Y"); // Y | R

  const homeClubId = m?.home_club;
  const awayClubId = m?.away_club;

  const homeName = m?.home_club_name || "Équipe 1";
  const awayName = m?.away_club_name || "Équipe 2";

  const loadMatch = async () => {
    if (!matchId) return;
    setLoad(true);
    try {
      const r = await api.get(`matches/${matchId}/`);
      setMatch(r.data);
      setError(null);
    } catch (e) {
      setError(e.message || "Erreur de chargement du match");
    } finally {
      setLoad(false);
    }
  };

  useEffect(() => {
    loadMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const clubs = useMemo(
    () => ({
      home: { id: homeClubId, name: homeName },
      away: { id: awayClubId, name: awayName },
    }),
    [homeClubId, awayClubId, homeName, awayName]
  );

  /* ---------- Add Goal (via /goals/bulk/) ---------- */
  const onAddGoal = async (e) => {
    e.preventDefault();
    if (!m) return;

    const club = clubs[goalClub];
    if (!club?.id) return toast("Choisis d’abord un club");
    const minute = toInt(goalMinute, null);
    if (minute === null) return toast("Minute invalide");

    const payloadGoal = {
      club: club.id,
      minute,
      // buteur
      ...(scorer?.id ? { player: scorer.id } : {}),
      ...(scorer?.name && !scorer.id ? { player_name: scorer.name } : {}),
      // passeur
      ...(assist?.id ? { assist_player: assist.id } : {}),
      ...(assist?.name && !assist.id ? { assist_name: assist.name } : {}),
    };

    try {
      await api.post("goals/bulk/", {
        match: matchId,
        replace: false,
        goals: [payloadGoal],
      });
      // reset
      setGoalMinute("");
      setScorer(null);
      setAssist(null);
      await loadMatch();
      toast("But ajouté !");
    } catch (e) {
      toast(e?.response?.data?.detail || "Échec ajout du but");
    }
  };

  /* ---------- Add Card (via /cards/) ---------- */
  const onAddCard = async (e) => {
    e.preventDefault();
    if (!m) return;

    const club = clubs[cardClub];
    if (!club?.id) return toast("Choisis d’abord un club");
    const minute = toInt(cardMinute, null);
    if (minute === null) return toast("Minute invalide");
    if (!cardPlayer?.id) return toast("Sélectionne un joueur pour le carton");

    try {
      await api.post("cards/", {
        match: matchId,
        club: club.id,
        minute,
        player: cardPlayer.id,
        type: cardType, // 'Y' ou 'R'
      });
      setCardMinute("");
      setCardPlayer(null);
      setCardType("Y");
      await loadMatch();
      toast("Carton ajouté !");
    } catch (e) {
      toast(e?.response?.data?.detail || "Échec ajout du carton");
    }
  };

  /* ---------- Suppressions ---------- */
  const deleteGoal = async (goalId) => {
    if (!window.confirm("Supprimer ce but ?")) return;
    try {
      await api.delete(`goals/${goalId}/`);
      await loadMatch();
    } catch {
      toast("Suppression impossible");
    }
  };
  const deleteCard = async (cardId) => {
    if (!window.confirm("Supprimer ce carton ?")) return;
    try {
      await api.delete(`cards/${cardId}/`);
      await loadMatch();
    } catch {
      toast("Suppression impossible");
    }
  };

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;
  if (!m) return <p>Match introuvable</p>;

  return (
    <section className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">
          Événements — {homeName} <span className="text-gray-400">vs</span> {awayName}
        </h1>
        <Link to={`/match/${matchId}`} className="text-sm text-blue-600 underline">
          ↩︎ Retour au match
        </Link>
      </div>

      {/* ---- BUTS ---- */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <h2 className="font-semibold mb-3">Ajouter un but</h2>
          <form className="space-y-3" onSubmit={onAddGoal}>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-600">Équipe</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={goalClub}
                  onChange={(e) => setGoalClub(e.target.value)}
                >
                  <option value="home">{homeName}</option>
                  <option value="away">{awayName}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Minute</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  type="number"
                  min="0"
                  value={goalMinute}
                  onChange={(e) => setGoalMinute(e.target.value)}
                  placeholder="ex. 54"
                  required
                />
              </div>
            </div>

            <PlayerPicker
              clubId={goalClub === "home" ? homeClubId : awayClubId}
              label="Buteur"
              value={scorer}
              onChange={setScorer}
              required={false} // buteur en texte autorisé (création auto via bulk)
            />

            <PlayerPicker
              clubId={goalClub === "home" ? homeClubId : awayClubId}
              label="Passeur (optionnel)"
              value={assist}
              onChange={setAssist}
              required={false}
            />

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700"
              >
                Ajouter le but
              </button>
            </div>
          </form>
        </div>

        {/* ---- CARTONS ---- */}
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <h2 className="font-semibold mb-3">Ajouter un carton</h2>
          <form className="space-y-3" onSubmit={onAddCard}>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-gray-600">Équipe</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={cardClub}
                  onChange={(e) => setCardClub(e.target.value)}
                >
                  <option value="home">{homeName}</option>
                  <option value="away">{awayName}</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-600">Minute</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  type="number"
                  min="0"
                  value={cardMinute}
                  onChange={(e) => setCardMinute(e.target.value)}
                  placeholder="ex. 17"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-gray-600">Type</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2 text-sm"
                  value={cardType}
                  onChange={(e) => setCardType(e.target.value)}
                >
                  <option value="Y">Jaune</option>
                  <option value="R">Rouge</option>
                </select>
              </div>
            </div>

            <PlayerPicker
              clubId={cardClub === "home" ? homeClubId : awayClubId}
              label="Joueur sanctionné"
              value={cardPlayer}
              onChange={setCardPlayer}
              required={true} // nécessaire pour /cards/
            />

            <div className="pt-2">
              <button
                type="submit"
                className="px-4 py-2 rounded bg-indigo-600 text-white hover:bg-indigo-700"
              >
                Ajouter le carton
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* ---- LISTES ---- */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <h3 className="font-semibold mb-3">Buts</h3>
          {m.goals?.length ? (
            <ul className="space-y-2">
              {m.goals.map((g) => (
                <li
                  key={g.id}
                  className="flex items-center justify-between border rounded px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-semibold">{g.minute}'</span>{" "}
                    <span className="text-gray-600">• {g.club_name}</span>{" "}
                    — {g.player_name || "?"}
                    {g.assist_name ? (
                      <span className="text-gray-500"> (passe : {g.assist_name})</span>
                    ) : null}
                  </div>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => deleteGoal(g.id)}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Aucun but.</p>
          )}
        </div>

        <div className="border rounded-xl p-4 bg-white shadow-sm">
          <h3 className="font-semibold mb-3">Cartons</h3>
          {m.cards?.length ? (
            <ul className="space-y-2">
              {m.cards.map((c) => (
                <li
                  key={c.id}
                  className="flex items-center justify-between border rounded px-3 py-2"
                >
                  <div className="text-sm">
                    <span className="font-semibold">{c.minute}'</span>{" "}
                    <span className="text-gray-600">• {c.club_name}</span>{" "}
                    — {c.player_name || "?"}{" "}
                    <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${
                      c.type === "R"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-800"
                    }`}>
                      {c.type === "R" ? "Rouge" : "Jaune"}
                    </span>
                  </div>
                  <button
                    className="text-xs text-red-600 hover:underline"
                    onClick={() => deleteCard(c.id)}
                  >
                    Supprimer
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-gray-500">Aucun carton.</p>
          )}
        </div>
      </div>
    </section>
  );
}
