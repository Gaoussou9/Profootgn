// src/pages/Home.jsx
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

const statusStyle = (s) => {
  switch (s) {
    case "LIVE":
      return "bg-red-100 text-red-700 ring-red-200";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-700 ring-blue-200";
    case "FINISHED":
    case "FT": // <- accepte aussi 'FT' comme terminé
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-200";
  }
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "");

const Logo = ({ src, alt, size = "w-10 h-10" }) => (
  <img
    src={src || "/club-placeholder.png"}
    alt={alt}
    className={`${size} object-contain`}
    onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
  />
);

function MatchCard({ m }) {
  // Fallbacks pour s'adapter aux différentes formes renvoyées par l'API
  const homeName = m.home_club_name || m.home || m.home_name || m.homeTeam || "";
  const awayName = m.away_club_name || m.away || m.away_name || m.awayTeam || "";
  const homeLogo = m.home_club_logo || m.home_logo || m.home_club?.logo || null;
  const awayLogo = m.away_club_logo || m.away_logo || m.away_club?.logo || null;

  const isScheduled = m.status === "SCHEDULED";
  const isLive = m.status === "LIVE";

  const center = isScheduled ? (
    <span className="text-gray-500 font-medium">vs</span>
  ) : (
    <span className="text-xl font-bold">
      {m.home_score} <span className="text-gray-400">-</span> {m.away_score}
    </span>
  );

  return (
    <Link
      to={`/match/${m.id}`}
      className="relative block bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 hover:shadow-md transition"
    >
      {/* badge statut */}
      <div
        className={`absolute -top-2 right-4 text-xs px-2 py-1 rounded-full ring-1 ${statusStyle(
          m.status
        )}`}
      >
        {isLive && (
          <span className="mr-1 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
        )}
        {m.status}
        {isLive && m.minute ? ` • ${m.minute}'` : ""}
      </div>

      <div className="flex items-center justify-between gap-3">
        {/* Home */}
        <div className="flex items-center gap-2 min-w-0">
          <Logo src={homeLogo} alt={homeName} />
          <span className="font-semibold truncate">{homeName}</span>
        </div>

        {/* center score */}
        <div className="min-w-[72px] text-center">{center}</div>

        {/* Away */}
        <div className="flex items-center gap-2 justify-end min-w-0">
          <span className="font-semibold truncate text-right">{awayName}</span>
          <Logo src={awayLogo} alt={awayName} />
        </div>
      </div>

      <div className="text-xs text-gray-500 mt-2">
        {fmtDate(m.datetime)}
        {m.venue ? ` • ${m.venue}` : ""}
      </div>
    </Link>
  );
}

export default function Home() {
  const [upcoming, setUpcoming] = useState([]);
  const [recent, setRecent] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Essaye les endpoints dédiés, sinon fallback sur la liste filtrée/paginée
    const getUpcoming = api
      .get("/matches/upcoming/")
      .then((r) => (Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(() =>
        api
          .get("/matches/?status=SCHEDULED&ordering=datetime&page_size=6")
          .then((r) => (Array.isArray(r.data) ? r.data : r.data.results || []))
      );

    const getRecent = api
      .get("/matches/recent/")
      .then((r) => (Array.isArray(r.data) ? r.data : r.data.results || []))
      .catch(() =>
        api
          // DRF utilise généralement 'FT' pour terminé
          .get("/matches/?status=FT&ordering=-datetime&page_size=6")
          .then((r) => (Array.isArray(r.data) ? r.data : r.data.results || []))
      );

    Promise.all([getUpcoming, getRecent])
      .then(([u, r]) => {
        setUpcoming(u || []);
        setRecent(r || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoad(false));
  }, []);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <section className="space-y-8">
      {/* À venir */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Matches à venir</h2>
        {upcoming.length ? (
          <ul className="grid md:grid-cols-2 gap-4">
            {upcoming.map((m) => (
              <li key={`u-${m.id}`}>
                <MatchCard m={m} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Aucun match programmé.</p>
        )}
      </div>

      {/* Derniers résultats */}
      <div>
        <h2 className="text-2xl font-bold mb-4">Derniers résultats</h2>
        {recent.length ? (
          <ul className="grid md:grid-cols-2 gap-4">
            {recent.map((m) => (
              <li key={`r-${m.id}`}>
                <MatchCard m={m} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-gray-500">Pas de résultats récents.</p>
        )}
      </div>
    </section>
  );
}
