import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Home from './pages/Home.jsx'
import Standings from './pages/Standings.jsx'
import TopScorers from './pages/TopScorers.jsx'
import MatchDetail from "./pages/MatchDetail";


const Nav = () => (
  <nav className="px-4 py-3 border-b bg-white sticky top-0 z-10 flex gap-4">
    <NavLink to="/" className={({isActive}) => (isActive?'font-semibold':'')}>Accueil</NavLink>
    <NavLink to="/standings" className={({isActive}) => (isActive?'font-semibold':'')}>Classement</NavLink>
    <NavLink to="/top-scorers" className={({isActive}) => (isActive?'font-semibold':'')}>Buteurs</NavLink>
  </nav>
)

export default function App(){
  return (
    <BrowserRouter>
      <Nav/>
      <main className="p-6 max-w-6xl mx-auto">
        <Routes>
          <Route path="/" element={<Home/>}/>
        <Route path="/standings" element={<Standings/>}/>
        <Route path="/top-scorers" element={<TopScorers/>}/>
         <Route path="/match/:id" element={<MatchDetail />} />
        </Routes>
      </main>
    </BrowserRouter>
  )
}