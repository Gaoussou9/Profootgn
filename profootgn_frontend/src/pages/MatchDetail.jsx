// src/pages/MatchDetail.jsx
import { useEffect, useMemo, useRef, useState } from "react";
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

const TinyAvatar = ({ src, alt }) => (
  <img
    src={src || "/player-placeholder.png"}
    alt={alt || "Joueur"}
    className="w-5 h-5 rounded-full object-cover ring-1 ring-gray-200"
    onError={(e) => (e.currentTarget.src = "/player-placeholder.png")}
  />
);

const playerPhoto = (ev = {}) => {
  const p = ev.player || {};
  return p.photo || ev.player_photo || ev.photo || ev.playerPhoto || null;
};

const statusClasses = (s) => {
  switch ((s || "").toUpperCase()) {
    case "LIVE":
      return "bg-red-100 text-red-700 ring-1 ring-red-200";
    case "HT":
    case "PAUSED":
      return "bg-amber-100 text-amber-700 ring-1 ring-amber-200";
    case "SCHEDULED":
      return "bg-blue-100 text-blue-700 ring-1 ring-blue-200";
    case "SUSPENDED":
      return "bg-zinc-100 text-zinc-700 ring-1 ring-zinc-200";
    case "POSTPONED":
      return "bg-sky-100 text-sky-700 ring-1 ring-sky-200";
    case "CANCELED":
      return "bg-rose-100 text-rose-700 ring-1 ring-rose-200";
    case "FINISHED":
    case "FT":
      return "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200";
    default:
      return "bg-gray-100 text-gray-700 ring-1 ring-gray-200";
  }
};

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "");

