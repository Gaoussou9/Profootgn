// src/pages/MatchDetail.jsx
import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../api/client";

const Logo = ({ src, alt, size = "w-12 h-12" }) => (
  <img
    src={src || "/club-placeholder.png"}
    alt={alt}
    className={`${size} object-contain`}
    onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
  />
);

const statusClasses = (s) => {
  switch ((s || "").toUpperCase()) {
    case "LIVE":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";
    case "FINISHED":
    case "FT":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "");

const Row = ({ left, center, right }) => (
  <div className="grid grid-cols-3 items-center gap-3 py-2">
    <div className="flex items-center gap-2 min-w-0">{left}</div>
    <div className="text-center text-sm text-gray-600">{center}</div>
    <div className="flex items-center gap-2 justify-end min-w-0">{right}</div>
  </div>
);

// libellé joueur robuste : player_name > "Joueur #id" > prénom/nom > "Inconnu"
const playerLabel = (ev = {}) => {
  if (ev.player_name) return ev.player_name;
  if (typeof ev.player === "number") return `Joueur #${ev.player}`;
  const first = ev?.player?.first_name || ev.player_first_name || "";
  const last  = ev?.player?.last_name  || ev.player_last_name  || "";
  const full = `${first} ${last}`.trim();
  return full || "Inconnu";
};

const cardEmoji = (ev) => {
  const v = (ev?.type || ev?.color || ev?.card || ev?.card_type || "")
    .toString()
    .toUpperCase();
  if (v.includes("RED")) return "🟥";
  if (v.includes("YELLOW")) return "🟨";
  return "🟨";
};

export default function MatchDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoad(true);
    // ⛔️ enlever le slash initial pour respecter baseURL /api
    api
      .get(`matches/${id}/`)
      .then((res) => setM(res.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoad(false));
  }, [id]);

  const isLive = (m?.status || "").toUpperCase() === "LIVE";
  const isScheduled = (m?.status || "").toUpperCase() === "SCHEDULED";

  const homeGoals = useMemo(() => {
    const homeId = m ? Number(m.home_club) : null;
    return (m?.goals || [])
      .filter((g) => Number(g.club) === homeId)
      .sort((a, b) => (a.minute || 0) - (b.minute || 0));
  }, [m]);

  const awayGoals = useMemo(() => {
    const awayId = m ? Number(m.away_club) : null;
    return (m?.goals || [])
      .filter((g) => Number(g.club) === awayId)
      .sort((a, b) => (a.minute || 0) - (b.minute || 0));
  }, [m]);

  const timeline = useMemo(() => {
    if (!m) return [];
    const homeId = Number(m.home_club);
    const goals = (m.goals || []).map((g) => ({
      kind: "goal",
      minute: g.minute ?? g.time ?? g.min ?? null,
      club: Number(g.club),
      raw: g,
      onHomeSide: Number(g.club) === homeId,
    }));
    const cards = (m.cards || []).map((c) => ({
      kind: "card",
      minute: c.minute ?? c.time ?? c.min ?? null,
      club: Number(c.club),
      raw: c,
      onHomeSide: Number(c.club) === homeId,
    }));
    return [...goals, ...cards].sort((a, b) => (a.minute ?? 0) - (b.minute ?? 0));
  }, [m]);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;
  if (!m) return <p>Match introuvable.</p>;

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      <div className="relative bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <div className={`absolute right-3 top-3 text-xs px-2 py-1 rounded-full ${statusClasses(m.status)}`}>
          {isLive && <span className="mr-1 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />}
          {m.status}
          {isLive && m.minute ? ` • ${m.minute}'` : ""}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo src={m.home_club_logo} alt={m.home_club_name} />
            <span className="font-semibold truncate">{m.home_club_name}</span>
          </div>

          <div className="text-center">
            <div className="text-3xl font-extrabold leading-none">
              {isScheduled ? "vs" : (
                <>
                  {m.home_score}
                  <span className="text-gray-400"> - </span>
                  {m.away_score}
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {fmtDate(m.datetime)}{m.venue ? ` • ${m.venue}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end min-w-0">
            <span className="font-semibold truncate text-right">{m.away_club_name}</span>
            <Logo src={m.away_club_logo} alt={m.away_club_name} />
          </div>
        </div>
      </div>

      {/* Buteurs */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <h2 className="text-lg font-semibold mb-3">Buteurs</h2>
        {(!homeGoals.length && !awayGoals.length) ? (
          <p className="text-gray-500">Aucun buteur.</p>
        ) : (
          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="text-sm text-gray-500 mb-2">{m.home_club_name}</div>
              <ul className="space-y-1">
                {homeGoals.map((g) => (
                  <li key={`hg-${g.id}`} className="text-sm flex items-center gap-2">
                    <span className="font-mono">{g.minute}'</span>
                    <span className="font-medium truncate">{playerLabel(g)}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <div className="text-sm text-gray-500 mb-2 text-right">{m.away_club_name}</div>
              <ul className="space-y-1">
                {awayGoals.map((g) => (
                  <li key={`ag-${g.id}`} className="text-sm flex items-center gap-2 justify-end">
                    <span className="font-medium truncate">{playerLabel(g)}</span>
                    <span className="font-mono">{g.minute}'</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Timeline (buts + cartons) */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <h2 className="text-lg font-semibold mb-3">Événements</h2>
        {!timeline.length && <p className="text-gray-500">Aucun événement pour le moment.</p>}
        <div className="divide-y">
          {timeline.map((ev, idx) => {
            const min = ev.minute ?? "?";
            if (ev.kind === "goal") {
              const g = ev.raw;
              const pName = playerLabel(g);
              return (
                <Row
                  key={`g-${idx}-${min}`}
                  left={ev.onHomeSide ? (
                    <>
                      <span className="text-sm text-gray-500">{min}'</span>
                      <span>⚽</span>
                      <span className="font-medium truncate">{pName}</span>
                    </>
                  ) : null}
                  center={<span>But</span>}
                  right={!ev.onHomeSide ? (
                    <>
                      <span className="font-medium truncate">{pName}</span>
                      <span>⚽</span>
                      <span className="text-sm text-gray-500">{min}'</span>
                    </>
                  ) : null}
                />
              );
            }
            const c = ev.raw;
            const emoji = cardEmoji(c);
            const pName = playerLabel(c);
            return (
              <Row
                key={`c-${idx}-${min}`}
                left={ev.onHomeSide ? (
                  <>
                    <span className="text-sm text-gray-500">{min}'</span>
                    <span>{emoji}</span>
                    <span className="font-medium truncate">{pName}</span>
                  </>
                ) : null}
                center={<span>Carton</span>}
                right={!ev.onHomeSide ? (
                  <>
                    <span className="font-medium truncate">{pName}</span>
                    <span>{emoji}</span>
                    <span className="text-sm text-gray-500">{min}'</span>
                  </>
                ) : null}
              />
            );
          })}
        </div>
      </div>

      <div>
        <Link to="/" className="text-blue-600 hover:underline">
          &larr; Retour à l’accueil
        </Link>
      </div>
    </section>
  );
}
