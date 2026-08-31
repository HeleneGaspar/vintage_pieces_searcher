import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Feed from './pages/Feed';
import Favorites from './pages/Favorites';
import AddPiece from './pages/AddPiece';
import PieceDetail from './pages/PieceDetail';

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              borderRadius: '9999px',
              padding: '10px 20px',
              fontSize: '14px',
            },
          }}
        />
        <Routes>
          <Route element={<Layout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/feed" element={<Feed />} />
            <Route path="/favorites" element={<Favorites />} />
            <Route path="/add" element={<AddPiece />} />
            <Route path="/piece/:id" element={<PieceDetail />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
