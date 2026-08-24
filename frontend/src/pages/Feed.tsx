import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import ResultCard from '../components/ResultCard';
import { getFeed, searchAll } from '../api/client';

export default function Feed() {
  const queryClient = useQueryClient();
  const { data: feed, isLoading } = useQuery({ queryKey: ['feed'], queryFn: getFeed });

  const resync = useMutation({
    mutationFn: searchAll,
    onSuccess: (data) => {
      toast.success(data.message);
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['feed'] }), 5000);
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
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">Feed</h1>
        <button
          onClick={() => resync.mutate()}
          disabled={resync.isPending}
          className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {resync.isPending ? 'Searching…' : 'Resync all'}
        </button>
      </div>

      {!feed || feed.length === 0 ? (
        <div className="text-center py-24">
          <p className="text-gray-400">No pieces tracked yet. Add your first piece to see results here.</p>
        </div>
      ) : (
        <div className="space-y-14">
          {feed.map((piece) => (
            <section key={piece.id}>
              <div className="flex items-start gap-6 mb-5">
                <div className="w-20 h-20 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                  <img
                    src={`/uploads/${piece.image_filename}`}
                    alt={piece.brand}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-lg font-medium text-gray-900">{piece.brand}</h2>
                  {piece.description && (
                    <p className="text-sm text-gray-400 mt-0.5">{piece.description}</p>
                  )}
                  <p className="text-xs text-gray-300 mt-1">
                    {piece.results.length} result{piece.results.length !== 1 ? 's' : ''}
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
      )}
    </div>
  );
}
