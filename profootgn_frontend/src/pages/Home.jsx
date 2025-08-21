// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

/* ---------- Helpers UI ---------- */

const Logo = ({ src, alt, size = "w-8 h-8" }) => (
  <img
    src={src || "/club-placeholder.png"}
    alt={alt}
    className={`${size} object-contain shrink-0`}
    onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
  />
);

const statusClasses = (s) => {
  switch ((s || "").toUpperCase()) {
    case "LIVE":
      return "bg-red-100 text-red-700 ring-red-200";
    case "HT":
    case "PAUSED":
      return "bg-amber-100 text-amber-800 ring-amber-200";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-700 ring-blue-200";
    case "SUSPENDED":
      return "bg-violet-100 text-violet-800 ring-violet-200";
    case "POSTPONED":
      return "bg-yellow-100 text-yellow-800 ring-yellow-200";
    case "CANCELED":
      return "bg-gray-200 text-gray-700 ring-gray-300";
    case "FINISHED":
    case "FT":
      return "bg-emerald-100 text-emerald-700 ring-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 ring-gray-200";
  }
};

const statusLabel = (s) => {
  switch ((s || "").toUpperCase()) {
    case "SCHEDULED": return "Prévu";
    case "LIVE":      return "LIVE";
    case "HT":        return "Mi-temps";
    case "PAUSED":    return "Pause";
    case "SUSPENDED": return "Suspendu";
    case "POSTPONED": return "Reporté";
    case "CANCELED":  return "Annulé";
    case "FT":
    case "FINISHED":  return "Terminé";
    default:          return s || "-";
  }
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "");

/* ---------- Hook: minute LIVE persistante (0'… et plus) ---------- */
/**
 * - Persiste un startAt par match dans localStorage pour lisser l’affichage client.
 * - On colle à la minute API au départ et on resynchronise si l’écart > 3'.
 * - Ne borne pas à 90 (pour pouvoir afficher 90’+).
 */
function usePersistentLiveMinute(matchId, status, apiMinute) {
  const isLive = (status || "").toUpperCase() === "LIVE";
  const key = `gn:liveStartAt:${matchId}`;
  const [tick, setTick] = useState(Date.now());

  useEffect(() => {
    if (!isLive) return;
    const id = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isLive]);

  useEffect(() => {
    const upper = (status || "").toUpperCase();

    if (upper !== "LIVE") {
      if (upper === "FT" || upper === "FINISHED") {
        try { localStorage.removeItem(key); } catch {}
      }
      return;
    }
    const apiMinNum =
      Number.isFinite(Number(apiMinute)) ? Math.max(0, Number(apiMinute)) : 0;

    let stored = null;
    try { stored = localStorage.getItem(key); } catch {}

    if (!stored) {
      const startAt = Date.now() - apiMinNum * 60000;
      try { localStorage.setItem(key, String(startAt)); } catch {}
      return;
    }
    const startAt = Number(stored);
    if (Number.isFinite(startAt)) {
      const fromLS = Math.max(0, Math.floor((Date.now() - startAt) / 60000));
      if (Math.abs(fromLS - apiMinNum) > 3) {
        const newStart = Date.now() - apiMinNum * 60000;
        try { localStorage.setItem(key, String(newStart)); } catch {}
      }
    }
  }, [status, apiMinute, key]);

  if (!isLive) return null;

  let startAt = null;
  try { startAt = Number(localStorage.getItem(key)); } catch {}
  let minute = 0;
  if (Number.isFinite(startAt)) {
    minute = Math.max(0, Math.floor((Date.now() - startAt) / 60000));
  } else {
    const apiMinNum =
      Number.isFinite(Number(apiMinute)) ? Math.max(0, Number(apiMinute)) : 0;
    const fallbackStart = Date.now() - apiMinNum * 60000;
    try { localStorage.setItem(key, String(fallbackStart)); } catch {}
    minute = apiMinNum;
  }
  return minute;
}

