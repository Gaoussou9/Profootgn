import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import api from "../api/client";

const Logo = ({ src, alt, size = "w-8 h-8" }) => (
  <img
    src={src || "/club-placeholder.png"}
    alt={alt}
    className={`${size} object-contain shrink-0`}
    onError={(e) => (e.currentTarget.src = "/club-placeholder.png")}
  />
);

const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "");

/* ---------------- Toast minimal ---------------- */
function useToast() {
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!msg) return;
    const id = setTimeout(() => setMsg(null), 2500);
    return () => clearTimeout(id);
  }, [msg]);
  return { msg, setMsg };
}

function Toast({ msg }) {
  if (!msg) return null;
  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white text-sm px-3 py-2 rounded-lg shadow">
      {msg}
    </div>
  );
}

/* ------------- Autocomplete joueur ------------- */
function PlayerAutocomplete({ clubId, placeholder, value, setValue, setPickedId }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const boxRef = useRef(null);

  // Fermer au clic extérieur
  useEffect(() => {
    const onClick = (e) => {
      if (!boxRef.current) return;
      if (!boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  // Cherche joueurs (après 2 chars)
  useEffect(() => {
    let stop = false;
    const q = (value || "").trim();
    if (!clubId || q.length < 2) {
      setItems([]);
      return;
    }
    setLoading(true);
    api
      .get(`players/search/?club=${clubId}&q=${encodeURIComponent(q)}&limit=20`)
      .then((r) => {
        if (stop) return;
        const arr = Array.isArray(r.data) ? r.data : [];
        setItems(arr);
        setOpen(true);
      })
      .catch(() => {})
      .finally(() => !stop && setLoading(false));
    return () => {
      stop = true;
    };
  }, [clubId, value]);

  return (
    <div className="relative" ref={boxRef}>
      <input
        type="text"
        className="border rounded px-2 py-1 w-64"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setPickedId(null);
        }}
        onFocus={() => value?.length >= 2 && setOpen(true)}
      />
      {open && (items.length > 0 || loading) && (
        <div className="absolute z-10 mt-1 w-64 bg-white border rounded shadow">
          {loading && <div className="px-2 py-1 text-xs text-gray-500">Recherche…</div>}
          {items.map((it) => (
            <button
              key={it.id}
              type="button"
              className="w-full text-left px-2 py-1 hover:bg-gray-50"
              onClick={() => {
                setValue(it.name);
                setPickedId(it.id);
                setOpen(false);
              }}
            >
              {it.name} <span className="text-xs text-gray-500">({it.club_name || "—"})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------- Page d’édition --------------- */
export default function MatchEventsEditor() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [m, setM] = useState(null);
  const [loading, setLoad] = useState(true);
  const [err, setErr] = useState(null);
  const toast = useToast();

  // BUT
  const [gMinute, setGMinute] = useState("");
  const [gClub, setGClub] = useState("home");
  const [gPlayerName, setGPlayerName] = useState("");
  const [gPlayerId, setGPlayerId] = useState(null);
  const [gAssistName, setGAssistName] = useState("");
  const [gAssistId, setGAssistId] = useState(null);

  // CARTON
  const [cMinute, setCMinute] = useState("");
  const [cClub, setCClub] = useState("home");
  const [cColor, setCColor] = useState("Y");
  const [cPlayerName, setCPlayerName] = useState("");
  const [cPlayerId, setCPlayerId] = useState(null);

  const reload = async () => {
    setLoad(true);
    try {
      const r = await api.get(`matches/${id}/`);
      setM(r.data);
      setErr(null);
    } catch (e) {
      setErr(e.message || "Erreur de chargement");
    } finally {
      setLoad(false);
    }
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const home = useMemo(
    () => ({ id: m?.home_club, name: m?.home_club_name || "Domicile", logo: m?.home_club_logo || null }),
    [m]
  );
  const away = useMemo(
    () => ({ id: m?.away_club, name: m?.away_club_name || "Extérieur", logo: m?.away_club_logo || null }),
    [m]
  );
  const clubIdOf = (side) => (side === "home" ? home.id : away.id);

  /* ---------- Actions ---------- */
  const addGoal = async (e) => {
    e.preventDefault();
    const minute = parseInt(gMinute, 10);
    const club = clubIdOf(gClub);
    if (!Number.isFinite(minute) || minute < 0 || !club) return;

    const payload = {
      match: Number(id),
      replace: false,
      goals: [
        {
          club,
          minute,
          ...(gPlayerId ? { player: gPlayerId } : (gPlayerName.trim() ? { player_name: gPlayerName.trim() } : {})),
          ...(gAssistId
            ? { assist_player: gAssistId }
            : gAssistName.trim()
            ? { assist_name: gAssistName.trim() }
            : {}),
        },
      ],
    };

    try {
      await api.post("goals/bulk/", payload);
      setGMinute(""); setGPlayerName(""); setGPlayerId(null);
      setGAssistName(""); setGAssistId(null);
      await reload();
      toast.setMsg("But ajouté");
    } catch (e2) {
      toast.setMsg(e2?.response?.data?.detail || "Échec ajout but");
    }
  };

  const addCard = async (e) => {
    e.preventDefault();
    const minute = parseInt(cMinute, 10);
    const club = clubIdOf(cClub);
    if (!Number.isFinite(minute) || minute < 0 || !club) return;

    const payload = {
      match: Number(id),
      replace: false,
      cards: [
        {
          club,
          minute,
          color: cColor,
          ...(cPlayerId ? { player: cPlayerId } : (cPlayerName.trim() ? { player_name: cPlayerName.trim() } : {})),
        },
      ],
    };

    try {
      await api.post("cards/bulk/", payload);
      setCMinute(""); setCPlayerName(""); setCPlayerId(null); setCColor("Y");
      await reload();
      toast.setMsg("Carton ajouté");
    } catch (e2) {
      toast.setMsg(e2?.response?.data?.detail || "Échec ajout carton");
    }
  };

  const deleteGoal = async (goalId) => {
    if (!window.confirm("Supprimer ce but ?")) return;
    try {
      await api.delete(`goals/${goalId}/`);
      await reload();
      toast.setMsg("But supprimé");
    } catch {
      toast.setMsg("Échec suppression");
    }
  };

  const deleteCard = async (cardId) => {
    if (!window.confirm("Supprimer ce carton ?")) return;
    try {
      await api.delete(`cards/${cardId}/`);
      await reload();
      toast.setMsg("Carton supprimé");
    } catch {
      toast.setMsg("Échec suppression");
    }
  };

  if (loading) return <p>Chargement…</p>;
  if (err) return <p className="text-red-600">Erreur : {err}</p>;
  if (!m) return <p>Match introuvable.</p>;

  return (
    <section className="space-y-6">
      <Toast msg={toast.msg} />

      {/* En-tête */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Logo src={home.logo} alt={home.name} />
            <span className="font-semibold truncate">{home.name}</span>
          </div>
        <div className="text-center">
            <div className="text-xl font-extrabold tabular-nums">
              {m.home_score}
              <span className="text-gray-400"> - </span>
              {m.away_score}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {m.round_name ? `${m.round_name} • ` : ""}
              {fmtDate(m.datetime)}{m.venue ? ` • ${m.venue}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-3 min-w-0 justify-end">
            <span className="font-semibold truncate text-right">{away.name}</span>
            <Logo src={away.logo} alt={away.name} />
          </div>
        </div>
      </div>

      {/* Ajouter un but */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <h2 className="text-lg font-semibold mb-3">Ajouter un but</h2>
        <form onSubmit={addGoal} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col">
            <span className="text-xs text-gray-600">Minute</span>
            <input
              type="number"
              className="border rounded px-2 py-1 w-24"
              value={gMinute}
              onChange={(e) => setGMinute(e.target.value)}
              min={0}
              required
            />
          </label>

          <label className="flex flex-col">
            <span className="text-xs text-gray-600">Équipe</span>
            <select
              className="border rounded px-2 py-1"
              value={gClub}
              onChange={(e) => { setGClub(e.target.value); setGPlayerId(null); setGAssistId(null); }}
            >
              <option value="home">{home.name}</option>
              <option value="away">{away.name}</option>
            </select>
          </label>

          <div className="flex flex-col">
            <span className="text-xs text-gray-600">Buteur</span>
            <PlayerAutocomplete
              clubId={clubIdOf(gClub)}
              placeholder="Nom du buteur"
              value={gPlayerName}
              setValue={setGPlayerName}
              setPickedId={setGPlayerId}
            />
          </div>

          <div className="flex flex-col">
            <span className="text-xs text-gray-600">Passeur (optionnel)</span>
            <PlayerAutocomplete
              clubId={clubIdOf(gClub)}
              placeholder="Nom du passeur"
              value={gAssistName}
              setValue={setGAssistName}
              setPickedId={setGAssistId}
            />
          </div>

          <button type="submit" className="px-3 py-2 rounded bg-emerald-600 text-white">
            Ajouter
          </button>
        </form>

        {/* Liste des buts */}
        <ul className="mt-4 divide-y">
          {(m.goals || []).map((g) => (
            <li key={g.id} className="py-2 flex items-center gap-3">
              <span className="w-12 text-gray-500 text-sm">{g.minute}'</span>
              <img src={g.club_logo || "/club-placeholder.png"} alt={g.club_name || "-"} className="w-6 h-6 object-contain" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{g.player_name || "—"}</div>
                <div className="text-xs text-gray-500 truncate">
                  {g.assist_name ? `Passeur : ${g.assist_name}` : ""}
                </div>
                <div className="text-xs text-gray-400 truncate">{g.club_name || "-"}</div>
              </div>
              <button
                onClick={() => deleteGoal(g.id)}
                className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100"
              >
                Supprimer
              </button>
            </li>
          ))}
          {!m.goals?.length && <li className="py-2 text-gray-500 text-sm">Aucun but.</li>}
        </ul>
      </div>

      {/* Ajouter un carton */}
      <div className="bg-white rounded-2xl shadow-sm ring-1 ring-gray-100 p-4">
        <h2 className="text-lg font-semibold mb-3">Ajouter un carton</h2>
        <form onSubmit={addCard} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col">
            <span className="text-xs text-gray-600">Minute</span>
            <input
              type="number"
              className="border rounded px-2 py-1 w-24"
              value={cMinute}
              onChange={(e) => setCMinute(e.target.value)}
              min={0}
              required
            />
          </label>

          <label className="flex flex-col">
            <span className="text-xs text-gray-600">Équipe</span>
            <select
              className="border rounded px-2 py-1"
              value={cClub}
              onChange={(e) => { setCClub(e.target.value); setCPlayerId(null); }}
            >
              <option value="home">{home.name}</option>
              <option value="away">{away.name}</option>
            </select>
          </label>

          <label className="flex flex-col">
            <span className="text-xs text-gray-600">Couleur</span>
            <select
              className="border rounded px-2 py-1"
              value={cColor}
              onChange={(e) => setCColor(e.target.value)}
            >
              <option value="Y">Jaune</option>
              <option value="R">Rouge</option>
            </select>
          </label>

          <div className="flex flex-col">
            <span className="text-xs text-gray-600">Joueur</span>
            <PlayerAutocomplete
              clubId={clubIdOf(cClub)}
              placeholder="Nom du joueur"
              value={cPlayerName}
              setValue={setCPlayerName}
              setPickedId={setCPlayerId}
            />
          </div>

          <button type="submit" className="px-3 py-2 rounded bg-emerald-600 text-white">
            Ajouter
          </button>
        </form>

        {/* Liste des cartons */}
        <ul className="mt-4 divide-y">
          {(m.cards || []).map((c) => (
            <li key={c.id} className="py-2 flex items-center gap-3">
              <span className="w-12 text-gray-500 text-sm">{c.minute}'</span>
              <img src={c.club_logo || "/club-placeholder.png"} alt={c.club_name || "-"} className="w-6 h-6 object-contain" />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">
                  {c.player_name || "—"} <span className="text-xs text-gray-500">({c.type === "R" ? "Rouge" : "Jaune"})</span>
                </div>
                <div className="text-xs text-gray-400 truncate">{c.club_name || "-"}</div>
              </div>
              <button
                onClick={() => deleteCard(c.id)}
                className="px-2 py-1 text-xs rounded bg-red-50 text-red-700 hover:bg-red-100"
              >
                Supprimer
              </button>
            </li>
          ))}
          {!m.cards?.length && <li className="py-2 text-gray-500 text-sm">Aucun carton.</li>}
        </ul>
      </div>

      <div className="flex items-center justify-between">
        <Link to={`/match/${id}`} className="text-blue-600 hover:underline">← Retour au match</Link>
        <button className="text-sm text-gray-600 hover:underline" onClick={() => navigate(`/`)}>Accueil</button>
      </div>
    </section>
  );
}
