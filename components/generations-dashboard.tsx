'use client';

import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  getGenerations,
  getGenerationsStats,
  deleteGeneration,
  clearGenerations,
  type Generation,
} from '@/lib/generations-store';
import { download } from '@/lib/download';
import {
  DownloadIcon,
  TrashIcon,
  ImageIcon,
  VideoIcon,
  FileTextIcon,
  AudioWaveformIcon,
  CodeIcon,
  RefreshCwIcon,
  TrendingUpIcon,
  ClockIcon,
  CheckCircleIcon,
  XCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  FilterIcon,
  EyeIcon,
  ExternalLinkIcon,
  SparklesIcon,
  ZapIcon,
  SendIcon,
} from 'lucide-react';
import { useEffect, useState, useMemo } from 'react';

// Icônes par type
const typeIcons: Record<string, typeof ImageIcon> = {
  text: FileTextIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioWaveformIcon,
  code: CodeIcon,
};

// Couleurs par type
const typeStyles: Record<string, { bg: string; text: string; border: string; glow: string }> = {
  text: { 
    bg: 'bg-sky-500/10', 
    text: 'text-sky-400', 
    border: 'border-sky-500/30',
    glow: 'shadow-sky-500/20'
  },
  image: { 
    bg: 'bg-[#00ff41]/10', 
    text: 'text-[#00ff41]', 
    border: 'border-[#00ff41]/30',
    glow: 'shadow-[#00ff41]/20'
  },
  video: { 
    bg: 'bg-fuchsia-500/10', 
    text: 'text-fuchsia-400', 
    border: 'border-fuchsia-500/30',
    glow: 'shadow-fuchsia-500/20'
  },
  audio: { 
    bg: 'bg-emerald-500/10', 
    text: 'text-emerald-400', 
    border: 'border-emerald-500/30',
    glow: 'shadow-emerald-500/20'
  },
  code: { 
    bg: 'bg-amber-500/10', 
    text: 'text-amber-400', 
    border: 'border-amber-500/30',
    glow: 'shadow-amber-500/20'
  },
};

// Types pour le tri
type SortField = 'createdAt' | 'type' | 'model' | 'duration' | 'cost';
type SortDirection = 'asc' | 'desc';

// Formater la date
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// Formater l'heure avec secondes
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// Formater la durée
function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

// Formater le coût en euros
function formatCost(cost: number): string {
  if (cost === 0) return '0 €';
  if (cost < 0.001) return '< 0.001 €';
  if (cost < 0.01) return `${cost.toFixed(4)} €`;
  return `${cost.toFixed(3)} €`;
}

