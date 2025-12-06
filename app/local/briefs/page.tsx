'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  FileTextIcon,
  FilePlusIcon,
  TrashIcon,
  PlayIcon,
  ArrowLeftIcon,
  FileIcon,
  ClockIcon,
  CoinsIcon,
  LayoutGridIcon,
  ListIcon,
  Trash2Icon,
  XIcon,
  CheckIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import type { Brief } from '@/types/brief';
import { formatTokens } from '@/lib/token-counter';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BriefsPage() {
  const router = useRouter();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Mode liste vs grille
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  // Mode sélection batch
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchDeleteDialogOpen, setBatchDeleteDialogOpen] = useState(false);

  useEffect(() => {
    loadBriefs();
  }, []);

  const loadBriefs = async () => {
    try {
      const response = await fetch('/api/briefs');
      if (response.ok) {
        const data = await response.json();
        setBriefs(data);
      }
    } catch (error) {
      console.error('Erreur lors du chargement des briefs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer ce creative plan ? Cette action est irréversible.')) return;
    
    try {
      const response = await fetch(`/api/briefs/${id}`, { method: 'DELETE' });
      if (response.ok) {
        loadBriefs();
      }
    } catch (error) {
      console.error('Erreur lors de la suppression:', error);
    }
  };

  const handleCreateNew = () => {
    router.push('/local/briefs/new');
  };

  // Toggle sélection d'un brief
  const toggleBriefSelection = useCallback((briefId: string) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(briefId)) {
        newSet.delete(briefId);
      } else {
        newSet.add(briefId);
      }
      return newSet;
    });
  }, []);

  // Sélectionner/désélectionner tous
  const toggleSelectAll = useCallback(() => {
    if (selectedIds.size === briefs.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(briefs.map(b => b.id)));
    }
  }, [briefs, selectedIds.size]);

  // Annuler le mode sélection
  const cancelSelectionMode = useCallback(() => {
    setIsSelectionMode(false);
    setSelectedIds(new Set());
  }, []);

  // Confirmer la suppression batch
  const handleBatchDeleteConfirm = useCallback(async () => {
    const idsToDelete = Array.from(selectedIds);
    
    // Supprimer chaque brief via l'API
    for (const id of idsToDelete) {
      try {
        await fetch(`/api/briefs/${id}`, { method: 'DELETE' });
      } catch (error) {
        console.error('Erreur suppression brief:', id, error);
      }
    }
    
    // Recharger la liste
    loadBriefs();
    setBatchDeleteDialogOpen(false);
    cancelSelectionMode();
  }, [selectedIds, cancelSelectionMode]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/local/projects">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeftIcon size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Creative Plans</h1>
              <p className="text-sm text-muted-foreground">
                Créez des creative plans pour générer automatiquement des projets
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Mode sélection actif */}
            {isSelectionMode ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={toggleSelectAll}
                  className="gap-2"
                >
                  <CheckIcon size={14} />
                  {selectedIds.size === briefs.length ? 'Tout désélectionner' : 'Tout sélectionner'}
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setBatchDeleteDialogOpen(true)}
                  disabled={selectedIds.size === 0}
                  className="gap-2"
                >
                  <Trash2Icon size={14} />
                  Supprimer ({selectedIds.size})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelSelectionMode}
                  className="gap-2"
                >
                  <XIcon size={14} />
                  Annuler
                </Button>
              </>
            ) : (
              <>
                {/* Toggle vue grille/liste */}
                <div className="flex items-center rounded-lg border p-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded ${viewMode === 'grid' ? 'bg-accent' : ''}`}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGridIcon size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className={`h-7 w-7 rounded ${viewMode === 'list' ? 'bg-accent' : ''}`}
                    onClick={() => setViewMode('list')}
                  >
                    <ListIcon size={14} />
                  </Button>
                </div>
                
                {/* Bouton mode sélection */}
                {briefs.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setIsSelectionMode(true)}
                    className="gap-2"
                  >
                    <Trash2Icon size={14} />
                    Sélectionner
                  </Button>
                )}
                
                <Button onClick={handleCreateNew} className="gap-2">
                  <FilePlusIcon size={16} />
                  Nouveau Creative Plan
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Chargement...</p>
          </div>
        ) : briefs.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-card/50 p-12 text-center">
            <FilePlusIcon size={48} className="mx-auto mb-4 text-muted-foreground/50" />
            <h2 className="text-lg font-medium mb-2">Aucun creative plan</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Créez votre premier creative plan pour commencer à générer des projets automatiquement
            </p>
            <Button onClick={handleCreateNew} className="gap-2">
              <FilePlusIcon size={16} />
              Créer mon premier creative plan
            </Button>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {briefs.map((brief) => (
              <Card
                key={brief.id}
                className={`group relative overflow-hidden transition-all cursor-pointer ${
                  selectedIds.has(brief.id)
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-border/50 hover:border-border hover:shadow-lg'
                }`}
                onClick={() => isSelectionMode ? toggleBriefSelection(brief.id) : router.push(`/local/briefs/${brief.id}`)}
              >
                {/* Checkbox en mode sélection */}
                {isSelectionMode && (
                  <div 
                    className="absolute top-4 left-4 z-20"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Checkbox
                      checked={selectedIds.has(brief.id)}
                      onCheckedChange={() => toggleBriefSelection(brief.id)}
                      className="h-5 w-5 border-2 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                    />
                  </div>
                )}
                
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative p-6">
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    <StatusBadge status={brief.status} />
                  </div>

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4 ${isSelectionMode ? 'ml-8' : ''}`}>
                    <FileIcon size={24} className="text-violet-400" />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold mb-2 line-clamp-1">{brief.name}</h3>
                  
                  {/* Description */}
                  {brief.description && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {brief.description}
                    </p>
                  )}

                  {/* Stats */}
                  <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <FileTextIcon size={12} />
                      {brief.documents?.length || 0} docs
                    </div>
                    <div className="flex items-center gap-1">
                      <CoinsIcon size={12} />
                      {formatTokens(brief.totalTokens)}
                    </div>
                    {brief.estimatedCost && (
                      <div className="flex items-center gap-1 text-emerald-400">
                        ~{brief.estimatedCost}
                      </div>
                    )}
                  </div>

                  {/* Date */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <ClockIcon size={12} />
                    {format(new Date(brief.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </div>

                  {/* Actions */}
                  {!isSelectionMode && (
                    <div className="flex gap-2 mt-4 pt-4 border-t border-border/30">
                      {brief.status === 'ready' || brief.status === 'draft' ? (
                        <Button
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/local/briefs/${brief.id}/generate`);
                          }}
                        >
                          <PlayIcon size={14} />
                          Générer
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(brief.id);
                        }}
                        className="text-destructive hover:text-destructive"
                      >
                        <TrashIcon size={14} />
                      </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          /* Mode Liste */
          <div className="space-y-2">
            {briefs.map((brief) => (
              <div
                key={brief.id}
                className={`group flex items-center gap-4 rounded-xl border p-4 transition-all cursor-pointer ${
                  selectedIds.has(brief.id)
                    ? 'border-red-500/50 bg-red-500/10'
                    : 'border-border/50 hover:border-border hover:bg-accent/50'
                }`}
                onClick={() => isSelectionMode ? toggleBriefSelection(brief.id) : router.push(`/local/briefs/${brief.id}`)}
              >
                {/* Checkbox en mode sélection */}
                {isSelectionMode && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.has(brief.id)}
                      onCheckedChange={() => toggleBriefSelection(brief.id)}
                      className="h-5 w-5 border-2 data-[state=checked]:bg-red-500 data-[state=checked]:border-red-500"
                    />
                  </div>
                )}
                
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0">
                  <FileIcon size={20} className="text-violet-400" />
                </div>
                
                {/* Infos principales */}
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold truncate group-hover:text-violet-400 transition-colors">
                    {brief.name}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(brief.createdAt), 'dd MMM yyyy', { locale: fr })}
                  </p>
                </div>
                
                {/* Stats rapides */}
                <div className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileTextIcon size={12} />
                    {brief.documents?.length || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <CoinsIcon size={12} />
                    {formatTokens(brief.totalTokens)}
                  </span>
                  {brief.estimatedCost && (
                    <span className="text-emerald-400">~{brief.estimatedCost}</span>
                  )}
                </div>
                
                {/* Status */}
                <StatusBadge status={brief.status} />
                
                {/* Actions */}
                {!isSelectionMode && (
                  <div className="flex items-center gap-2">
                    {(brief.status === 'ready' || brief.status === 'draft') && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/local/briefs/${brief.id}/generate`);
                        }}
                        className="gap-1"
                      >
                        <PlayIcon size={14} />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(brief.id);
                      }}
                      className="text-destructive hover:text-destructive"
                    >
                      <TrashIcon size={14} />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Batch Delete Dialog */}
      <Dialog open={batchDeleteDialogOpen} onOpenChange={setBatchDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">
              Supprimer {selectedIds.size} creative plan{selectedIds.size > 1 ? 's' : ''} ?
            </DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Êtes-vous sûr de vouloir supprimer ces {selectedIds.size} creative plan{selectedIds.size > 1 ? 's' : ''} ?
            <br />
            <span className="text-destructive font-medium">Cette action est irréversible.</span>
          </p>
          <div className="max-h-40 overflow-y-auto rounded-lg bg-muted/50 p-3 space-y-1">
            {briefs.filter(b => selectedIds.has(b.id)).map(b => (
              <div key={b.id} className="text-sm flex items-center gap-2">
                <TrashIcon size={12} className="text-destructive" />
                {b.name}
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBatchDeleteDialogOpen(false)}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleBatchDeleteConfirm}>
              Supprimer tout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composant pour le badge de status
function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'draft':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
          Brouillon
        </span>
      );
    case 'ready':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
          Prêt
        </span>
      );
    case 'generating':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30">
          Génération...
        </span>
      );
    case 'completed':
      return (
        <span className="px-2 py-1 text-xs rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/30">
          Terminé
        </span>
      );
    default:
      return null;
  }
}

