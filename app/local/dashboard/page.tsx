'use client';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
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
  deleteGeneration,
  clearGenerations,
  renameGeneration,
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
  ArrowLeftIcon,
  TrendingUpIcon,
  ClockIcon,
  DollarSignIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  PencilIcon,
  EyeIcon,
  XIcon,
  ZapIcon,
  FilterIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CpuIcon,
  FolderOpenIcon,
  HardDriveIcon,
  MoreHorizontalIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState, useMemo } from 'react';
import { format, isWithinInterval, startOfDay, endOfDay, subDays, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { DateRange } from 'react-day-picker';

// Types pour le tri
type SortField = 'createdAt' | 'nodeName' | 'type' | 'model' | 'duration' | 'cost' | 'fileSize' | 'size';
type SortDirection = 'asc' | 'desc';

// Icônes par type
const typeIcons: Record<string, typeof ImageIcon> = {
  text: FileTextIcon,
  image: ImageIcon,
  video: VideoIcon,
  audio: AudioWaveformIcon,
  code: CodeIcon,
};

// Couleurs par type
const typeStyles: Record<string, { bg: string; text: string; border: string }> = {
  text: { bg: 'bg-sky-500/10', text: 'text-sky-400', border: 'border-sky-500/30' },
  image: { bg: 'bg-violet-500/10', text: 'text-violet-400', border: 'border-violet-500/30' },
  video: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  audio: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  code: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
};

// Présets de dates
const datePresets = [
  { label: "Aujourd'hui", getValue: () => ({ from: startOfDay(new Date()), to: endOfDay(new Date()) }) },
  { label: 'Hier', getValue: () => ({ from: startOfDay(subDays(new Date(), 1)), to: endOfDay(subDays(new Date(), 1)) }) },
  { label: '7 derniers jours', getValue: () => ({ from: startOfDay(subDays(new Date(), 6)), to: endOfDay(new Date()) }) },
  { label: '30 derniers jours', getValue: () => ({ from: startOfDay(subDays(new Date(), 29)), to: endOfDay(new Date()) }) },
  { label: 'Cette semaine', getValue: () => ({ from: startOfWeek(new Date(), { locale: fr }), to: endOfWeek(new Date(), { locale: fr }) }) },
  { label: 'Ce mois', getValue: () => ({ from: startOfMonth(new Date()), to: endOfMonth(new Date()) }) },
  { label: 'Mois dernier', getValue: () => ({ from: startOfMonth(subMonths(new Date(), 1)), to: endOfMonth(subMonths(new Date(), 1)) }) },
];

function formatDate(isoString: string): string {
  return format(new Date(isoString), 'dd/MM/yyyy', { locale: fr });
}

function formatTime(isoString: string): string {
  return format(new Date(isoString), 'HH:mm:ss', { locale: fr });
}

function formatDuration(seconds: number): string {
  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  return `${mins}m ${secs}s`;
}

function formatCost(cost: number): string {
  if (cost === 0) return '$0.00';
  if (cost < 0.001) return '< $0.001';
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(3)}`;
}

function formatFileSize(bytes: number | undefined): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function DashboardPage() {
  const [generations, setGenerations] = useState<Generation[]>([]);
  const [filter, setFilter] = useState<string>('all');
  const [modelFilter, setModelFilter] = useState<string>('all');
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [itemsToShow, setItemsToShow] = useState(20);
  
  // État pour le tri
  const [sortField, setSortField] = useState<SortField>('createdAt');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // État pour le renommage
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [selectedGeneration, setSelectedGeneration] = useState<Generation | null>(null);
  const [newName, setNewName] = useState('');

  const loadData = () => {
    setGenerations(getGenerations());
  };

  useEffect(() => {
    loadData();
    
    const handleNewGeneration = () => loadData();
    window.addEventListener('tersa-generation-added', handleNewGeneration);
    
    return () => {
      window.removeEventListener('tersa-generation-added', handleNewGeneration);
    };
  }, []);

  // Liste unique des modèles disponibles
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    generations.forEach(g => {
      if (g.modelLabel || g.model) {
        models.add(g.modelLabel || g.model);
      }
    });
    return Array.from(models).sort();
  }, [generations]);

  // Filtrer et trier les générations
  const filteredGenerations = useMemo(() => {
    let filtered = generations;
    
    // Filtre par type
    if (filter !== 'all') {
      filtered = filtered.filter(g => g.type === filter);
    }
    
    // Filtre par modèle
    if (modelFilter !== 'all') {
      filtered = filtered.filter(g => (g.modelLabel || g.model) === modelFilter);
    }
    
    // Filtre par date
    if (dateRange?.from) {
      filtered = filtered.filter(g => {
        const genDate = new Date(g.createdAt);
        if (dateRange.to) {
          return isWithinInterval(genDate, { 
            start: startOfDay(dateRange.from!), 
            end: endOfDay(dateRange.to) 
          });
        }
        return genDate >= startOfDay(dateRange.from!);
      });
    }
    
    // Trier
    filtered = [...filtered].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;
      
      switch (sortField) {
        case 'createdAt':
          aVal = new Date(a.createdAt).getTime();
          bVal = new Date(b.createdAt).getTime();
          break;
        case 'nodeName':
          aVal = a.nodeName || '';
          bVal = b.nodeName || '';
          break;
        case 'type':
          aVal = a.type;
          bVal = b.type;
          break;
        case 'model':
          aVal = a.modelLabel || a.model;
          bVal = b.modelLabel || b.model;
          break;
        case 'duration':
          aVal = a.duration;
          bVal = b.duration;
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        case 'fileSize':
          aVal = a.fileSize || 0;
          bVal = b.fileSize || 0;
          break;
        case 'size':
          aVal = a.size || '';
          bVal = b.size || '';
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
  }, [generations, filter, modelFilter, dateRange, sortField, sortDirection]);
  
  // Gérer le tri
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Icône de tri
  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null;
    return sortDirection === 'asc' 
      ? <ChevronUpIcon size={14} className="inline ml-1" />
      : <ChevronDownIcon size={14} className="inline ml-1" />;
  };

  // Stats pour l'intervalle sélectionné
  const stats = useMemo(() => {
    const data = filteredGenerations;
    return {
      total: data.length,
      success: data.filter(g => g.status === 'success').length,
      error: data.filter(g => g.status === 'error').length,
      totalCost: data.reduce((acc, g) => acc + (g.cost || 0), 0),
      totalDuration: data.reduce((acc, g) => acc + (g.duration || 0), 0),
      byType: {
        text: data.filter(g => g.type === 'text').length,
        image: data.filter(g => g.type === 'image').length,
        video: data.filter(g => g.type === 'video').length,
        audio: data.filter(g => g.type === 'audio').length,
        code: data.filter(g => g.type === 'code').length,
      },
    };
  }, [filteredGenerations]);

  const visibleGenerations = filteredGenerations.slice(0, itemsToShow);

  const handleDelete = (id: string) => {
    if (confirm('Supprimer cette génération ?')) {
      deleteGeneration(id);
      loadData();
    }
  };

  const handleClearAll = () => {
    if (confirm('Supprimer TOUTES les générations ? Cette action est irréversible.')) {
      clearGenerations();
      loadData();
    }
  };

  const handleDownload = (gen: Generation) => {
    if (gen.outputUrl) {
      const ext = gen.type === 'video' ? 'mp4' : gen.type === 'audio' ? 'mp3' : 'png';
      download({ url: gen.outputUrl, type: `${gen.type}/${ext}` }, gen.id, ext);
    }
  };

  const handlePreview = (gen: Generation) => {
    if (gen.outputUrl) {
      window.open(gen.outputUrl, '_blank');
    }
  };

  const handleRevealInFinder = async (gen: Generation) => {
    if (!gen.outputUrl) {
      alert('Pas d\'URL de fichier disponible');
      return;
    }
    
    console.log('[Reveal] URL envoyée:', gen.outputUrl);
    
    try {
      const response = await fetch('/api/reveal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: gen.outputUrl }),
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        console.error('[Reveal] Erreur:', result);
        alert(`Erreur: ${result.error}\nURL: ${gen.outputUrl}${result.path ? `\nChemin: ${result.path}` : ''}`);
      } else {
        console.log('[Reveal] Succès:', result);
      }
    } catch (error) {
      console.error('[Reveal] Erreur réseau:', error);
      alert(`Erreur réseau\nURL: ${gen.outputUrl}`);
    }
  };

  const handleRenameClick = (gen: Generation) => {
    setSelectedGeneration(gen);
    setNewName(gen.nodeName || '');
    setRenameDialogOpen(true);
  };

  const handleRenameConfirm = () => {
    if (selectedGeneration) {
      renameGeneration(selectedGeneration.id, newName.trim());
      loadData();
    }
    setRenameDialogOpen(false);
    setSelectedGeneration(null);
  };

  const handleDatePreset = (preset: typeof datePresets[0]) => {
    setDateRange(preset.getValue());
    setIsCalendarOpen(false);
  };

  const clearDateFilter = () => {
    setDateRange(undefined);
  };

  // Formatage de l'affichage du range de dates
  const dateRangeLabel = dateRange?.from 
    ? dateRange.to 
      ? `${format(dateRange.from, 'dd MMM', { locale: fr })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: fr })}`
      : format(dateRange.from, 'dd MMM yyyy', { locale: fr })
    : 'Toutes les dates';

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
              <h1 className="text-xl font-bold">Dashboard</h1>
              <p className="text-sm text-muted-foreground">
                Historique des générations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={loadData} className="gap-2">
              <RefreshCwIcon size={14} />
              Actualiser
            </Button>
            {generations.length > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearAll} className="gap-2 text-destructive hover:text-destructive">
                <TrashIcon size={14} />
                Tout effacer
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Date Range Picker */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[240px] justify-start">
                <CalendarIcon size={16} />
                {dateRangeLabel}
                <ChevronDownIcon size={14} className="ml-auto opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                {/* Présets */}
                <div className="border-r border-border p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground mb-2 px-2">Raccourcis</p>
                  {datePresets.map((preset) => (
                    <Button
                      key={preset.label}
                      variant="ghost"
                      size="sm"
                      className="w-full justify-start text-sm"
                      onClick={() => handleDatePreset(preset)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </div>
                {/* Calendrier */}
                <div className="p-3">
                  <Calendar
                    mode="range"
                    selected={dateRange}
                    onSelect={setDateRange}
                    numberOfMonths={2}
                    locale={fr}
                  />
                </div>
              </div>
            </PopoverContent>
          </Popover>
          
          {dateRange && (
            <Button variant="ghost" size="sm" onClick={clearDateFilter} className="gap-1">
              <XIcon size={14} />
              Effacer le filtre
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {/* Total */}
          <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <TrendingUpIcon size={14} />
                Générations
              </div>
              <div className="text-3xl font-bold tabular-nums">{stats.total}</div>
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
          
          {/* Coût */}
          <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <DollarSignIcon size={14} />
                Coût {dateRange ? 'période' : 'total'}
              </div>
              <div className="text-3xl font-bold tabular-nums text-emerald-400">
                ${stats.totalCost.toFixed(2)}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                ~${(stats.totalCost / Math.max(stats.total, 1)).toFixed(4)}/gen
              </div>
            </div>
          </div>
          
          {/* Temps */}
          <div className="group relative overflow-hidden rounded-xl border border-border/50 bg-card p-4 transition-all hover:border-border hover:shadow-lg">
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative">
              <div className="flex items-center gap-2 text-muted-foreground text-sm mb-2">
                <ClockIcon size={14} />
                Temps {dateRange ? 'période' : 'total'}
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

        {/* Filtres */}
        <div className="flex flex-wrap items-center gap-4 mb-4">
          {/* Filtre par type */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <FilterIcon size={14} />
              Type:
            </div>
            <Button
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter('all')}
              className="h-8 rounded-full"
            >
              Tous ({generations.length})
            </Button>
            {['text', 'image', 'video', 'audio', 'code'].map((type) => {
              const Icon = typeIcons[type];
              const style = typeStyles[type];
              const count = generations.filter(g => g.type === type).length;
              if (count === 0) return null;
              return (
                <Button
                  key={type}
                  variant={filter === type ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setFilter(type)}
                  className={`h-8 rounded-full gap-1.5 ${filter === type ? '' : `${style.text}`}`}
                >
                  <Icon size={12} />
                  {type.charAt(0).toUpperCase() + type.slice(1)} ({count})
                </Button>
              );
            })}
          </div>
          
          {/* Filtre par modèle */}
          {availableModels.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CpuIcon size={14} />
                Modèle:
              </div>
              <Select value={modelFilter} onValueChange={setModelFilter}>
                <SelectTrigger className="w-[200px] h-8">
                  <SelectValue placeholder="Tous les modèles" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les modèles</SelectItem>
                  {availableModels.map((model) => (
                    <SelectItem key={model} value={model}>
                      {model}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {modelFilter !== 'all' && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModelFilter('all')}
                  className="h-8 px-2"
                >
                  <XIcon size={14} />
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Tableau */}
        {filteredGenerations.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border/50 bg-card/50 p-12 text-center">
            <p className="text-lg font-medium mb-2">Aucune génération</p>
            <p className="text-sm text-muted-foreground">
              {dateRange ? 'Aucune génération pour cette période.' : 'Les générations apparaîtront ici automatiquement.'}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className="w-[50px]">Aperçu</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('nodeName')}
                  >
                    Nom <SortIcon field="nodeName" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('type')}
                  >
                    Type <SortIcon field="type" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('model')}
                  >
                    Modèle <SortIcon field="model" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('createdAt')}
                  >
                    Date <SortIcon field="createdAt" />
                  </TableHead>
                  <TableHead>Heure</TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('duration')}
                  >
                    Durée <SortIcon field="duration" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('cost')}
                  >
                    Coût <SortIcon field="cost" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('size')}
                  >
                    Résolution <SortIcon field="size" />
                  </TableHead>
                  <TableHead 
                    className="cursor-pointer hover:text-foreground transition-colors select-none"
                    onClick={() => handleSort('fileSize')}
                  >
                    Taille <SortIcon field="fileSize" />
                  </TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visibleGenerations.map((gen) => {
                  const Icon = typeIcons[gen.type] || FileTextIcon;
                  const style = typeStyles[gen.type] || typeStyles.text;
                  const defaultNames = ['Image', 'Video', 'Audio', 'Text', 'Code', 'image', 'video', 'audio', 'text', 'code'];
                  const hasCustomName = gen.nodeName && !defaultNames.includes(gen.nodeName);
                  const canShowThumbnail = gen.outputUrl && (gen.type === 'image' || gen.type === 'video');
                  
                  return (
                    <TableRow key={gen.id} className="border-border/30">
                      {/* Thumbnail */}
                      <TableCell className="w-[50px] p-2">
                        <div className="w-10 h-10 flex items-center justify-center bg-muted/30 rounded-lg overflow-hidden">
                          {canShowThumbnail ? (
                            gen.type === 'video' ? (
                              <video src={gen.outputUrl} className="max-w-full max-h-full object-contain" muted playsInline />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={gen.outputUrl} alt="" className="max-w-full max-h-full object-contain" />
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
                              <span className="font-mono text-xs bg-muted/50 px-2 py-1 rounded cursor-help max-w-[120px] truncate inline-block">
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
                      <TableCell className="text-muted-foreground text-sm">
                        {formatDate(gen.createdAt)}
                      </TableCell>
                      
                      {/* Heure */}
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {formatTime(gen.createdAt)}
                      </TableCell>
                      
                      {/* Durée */}
                      <TableCell>
                        <span className="font-mono text-xs">{formatDuration(gen.duration)}</span>
                      </TableCell>
                      
                      {/* Coût */}
                      <TableCell>
                        <span className="font-mono text-xs text-emerald-400">{formatCost(gen.cost)}</span>
                      </TableCell>
                      
                      {/* Résolution */}
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {gen.size || '—'}
                        </span>
                      </TableCell>
                      
                      {/* Taille */}
                      <TableCell>
                        <span className="font-mono text-xs text-muted-foreground">
                          {formatFileSize(gen.fileSize)}
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
                      
                      {/* Actions */}
                      <TableCell>
                        <div className="flex items-center justify-end">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <MoreHorizontalIcon size={16} />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48">
                              <DropdownMenuItem onClick={() => handleRenameClick(gen)} className="gap-2">
                                <PencilIcon size={14} />
                                Renommer
                              </DropdownMenuItem>
                              {gen.outputUrl && (
                                <>
                                  <DropdownMenuItem onClick={() => handlePreview(gen)} className="gap-2">
                                    <EyeIcon size={14} />
                                    Prévisualiser
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleRevealInFinder(gen)} className="gap-2">
                                    <FolderOpenIcon size={14} />
                                    Révéler dans le Finder
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleDownload(gen)} className="gap-2 text-emerald-400">
                                    <DownloadIcon size={14} />
                                    Télécharger
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                onClick={() => handleDelete(gen.id)} 
                                className="gap-2 text-destructive focus:text-destructive"
                              >
                                <TrashIcon size={14} />
                                Supprimer
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            
            {/* Pagination */}
            {filteredGenerations.length > visibleGenerations.length && (
              <div className="border-t border-border/30 p-4 text-center">
                <Button
                  variant="ghost"
                  onClick={() => setItemsToShow(prev => prev + 20)}
                  className="gap-2"
                >
                  <ChevronDownIcon size={16} />
                  Afficher plus ({filteredGenerations.length - visibleGenerations.length} restantes)
                </Button>
              </div>
            )}
            
            {/* Footer */}
            <div className="border-t border-border/30 px-4 py-3 bg-muted/30 text-xs text-muted-foreground flex items-center justify-between">
              <span>
                Affichage de {visibleGenerations.length} sur {filteredGenerations.length} génération{filteredGenerations.length > 1 ? 's' : ''}
              </span>
              <span className="flex items-center gap-4">
                <span>Total: {formatCost(stats.totalCost)}</span>
                <span>Durée: {formatDuration(stats.totalDuration)}</span>
              </span>
            </div>
          </div>
        )}
      </main>

      {/* Dialog de renommage */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Renommer la génération</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom de la génération"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleRenameConfirm}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
