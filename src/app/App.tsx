import { BrowserRouter, Routes, Route, Navigate } from 'react-router';
import { ThemeProvider, createTheme } from '@mui/material';
import { PlayerProvider } from './contexts/PlayerContext';
import MainLayout from './components/MainLayout';
import AIRecommendView from './components/views/AIRecommendView';
import ExploreView from './components/views/ExploreView';
import MusicLibraryView from './components/views/MusicLibraryView';
import SettingsView from './components/views/SettingsView';

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#6366f1',
    },
    background: {
      default: '#0a0a0f',
      paper: '#12121a',
    },
  },
});

export default function App() {
  return (
    <ThemeProvider theme={darkTheme}>
      <PlayerProvider>
        <BrowserRouter>
          <div className="size-full bg-[#0a0a0f] dark">
            <MainLayout>
              <Routes>
                <Route path="/" element={<Navigate to="/ai-recommend" replace />} />
                <Route path="/ai-recommend" element={<AIRecommendView />} />
                <Route path="/explore" element={<ExploreView />} />
                <Route path="/library" element={<MusicLibraryView />} />
                <Route path="/settings" element={<SettingsView />} />
              </Routes>
            </MainLayout>
          </div>
        </BrowserRouter>
      </PlayerProvider>
    </ThemeProvider>
  );
}
