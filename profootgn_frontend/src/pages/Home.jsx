// src/pages/Home.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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

/* ---------- Hook chrono LIVE: jamais de retour à 45' en 2e MT ---------- */
/**
 * Clés localStorage:
 *  - gn:live:<id>:anchor   = timestamp ms du point zéro (now - minute*60k)
 *  - gn:live:<id>:best     = meilleure minute vue (anti-retour)
 *  - gn:live:<id>:lastApi  = dernière minute API vue (anti-régression réseau)
 *  - gn:live:<id>:half2    = "1" si 2e mi-temps
 *  - gn:live:<id>:startSnapApplied = "1" si snap de démarrage (0–2’) appliqué
 *
 * Règles:
 *  - 1re MT: 0'→45' puis 45’+ si l’API traîne
 *  - 2e MT: 45',46',…→90’ puis 90’+ ; **jamais** de retour à 45’ après refresh
 *  - On ne recale vers l’avant que si >3’ de retard. Jamais vers l’arrière (sauf snap de départ 0–2’).
 */
function useLiveClock(matchId, status, apiMinute) {
  const upper   = (status || "").toUpperCase();
  const isLive  = upper === "LIVE";
  const isBreak = upper === "HT" || upper === "PAUSED";

  const base     = `gn:live:${matchId}`;
  const kAnchor  = `${base}:anchor`;
  const kBest    = `${base}:best`;
  const kLastApi = `${base}:lastApi`;
  const kHalf2   = `${base}:half2`;
  const kStart   = `${base}:startSnapApplied`;

  const [minute, setMinute] = useState(null);
  const [isSecondHalf, setIsSecondHalf] = useState(false);
  const timerRef = useRef(null);

  const readNum = (k, d=null)=>{ try{const n=Number(localStorage.getItem(k));return Number.isFinite(n)?n:d;}catch{return d;}};
  const readStr = (k)=>{ try{return localStorage.getItem(k);}catch{return null;} };
  const write   = (k,v)=>{ try{localStorage.setItem(k,String(v));}catch{} };
  const del     = (k)=>{ try{localStorage.removeItem(k);}catch{} };

  useEffect(() => {
    // FT -> purge
    if (upper === "FT" || upper === "FINISHED") {
      [kAnchor,kBest,kLastApi,kHalf2,kStart].forEach(del);
      setMinute(null);
      setIsSecondHalf(false);
      return;
    }

    // Pause: on note la 2e MT et on borne best >= 45 (mais pas d’ancrage arrière)
    if (isBreak) {
      write(kHalf2,"1");
      const best = readNum(kBest,0);
      if ((best ?? 0) < 45) write(kBest,45);
      setIsSecondHalf(true);
      return;
    }

    if (!isLive) { setMinute(null); return; }

    const now = Date.now();

    // Minute API normalisée + anti-régression API (>2')
    let apiMin = parseInt(apiMinute,10);
    if (!Number.isFinite(apiMin) || apiMin < 0) apiMin = 0;
    const lastApi = readNum(kLastApi,-1);
    if (Number.isFinite(lastApi) && apiMin < lastApi - 2) apiMin = lastApi;
    if (apiMin > (lastApi ?? -1)) write(kLastApi, apiMin);

    // Détecter 2e MT si on arrive en cours
    if (!readStr(kHalf2) && apiMin >= 46) write(kHalf2,"1");
    const h2 = readStr(kHalf2) === "1";
    setIsSecondHalf(h2);

    let anchor = readNum(kAnchor,null);
    let best   = readNum(kBest,null);

    // Si best manquant mais ancre présente, reconstruire best depuis l’affichage courant
    if (!Number.isFinite(best) && Number.isFinite(anchor)) {
      const displayed = Math.max(0, Math.floor((now - anchor)/60000));
      best = displayed; write(kBest,best);
    }
    if (!Number.isFinite(best)) best = 0;

    const placeAnchor = (m) => { const a = now - Math.max(0,m)*60000; write(kAnchor,a); return a; };

    if (!Number.isFinite(anchor)) {
      // première ancre: sur le meilleur connu (jamais en arrière)
      anchor = placeAnchor(Math.max(apiMin, best));
    } else {
      const displayed = Math.max(0, Math.floor((now - anchor)/60000));

      // Snap de début une seule fois (0–2’) si l’affichage local est trop en avance
      if (readStr(kStart)!=="1" && apiMin<=2 && best<=2 && displayed>apiMin+2) {
        anchor = placeAnchor(apiMin);
        write(kStart,"1");
      }

      // ⚠️ AUCUN snap spécial 2e MT: on n’autorise plus de retour à 45’

      // Rattrapage vers l’AVANT uniquement (jamais en arrière)
      const candidate = Math.max(apiMin, best, displayed);
      if (candidate - displayed > 3) {
        anchor = placeAnchor(candidate);
      }
    }

    // Ticker 1s
    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const a = readNum(kAnchor,anchor);
      let m = Math.max(0, Math.floor((Date.now() - a)/60000));
      const hh2 = readStr(kHalf2) === "1";
      if (hh2 && m < 45) m = 45;  // 2e MT ne descend jamais sous 45'
      setMinute(m);
      setIsSecondHalf(hh2);
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upper, isLive, isBreak, apiMinute, matchId]);

  return { minute, isSecondHalf };
}

/** Badge minute
 * - HT / PAUSED -> "HT"
 * - LIVE:
 *     · 1re MT: 0'…44' puis "45’+"
 *     · 2e MT: 45'…89' puis "90’+"
 * - autres -> null
 */
function formatMinuteForBadge(status, minute, isSecondHalf) {
  const upper = (status || "").toUpperCase();
  if (upper === "HT" || upper === "PAUSED") return "HT";
  if (upper !== "LIVE") return null;

  const n = Math.max(0, Number(minute ?? 0));
  if (isSecondHalf) return n >= 90 ? "90’+" : `${n}'`;
  return n >= 45 ? "45’+" : `${n}'`;
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
  const { minute, isSecondHalf } = useLiveClock(m.id, status, m.minute);
  const minuteLabel = formatMinuteForBadge(status, minute, isSecondHalf);

  return (
    <Link
      to={`/match/${m.id}`}
      className="relative block bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4 hover:shadow-md transition"
    >
      {/* Badge statut + minute */}
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

      {/* Badge Journée si dispo */}
      {m.round_name ? (
        <div className="absolute left-3 top-3 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 ring-1 ring-gray-200">
          {m.round_name}
        </div>
      ) : null}

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

        {/* Score centré (logique par statut) */}
        <div className="w-[6rem] text-center">
          {isScheduled ? (
            <span className="text-gray-500 font-semibold">vs</span>
          ) : isPostponed ? (
            <span className="text-gray-400 font-semibold">—</span>
          ) : (
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
    return () => { stop = true; };
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

  // Rafraîchit les autres statuts toutes les 30s
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

  // Flux unique: LIVE -> SCHEDULED -> POSTPONED -> SUSPENDED -> CANCELED -> RECENT
  const feed = useMemo(() => {
    const map = new Map();
    const push = (list) => (list || []).forEach((m) => { if (!map.has(m.id)) map.set(m.id, m); });
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
