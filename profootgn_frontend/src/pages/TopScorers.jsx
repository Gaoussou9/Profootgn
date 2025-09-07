// src/pages/TopScorers.jsx
import { useEffect, useMemo, useState } from "react";
import api from "../api/client";

const Avatar = ({ src, alt }) => (
  <img
    src={src || "/player-placeholder.png"}
    alt={alt || "Joueur"}
    className="w-8 h-8 rounded-full object-cover ring-1 ring-gray-200"
    onError={(e) => (e.currentTarget.src = "/player-placeholder.png")}
  />
);

export default function TopScorers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  const parseResponse = (data) => {
    const arr =
      Array.isArray(data)
        ? data
        : Array.isArray(data?.results)
          ? data.results
          : Array.isArray(data?.rows)
            ? data.rows
            : [];

    // Normalisation très tolérante
    const norm = arr.map((it, idx) => {
      const p = it.player || {}; // joueur imbriqué éventuel
      const id =
        p.id ?? it.player_id ?? it.id ?? `row-${idx}`;

      const first =
        p.first_name ??
        it.player_first_name ??
        it.first_name ??
        "";

      const last =
        p.last_name ??
        it.player_last_name ??
        it.last_name ??
        "";

      const number =
        p.number ??
        it.number ??
        null;

      const nameFromFlat = it.player_name || it.name || "";
      const name =
        (first || last)
          ? `${first} ${last}`.trim()
          : (nameFromFlat || (number ? `#${number}` : "Inconnu"));

      const club =
        it.club_name ??
        it.club ??
        it.club_title ??
        (p.club_name || "") ??
        "";

      const photo =
        p.photo ??
        it.player_photo ??
        it.photo ??
        null;

      const goals =
        it.goals ??
        it.count ??
        it.total ??
        it.nb ??
        0;

      return {
        id,
        name,
        club,
        goals: Number(goals) || 0,
        photo,
      };
    });

    // Si pas trié, on trie
    norm.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
    return norm;
  };

  const fetchData = async () => {
    try {
      setLoad(true);
      const r = await api.get("stats/topscorers/?include_live=1&limit=100");
      setRows(parseResponse(r.data));
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

  const totalGoals = useMemo(
    () => rows.reduce((s, r) => s + (r.goals || 0), 0),
    [rows]
  );

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <section className="max-w-3xl mx-auto">
      <div className="flex items-end justify-between mb-3">
        <h1 className="text-2xl font-bold">Classement des buteurs</h1>
        <div className="text-xs text-gray-500">Total buts : {totalGoals}</div>
      </div>

      <ol className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm divide-y">
        {rows.map((r, i) => (
          <li key={r.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="w-6 text-right text-gray-500">{i + 1}.</span>
              <Avatar src={r.photo} alt={r.name} />
              <div className="min-w-0">
                <div className="font-medium truncate">{r.name}</div>
                <div className="text-xs text-gray-500 truncate">{r.club}</div>
              </div>
            </div>
            <div className="font-semibold tabular-nums">{r.goals}</div>
          </li>
        ))}
      </ol>

      <p className="text-xs text-gray-500 mt-2">
        * Classement mis à jour automatiquement (inclut les buts marqués en cours de match si disponibles).
      </p>
    </section>
  );
}
