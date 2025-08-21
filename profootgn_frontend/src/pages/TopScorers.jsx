// src/pages/Scorers.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

// ---------- Utils ----------
const absUrl = (u) => {
  if (!u) return null;
  const s = String(u);
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("//")) return window.location.protocol + s;
  if (s.startsWith("/")) return window.location.origin + s;
  return window.location.origin + (s.startsWith("media/") ? "/" + s : "/" + s);
};

// Essaie de lire un champ "photo" dans divers formats
const pickPhoto = (obj) =>
  obj?.player_photo ||
  obj?.photo_url ||
  obj?.photo ||
  obj?.image ||
  obj?.avatar ||
  obj?.picture ||
  obj?.profile_photo ||
  null;

const pickClubLogo = (obj) =>
  obj?.club_logo || obj?.logo_url || obj?.logo || obj?.crest || obj?.badge || null;

// paginate helper (DRF)
async function fetchAll(path, pageSize = 200) {
  let url = `${path}${path.includes("?") ? "&" : "?"}page_size=${pageSize}`;
  const out = [];
  // Boucle pagination — axios accepte absolu ou relatif
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await api.get(url);
    const data = Array.isArray(r.data) ? r.data : r.data.results || [];
    out.push(...data);
    const next = Array.isArray(r.data) ? null : r.data.next;
    if (!next) break;
    url = next;
  }
  return out;
}

// ---------- Page ----------
export default function Scorers() {
  const [rows, setRows] = useState([]);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let stop = false;

    const load = async () => {
      setLoading(true);
      setErr(null);

      try {
        // 1) Endpoint dédié topscorers
        const r = await api.get("stats/topscorers/?page_size=300");
        const arr = Array.isArray(r.data) ? r.data : r.data.results || [];

        if (arr.length) {
          // Normalisation
          const norm = arr
            .map((x) => {
              const player_id =
                x.player_id ??
                (typeof x.player === "number" ? x.player : null) ??
                null;
              const player_name =
                x.player_name || x.player || x.name || "Inconnu";
              const club_name = x.club_name || x.club || "";
              const club_logo = pickClubLogo(x);
              const photo = pickPhoto(x);
              return {
                player_id,
                player_name,
                club_name,
                club_logo: absUrl(club_logo),
                player_photo: absUrl(photo),
                goals: Number(x.goals || x.count || 0),
              };
            })
            .sort((a, b) => b.goals - a.goals);

          // Si certaines photos manquent, essaye de compléter depuis /players/
          const needResolve = norm.some((n) => !n.player_photo);
          if (needResolve) {
            try {
              const players = await fetchAll("players/", 500);
              const byId = new Map();
              const byName = new Map();
              for (const p of players) {
                const pid = Number(p.id);
                const nm =
                  p.name ||
                  `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
                  null;
                const pPhoto = pickPhoto(p);
                const abs = absUrl(pPhoto);
                if (Number.isFinite(pid)) byId.set(pid, abs);
                if (nm) byName.set(nm.toLowerCase(), abs);
              }
              for (const n of norm) {
                if (!n.player_photo) {
                  if (n.player_id && byId.has(n.player_id)) {
                    n.player_photo = byId.get(n.player_id);
                  } else {
                    const ph = byName.get(n.player_name.toLowerCase());
                    if (ph) n.player_photo = ph;
                  }
                }
              }
            } catch {
              /* pas grave */
            }
          }

          if (!stop) {
            setRows(norm);
            setLoading(false);
          }
          return;
        }

        // 2) Fallback : agrège depuis /goals/ et résout les photos via /players/
        const goals = await fetchAll("goals/", 500);

        // Prépare un index joueurs (si on peut) pour photos
        let playersById = new Map();
        let playersByName = new Map();
        try {
          const players = await fetchAll("players/", 500);
          playersById = new Map();
          playersByName = new Map();
          for (const p of players) {
            const pid = Number(p.id);
            const nm =
              p.name ||
              `${p.first_name || ""} ${p.last_name || ""}`.trim() ||
              null;
            const ph = absUrl(pickPhoto(p));
            if (Number.isFinite(pid)) playersById.set(pid, ph);
            if (nm) playersByName.set(nm.toLowerCase(), ph);
          }
        } catch {
          // joueurs non disponibles -> tant pis
        }

        const map = new Map();
        for (const g of goals) {
          const pid =
            typeof g.player === "number"
              ? Number(g.player)
              : typeof g.player_id === "number"
              ? Number(g.player_id)
              : null;
          const pname =
            g.player_name ||
            (pid ? `Joueur #${pid}` : "Inconnu");
          const cname = g.club_name || "";
          const clubLogo = absUrl(pickClubLogo(g));
          const gPhoto = absUrl(pickPhoto(g)); // si GoalSerializer l’expose

          const key = `${pname}__${cname}`;
          const cur =
            map.get(key) ||
            {
              player_id: pid,
              player_name: pname,
              club_name: cname,
              club_logo: clubLogo,
              player_photo: gPhoto || null,
              goals: 0,
            };
          cur.goals += 1;
          if (!cur.club_logo && clubLogo) cur.club_logo = clubLogo;
          if (!cur.player_photo) {
            // tente via id puis nom
            if (gPhoto) cur.player_photo = gPhoto;
            else if (pid && playersById.has(pid))
              cur.player_photo = playersById.get(pid);
            else if (playersByName.has(pname.toLowerCase()))
              cur.player_photo = playersByName.get(pname.toLowerCase());
          }
          map.set(key, cur);
        }

        const out = [...map.values()].sort((a, b) => b.goals - a.goals);
        if (!stop) {
          setRows(out);
          setLoading(false);
        }
      } catch (e) {
        if (!stop) {
          setErr(e.message || "Erreur de chargement");
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      stop = true;
    };
  }, []);

  const totalGoals = useMemo(
    () => rows.reduce((s, r) => s + (r.goals || 0), 0),
    [rows]
  );

  if (loading) return <p>Chargement…</p>;
  if (err) return <p className="text-red-600">Erreur : {err}</p>;

  return (
    <section>
      <div className="flex items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Classement des buteurs</h1>
        <div className="text-sm text-gray-500">Total buts : {totalGoals}</div>
      </div>

      {rows.length ? (
        <ul className="mt-4 divide-y">
          {rows.map((r, i) => (
            <li
              key={`${r.player_name}-${r.club_name}-${i}`}
              className="py-2 flex items-center gap-3"
            >
              <span className="w-8 text-gray-500 tabular-nums">{i + 1}.</span>

              {/* Photo du buteur (prioritaire), sinon logo club, sinon placeholder */}
              <img
                src={
                  r.player_photo ||
                  r.club_logo ||
                  "/club-placeholder.png"
                }
                alt={r.player_name}
                className="w-9 h-9 rounded-full object-cover border border-gray-200"
                onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
              />

              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{r.player_name}</div>
                <div className="text-xs text-gray-500 truncate">
                  {r.club_name || "-"}
                </div>
              </div>

              {/* Petit logo club à droite si on a aussi la photo joueur */}
              {r.player_photo && r.club_logo && (
                <img
                  src={r.club_logo}
                  alt={r.club_name}
                  className="w-6 h-6 object-contain"
                  onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
                />
              )}

              <div className="text-lg font-bold tabular-nums w-10 text-right">
                {r.goals}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-gray-500 mt-4">Aucun but enregistré.</p>
      )}
    </section>
  );
}