/** Format minute pour badge :
 * - LIVE + minute >= 90  -> "90’+"
 * - LIVE + minute >= 45  -> "45’+"
 * - LIVE sinon -> "X'"
 * - HT/PAUSED -> "HT"
 * - autres -> null
 */
function formatMinuteForBadge(status, minute) {
  const upper = (status || "").toUpperCase();
  if (upper === "HT" || upper === "PAUSED") return "HT";
  if (upper !== "LIVE") return null;
  const n = Number(minute ?? 0);
  if (n >= 90) return "90’+";
  if (n >= 45) return "45’+";
  return `${n}'`;
}

/* ---------- Carte Match ---------- */
function MatchCard({ m }) {
  const status = (m.status || "").toUpperCase();
  const isScheduled = status === "SCHEDULED" || status === "NOT_STARTED";
  const isLive = status === "LIVE";

  const isSuspended = status === "SUSPENDED";
  const isPostponed = status === "POSTPONED";
  const isCanceled  = status === "CANCELED" || status === "CANCELLED";

  const homeName =
    m.home_club_name || m.home || m.home_name || m.homeTeam || "Équipe 1";
  const awayName =
    m.away_club_name || m.away || m.away_name || m.awayTeam || "Équipe 2";
  const homeLogo = m.home_club_logo || m.home_logo || m.home_club?.logo || null;
  const awayLogo = m.away_club_logo || m.away_logo || m.away_club?.logo || null;

  // minute LIVE persistante côté client
  const liveMinute = usePersistentLiveMinute(m.id, status, m.minute);
  const minuteLabel = formatMinuteForBadge(status, liveMinute);

  return (
    <Link
      to={`/match/${m.id}`}
      className="relative block bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 hover:shadow-md transition"
    >
      {/* Badge statut + minute formatée */}
      <div
        className={`absolute right-3 top-3 text-xs px-2 py-1 rounded-full ring-1 ${statusClasses(
          status
        )}`}
      >
        {isLive && (
          <span className="mr-1 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse align-middle" />
        )}
        {statusLabel(status)}
        {minuteLabel ? ` • ${minuteLabel}` : ""}
      </div>

      {/* Grille compacte: [nom | logo | SCORE | logo | nom] */}
      <div className="grid grid-cols-[1fr,2rem,6rem,2rem,1fr] items-center gap-2 min-h-[68px]">
        {/* Nom home */}
        <div className="min-w-0 text-right pr-1">
          <span className="font-medium truncate">{homeName}</span>
        </div>

        {/* Logo home */}
        <div className="justify-self-end">
          <Logo src={homeLogo} alt={homeName} />
        </div>

        {/* Score centré (logique adaptée par statut) */}
        <div className="w-[6rem] text-center">
          {isScheduled ? (
            <span className="text-gray-500 font-semibold">vs</span>
          ) : isPostponed ? (
            // Reporté : pas de score
            <span className="text-gray-400 font-semibold">—</span>
          ) : (
            // LIVE / FT / SUSPENDED / CANCELED...
            <span
              className={`text-xl font-extrabold leading-none tabular-nums ${
                isSuspended || isCanceled ? "line-through text-gray-400" : ""
              }`}
            >
              {m.home_score}
              <span className="text-gray-400"> - </span>
              {m.away_score}
            </span>
          )}
        </div>

        {/* Logo away */}
        <div className="justify-self-start">
          <Logo src={awayLogo} alt={awayName} />
        </div>

        {/* Nom away */}
        <div className="min-w-0 text-left pl-1">
          <span className="font-medium truncate">{awayName}</span>
        </div>
      </div>

      {/* Date/lieu */}
      <div className="text-xs text-gray-500 mt-2">
        {fmtDate(m.datetime)}
        {m.venue ? ` • ${m.venue}` : ""}
      </div>
    </Link>
  );
}

/* ---------- Page d’accueil ---------- */

