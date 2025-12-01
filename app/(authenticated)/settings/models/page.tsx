'use client';

import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Search, ArrowLeft } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ModelList } from '@/components/settings/model-list';
import { ModelSidebar } from '@/components/settings/model-sidebar';
import modelsData from '@/lib/data/wavespeed-models.json';

export type WaveSpeedModel = typeof modelsData.data.items[0];

export default function ModelsSettingsPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [activeCategories, setActiveCategories] = useState<Set<string>>(new Set());

  // Extract unique categories (types) and families
  const categories = Array.from(new Set(modelsData.data.items.map(m => m.type))).sort();

  return (
    <div className="flex h-[calc(100vh-4rem)] w-full overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r bg-muted/10 hidden md:block">
        <div className="p-4 font-semibold text-lg tracking-tight">Catégories</div>
        <ModelSidebar 
          categories={categories} 
          selectedCategory={selectedCategory} 
          onSelectCategory={setSelectedCategory}
          activeCategories={activeCategories}
        />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header / Search */}
        <div className="p-6 border-b space-y-4 flex-shrink-0 bg-background z-10">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold tracking-tight">Modèles</h1>
            <Button variant="outline" size="sm" onClick={() => router.back()} className="gap-2">
              <ArrowLeft size={16} />
              Retour
            </Button>
          </div>
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search model..." 
              className="pl-9 bg-muted/50" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* Scrollable List Container */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-6xl mx-auto pb-20">
            <ModelList 
              models={modelsData.data.items} 
              searchQuery={searchQuery}
              selectedCategory={selectedCategory}
              onActiveCategoriesChange={setActiveCategories}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

