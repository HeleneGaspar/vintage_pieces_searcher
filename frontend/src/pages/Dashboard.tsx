import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import PieceCard from '../components/PieceCard';
import FilterBar from '../components/FilterBar';
import { getPieces, searchAll, vintedLogin, vintedLoginStatus } from '../api/client';

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      <p className="text-sm text-gray-400 mt-4">{message}</p>
    </div>
  );
}

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { data: loginStatus } = useQuery({
    queryKey: ['vinted-login'],
    queryFn: vintedLoginStatus,
  });

  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [syncing, setSyncing] = useState(false);

  const [pendingSearch, setPendingSearch] = useState(false);

  const { data: pieces, isLoading } = useQuery({
    queryKey: ['pieces'],
    queryFn: getPieces,
    refetchInterval: syncing || pendingSearch ? 5000 : false,
  });

  useEffect(() => {
    const hasPending = pieces?.some((p) => p.result_count === 0) ?? false;
    setPendingSearch(hasPending);
  }, [pieces]);

  const brands = useMemo(
    () => [...new Set((pieces ?? []).map((p) => p.brand).filter(Boolean))],
    [pieces],
  );
  const categories = useMemo(
    () => [...new Set((pieces ?? []).map((p) => p.category).filter((c): c is string => !!c))],
    [pieces],
  );

  const filteredPieces = useMemo(() => {
    if (!pieces) return [];
    return pieces
      .filter((p) => {
        if (brandFilter && p.brand !== brandFilter) return false;
        if (categoryFilter && p.category !== categoryFilter) return false;
        return true;
      })
      .sort((a, b) => b.unseen_count - a.unseen_count);
  }, [pieces, brandFilter, categoryFilter]);

  const resync = useMutation({
    mutationFn: searchAll,
    onSuccess: (data) => {
      toast.success(data.message + ' — refreshing results…');
      setSyncing(true);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['pieces'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        setSyncing(false);
      }, 30000);
    },
    onError: () => toast.error('Search failed'),
  });

  const login = useMutation({
    mutationFn: vintedLogin,
    onSuccess: () => {
      toast.success('Connected to Vinted!');
      queryClient.invalidateQueries({ queryKey: ['vinted-login'] });
    },
    onError: () => toast.error('Login timed out. Try again.'),
  });

  const isLoggedIn = loginStatus?.status === 'ok';

  return (
    <div>
      {!isLoggedIn && (
        <div className="mb-6 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-amber-900">Connect your Vinted account</p>
            <p className="text-xs text-amber-600 mt-0.5">
              Required for image-based search. A browser will open for you to log in.
            </p>
          </div>
          <button
            onClick={() => login.mutate()}
            disabled={login.isPending}
            className="px-4 py-2 bg-amber-600 text-white text-sm font-medium rounded-full hover:bg-amber-700 transition-colors disabled:opacity-50"
          >
            {login.isPending ? 'Waiting for login…' : 'Connect to Vinted'}
          </button>
        </div>
      )}

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">My Pieces</h1>
          <p className="text-sm text-gray-400 mt-1">
            {pieces?.length ?? 0} piece{(pieces?.length ?? 0) !== 1 ? 's' : ''} tracked
          </p>
        </div>
        <div className="flex items-center gap-3">
          {isLoggedIn && (
            <span className="text-xs text-green-600 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Vinted connected
            </span>
          )}
          <button
            onClick={() => resync.mutate()}
            disabled={resync.isPending}
            className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {resync.isPending ? 'Searching…' : 'Resync all'}
          </button>
        </div>
      </div>

      {pieces && pieces.length > 1 && (
        <div className="mb-6">
          <FilterBar
            brands={brands}
            categories={categories}
            selectedBrand={brandFilter}
            selectedCategory={categoryFilter}
            onBrandChange={setBrandFilter}
            onCategoryChange={setCategoryFilter}
          />
        </div>
      )}

      {syncing && (
        <Spinner message="Searching all pieces on Vinted…" />
      )}

      {!syncing && isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-square rounded-2xl bg-gray-100" />
              <div className="mt-3 h-4 w-3/4 rounded bg-gray-100" />
              <div className="mt-1 h-3 w-1/2 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      ) : !syncing && filteredPieces.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {filteredPieces.map((piece) => (
            <PieceCard key={piece.id} piece={piece} />
          ))}
        </div>
      ) : !syncing && pieces && pieces.length > 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400">No pieces match your filters</p>
        </div>
      ) : !syncing && !isLoading ? (
        <div className="text-center py-24">
          <p className="text-gray-400 mb-4">No pieces yet</p>
          <a
            href="/add"
            className="inline-block px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors"
          >
            Add your first piece
          </a>
        </div>
      ) : null}
    </div>
  );
}
