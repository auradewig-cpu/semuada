import { createContext, useContext, useMemo } from 'react';
import { useCategories } from '@/hooks/useProductQueries';
import { slugify } from '@/lib/utils';
import type { CategoryHierarchy } from '@/types';

interface CategoryContextType {
  hierarchy: CategoryHierarchy;
  categorySlugMap: Map<string, string>;
  subcategorySlugMap: Map<string, string>;
  isLoading: boolean;
}

const CategoryContext = createContext<CategoryContextType | undefined>(undefined);

export function CategoryProvider({ children }: { children: React.ReactNode }) {
  const { data: rawHierarchy, isLoading } = useCategories();

  // useCategories() returns the raw JSON shape (RSC-hydration-safe); build
  // the Map<Set> shape this context exposes here instead of inside the
  // query, so nothing downstream (FilterSidebar, Home's footer) needs to
  // change.
  const hierarchy = useMemo(() => {
    const map = new Map<string, Set<string>>();
    if (!rawHierarchy) return map;
    for (const [category, subcategories] of Object.entries(rawHierarchy)) {
      map.set(category, new Set(subcategories));
    }
    return map;
  }, [rawHierarchy]);

  const categorySlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const categoryName of hierarchy.keys()) {
      map.set(slugify(categoryName), categoryName);
    }
    return map;
  }, [hierarchy]);

  const subcategorySlugMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const subcategories of hierarchy.values()) {
      for (const subcategoryName of subcategories) {
        map.set(slugify(subcategoryName), subcategoryName);
      }
    }
    return map;
  }, [hierarchy]);

  const value = {
    hierarchy,
    categorySlugMap,
    subcategorySlugMap,
    isLoading,
  };

  return (
    <CategoryContext.Provider value={value}>
      {children}
    </CategoryContext.Provider>
  );
}

export function useCategoryContext() {
  const context = useContext(CategoryContext);
  if (context === undefined) {
    throw new Error('useCategoryContext must be used within a CategoryProvider');
  }
  return context;
}