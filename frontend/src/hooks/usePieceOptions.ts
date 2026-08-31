import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getPieces } from '../api/client';

const DEFAULT_CATEGORIES = ['Top', 'Jacket', 'Coat', 'Skirt', 'Dress', 'Trousers'];
const DEFAULT_MATERIALS = ['Leather', 'Silk', 'Satin', 'Wool', 'Nylon', 'Cotton'];

export function usePieceOptions() {
  const { data: pieces } = useQuery({ queryKey: ['pieces'], queryFn: getPieces });

  const categories = useMemo(() => {
    const set = new Set(DEFAULT_CATEGORIES);
    pieces?.forEach((p) => { if (p.category) set.add(p.category); });
    return [...set].sort();
  }, [pieces]);

  const materials = useMemo(() => {
    const set = new Set(DEFAULT_MATERIALS);
    pieces?.forEach((p) => { if (p.material) set.add(p.material); });
    return [...set].sort();
  }, [pieces]);

  return { categories, materials };
}
