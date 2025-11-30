'use client';

/**
 * Modale de bibliothèque de collections
 * Permet de gérer les catégories et collections sauvegardées
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FolderIcon,
  PlusIcon,
  Trash2Icon,
  PencilIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTextIcon,
  CopyIcon,
  CheckIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getCategories,
  getCollectionsByCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  deleteSavedCollection,
  duplicateCollection,
  DEFAULT_CATEGORY_COLORS,
  type CollectionCategory,
  type SavedCollection,
} from '@/lib/collections-library-store';

type CollectionsLibraryModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectCollection?: (collection: SavedCollection, category: CollectionCategory) => void;
  onCategoryChange?: (category: CollectionCategory) => void;
};

export const CollectionsLibraryModal = ({
  open,
  onOpenChange,
  onSelectCollection,
  onCategoryChange,
}: CollectionsLibraryModalProps) => {
  const [categories, setCategories] = useState<CollectionCategory[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState<string | null>(null);
  const [collections, setCollections] = useState<SavedCollection[]>([]);
  
  // États d'édition
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [showColorPicker, setShowColorPicker] = useState<string | null>(null);

  // Charger les catégories
  const loadCategories = useCallback(() => {
    const cats = getCategories();
    setCategories(cats);
    if (cats.length > 0 && !activeCategoryId) {
      setActiveCategoryId(cats[0].id);
    }
  }, [activeCategoryId]);

  // Charger les collections de la catégorie active
  const loadCollections = useCallback(() => {
    if (activeCategoryId) {
      const cols = getCollectionsByCategory(activeCategoryId);
      setCollections(cols);
    } else {
      setCollections([]);
    }
  }, [activeCategoryId]);

  useEffect(() => {
    if (open) {
      loadCategories();
    }
  }, [open, loadCategories]);

  useEffect(() => {
    loadCollections();
  }, [activeCategoryId, loadCollections]);

  // Créer une catégorie
  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = createCategory(newCategoryName.trim());
    setCategories([...categories, cat]);
    setActiveCategoryId(cat.id);
    setIsAddingCategory(false);
    setNewCategoryName('');
  };

  // Renommer une catégorie
  const handleRenameCategory = (id: string) => {
    if (!editingCategoryName.trim()) {
      setEditingCategoryId(null);
      return;
    }
    const updated = updateCategory(id, { name: editingCategoryName.trim() });
    loadCategories();
    setEditingCategoryId(null);
    if (updated && onCategoryChange) {
      onCategoryChange(updated);
    }
  };

  // Changer la couleur d'une catégorie
  const handleChangeColor = (id: string, color: string) => {
    const updated = updateCategory(id, { color });
    loadCategories();
    setShowColorPicker(null);
    if (updated && onCategoryChange) {
      onCategoryChange(updated);
    }
  };

  // Supprimer une catégorie
  const handleDeleteCategory = (id: string) => {
    if (categories.length <= 1) return; // Garder au moins une catégorie
    deleteCategory(id);
    loadCategories();
    if (activeCategoryId === id) {
      const remaining = categories.filter(c => c.id !== id);
      setActiveCategoryId(remaining[0]?.id || null);
    }
  };

  // Supprimer une collection
  const handleDeleteCollection = (id: string) => {
    deleteSavedCollection(id);
    loadCollections();
  };

  // Dupliquer une collection
  const handleDuplicateCollection = (id: string) => {
    duplicateCollection(id);
    loadCollections();
  };

  // Sélectionner une collection
  const handleSelectCollection = (collection: SavedCollection) => {
    const category = categories.find(c => c.id === collection.categoryId);
    if (category && onSelectCollection) {
      onSelectCollection(collection, category);
      onOpenChange(false);
    }
  };

  const activeCategory = categories.find(c => c.id === activeCategoryId);

  // Compter les types d'items dans une collection
  const getItemCounts = (items: SavedCollection['items']) => {
    return {
      image: items.filter(i => i.type === 'image').length,
      video: items.filter(i => i.type === 'video').length,
      audio: items.filter(i => i.type === 'audio').length,
      text: items.filter(i => i.type === 'text').length,
    };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[900px] p-0 gap-0 overflow-hidden" showCloseButton={false}>
        <div className="flex h-full">
          {/* Sidebar catégories */}
          <div className="w-64 border-r bg-muted/30 flex flex-col">
            <DialogHeader className="p-4 border-b">
              <DialogTitle className="text-base">Bibliothèque</DialogTitle>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto p-2">
              {categories.map((category) => (
                <div
                  key={category.id}
                  className={cn(
                    'group relative flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-colors mb-1',
                    activeCategoryId === category.id
                      ? 'bg-accent'
                      : 'hover:bg-accent/50'
                  )}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  {/* Indicateur couleur */}
                  <div
                    className="w-3 h-3 rounded-full shrink-0 cursor-pointer relative"
                    style={{ backgroundColor: category.color }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowColorPicker(showColorPicker === category.id ? null : category.id);
                    }}
                  >
                    {/* Color picker dropdown */}
                    {showColorPicker === category.id && (
                      <div 
                        className="absolute top-full left-0 mt-1 p-2 bg-popover border rounded-lg shadow-lg z-50 flex flex-wrap gap-1 w-32"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {DEFAULT_CATEGORY_COLORS.map((color) => (
                          <button
                            key={color}
                            className={cn(
                              'w-6 h-6 rounded-full transition-transform hover:scale-110',
                              category.color === color && 'ring-2 ring-primary ring-offset-2'
                            )}
                            style={{ backgroundColor: color }}
                            onClick={() => handleChangeColor(category.id, color)}
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Nom de la catégorie */}
                  {editingCategoryId === category.id ? (
                    <Input
                      value={editingCategoryName}
                      onChange={(e) => setEditingCategoryName(e.target.value)}
                      onBlur={() => handleRenameCategory(category.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRenameCategory(category.id);
                        if (e.key === 'Escape') setEditingCategoryId(null);
                      }}
                      className="h-6 text-sm flex-1"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span className="text-sm flex-1 truncate">{category.name}</span>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingCategoryId(category.id);
                        setEditingCategoryName(category.name);
                      }}
                      className="p-1 rounded hover:bg-background/50"
                    >
                      <PencilIcon size={12} />
                    </button>
                    {categories.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCategory(category.id);
                        }}
                        className="p-1 rounded hover:bg-destructive/20 text-destructive"
                      >
                        <Trash2Icon size={12} />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Ajouter catégorie */}
              {isAddingCategory ? (
                <div className="flex items-center gap-2 px-3 py-2">
                  <FolderIcon size={14} className="text-muted-foreground shrink-0" />
                  <Input
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    onBlur={() => {
                      if (newCategoryName.trim()) {
                        handleCreateCategory();
                      } else {
                        setIsAddingCategory(false);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleCreateCategory();
                      if (e.key === 'Escape') setIsAddingCategory(false);
                    }}
                    placeholder="Nom..."
                    className="h-6 text-sm flex-1"
                    autoFocus
                  />
                </div>
              ) : (
                <button
                  onClick={() => setIsAddingCategory(true)}
                  className="flex items-center gap-2 px-3 py-2 w-full rounded-lg text-muted-foreground hover:bg-accent/50 transition-colors"
                >
                  <PlusIcon size={14} />
                  <span className="text-sm">Nouvelle catégorie</span>
                </button>
              )}
            </div>
          </div>

          {/* Contenu principal - Collections */}
          <div className="flex-1 flex flex-col">
            <div className="p-4 border-b flex items-center justify-between">
              <h3 className="font-medium" style={{ color: activeCategory?.color }}>
                {activeCategory?.name || 'Collections'}
              </h3>
              <span className="text-sm text-muted-foreground">
                {collections.length} collection{collections.length !== 1 ? 's' : ''}
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {collections.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <p className="text-sm">Aucune collection dans cette catégorie</p>
                  <p className="text-xs mt-1 opacity-60">Sauvegardez des collections depuis le canvas</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {collections.map((collection) => {
                    const counts = getItemCounts(collection.items);
                    const firstImage = collection.items.find(i => i.type === 'image' && i.url);
                    
                    return (
                      <div
                        key={collection.id}
                        className="group relative border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer"
                        onClick={() => handleSelectCollection(collection)}
                      >
                        {/* Aperçu carré */}
                        <div className="aspect-square bg-muted/50 flex items-center justify-center">
                          {firstImage?.url ? (
                            <img 
                              src={firstImage.url} 
                              alt="" 
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <span className="text-2xl opacity-30">📁</span>
                          )}
                        </div>

                        {/* Info */}
                        <div className="p-3">
                          <h4 className="font-medium text-sm truncate">{collection.name}</h4>
                          <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                            {counts.image > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <ImageIcon size={10} /> {counts.image}
                              </span>
                            )}
                            {counts.video > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <VideoIcon size={10} /> {counts.video}
                              </span>
                            )}
                            {counts.audio > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <MusicIcon size={10} /> {counts.audio}
                              </span>
                            )}
                            {counts.text > 0 && (
                              <span className="flex items-center gap-0.5 text-xs">
                                <FileTextIcon size={10} /> {counts.text}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Actions au hover */}
                        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDuplicateCollection(collection.id);
                            }}
                            className="p-1.5 rounded bg-background/80 hover:bg-background shadow"
                          >
                            <CopyIcon size={12} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCollection(collection.id);
                            }}
                            className="p-1.5 rounded bg-background/80 hover:bg-destructive/20 text-destructive shadow"
                          >
                            <Trash2Icon size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

// Modale de sélection de catégorie (pour la création de collection)
type CategorySelectModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (category: CollectionCategory) => void;
};

export const CategorySelectModal = ({
  open,
  onOpenChange,
  onSelect,
}: CategorySelectModalProps) => {
  const [categories, setCategories] = useState<CollectionCategory[]>([]);
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  useEffect(() => {
    if (open) {
      setCategories(getCategories());
    }
  }, [open]);

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = createCategory(newCategoryName.trim());
    setCategories([...categories, cat]);
    setIsAddingCategory(false);
    setNewCategoryName('');
    onSelect(cat);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Choisir une catégorie</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-2 mt-4">
          {categories.map((category) => (
            <button
              key={category.id}
              onClick={() => {
                onSelect(category);
                onOpenChange(false);
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border hover:border-primary/50 hover:bg-accent/50 transition-colors"
            >
              <div
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: category.color }}
              />
              <span className="font-medium">{category.name}</span>
            </button>
          ))}

          {/* Ajouter catégorie */}
          {isAddingCategory ? (
            <div className="flex items-center gap-2 px-4 py-2 border rounded-lg">
              <Input
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateCategory();
                  if (e.key === 'Escape') setIsAddingCategory(false);
                }}
                placeholder="Nom de la catégorie..."
                className="h-8 flex-1"
                autoFocus
              />
              <Button size="sm" onClick={handleCreateCategory}>
                <CheckIcon size={14} />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setIsAddingCategory(true)}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-dashed hover:border-primary/50 hover:bg-accent/50 transition-colors text-muted-foreground"
            >
              <PlusIcon size={16} />
              <span>Nouvelle catégorie</span>
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

