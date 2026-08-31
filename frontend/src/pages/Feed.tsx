import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import ResultCard from '../components/ResultCard';
import FilterBar from '../components/FilterBar';
import { getFeed, searchAll } from '../api/client';

function Spinner({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
      <p className="text-sm text-gray-400 mt-4">{message}</p>
    </div>
  );
}

export default function Feed() {
  const queryClient = useQueryClient();

  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [syncing, setSyncing] = useState(false);

  const { data: feed, isLoading } = useQuery({
    queryKey: ['feed'],
    queryFn: getFeed,
    refetchInterval: syncing ? 5000 : false,
  });

  const brands = useMemo(
    () => [...new Set((feed ?? []).map((p) => p.brand).filter(Boolean))],
    [feed],
  );
  const categories = useMemo(
    () => [...new Set((feed ?? []).map((p) => p.category).filter((c): c is string => !!c))],
    [feed],
  );

  const filteredFeed = useMemo(() => {
    if (!feed) return [];
    return feed.filter((p) => {
      if (brandFilter && p.brand !== brandFilter) return false;
      if (categoryFilter && p.category !== categoryFilter) return false;
      return true;
    });
  }, [feed, brandFilter, categoryFilter]);

  const resync = useMutation({
    mutationFn: searchAll,
    onSuccess: (data) => {
      toast.success(data.message + ' — refreshing results…');
      setSyncing(true);
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['feed'] });
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        setSyncing(false);
      }, 30000);
    },
    onError: () => toast.error('Search failed'),
  });

  if (isLoading) {
    return (
      <div className="space-y-12">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="h-6 w-48 rounded bg-gray-100 mb-4" />
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="w-44 flex-shrink-0">
                  <div className="aspect-[3/4] rounded-xl bg-gray-100" />
                  <div className="mt-2 h-3 w-3/4 rounded bg-gray-100" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
        <button
          onClick={() => resync.mutate()}
          disabled={resync.isPending}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {resync.isPending ? 'Searching…' : 'Resync all'}
        </button>
      </div>

      {feed && feed.length > 1 && (
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

      {!syncing && filteredFeed.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400">
            {feed && feed.length > 0
              ? 'No pieces match your filters'
              : 'No pieces tracked yet. Add your first piece to see results here.'}
          </p>
        </div>
      ) : !syncing ? (
        <div className="space-y-14">
          {filteredFeed.map((piece) => (
            <section key={piece.id}>
              <div className="flex items-start gap-6 mb-5">
                <Link to={`/piece/${piece.id}`} className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100 block hover:opacity-80 transition-opacity">
                  <img
                    src={`/uploads/${piece.image_filename}`}
                    alt={piece.brand}
                    className="w-full h-full object-cover"
                  />
                </Link>
                <div>
                  <Link to={`/piece/${piece.id}`} className="hover:underline">
                    <h2 className="text-lg font-medium text-gray-900">{piece.brand}</h2>
                  </Link>
                  {piece.description && (
                    <p className="text-sm text-gray-400 mt-0.5">{piece.description}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1">
                    {piece.results.length} result{piece.results.length !== 1 ? 's' : ''}
                    {piece.unseen_count > 0 && (
                      <span className="ml-2 text-blue-500 font-medium">
                        {piece.unseen_count} new
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {piece.results.length > 0 ? (
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {piece.results.map((result) => (
                    <ResultCard key={result.id} result={result} />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-300 pl-1">No results yet — try a resync.</p>
              )}
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}
