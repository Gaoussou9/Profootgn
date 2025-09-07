// src/pages/Standings.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/client";

export default function Standings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);
  const [liveSet, setLiveSet] = useState(new Set());
  const [logoMap, setLogoMap] = useState(new Map());

  const prevRef = useRef(new Map());

  // Charge les logos une fois
  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("clubs/?page_size=500");
        const arr = Array.isArray(r.data) ? r.data : r.data.results || [];
        // Chaque item peut s’appeler logo_url, logo, image, etc.
        const m = new Map(
          arr.map((c) => [
            c.id,
            c.logo_url || c.logo || c.image || null,
          ])
        );
        setLogoMap(m);
      } catch {
        setLogoMap(new Map());
      }
    })();
  }, []);

  const fetchData = async () => {
  try {
    const [stRes, liveRes] = await Promise.all([
      // tu peux mettre ?debug=1 si tu veux voir les compteurs
      api.get("stats/standings/?include_live=1"),
      api.get("matches/live/"),
    ]);

    // ✅ parser robuste: accepte array, {table: [...]}, {results: [...]}
    const parseStandings = (data) => {
      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.table)) return data.table;
      if (data && Array.isArray(data.results)) return data.results;
      return [];
    };

    const st = parseStandings(stRes.data);

    const liveMatches = Array.isArray(liveRes.data)
      ? liveRes.data
      : liveRes.data?.results || [];

    const liveIds = new Set(
      liveMatches.flatMap((m) => [m.home_club, m.away_club]).filter(Boolean)
    );

    // détecte les changements pour surligner
    const prev = prevRef.current;
    const enriched = st.map((r) => {
      const p = prev.get(r.club_id);
      const changed = p
        ? p.points !== r.points ||
          p.goal_diff !== r.goal_diff ||
          p.goals_for !== r.goals_for ||
          p.played !== r.played
        : false;
      return { ...r, _changed: changed };
    });
    prevRef.current = new Map(enriched.map((r) => [r.club_id, r]));

    setRows(enriched);
    setLiveSet(liveIds);
    setError(null);
  } catch (e) {
    setError(e.message || "Erreur de chargement");
  } finally {
    setLoad(false);
  }
};


  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 15000);
    return () => clearInterval(id);
  }, []);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <section className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Classement</h1>

      <div className="overflow-x-auto rounded-2xl ring-1 ring-gray-200 shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Club</th>
              <th className="px-3 py-2 text-center">MJ</th>
              <th className="px-3 py-2 text-center">V</th>
              <th className="px-3 py-2 text-center">N</th>
              <th className="px-3 py-2 text-center">D</th>
              <th className="px-3 py-2 text-center">BM</th>
              <th className="px-3 py-2 text-center">BC</th>
              <th className="px-3 py-2 text-center">Diff</th>
              <th className="px-3 py-2 text-center">Pts</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i) => {
              const live = liveSet.has(r.club_id);
              const logoSrc = r.club_logo || logoMap.get(r.club_id) || "/club-placeholder.png";
              return (
                <tr
                  key={r.club_id}
                  className={`border-t ${r._changed ? "bg-amber-50 transition-colors" : ""}`}
                >
                  <td className="px-3 py-2">{i + 1}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <img
                        src={logoSrc}
                        alt={r.club_name}
                        className="w-5 h-5 object-contain"
                        onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
                      />
                      <span className="truncate">{r.club_name}</span>
                      {live && (
                        <span className="ml-1 inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                          <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 text-center">{r.played}</td>
                  <td className="px-3 py-2 text-center">{r.wins}</td>
                  <td className="px-3 py-2 text-center">{r.draws}</td>
                  <td className="px-3 py-2 text-center">{r.losses}</td>
                  <td className="px-3 py-2 text-center">{r.goals_for}</td>
                  <td className="px-3 py-2 text-center">{r.goals_against}</td>
                  <td className="px-3 py-2 text-center">{r.goal_diff}</td>
                  <td className="px-3 py-2 text-center font-bold">{r.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        * Classement provisoire mis à jour automatiquement pendant les matchs (inclut LIVE/HT/PAUSED).
      </p>
    </section>
  );
}
