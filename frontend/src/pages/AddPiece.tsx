import { useCallback, useRef, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { createPiece } from '../api/client';

const DEFAULT_CATEGORIES = ['Top', 'Jacket', 'Coat', 'Skirt', 'Dress', 'Trousers'];
const DEFAULT_MATERIALS = ['Leather', 'Silk', 'Satin', 'Wool', 'Nylon', 'Cotton'];

export default function AddPiece() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const newCategoryRef = useRef<HTMLInputElement>(null);
  const [material, setMaterial] = useState('');
  const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
  const [showNewMaterial, setShowNewMaterial] = useState(false);
  const [newMaterial, setNewMaterial] = useState('');
  const [description, setDescription] = useState('');

  const onDrop = useCallback((accepted: File[]) => {
    if (accepted.length > 0) {
      const f = accepted[0];
      setFile(f);
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'] },
    maxFiles: 1,
  });

  const mutation = useMutation({
    mutationFn: (formData: FormData) => createPiece(formData),
    onSuccess: () => {
      toast.success('Piece added! Searching Vinted…');
      queryClient.invalidateQueries({ queryKey: ['pieces'] });
      navigate('/');
    },
    onError: () => toast.error('Failed to add piece'),
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !brand.trim()) {
      toast.error('Brand and image are required');
      return;
    }
    const fd = new FormData();
    fd.append('image', file);
    fd.append('brand', brand.trim());
    if (category.trim()) fd.append('category', category.trim());
    if (material.trim()) fd.append('material', material.trim());
    if (description.trim()) fd.append('description', description.trim());
    mutation.mutate(fd);
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">Add a piece</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div
          {...getRootProps()}
          className={`relative border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-gray-900 bg-gray-50'
              : 'border-gray-200 hover:border-gray-400'
          }`}
        >
          <input {...getInputProps()} />
          {preview ? (
            <img
              src={preview}
              alt="Preview"
              className="mx-auto max-h-64 rounded-xl object-contain"
            />
          ) : (
            <div className="py-8">
              <p className="text-sm text-gray-400">
                Drop a reference image here, or click to select
              </p>
              <p className="text-xs text-gray-300 mt-1">JPG, PNG, WEBP</p>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Brand <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            placeholder="e.g. Acne Studios"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
            required
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
          {showNewCategory ? (
            <div className="flex gap-2 mt-2">
              <input
                ref={newCategoryRef}
                type="text"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newCategory.trim();
                    if (val && !categories.includes(val)) {
                      setCategories([...categories, val]);
                      setCategory(val);
                    }
                    setNewCategory('');
                    setShowNewCategory(false);
                  }
                }}
                placeholder="New category name"
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const val = newCategory.trim();
                  if (val && !categories.includes(val)) {
                    setCategories([...categories, val]);
                    setCategory(val);
                  }
                  setNewCategory('');
                  setShowNewCategory(false);
                }}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setNewCategory(''); setShowNewCategory(false); }}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewCategory(true)}
              className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-base leading-none">+</span> Add new category
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Material</label>
          <select
            value={material}
            onChange={(e) => setMaterial(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white appearance-none"
          >
            <option value="">Select a material</option>
            {materials.map((mat) => (
              <option key={mat} value={mat}>{mat}</option>
            ))}
          </select>
          {showNewMaterial ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const val = newMaterial.trim();
                    if (val && !materials.includes(val)) {
                      setMaterials([...materials, val]);
                      setMaterial(val);
                    }
                    setNewMaterial('');
                    setShowNewMaterial(false);
                  }
                }}
                placeholder="New material name"
                className="flex-1 px-4 py-2 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                autoFocus
              />
              <button
                type="button"
                onClick={() => {
                  const val = newMaterial.trim();
                  if (val && !materials.includes(val)) {
                    setMaterials([...materials, val]);
                    setMaterial(val);
                  }
                  setNewMaterial('');
                  setShowNewMaterial(false);
                }}
                className="px-4 py-2 bg-gray-900 text-white text-sm rounded-xl hover:bg-gray-800 transition-colors"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => { setNewMaterial(''); setShowNewMaterial(false); }}
                className="px-3 py-2 text-sm text-gray-400 hover:text-gray-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowNewMaterial(true)}
              className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-base leading-none">+</span> Add new material
            </button>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Any keywords to narrow the search…"
            rows={3}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={mutation.isPending || !file || !brand.trim()}
          className="w-full py-3 bg-gray-900 text-white text-sm font-medium rounded-full hover:bg-gray-800 transition-colors disabled:opacity-50"
        >
          {mutation.isPending ? 'Adding…' : 'Add piece & search'}
        </button>
      </form>
    </div>
  );
}
