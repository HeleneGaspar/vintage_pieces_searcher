import { useMemo } from 'react';

interface FilterBarProps {
  brands: string[];
  categories: string[];
  selectedBrand: string;
  selectedCategory: string;
  onBrandChange: (brand: string) => void;
  onCategoryChange: (category: string) => void;
}

export default function FilterBar({
  brands,
  categories,
  selectedBrand,
  selectedCategory,
  onBrandChange,
  onCategoryChange,
}: FilterBarProps) {
  const sortedBrands = useMemo(() => [...brands].sort(), [brands]);
  const sortedCategories = useMemo(() => [...categories].sort(), [categories]);
  const hasFilters = selectedBrand || selectedCategory;

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <select
        value={selectedBrand}
        onChange={(e) => onBrandChange(e.target.value)}
        className="px-3.5 py-2 rounded-full border border-gray-200 text-sm bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
      >
        <option value="">All brands</option>
        {sortedBrands.map((b) => (
          <option key={b} value={b}>{b}</option>
        ))}
      </select>

      <select
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        className="px-3.5 py-2 rounded-full border border-gray-200 text-sm bg-white appearance-none pr-8 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%239ca3af' d='M3 4.5l3 3 3-3'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
      >
        <option value="">All categories</option>
        {sortedCategories.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {hasFilters && (
        <button
          onClick={() => { onBrandChange(''); onCategoryChange(''); }}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
        >
          Clear filters
        </button>
      )}
    </div>
  );
}
