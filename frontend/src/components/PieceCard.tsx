import { Link } from 'react-router-dom';
import type { Piece } from '../api/client';

export default function PieceCard({ piece }: { piece: Piece }) {
  return (
    <Link to={`/piece/${piece.id}`} className="group block">
      <div className="relative aspect-square overflow-hidden rounded-2xl bg-gray-100">
        <img
          src={`/uploads/${piece.image_filename}`}
          alt={piece.brand}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {piece.unseen_count > 0 && (
          <span className="absolute top-2.5 right-2.5 min-w-[20px] h-5 px-1.5 flex items-center justify-center bg-blue-500 text-white text-[10px] font-bold rounded-full shadow-sm">
            {piece.unseen_count}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <p className="text-sm font-medium text-gray-900 truncate">{piece.brand}</p>
        {piece.description && (
          <p className="text-xs text-gray-400 truncate">{piece.description}</p>
        )}
        <div className="flex items-center gap-2">
          {piece.result_count > 0 ? (
            <span className="text-xs text-gray-500">
              {piece.result_count} result{piece.result_count !== 1 ? 's' : ''}
            </span>
          ) : (
            <span className="text-xs text-gray-400 flex items-center gap-1.5">
              <span className="w-3 h-3 border border-gray-300 border-t-gray-500 rounded-full animate-spin" />
              Searching…
            </span>
          )}
          {piece.unseen_count > 0 && (
            <span className="text-xs font-medium text-blue-500">
              {piece.unseen_count} new
            </span>
          )}
          {!piece.is_active && (
            <span className="text-xs text-amber-500">Paused</span>
          )}
        </div>
      </div>
    </Link>
  );
}
