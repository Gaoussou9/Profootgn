// src/pages/TopScorers.jsx
import { useEffect, useState } from "react";
import api from "../api/client";

export default function TopScorers() {
  const [rows, setRows] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/stats/topscorers/")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : (res.data.results || [])))
      .catch((e) => setError(e.message))
      .finally(() => setLoad(false));
  }, []);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <section className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Meilleurs buteurs</h1>
      <div className="bg-white rounded-2xl ring-1 ring-gray-200 shadow-sm overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Joueur</th>
              <th className="px-3 py-2 text-left">Club</th>
              <th className="px-3 py-2 text-center">Buts</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i) => (
              <tr key={r.player_id || i} className="border-t">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{r.player_name}</td>
                <td className="px-3 py-2">{r.club_name}</td>
                <td className="px-3 py-2 text-center font-bold">{r.goals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
