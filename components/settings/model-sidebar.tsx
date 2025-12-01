'use client';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';

interface ModelSidebarProps {
  categories: string[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
  activeCategories: Set<string>;
}

export function ModelSidebar({ 
  categories, 
  selectedCategory, 
  onSelectCategory,
  activeCategories 
}: ModelSidebarProps) {
  return (
    <div className="space-y-1 p-2">
      <Button
        variant={selectedCategory === null ? "secondary" : "ghost"}
        className="w-full justify-start font-normal"
        onClick={() => onSelectCategory(null)}
      >
        Tous les modèles
      </Button>
      
      {categories.map((category) => (
        <Button
          key={category}
          variant={selectedCategory === category ? "secondary" : "ghost"}
          className={cn(
            "w-full justify-between font-normal",
            // Highlight if any model in this category is active (logic to be refined)
            activeCategories.has(category) && "text-primary font-medium"
          )}
          onClick={() => onSelectCategory(category)}
        >
          <span className="capitalize">{category.replace(/-/g, ' ')}</span>
          {activeCategories.has(category) && (
            <div className="h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
      ))}
    </div>
  );
}

