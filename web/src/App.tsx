import { Routes, Route } from 'react-router';
import Home from './pages/Home';
import GamesHall from './pages/GamesHall';
import SettingsPage from './pages/Settings';
import QuizIntro from './quiz/QuizIntro';
import QuizRunner from './quiz/QuizRunner';
import MemoryFlash from './games/MemoryFlash';
import ReactionTap from './games/ReactionTap';
import MatchPairs from './games/MatchPairs';
import BiggerTap from './games/BiggerTap';
import HGE2Tier from './games/hge2/HGE2Tier';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/skill/:skillId" element={<QuizIntro />} />
      <Route path="/quiz/:skillId" element={<QuizRunner />} />
      <Route path="/games" element={<GamesHall />} />
      <Route path="/games/memory-flash" element={<MemoryFlash />} />
      <Route path="/games/reaction-tap" element={<ReactionTap />} />
      <Route path="/games/match-pairs" element={<MatchPairs />} />
      <Route path="/games/bigger-tap" element={<BiggerTap />} />
      <Route path="/games/hge2/:tierId" element={<HGE2Tier />} />
      <Route path="/settings" element={<SettingsPage />} />
    </Routes>
  );
}
