import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import ResultCard from '../components/ResultCard';
import { deletePiece, getPiece, searchPiece } from '../api/client';

export default function PieceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: piece, isLoading } = useQuery({
    queryKey: ['piece', id],
    queryFn: () => getPiece(id!),
    enabled: !!id,
  });

  const resync = useMutation({
    mutationFn: () => searchPiece(id!),
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['piece', id] }), 3000);
    },
    onError: () => toast.error('Search failed'),
  });

  const remove = useMutation({
    mutationFn: () => deletePiece(id!),
    onSuccess: () => {
      toast.success('Piece deleted');
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
      navigate('/');
    },
  });

  if (isLoading || !piece) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-gray-100" />
        <div className="aspect-square max-w-xs rounded-2xl bg-gray-100" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-start gap-8 mb-10">
        <div className="w-full md:w-64 flex-shrink-0">
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-100">
            <img
              src={`/uploads/${piece.image_filename}`}
              alt={piece.brand}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          <h1 className="text-2xl font-semibold tracking-tight">{piece.brand}</h1>
          {piece.category && (
            <p className="text-sm text-gray-500">
              <span className="text-gray-400">Category:</span> {piece.category}
            </p>
          )}
          {piece.material && (
            <p className="text-sm text-gray-500">
              <span className="text-gray-400">Material:</span> {piece.material}
            </p>
          )}
          {piece.description && (
            <p className="text-sm text-gray-500">
              <span className="text-gray-400">Description:</span> {piece.description}
            </p>
          )}
          <p className="text-xs text-gray-300">
            Added {new Date(piece.created_at).toLocaleDateString()}
          </p>

          <div className="flex gap-3 pt-2">
            <button
              onClick={() => resync.mutate()}
              disabled={resync.isPending}
              className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {resync.isPending ? 'Searching…' : 'Resync'}
            </button>
            <button
              onClick={() => {
                if (confirm('Delete this piece?')) remove.mutate();
              }}
              className="px-5 py-2.5 text-red-500 text-sm font-medium rounded-full border border-red-200 hover:bg-red-50 transition-colors"
            >
              Delete
            </button>
          </div>
        </div>
      </div>

      <h2 className="text-lg font-medium mb-5">
        Vinted results
        <span className="text-gray-400 font-normal text-sm ml-2">
          {piece.results.length} found
        </span>
      </h2>

      {piece.results.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
          {piece.results.map((result) => (
            <ResultCard key={result.id} result={result} className="w-full" />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <p className="text-gray-400">No results yet. Hit Resync to search Vinted.</p>
        </div>
      )}
    </div>
  );
}
