// src/pages/Standings.jsx
import { useEffect, useState } from "react";
import api from "../api/client";

export default function Standings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoad] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get("/stats/standings/")
      .then((res) => setRows(Array.isArray(res.data) ? res.data : (res.data.results || [])))
      .catch((e) => setError(e.message))
      .finally(() => setLoad(false));
  }, []);

  if (loading) return <p>Chargement…</p>;
  if (error) return <p className="text-red-600">Erreur : {error}</p>;

  return (
    <section className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Classement</h1>
      <div className="overflow-x-auto rounded-2xl ring-1 ring-gray-200 shadow-sm">
        <table className="min-w-full bg-white">
          <thead className="bg-gray-50 text-xs uppercase text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">#</th>
              <th className="px-3 py-2 text-left">Club</th>
              <th className="px-3 py-2 text-center">J</th>
              <th className="px-3 py-2 text-center">G</th>
              <th className="px-3 py-2 text-center">N</th>
              <th className="px-3 py-2 text-center">P</th>
              <th className="px-3 py-2 text-center">Bp</th>
              <th className="px-3 py-2 text-center">Bc</th>
              <th className="px-3 py-2 text-center">Diff</th>
              <th className="px-3 py-2 text-center">Pts</th>
            </tr>
          </thead>
          <tbody className="text-sm">
            {rows.map((r, i) => (
              <tr key={r.club_id} className="border-t">
                <td className="px-3 py-2">{i + 1}</td>
                <td className="px-3 py-2">{r.club_name}</td>
                <td className="px-3 py-2 text-center">{r.played}</td>
                <td className="px-3 py-2 text-center">{r.wins}</td>
                <td className="px-3 py-2 text-center">{r.draws}</td>
                <td className="px-3 py-2 text-center">{r.losses}</td>
                <td className="px-3 py-2 text-center">{r.goals_for}</td>
                <td className="px-3 py-2 text-center">{r.goals_against}</td>
                <td className="px-3 py-2 text-center">{r.goal_diff}</td>
                <td className="px-3 py-2 text-center font-bold">{r.points}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
