import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import ResultCard from '../components/ResultCard';
import { deletePiece, getPiece, markResultsSeen, searchPiece, updatePiece, updatePieceImage } from '../api/client';
import { usePieceOptions } from '../hooks/usePieceOptions';

function PencilIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
    </svg>
  );
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
    </svg>
  );
}

function SearchingOrEmpty({ piece }: { piece: { created_at: string } }) {
  const ageMs = Date.now() - new Date(piece.created_at).getTime();
  const isRecent = ageMs < 120_000;

  if (isRecent) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
        <p className="text-sm text-gray-400 mt-4">Searching Vinted…</p>
      </div>
    );
  }

  return (
    <div className="text-center py-16">
      <p className="text-gray-400">No results yet. Hit Resync to search.</p>
    </div>
  );
}

export default function PieceDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { categories, materials: materialsList } = usePieceOptions();

  const [editing, setEditing] = useState(false);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [material, setMaterial] = useState('');
  const [description, setDescription] = useState('');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: piece, isLoading } = useQuery({
    queryKey: ['piece', id],
    queryFn: () => getPiece(id!),
    enabled: !!id,
    refetchInterval: (query) => {
      const data = query.state.data;
      if (data && data.results.length === 0) return 3000;
      return false;
    },
  });

  // Mark results as seen when viewing the piece
  useEffect(() => {
    if (piece && piece.unseen_count > 0) {
      markResultsSeen(id!).then(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        queryClient.invalidateQueries({ queryKey: ['pieces'] });
      });
    }
  }, [piece?.id, piece?.unseen_count]);

  const resync = useMutation({
    mutationFn: () => searchPiece(id!),
    onSuccess: (data) => {
      toast.success(data.message);
      queryClient.invalidateQueries({ queryKey: ['piece', id] });
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (err: any) => {
      const detail = err?.response?.data?.detail;
      if (err?.response?.status === 401 || detail?.includes('session expired')) {
        toast.error('Vinted session expired. Please reconnect to Vinted.', { duration: 6000 });
      } else {
        toast.error('Search failed');
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => deletePiece(id!),
    onSuccess: () => {
      toast.success('Piece deleted');
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
      navigate('/');
    },
  });

  const save = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (imageFile) {
        await updatePieceImage(id!, imageFile);
      }
      return updatePiece(id!, data);
    },
    onSuccess: () => {
      toast.success('Piece updated');
      setEditing(false);
      setImagePreview(null);
      setImageFile(null);
      queryClient.invalidateQueries({ queryKey: ['piece', id] });
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
    },
    onError: () => toast.error('Failed to update piece'),
  });

  const startEditing = () => {
    if (!piece) return;
    setBrand(piece.brand);
    setCategory(piece.category ?? '');
    setMaterial(piece.material ?? '');
    setDescription(piece.description ?? '');
    setImagePreview(null);
    setImageFile(null);
    setEditing(true);
  };

  const cancelEditing = () => {
    setEditing(false);
    setImagePreview(null);
    setImageFile(null);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const handleSave = () => {
    if (!brand.trim()) {
      toast.error('Brand is required');
      return;
    }
    save.mutate({
      brand: brand.trim(),
      category: category.trim() || null,
      material: material.trim() || null,
      description: description.trim() || null,
    });
  };

  if (isLoading || !piece) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 rounded bg-gray-100" />
        <div className="aspect-square max-w-xs rounded-2xl bg-gray-100" />
      </div>
    );
  }

  const imageSrc = imagePreview ?? `/uploads/${piece.image_filename}`;

  return (
    <div className="relative">
      {!editing && (
        <div className="absolute top-0 right-0 flex items-center gap-1">
          <button
            onClick={startEditing}
            className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors"
            title="Edit piece"
          >
            <PencilIcon className="w-4.5 h-4.5" />
          </button>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
            title="Delete piece"
          >
            <TrashIcon className="w-4.5 h-4.5" />
          </button>
        </div>
      )}

      <div className="flex flex-col md:flex-row md:items-start gap-8 mb-10">
        <div className="w-full md:w-64 flex-shrink-0">
          <div
            className={`relative aspect-square rounded-2xl overflow-hidden bg-gray-100 ${editing ? 'cursor-pointer group' : ''}`}
            onClick={editing ? () => fileInputRef.current?.click() : undefined}
          >
            <img
              src={imageSrc}
              alt={piece.brand}
              className="w-full h-full object-cover"
            />
            {editing && (
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span className="text-white text-sm font-medium">Change image</span>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
        </div>

        <div className="flex-1 space-y-3">
          {editing ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Brand <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white appearance-none"
                >
                  <option value="">Select a category</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
                <select
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white appearance-none"
                >
                  <option value="">Select a material</option>
                  {materialsList.map((mat) => (
                    <option key={mat} value={mat}>{mat}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
                />
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleSave}
                  disabled={save.isPending}
                  className="px-5 py-2.5 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  {save.isPending ? 'Saving…' : 'Save'}
                </button>
                <button
                  onClick={cancelEditing}
                  className="px-5 py-2.5 text-sm text-gray-500 font-medium rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
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
              </div>
            </>
          )}
        </div>
      </div>

      {resync.isPending ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          <p className="text-sm text-gray-400 mt-4">Searching Vinted…</p>
        </div>
      ) : piece.results.length > 0 ? (
        <>
          <h2 className="text-lg font-medium mb-4">
            Vinted results
            <span className="text-gray-400 font-normal text-sm ml-2">
              {piece.results.length} found
            </span>
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-5">
            {[...piece.results]
              .sort((a, b) => {
                if (a.is_favorited !== b.is_favorited) return a.is_favorited ? -1 : 1;
                if (a.is_seen !== b.is_seen) return a.is_seen ? 1 : -1;
                return 0;
              })
              .map((result) => (
                <ResultCard key={result.id} result={result} className="w-full" />
              ))}
          </div>
        </>
      ) : (
        <SearchingOrEmpty piece={piece} />
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm mx-4 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">Delete this piece?</h3>
            <p className="text-sm text-gray-500 mt-2">
              This will permanently remove this piece and all its search results. This action cannot be undone.
            </p>
            <div className="flex gap-3 mt-6 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  remove.mutate();
                }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 rounded-full hover:bg-red-600 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