// Formater les nombres grands
function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function GenerationsDashboard() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [stats, setStats] = useState<ReturnType<typeof getGenerationsStats> | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [itemsToShow, setItemsToShow] = useState(10);
  const [isExpanded, setIsExpanded] = useState(true);

  // Charger les données
  const loadData = () => {
    setGenerations(getGenerations());
    setStats(getGenerationsStats());
  };

  useEffect(() => {
    loadData();
    
    // Écouter les nouvelles générations
    const handleNewGeneration = () => loadData();
    window.addEventListener('tersa-generation-added', handleNewGeneration);
    
    return () => {
      window.removeEventListener('tersa-generation-added', handleNewGeneration);
    };
  }, []);

  // Filtrer et trier les générations
  const processedGenerations = useMemo(() => {
    let filtered = filter === 'all' 
      ? generations 
      : generations.filter(g => g.type === filter);
    
    // Trier
    filtered = [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      switch (sortField) {
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'model':
          aVal = a.model;
          bVal = b.model;
          break;
        case 'duration':
          aVal = a.duration;
          bVal = b.duration;
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        default:
          return 0;
      }
      
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal) 
          : bVal.localeCompare(aVal);
      }
      
      return sortDirection === 'asc' 
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });
    
    return filtered;
  }, [generations, filter, sortField, sortDirection]);

  // Générations visibles (pagination)
  const visibleGenerations = processedGenerations.slice(0, itemsToShow);

  // Supprimer une génération
  const handleDelete = (id: string) => {
    if (confirm('Supprimer cette génération ?')) {
      deleteGeneration(id);
      loadData();
    }
  };

  // Tout supprimer
  const handleClearAll = () => {
    if (confirm('Supprimer TOUTES les générations ? Cette action est irréversible.')) {
      clearGenerations();
      loadData();
    }
  };

  // Télécharger
  const handleDownload = (gen: Generation) => {
    if (gen.outputUrl) {
      const ext = gen.type === 'video' ? 'mp4' : gen.type === 'audio' ? 'mp3' : 'png';
      download({ url: gen.outputUrl, type: `${gen.type}/${ext}` }, gen.id, ext);
    }
  };

  // Prévisualiser
  const handlePreview = (gen: Generation) => {
    if (gen.outputUrl) {
      window.open(gen.outputUrl, '_blank');
    }
  };

  // Gérer le tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Afficher l'icône de tri
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUpIcon size={14} className="inline ml-1" />
      : <ChevronDownIcon size={14} className="inline ml-1" />;
  };

  return (
    <div className="mb-10">
      {/* Header du dashboard */}
      <div className="flex items-center justify-between mb-6">
        <button 
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-3 group"
        >
          <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-[#00ff41]/20 to-fuchsia-500/20 border border-[#00ff41]/30">
            <SparklesIcon size={18} className="text-[#00ff41]" />
          </div>
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              Tableau de bord
              {isExpanded 
                ? <ChevronUpIcon size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                : <ChevronDownIcon size={18} className="text-muted-foreground group-hover:text-foreground transition-colors" />
              }
            </h2>
            <p className="text-sm text-muted-foreground">
              {stats?.total || 0} génération{(stats?.total || 0) > 1 ? 's' : ''} • {formatCost(stats?.totalCost || 0)} total
            </p>
          </div>
        </button>
        
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={loadData} className="gap-1.5">
            <RefreshCwIcon size={14} />
            <span className="hidden sm:inline">Actualiser</span>
          </Button>
          {generations.length > 0 && (
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleClearAll} 
              className="gap-1.5 text-destructive hover:text-destructive"
            >
              <TrashIcon size={14} />
              <span className="hidden sm:inline">Tout effacer</span>
            </Button>
          )}
        </div>
      </div>

      {isExpanded && (
        <>
          {/* Stats Cards */}
          {stats && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Total */}
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-[#00ff41]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <TrendingUpIcon size={14} />
                    Générations
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{formatNumber(stats.total)}</div>
                  <div className="flex gap-2 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-emerald-400">
                      <CheckCircleIcon size={12} />
                      {stats.success}
                    </span>
                    {stats.error > 0 && (
                      <span className="flex items-center gap-1 text-rose-400">
                        <XCircleIcon size={12} />
                        {stats.error}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Coût total */}
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    Coût estimé
                  </div>
                  <div className="text-3xl font-bold tabular-nums text-emerald-400">
                    {stats.totalCost.toFixed(2)} €
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    ~{(stats.totalCost / Math.max(stats.total, 1)).toFixed(4)} €/gen
                  </div>
                </div>
              </div>
              
              {/* Temps total */}
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <ClockIcon size={14} />
                    Temps total
                  </div>
                  <div className="text-3xl font-bold tabular-nums">{formatDuration(stats.totalDuration)}</div>
                  <div className="text-xs text-muted-foreground mt-2">
                    ~{formatDuration(stats.totalDuration / Math.max(stats.total, 1))}/gen
                  </div>
                </div>
              </div>
              
              {/* Par type */}
              <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="relative">
                  <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                    <ZapIcon size={14} />
                    Par type
                  </div>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {Object.entries(stats.byType).map(([type, count]) => {
                      if (count === 0) return null;
                      const style = typeStyles[type];
                      const Icon = typeIcons[type];
                      return (
                        <span 
                          key={type} 
                          className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${style.bg} ${style.text} ${style.border}`}
                        >
                          <Icon size={10} />
                          {count}
                        </span>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Filtres */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground mr-2">
              <FilterIcon size={14} />
              Filtrer:
            </div>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-8 rounded-full"
            >
              Tous
            </Button>
            {['text', 'image', 'video', 'audio', 'code'].map((type) => {
              const Icon = typeIcons[type];
              const style = typeStyles[type];
              const count = stats?.byType[type as keyof typeof stats.byType] || 0;
              if (count === 0) return null;
              return (
                <Button
                  key={type}
                  variant={filter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(type)}
                  className={`h-8 rounded-full gap-1.5 ${filter === type ? '' : `${style.text} hover:${style.bg}`}`}
                >
                  <Icon size={12} />
                  {type.charAt(0).toUpperCase() + type.slice(1)}
                  <span className="text-xs opacity-60">({count})</span>
                </Button>
              );
            })}
          </div>

          {/* État vide */}
          {generations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border/50 bg-card/50 p-12 text-center">
              <div className="flex justify-center mb-4">
                <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-muted/50">
                  <SparklesIcon size={28} className="text-muted-foreground" />
                </div>
              </div>
              <h3 className="text-lg font-medium mb-2">Aucune génération</h3>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Les générations d&apos;images, vidéos, audio et texte apparaîtront ici automatiquement avec toutes leurs informations.
              </p>
            </div>
          ) : (
          /* Tableau des générations */
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[60px]">Aperçu</TableHead>
                  <TableHead>Nom</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('type')}
                  >
                    Type <SortIcon field="type" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('model')}
                  >
                    Modèle <SortIcon field="model" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('createdAt')}
                  >
                    Date <SortIcon field="createdAt" />
                  </TableHead>
                  <TableHead>Heure</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('duration')}
                  >
                    Durée <SortIcon field="duration" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => handleSort('cost')}
                  >
                    Coût <SortIcon field="cost" />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-center">DVR</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleGenerations.map((gen) => {
                  const Icon = typeIcons[gen.type] || FileTextIcon;
                  const style = typeStyles[gen.type] || typeStyles.text;
                  
                  // Vérifier si le nom est personnalisé (pas le nom par défaut)
                  const defaultNames = ['Image', 'Video', 'Audio', 'Text', 'Code', 'image', 'video', 'audio', 'text', 'code'];
                  const hasCustomName = gen.nodeName && !defaultNames.includes(gen.nodeName);
                  
                  // Vérifier si on peut afficher un thumbnail
                  const canShowThumbnail = gen.outputUrl && (gen.type === 'image' || gen.type === 'video');
                  
                  return (
                    <TableRow key={gen.id} className="border-border/30">
                      {/* Thumbnail */}
                      <TableCell className="w-[60px] p-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
                          {canShowThumbnail ? (
                            gen.type === 'video' ? (
                              <video
                                src={gen.outputUrl}
                                className="max-w-full max-h-full object-contain"
                                muted
                                playsInline
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={gen.outputUrl}
                                alt=""
                                className="max-w-full max-h-full object-contain"
                              />
                            )
                          ) : (
                            <Icon size={16} className={style.text} />
                          )}
                        </div>
                      </TableCell>
                      
                      {/* Nom */}
                      <TableCell>
                        {hasCustomName ? (
                          <span className="text-sm font-medium">{gen.nodeName}</span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>
                      
                      {/* Type */}
                      <TableCell>
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${style.bg} ${style.text} ${style.border}`}>
                          <Icon size={12} />
                          {gen.type}
                        </span>
                      </TableCell>
                      
                      {/* Modèle */}
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded cursor-help max-w-[150px] truncate inline-block">
                                {gen.modelLabel || gen.model}
                              </span>
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-mono text-xs">{gen.model}</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      
                      {/* Date */}
                      <TableCell className="text-muted-foreground">
                        {formatDate(gen.createdAt)}
                      </TableCell>
                      
                      {/* Heure */}
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(gen.createdAt)}
                      </TableCell>
                      
                      {/* Durée */}
                      <TableCell>
                        <span className="font-mono text-xs">
                          {formatDuration(gen.duration)}
                        </span>
                      </TableCell>
                      
                      {/* Coût */}
                      <TableCell>
                        <span className="font-mono text-xs text-emerald-400">
                          {formatCost(gen.cost)}
                        </span>
                      </TableCell>
                      
                      {/* Status */}
                      <TableCell>
                        {gen.status === 'success' ? (
                          <span className="inline-flex items-center gap-1 text-emerald-400 text-xs">
                            <CheckCircleIcon size={14} />
                            Succès
                          </span>
                        ) : (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center gap-1 text-rose-400 text-xs cursor-help">
                                  <XCircleIcon size={14} />
                                  Erreur
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="max-w-xs">{gen.error || 'Erreur inconnue'}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </TableCell>
                      
                      {/* DVR Status */}
                      <TableCell className="text-center">
                        {gen.dvrTransferred ? (
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img 
                                    src="/dvr-icon.png" 
                                    alt="DVR" 
                                    className="w-5 h-5 object-contain"
                                  />
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Envoyé vers DVR</p>
                                {gen.dvrProject && <p className="text-xs text-muted-foreground">Projet: {gen.dvrProject}</p>}
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted/30">
                            <SendIcon size={12} className="text-muted-foreground/50" />
                          </span>
                        )}
                      </TableCell>
                      
                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          {gen.outputUrl && (
                            <>
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8"
                                      onClick={() => handlePreview(gen)}
                                    >
                                      <EyeIcon size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Prévisualiser</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-8 w-8 text-emerald-400 hover:text-emerald-300"
                                      onClick={() => handleDownload(gen)}
                                    >
                                      <DownloadIcon size={14} />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Télécharger</TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </>
                          )}
                          
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDelete(gen.id)}
                                >
                                  <TrashIcon size={14} />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Supprimer</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination / Load more */}
            {processedGenerations.length > visibleGenerations.length && (
              <div className="border-t border-border/30 p-4 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setItemsToShow(prev => prev + 10)}
                  className="gap-2"
                >
                  <ChevronDownIcon size={16} />
                  Afficher plus ({processedGenerations.length - visibleGenerations.length} restantes)
                </Button>
              </div>
            )}
            
            {/* Footer avec résumé */}
            {visibleGenerations.length > 0 && (
              <div className="border-t border-border/30 px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  Affichage de {visibleGenerations.length} sur {processedGenerations.length} génération{processedGenerations.length > 1 ? 's' : ''}
                  {filter !== 'all' && ` (filtré par ${filter})`}
                </span>
                <span className="flex items-center gap-4">
                  <span>Total affiché: {formatCost(visibleGenerations.reduce((acc, g) => acc + g.cost, 0))}</span>
                  <span>Durée: {formatDuration(visibleGenerations.reduce((acc, g) => acc + g.duration, 0))}</span>
                </span>
              </div>
            )}
          </div>
          )}
        </>
      )}
    </div>
  );
}

