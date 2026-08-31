import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { SearchResult } from '../api/client';
import { toggleFavorite } from '../api/client';

export default function ResultCard({
  result,
  className = 'w-44 flex-shrink-0',
}: {
  result: SearchResult;
  className?: string;
}) {
  const queryClient = useQueryClient();

  const favMutation = useMutation({
    mutationFn: () => toggleFavorite(result.piece_id, result.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['piece', result.piece_id] });
      queryClient.invalidateQueries({ queryKey: ['feed'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });

  return (
    <div className={`relative ${className} ${!result.is_favorited && result.is_seen ? 'opacity-50' : ''}`}>
      <a
        href={result.item_url}
        target="_blank"
        rel="noopener noreferrer"
        className="group block"
      >
        <div className={`aspect-[3/4] overflow-hidden rounded-xl bg-gray-100 ${!result.is_seen ? 'ring-2 ring-blue-400' : ''}`}>
          {result.image_url ? (
            <img
              src={result.image_url}
              alt={result.title || 'Item'}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-gray-300 text-xs">
              No image
            </div>
          )}
        </div>
        <div className="mt-2 space-y-0.5">
          <p className="text-xs font-medium text-gray-900 truncate">
            {result.title || 'Untitled'}
          </p>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-700">
              {result.price != null ? `${result.price} ${result.currency || '€'}` : ''}
            </span>
            {!result.is_seen && (
              <span className="text-[10px] font-medium text-blue-500">New</span>
            )}
          </div>
          {result.size && (
            <p className="text-[10px] text-gray-400">{result.size}</p>
          )}
        </div>
      </a>

      <button
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          favMutation.mutate();
        }}
        className="absolute top-2 right-2 p-1.5 rounded-full bg-white/80 backdrop-blur-sm hover:bg-white transition-colors shadow-sm"
        title={result.is_favorited ? 'Remove from favorites' : 'Add to favorites'}
      >
        {result.is_favorited ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-red-500">
            <path d="M9.653 16.915l-.005-.003-.019-.01a20.759 20.759 0 01-1.162-.682 22.045 22.045 0 01-2.582-1.9C4.045 12.733 2 10.352 2 7.5a4.5 4.5 0 018-2.828A4.5 4.5 0 0118 7.5c0 2.852-2.044 5.233-3.885 6.82a22.049 22.049 0 01-3.744 2.582l-.019.01-.005.003h-.002a.723.723 0 01-.692 0h-.002z" />
          </svg>
        ) : (
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-gray-500">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
          </svg>
        )}
      </button>
    </div>
  );
}
