import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import ResultCard from '../components/ResultCard';
import FilterBar from '../components/FilterBar';
import { getFavorites } from '../api/client';
import type { SearchResult } from '../api/client';

interface FlatFavorite {
  result: SearchResult;
  brand: string;
  pieceId: string;
  imageFilename: string;
}

export default function Favorites() {
  const [brandFilter, setBrandFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const { data: favorites, isLoading } = useQuery({
    queryKey: ['favorites'],
    queryFn: getFavorites,
  });

  const brands = useMemo(
    () => [...new Set((favorites ?? []).map((p) => p.brand).filter(Boolean))],
    [favorites],
  );
  const categories = useMemo(
    () => [...new Set((favorites ?? []).map((p) => p.category).filter((c): c is string => !!c))],
    [favorites],
  );

  const flatFavorites = useMemo<FlatFavorite[]>(() => {
    if (!favorites) return [];
    return favorites
      .filter((p) => {
        if (brandFilter && p.brand !== brandFilter) return false;
        if (categoryFilter && p.category !== categoryFilter) return false;
        return true;
      })
      .flatMap((p) =>
        p.results.map((r) => ({
          result: r,
          brand: p.brand,
          pieceId: p.id,
          imageFilename: p.image_filename,
        })),
      );
  }, [favorites, brandFilter, categoryFilter]);

  if (isLoading) {
    return (
      <div>
        <div className="h-8 w-40 rounded bg-gray-100 mb-2" />
        <div className="h-4 w-24 rounded bg-gray-100 mb-8" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="aspect-[3/4] rounded-xl bg-gray-100" />
              <div className="mt-2 h-3 w-3/4 rounded bg-gray-100" />
              <div className="mt-1 h-3 w-1/2 rounded bg-gray-100" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Favorites</h1>
          <p className="text-sm text-gray-400 mt-1">
            {flatFavorites.length} item{flatFavorites.length !== 1 ? 's' : ''} saved
          </p>
        </div>
      </div>

      {favorites && favorites.length > 1 && (
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

      {flatFavorites.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400">
            {favorites && favorites.length > 0
              ? 'No favorites match your filters'
              : 'No favorites yet. Heart items from your search results to save them here.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {flatFavorites.map(({ result, brand, pieceId, imageFilename }) => (
            <div key={result.id}>
              <ResultCard result={result} className="w-full" />
              <Link
                to={`/piece/${pieceId}`}
                className="mt-1.5 flex items-center gap-2 group/link"
              >
                <div className="w-5 h-5 rounded overflow-hidden bg-gray-100 flex-shrink-0">
                  <img
                    src={`/uploads/${imageFilename}`}
                    alt={brand}
                    className="w-full h-full object-cover"
                  />
                </div>
                <span className="text-[11px] text-gray-400 truncate group-hover/link:text-gray-600 transition-colors">
                  {brand}
                </span>
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
