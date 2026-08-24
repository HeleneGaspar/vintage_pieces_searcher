import type { SearchResult } from '../api/client';

export default function ResultCard({
  result,
  className = 'w-44 flex-shrink-0',
}: {
  result: SearchResult;
  className?: string;
}) {
  return (
    <a
      href={result.item_url}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block ${className}`}
    >
      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-gray-100">
        {result.image_url ? (
          <img
            src={result.image_url}
            alt={result.title || 'Vinted item'}
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
          {result.similarity_score != null && (
            <span className="text-[10px] text-gray-400">
              {Math.round(result.similarity_score * 100)}% match
            </span>
          )}
        </div>
        {result.size && (
          <p className="text-[10px] text-gray-400">{result.size}</p>
        )}
      </div>
    </a>
  );
}
