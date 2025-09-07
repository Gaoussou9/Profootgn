// src/App.jsx
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Standings from "./pages/Standings.jsx";
import TopScorers from "./pages/TopScorers.jsx";
import MatchDetail from "./pages/MatchDetail.jsx";
import MatchEventsEditor from "./pages/MatchEventsEditor.jsx";
import Home from "./pages/Home.jsx";

const Nav = () => (
  <nav className="px-4 py-3 border-b bg-white sticky top-0 z-10 flex gap-4">
    {/* Accueil => /journees */}
    <NavLink end to="/journees" className={({ isActive }) => (isActive ? "font-semibold" : "")}>
      Accueil
    </NavLink>
    <NavLink to="/standings" className={({ isActive }) => (isActive ? "font-semibold" : "")}>
      Classement
    </NavLink>
    <NavLink to="/top-scorers" className={({ isActive }) => (isActive ? "font-semibold" : "")}>
      Buteurs
    </NavLink>
  </nav>
);

export default function App() {
  return (
    <BrowserRouter>
      <Nav />
      <main className="p-6 max-w-6xl mx-auto">
        <Routes>
          {/* Accueil -> /journees */}
          <Route path="/" element={<Navigate to="/Home" replace />} />

          {/* Pages */}
          <Route path="/journees" element={<Home />} />
          <Route path="/standings" element={<Standings />} />
          <Route path="/top-scorers" element={<TopScorers />} />
          <Route path="/match/:id" element={<MatchDetail />} />

          {/* Admin */}
          <Route path="/admin/match/:id/events" element={<MatchEventsEditor />} />

          {/* 404 */}
          <Route path="*" element={<Navigate to="/Home" replace />} />
        </Routes>
      </main>
    </BrowserRouter>
  );
}
