// src/api/client.js
import axios from "axios";

const base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

// Toujours finir par /api/
const baseURL = base.replace(/\/+$/, "") + "/api/";

const api = axios.create({
  baseURL,
  timeout: 15000,
  // Si tu utilises des cookies/CSRF côté Django, active ceci :
  // withCredentials: true,
});

// ----- Request interceptor -----
// - supprime les slashes de tête sur config.url (pour éviter //)
// - ajoute le Bearer token si présent
// - force Accept / Content-Type en JSON
api.interceptors.request.use((config) => {
  if (config.url) {
    // '/matches/...' -> 'matches/...'
    config.url = config.url.replace(/^\/+/, "");
  }
  config.headers = {
    ...(config.headers || {}),
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const t = localStorage.getItem("token");
  if (t) config.headers.Authorization = `Bearer ${t}`;
  return config;
});

// ----- Response interceptor -----
// (optionnel) normalise les erreurs pour un message lisible
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const msg =
      err?.response?.data?.detail ||
      err?.response?.data?.message ||
      err?.message ||
      "Erreur réseau";
    // Tu peux logger si besoin :
    // console.warn("API error:", msg, err?.response);
    return Promise.reject(new Error(msg));
  }
);

// Petit helper pratique pour tes pages React :
// Récupère toujours un tableau, que la réponse DRF soit paginée ou non.
export const getArr = (res) =>
  Array.isArray(res?.data) ? res.data : res?.data?.results || [];

export default api;