export default function Home() {
  const [live, setLive] = useState([]);
  const [upcoming, setUpcoming] = useState([]);    // SCHEDULED (à venir)
  const [recent, setRecent] = useState([]);        // FT récents
  const [suspended, setSuspended] = useState([]);  // SUSPENDED
  const [postponed, setPostponed] = useState([]);  // POSTPONED
  const [canceled, setCanceled] = useState([]);    // CANCELED
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  // Chargement initial
  useEffect(() => {
    let stop = false;
    (async () => {
      setLoad(true);
      try {
        const [rLive, rUpcoming, rRecent, rSusp, rPost, rCanc] = await Promise.all([
          api.get("matches/live/").catch(() => ({ data: [] })),
          api.get("matches/upcoming/").catch(() =>
            api.get("matches/?status=SCHEDULED&ordering=datetime&page_size=12")
          ),
          api.get("matches/recent/").catch(() =>
            api.get("matches/?status=FT&ordering=-datetime&page_size=12")
          ),
          api.get("matches/?status=SUSPENDED&ordering=-datetime&page_size=12").catch(() => ({ data: [] })),
          api.get("matches/?status=POSTPONED&ordering=-datetime&page_size=12").catch(() => ({ data: [] })),
          api.get("matches/?status=CANCELED&ordering=-datetime&page_size=12").catch(() => ({ data: [] })),
        ]);

        const getArr = (res) =>
          Array.isArray(res?.data) ? res.data : res?.data?.results || [];

        if (!stop) {
          setLive(getArr(rLive));
          setUpcoming(getArr(rUpcoming));
          setRecent(getArr(rRecent));
          setSuspended(getArr(rSusp));
          setPostponed(getArr(rPost));
          setCanceled(getArr(rCanc));
          setError(null);
        }
      } catch (e) {
        if (!stop) setError(e.message || "Erreur de chargement");
      } finally {
        if (!stop) setLoad(false);
      }
    })();
    return () => {
      stop = true;
    };
  }, []);

  // Rafraîchit les LIVE toutes les 15s
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const r = await api.get("matches/live/");
        const arr = Array.isArray(r.data) ? r.data : r.data.results || [];
        setLive(arr);
      } catch {}
    }, 15000);
    return () => clearInterval(id);
  }, []);

  // Rafraîchit les autres statuts toutes les 30s (suffisant)
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        const [rUpcoming, rRecent, rSusp, rPost, rCanc] = await Promise.all([
          api.get("matches/upcoming/").catch(() =>
            api.get("matches/?status=SCHEDULED&ordering=datetime&page_size=12")
          ),
          api.get("matches/recent/").catch(() =>
            api.get("matches/?status=FT&ordering=-datetime&page_size=12")
          ),
          api.get("matches/?status=SUSPENDED&ordering=-datetime&page_size=12").catch(() => ({ data: [] })),
          api.get("matches/?status=POSTPONED&ordering=-datetime&page_size=12").catch(() => ({ data: [] })),
          api.get("matches/?status=CANCELED&ordering=-datetime&page_size=12").catch(() => ({ data: [] })),
        ]);
        const getArr = (res) =>
          Array.isArray(res?.data) ? res.data : res?.data?.results || [];
        setUpcoming(getArr(rUpcoming));
        setRecent(getArr(rRecent));
        setSuspended(getArr(rSusp));
        setPostponed(getArr(rPost));
        setCanceled(getArr(rCanc));
      } catch {}
    }, 30000);
    return () => clearInterval(id);
  }, []);

  // Flux unique: LIVE -> HT/PAUSED (inclus dans live) -> SCHEDULED -> POSTPONED -> SUSPENDED -> CANCELED -> RECENT
  const feed = useMemo(() => {
    const map = new Map();
    const push = (list) =>
      (list || []).forEach((m) => {
        if (!map.has(m.id)) map.set(m.id, m);
      });
    push(live);
    push(upcoming);
    push(postponed);
    push(suspended);
    push(canceled);
    push(recent);
    return Array.from(map.values());
  }, [live, upcoming, postponed, suspended, canceled, recent]);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <section className="space-y-4">
      <ul className="grid gap-4">
        {feed.map((m) => (
          <li key={m.id}>
            <MatchCard m={m} />
          </li>
        ))}
      </ul>
    </section>
  );
}