'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  FilePlusIcon,
  TrashIcon,
  PlayIcon,
  ArrowLeftIcon,
  FileIcon,
  ClockIcon,
  CoinsIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import type { Brief } from '@/types/brief';
import { formatTokens, formatCost } from '@/lib/token-counter';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function BriefsPage() {
  const router = useRouter();
  const [briefs, setBriefs] = useState<Brief[]>([]);
  const [loading, setLoading] = useState(true);

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
          <Button onClick={handleCreateNew} className="gap-2">
            <FilePlusIcon size={16} />
            Nouveau Creative Plan
          </Button>
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
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {briefs.map((brief) => (
              <Card
                key={brief.id}
                className="group relative overflow-hidden border-border/50 hover:border-border hover:shadow-lg transition-all cursor-pointer"
                onClick={() => router.push(`/local/briefs/${brief.id}`)}
              >
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="relative p-6">
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    {brief.status === 'draft' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/10 text-yellow-500 border border-yellow-500/30">
                        Brouillon
                      </span>
                    )}
                    {brief.status === 'ready' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                        Prêt
                      </span>
                    )}
                    {brief.status === 'generating' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/30">
                        Génération...
                      </span>
                    )}
                    {brief.status === 'completed' && (
                      <span className="px-2 py-1 text-xs rounded-full bg-violet-500/10 text-violet-500 border border-violet-500/30">
                        Terminé
                      </span>
                    )}
                  </div>

                  {/* Icon */}
                  <div className="w-12 h-12 rounded-lg bg-violet-500/10 flex items-center justify-center mb-4">
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
                </div>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