/* ------------------ mêmes helpers que Home ------------------ */
// Mémoire locale stable de la minute LIVE (anti-retour)
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
    if (upper === "FT" || upper === "FINISHED") {
      [kAnchor,kBest,kLastApi,kHalf2,kStart].forEach(del);
      setMinute(null);
      setIsSecondHalf(false);
      return;
    }

    if (isBreak) {
      write(kHalf2,"1");
      const best = readNum(kBest,0);
      if (best < 45) write(kBest,45);
      setIsSecondHalf(true);
      return;
    }

    if (!isLive) { setMinute(null); return; }

    const now = Date.now();

    // minute API + anti-régression réseau
    let apiMin = parseInt(apiMinute,10);
    if (!Number.isFinite(apiMin) || apiMin < 0) apiMin = 0;
    const lastApi = readNum(kLastApi,-1);
    if (Number.isFinite(lastApi) && apiMin < lastApi - 2) apiMin = lastApi;
    if (apiMin > (lastApi ?? -1)) write(kLastApi, apiMin);

    // bascule 2e MT si on arrive après 46'
    if (!readStr(kHalf2) && apiMin >= 46) write(kHalf2,"1");
    const h2 = readStr(kHalf2) === "1";
    setIsSecondHalf(h2);

    let anchor = readNum(kAnchor,null);
    let best   = readNum(kBest,null);
    if (!Number.isFinite(best) && Number.isFinite(anchor)) {
      const displayed = Math.max(0, Math.floor((now - anchor)/60000));
      best = displayed; write(kBest,best);
    }
    if (!Number.isFinite(best)) best = 0;

    const placeAnchor = (m) => { const a = now - Math.max(0,m)*60000; write(kAnchor,a); return a; };

    if (!Number.isFinite(anchor)) {
      anchor = placeAnchor(Math.max(apiMin, best));
    } else {
      const displayed = Math.max(0, Math.floor((now - anchor)/60000));
      // Snap de départ une fois si trop en avance (0–2’)
      if (readStr(kStart)!=="1" && apiMin<=2 && best<=2 && displayed>apiMin+2) {
        anchor = placeAnchor(apiMin);
        write(kStart,"1");
      }
      // rattrapage vers l’AVANT uniquement (>3’ de retard)
      const candidate = Math.max(apiMin, best, displayed);
      if (candidate - displayed > 3) anchor = placeAnchor(candidate);
    }

    if (timerRef.current) clearInterval(timerRef.current);
    const tick = () => {
      const a = readNum(kAnchor,anchor);
      let m = Math.max(0, Math.floor((Date.now() - a)/60000));
      const hh2 = readStr(kHalf2) === "1";
      if (hh2 && m < 45) m = 45;
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

// Affichage badge minute identique à Home
function formatMinuteForBadge(status, minute, isSecondHalf) {
  const upper = (status || "").toUpperCase();
  if (upper === "HT" || upper === "PAUSED") return "HT";
  if (upper !== "LIVE") return null;
  const n = Math.max(0, Number(minute ?? 0));
  if (isSecondHalf) return n >= 90 ? "90’+" : `${n}'`;
  return n >= 45 ? "45’+" : `${n}'`;
}
/* ----------------------------------------------------------- */

const Row = ({ left, center, right }) => (
  <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
    <div className="flex items-center gap-2 min-w-0">{left}</div>
    <div className="text-center text-sm text-gray-600">{center}</div>
    <div className="flex items-center gap-2 justify-end min-w-0">{right}</div>
  </div>
);

// Nom joueur robuste
const playerLabel = (ev = {}) => {
  if (ev.player_name) return ev.player_name;
  if (typeof ev.player === "number") return `Joueur #${ev.player}`;
  const first = ev?.player?.first_name || ev.player_first_name || "";
  const last = ev?.player?.last_name || ev.player_last_name || "";
  const full = `${first} ${last}`.trim();
  return full || "Inconnu";
};

// Passeur (si présent)
const assistLabel = (ev = {}) => {
  const txt =
    ev.assist_name ||
    ev.assist ||
    ev.assist_player_name ||
    (ev.assist && ev.assist.first_name
      ? `${ev.assist.first_name} ${ev.assist.last_name || ""}`.trim()
      : null);
  return (txt || "").trim() || null;
};

// Tag "(pen.)" ou "(csc)" après le buteur
const _truthy = (v) =>
  v === true ||
  v === 1 ||
  v === "1" ||
  (typeof v === "string" && ["true", "yes", "y"].includes(v.toLowerCase()));

const goalTag = (g = {}) => {
  const t = (g.type || g.kind || "").toString().toUpperCase();
  const isPen =
    _truthy(g.penalty) ||
    _truthy(g.is_penalty) ||
    _truthy(g.on_penalty) ||
    ["PEN", "P", "PK", "PENALTY"].includes(t);
  const isOG =
    _truthy(g.own_goal) ||
    _truthy(g.is_own_goal) ||
    _truthy(g.og) ||
    ["OG", "CSC", "OWN_GOAL", "OWNGOAL"].includes(t);
  return isPen ? " (pen.)" : isOG ? " (csc)" : "";
};

// Cartons
const cardEmoji = (ev) => {
  const v = (
    ev?.color ?? ev?.type ?? ev?.card ?? ev?.card_type ?? ""
  ).toString().toUpperCase();
  if (v === "R" || v.includes("RED") || v.includes("ROUGE")) return "🟥";
  if (v === "Y" || v.includes("YELLOW") || v.includes("JAUNE")) return "🟨";
  return "🟨";
};
const cardLabel = (ev) => {
  const v = (
    ev?.color ?? ev?.type ?? ev?.card ?? ev?.card_type ?? ""
  ).toString().toUpperCase();
  if (v === "R" || v.includes("RED") || v.includes("ROUGE")) return "Carton rouge";
  if (v === "Y" || v.includes("YELLOW") || v.includes("JAUNE")) return "Carton jaune";
  return "Carton";
};

export default function MatchDetail() {
  const { id } = useParams();
  const [m, setM] = useState(null);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoad(true);
    api
      .get(`matches/${id}/`)
      .then((res) => setM(res.data))
      .catch((e) => setError(e.message || "Erreur"))
      .finally(() => setLoad(false));
  }, [id]);

  const status = (m?.status || "").toUpperCase();
  const isLiveLike = status === "LIVE" || status === "HT" || status === "PAUSED";
  const isScheduled = status === "SCHEDULED";
  const isLive = status === "LIVE";

  // minute LIVE identique à Home
  const { minute, isSecondHalf } = useLiveClock(m?.id, status, m?.minute);
  const minuteLabel = formatMinuteForBadge(status, minute, isSecondHalf);

  // rafraîchissement périodique quand LIVE/HT/PAUSED
  useEffect(() => {
    if (!isLiveLike) return;
    const t = setInterval(() => {
      api.get(`matches/${id}/`).then((res) => setM(res.data)).catch(() => {});
    }, 7000);
    return () => clearInterval(t);
  }, [id, isLiveLike]);

  const timeline = useMemo(() => {
    if (!m) return [];
    const homeId = Number(m.home_club);

    const goals = (m.goals || []).map((g) => ({
      kind: "goal",
      minute: g.minute ?? g.time ?? g.min ?? null,
      club: Number(g.club ?? g.club_id),
      raw: g,
      onHomeSide: Number(g.club ?? g.club_id) === homeId,
    }));

    const cards = (m.cards || []).map((c) => ({
      kind: "card",
      minute: c.minute ?? c.time ?? c.min ?? null,
      club: Number(c.club ?? c.club_id),
      raw: c,
      onHomeSide: Number(c.club ?? c.club_id) === homeId,
    }));

    return [...goals, ...cards].sort(
      (a, b) => (a.minute ?? 0) - (b.minute ?? 0)
    );
  }, [m]);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;
  if (!m) return <p>Match introuvable.</p>;

  return (
    <section className="max-w-3xl mx-auto space-y-6">
      {/* En-tête */}
      <div className="relative bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <div
          className={`absolute right-3 top-3 text-xs px-2 py-1 rounded-full ${statusClasses(
            status
          )}`}
        >
          {isLive && (
            <span className="mr-1 inline-block w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          )}
          {status}
          {minuteLabel ? ` • ${minuteLabel}` : ""}
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo src={m.home_club_logo} alt={m.home_club_name} />
            <span className="font-semibold whitespace-normal break-words">
              {m.home_club_name}
            </span>
          </div>

          <div className="text-center">
            <div className="text-3xl font-extrabold leading-none">
              {isScheduled ? (
                "vs"
              ) : (
                <>
                  {m.home_score}
                  <span className="text-gray-400"> - </span>
                  {m.away_score}
                </>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {fmtDate(m.datetime)}
              {m.venue ? ` • ${m.venue}` : ""}
            </div>
          </div>

          <div className="flex items-center gap-3 justify-end min-w-0">
            <span className="font-semibold whitespace-normal break-words text-right">
              {m.away_club_name}
            </span>
            <Logo src={m.away_club_logo} alt={m.away_club_name} />
          </div>
        </div>
      </div>

      {/* Événements (buts + cartons) */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <h2 className="text-lg font-semibold mb-3">Événements</h2>
        {!timeline.length && (
          <p className="text-gray-500">Aucun événement pour le moment.</p>
        )}
        <div className="divide-y">
          {timeline.map((ev, idx) => {
            const min = ev.minute ?? "?";

            if (ev.kind === "goal") {
              const g = ev.raw;
              const pName = playerLabel(g);
              const a = assistLabel(g);
              const pPhoto = playerPhoto(g);

              return (
                <Row
                  key={`g-${idx}-${min}`}
                  left={
                    ev.onHomeSide ? (
                      <>
                        <span className="text-sm text-gray-500">{min}'</span>
                        <span>⚽</span>
                        <TinyAvatar src={pPhoto} alt={pName} />
                        <div className="flex flex-col min-w-0">
                          <span
                            className="font-medium whitespace-normal break-words"
                            title={pName}
                          >
                            {pName}
                            {goalTag(g)}
                          </span>
                          {a ? (
                            <span
                              className="text-xs text-gray-500 whitespace-normal break-words mt-0.5"
                              title={a}
                            >
                              🅰️ {a}
                            </span>
                          ) : null}
                        </div>
                      </>
                    ) : null
                  }
                  center={<span>But</span>}
                  right={
                    !ev.onHomeSide ? (
                      <>
                        <div className="flex flex-col items-end min-w-0">
                          <span
                            className="font-medium whitespace-normal break-words text-right"
                            title={pName}
                          >
                            {pName}
                            {goalTag(g)}
                          </span>
                          {a ? (
                            <span
                              className="text-xs text-gray-500 whitespace-normal break-words mt-0.5 text-right"
                              title={a}
                            >
                              🅰️ {a}
                            </span>
                          ) : null}
                        </div>
                        <TinyAvatar src={pPhoto} alt={pName} />
                        <span>⚽</span>
                        <span className="text-sm text-gray-500">{min}'</span>
                      </>
                    ) : null
                  }
                />
              );
            }

            const c = ev.raw;
            const emoji = cardEmoji(c);
            const pName = playerLabel(c);

            return (
              <Row
                key={`c-${idx}-${min}`}
                left={
                  ev.onHomeSide ? (
                    <>
                      <span className="text-sm text-gray-500">{min}'</span>
                      <span>{emoji}</span>
                      <span
                        className="font-medium whitespace-normal break-words"
                        title={pName}
                      >
                        {pName}
                      </span>
                    </>
                  ) : null
                }
                center={<span>{cardLabel(c)}</span>}
                right={
                  !ev.onHomeSide ? (
                    <>
                      <span
                        className="font-medium whitespace-normal break-words text-right"
                        title={pName}
                      >
                        {pName}
                      </span>
                      <span>{emoji}</span>
                      <span className="text-sm text-gray-500">{min}'</span>
                    </>
                  ) : null
                }
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
