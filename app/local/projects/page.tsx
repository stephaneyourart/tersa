'use client';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  createLocalProject,
  deleteLocalProject,
  duplicateLocalProject,
  formatProjectDate,
  getLocalProjects,
  renameLocalProject,
  type LocalProject,
  type ProjectStats as StoredProjectStats,
} from '@/lib/local-projects-store';
import { 
  BarChart3Icon, 
  CopyIcon, 
  FolderOpenIcon, 
  MoreHorizontalIcon, 
  PencilIcon, 
  PlusIcon, 
  TrashIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  ClockIcon,
  DollarSignIcon,
  HardDriveIcon,
  SparklesIcon,
  CheckCircle2Icon,
  TrendingUpIcon,
  DatabaseIcon,
  Trash2Icon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState, useMemo } from 'react';

// Types pour les stats calculées
interface CalculatedStats {
  // Éléments actuels sur le canvas
  currentImages: number;
  currentVideos: number;
  currentAudios: number;
  currentGenerated: number;
  currentDVR: number;
  totalDuration: number;
  
  // Previews pour mosaïque
  mediaPreviews: string[];
  
  // Modèles utilisés (actuels)
  currentModels: Record<string, number>;
  currentCost: number;
}

interface StorageBreakdown {
  images: { count: number; size: number };
  videos: { count: number; size: number };
  audios: { count: number; size: number };
  total: number;
}

// Extraire les stats calculées d'un projet (éléments actuels)
function extractCalculatedStats(project: LocalProject): CalculatedStats {
  const stats: CalculatedStats = {
    currentImages: 0,
    currentVideos: 0,
    currentAudios: 0,
    currentGenerated: 0,
    currentDVR: 0,
    totalDuration: 0,
    mediaPreviews: [],
    currentModels: {},
    currentCost: 0,
  };

  const nodes = project.data?.nodes || [];
  
  for (const node of nodes) {
    const nodeData = node as { type?: string; data?: Record<string, unknown> };
    const type = nodeData.type;
    const data = nodeData.data || {};

    // Comptage par type
    if (type === 'image' || type === 'image-transform') {
      stats.currentImages++;
      const url = (data.generated?.url || data.content?.url) as string | undefined;
      if (url && stats.mediaPreviews.length < 9) {
        stats.mediaPreviews.push(url);
      }
    } else if (type === 'video' || type === 'video-transform') {
      stats.currentVideos++;
      const duration = (data.duration || data.generated?.duration) as number | undefined;
      if (duration) {
        stats.totalDuration += duration;
      }
      const url = (data.generated?.url || data.content?.url) as string | undefined;
      if (url && stats.mediaPreviews.length < 9) {
        stats.mediaPreviews.push(url);
      }
    } else if (type === 'audio' || type === 'audio-transform') {
      stats.currentAudios++;
    }

    // Stats sur les générations actuelles
    if (data.isGenerated) {
      stats.currentGenerated++;
    }

    // Stats DVR
    if (data.dvrTransferred) {
      stats.currentDVR++;
    }

    // Coûts actuels
    if (typeof data.cost === 'number') {
      stats.currentCost += data.cost;
    }

    // Modèles actuels
    if (data.modelId && typeof data.modelId === 'string') {
      stats.currentModels[data.modelId] = (stats.currentModels[data.modelId] || 0) + 1;
    }
  }

  return stats;
}

// Formater la durée
function formatDuration(seconds: number): string {
  if (seconds === 0) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const mins = Math.floor(seconds / 60);
  const secs = Math.round(seconds % 60);
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hours = Math.floor(mins / 60);
  const remainingMins = mins % 60;
  return `${hours}h ${remainingMins}m`;
}

// Formater le coût
function formatCost(cost: number): string {
  if (cost === 0) return '$0';
  if (cost < 0.001) return '<$0.001';
  if (cost < 0.01) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

// Formater la taille
function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Extraire le service depuis le modelId
function getServiceFromModel(modelId: string): string {
  if (modelId.includes('wavespeed')) return 'WaveSpeed';
  if (modelId.includes('fal')) return 'Fal.ai';
  if (modelId.includes('replicate')) return 'Replicate';
  if (modelId.includes('openai') || modelId.includes('gpt') || modelId.includes('dall-e')) return 'OpenAI';
  if (modelId.includes('runway')) return 'Runway';
  if (modelId.includes('luma')) return 'Luma';
  if (modelId.includes('minimax')) return 'Minimax';
  if (modelId.includes('kling')) return 'Kling';
  return 'Autre';
}

export default function LocalProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<LocalProject | null>(null);
  const [newName, setNewName] = useState('');
  const [storageByProject, setStorageByProject] = useState<Record<string, StorageBreakdown>>({});
  const [globalStorage, setGlobalStorage] = useState<StorageBreakdown | null>(null);

  // Charger les projets au montage
  useEffect(() => {
    setProjects(getLocalProjects());
  }, []);

  // Charger le stockage GLOBAL (fichiers uniques, pas dupliqués)
  useEffect(() => {
    async function loadGlobalStorage() {
      try {
        const response = await fetch('/api/global-storage');
        if (response.ok) {
          const data = await response.json();
          setGlobalStorage(data.breakdown);
        }
      } catch {
        // Ignorer les erreurs
      }
    }
    
    loadGlobalStorage();
  }, [projects]); // Recharger quand les projets changent

  // Charger la taille disque pour chaque projet (pour l'affichage par projet)
  useEffect(() => {
    async function loadStorage() {
      const storage: Record<string, StorageBreakdown> = {};
      
      for (const project of projects) {
        try {
          const response = await fetch('/api/project-storage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodes: project.data?.nodes || [] }),
          });
          
          if (response.ok) {
            const data = await response.json();
            storage[project.id] = data.breakdown;
          }
        } catch {
          // Ignorer les erreurs
        }
      }
      
      setStorageByProject(storage);
    }
    
    if (projects.length > 0) {
      loadStorage();
    }
  }, [projects]);

  // Stats globales
  const globalStats = useMemo(() => {
    let totalCost = 0;
    let totalGenerations = 0;
    let totalDVR = 0;
    const allServices: Record<string, number> = {};

    for (const project of projects) {
      // Stats stockées (historiques)
      if (project.stats) {
        totalCost += project.stats.totalCost || 0;
        totalGenerations += project.stats.totalGenerations || 0;
        totalDVR += project.stats.totalSentToDVR || 0;
        
        for (const [service, cost] of Object.entries(project.stats.costByService || {})) {
          allServices[service] = (allServices[service] || 0) + cost;
        }
      }
    }

    return {
      totalCost,
      totalGenerations,
      totalDVR,
      // Utiliser le stockage global (fichiers uniques) au lieu d'additionner par projet
      totalStorage: globalStorage?.total || 0,
      allServices,
      projectCount: projects.length,
    };
  }, [projects, globalStorage]);

  // Créer un nouveau projet
  const handleNewProject = useCallback(() => {
    const project = createLocalProject();
    router.push(`/local/canvas/${project.id}`);
  }, [router]);

  // Ouvrir un projet
  const handleOpenProject = useCallback((project: LocalProject) => {
    router.push(`/local/canvas/${project.id}`);
  }, [router]);

  // Dupliquer un projet
  const handleDuplicate = useCallback((project: LocalProject) => {
    const duplicated = duplicateLocalProject(project.id);
    if (duplicated) {
      setProjects(getLocalProjects());
    }
  }, []);

  // Ouvrir le dialog de renommage
  const handleRenameClick = useCallback((project: LocalProject) => {
    setSelectedProject(project);
    setNewName(project.name);
    setRenameDialogOpen(true);
  }, []);

  // Confirmer le renommage
  const handleRenameConfirm = useCallback(() => {
    if (selectedProject && newName.trim()) {
      renameLocalProject(selectedProject.id, newName.trim());
      setProjects(getLocalProjects());
    }
    setRenameDialogOpen(false);
    setSelectedProject(null);
  }, [selectedProject, newName]);

  // Ouvrir le dialog de suppression
  const handleDeleteClick = useCallback((project: LocalProject) => {
    setSelectedProject(project);
    setDeleteDialogOpen(true);
  }, []);

  // Confirmer la suppression
  const handleDeleteConfirm = useCallback(() => {
    if (selectedProject) {
      deleteLocalProject(selectedProject.id);
      setProjects(getLocalProjects());
    }
    setDeleteDialogOpen(false);
    setSelectedProject(null);
  }, [selectedProject]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-zinc-950/80 backdrop-blur-xl">
        <div className="container flex h-16 items-center justify-between px-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-white to-zinc-400 bg-clip-text text-transparent">
            Media Conductor
          </h1>
          <div className="flex items-center gap-3">
            <Link href="/local/dashboard">
              <Button variant="outline" className="gap-2 border-white/10 bg-white/5 hover:bg-white/10">
                <BarChart3Icon size={16} />
                Dashboard
              </Button>
            </Link>
            <Button onClick={handleNewProject} className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
              <PlusIcon size={16} />
              Nouveau projet
            </Button>
          </div>
        </div>
      </header>

      {/* Global Stats Bar */}
      {projects.length > 0 && (
        <div className="border-b border-white/5 bg-white/[0.02]">
          <div className="container px-6 py-4">
            <div className="flex items-center justify-between gap-6 overflow-x-auto">
              <div className="flex items-center gap-6">
                <StatBadge icon={<FolderOpenIcon size={14} />} value={globalStats.projectCount} label="projets" />
                <StatBadge icon={<SparklesIcon size={14} />} value={globalStats.totalGenerations} label="générés" color="text-fuchsia-400" />
                <StatBadge icon={<CheckCircle2Icon size={14} />} value={globalStats.totalDVR} label="dans DVR" color="text-orange-400" />
                <StatBadge icon={<HardDriveIcon size={14} />} value={formatSize(globalStats.totalStorage)} label="sur disque" color="text-cyan-400" />
              </div>
              <div className="flex items-center gap-2 text-sm">
                <DollarSignIcon size={14} className="text-emerald-400" />
                <span className="font-mono text-emerald-400 text-lg">{formatCost(globalStats.totalCost)}</span>
                <span className="text-zinc-500">coût total</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="container px-6 py-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-6 rounded-full bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 p-8">
              <FolderOpenIcon size={56} className="text-violet-400" />
            </div>
            <h2 className="mb-3 text-2xl font-semibold text-white">Aucun projet</h2>
            <p className="mb-8 text-zinc-400 max-w-md">
              Créez votre premier projet pour commencer à générer des médias IA
            </p>
            <Button onClick={handleNewProject} size="lg" className="gap-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500">
              <PlusIcon size={20} />
              Créer un projet
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                calculatedStats={extractCalculatedStats(project)}
                storage={storageByProject[project.id]}
                onOpen={handleOpenProject}
                onRename={handleRenameClick}
                onDuplicate={handleDuplicate}
                onDelete={handleDeleteClick}
              />
            ))}
          </div>
        )}
      </main>

      {/* Rename Dialog */}
      <Dialog open={renameDialogOpen} onOpenChange={setRenameDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Renommer le projet</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nom du projet"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            autoFocus
            className="bg-zinc-800 border-white/10"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)} className="border-white/10">
              Annuler
            </Button>
            <Button onClick={handleRenameConfirm}>Renommer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="bg-zinc-900 border-white/10">
          <DialogHeader>
            <DialogTitle>Supprimer le projet ?</DialogTitle>
          </DialogHeader>
          <p className="text-zinc-400">
            Êtes-vous sûr de vouloir supprimer &quot;{selectedProject?.name}&quot; ? Cette action est irréversible.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} className="border-white/10">
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Badge de stat
function StatBadge({ 
  icon, 
  value, 
  label, 
  color = 'text-zinc-300' 
}: { 
  icon: React.ReactNode; 
  value: number | string; 
  label: string; 
  color?: string;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <span className={color}>{icon}</span>
      <span className={`font-semibold ${color}`}>{value}</span>
      <span className="text-zinc-500 text-sm">{label}</span>
    </div>
  );
}

// Composant pour une carte de projet
interface ProjectCardProps {
  project: LocalProject;
  calculatedStats: CalculatedStats;
  storage?: StorageBreakdown;
  onOpen: (project: LocalProject) => void;
  onRename: (project: LocalProject) => void;
  onDuplicate: (project: LocalProject) => void;
  onDelete: (project: LocalProject) => void;
}

function ProjectCard({ project, calculatedStats, storage, onOpen, onRename, onDuplicate, onDelete }: ProjectCardProps) {
  const storedStats = project.stats;
  const totalHistoricalGenerations = storedStats?.totalGenerations || 0;
  const totalDeleted = storedStats?.totalDeleted || 0;
  const totalCost = storedStats?.totalCost || 0;
  const totalDVR = storedStats?.totalSentToDVR || 0;
  
  // Pourcentages
  const retentionPercent = totalHistoricalGenerations > 0 
    ? Math.round(((totalHistoricalGenerations - totalDeleted) / totalHistoricalGenerations) * 100)
    : 0;
  const dvrPercent = totalHistoricalGenerations > 0
    ? Math.round((totalDVR / totalHistoricalGenerations) * 100)
    : 0;

  // Coûts par service
  const costByService = storedStats?.costByService || {};
  const topServices = Object.entries(costByService)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);

  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/5 bg-zinc-900/50 transition-all hover:border-white/10 hover:bg-zinc-900/80">
      {/* Mosaïque / Thumbnail */}
      <div
        className="relative cursor-pointer aspect-[16/9] overflow-hidden"
        onClick={() => onOpen(project)}
      >
        {calculatedStats.mediaPreviews.length > 0 ? (
          <MediaMosaic previews={calculatedStats.mediaPreviews} />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-900">
            <div className="rounded-xl border-2 border-dashed border-white/10 p-10">
              <FolderOpenIcon size={40} className="text-zinc-600" />
            </div>
          </div>
        )}
        
        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-900 via-transparent to-transparent opacity-80" />
        
        {/* Badges media en overlay */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 flex-wrap">
          {calculatedStats.currentImages > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-blue-500/30 px-2.5 py-1 text-xs font-medium text-blue-200 backdrop-blur-sm">
              <ImageIcon size={12} /> {calculatedStats.currentImages}
            </span>
          )}
          {calculatedStats.currentVideos > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-purple-500/30 px-2.5 py-1 text-xs font-medium text-purple-200 backdrop-blur-sm">
              <VideoIcon size={12} /> {calculatedStats.currentVideos}
            </span>
          )}
          {calculatedStats.currentAudios > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-green-500/30 px-2.5 py-1 text-xs font-medium text-green-200 backdrop-blur-sm">
              <MusicIcon size={12} /> {calculatedStats.currentAudios}
            </span>
          )}
          {calculatedStats.totalDuration > 0 && (
            <span className="ml-auto flex items-center gap-1 rounded-full bg-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-200 backdrop-blur-sm">
              <ClockIcon size={12} /> {formatDuration(calculatedStats.totalDuration)}
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        {/* Header with name and menu */}
        <div className="flex items-start justify-between">
          <div 
            className="min-w-0 flex-1 cursor-pointer"
            onClick={() => onOpen(project)}
          >
            <h3 className="truncate text-lg font-semibold text-white group-hover:text-violet-300 transition-colors">
              {project.name}
            </h3>
            <p className="text-sm text-zinc-500">
              {formatProjectDate(project.updatedAt)}
            </p>
          </div>
          
          {/* Menu button */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-8 w-8 shrink-0 text-zinc-400 hover:text-white hover:bg-white/10"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontalIcon size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48 bg-zinc-900 border-white/10">
              <DropdownMenuItem onClick={() => onOpen(project)} className="gap-2">
                <FolderOpenIcon size={16} />
                Ouvrir
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onRename(project)} className="gap-2">
                <PencilIcon size={16} />
                Renommer
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onDuplicate(project)} className="gap-2">
                <CopyIcon size={16} />
                Dupliquer
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-white/10" />
              <DropdownMenuItem 
                onClick={() => onDelete(project)} 
                className="gap-2 text-red-400 focus:text-red-400 focus:bg-red-500/10"
              >
                <TrashIcon size={16} />
                Supprimer
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Stats Section */}
        <div className="space-y-3 pt-3 border-t border-white/5">
          
          {/* Coût total + Breakdown services */}
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <DollarSignIcon size={16} className="text-emerald-400" />
                <span className="text-xl font-bold text-emerald-400 font-mono">
                  {formatCost(totalCost)}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">coût total</p>
            </div>
            
            {/* Breakdown par service */}
            {topServices.length > 0 && (
              <div className="flex flex-wrap gap-1 justify-end">
                {topServices.map(([service, cost]) => (
                  <span 
                    key={service} 
                    className="text-xs bg-zinc-800 text-zinc-400 px-2 py-0.5 rounded"
                  >
                    {service}: {formatCost(cost)}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Statistiques de génération */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-fuchsia-400">
                <SparklesIcon size={12} />
                <span className="font-bold">{totalHistoricalGenerations}</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">générés</p>
            </div>
            
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-cyan-400">
                <DatabaseIcon size={12} />
                <span className="font-bold">{retentionPercent}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">conservés</p>
            </div>
            
            <div className="bg-zinc-800/50 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-orange-400">
                <CheckCircle2Icon size={12} />
                <span className="font-bold">{dvrPercent}%</span>
              </div>
              <p className="text-[10px] text-zinc-500 mt-0.5">dans DVR</p>
            </div>
          </div>

          {/* Espace disque */}
          {storage && storage.total > 0 && (
            <div className="bg-zinc-800/30 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <HardDriveIcon size={14} className="text-cyan-400" />
                  <span className="text-sm font-medium text-white">{formatSize(storage.total)}</span>
                </div>
                <span className="text-xs text-zinc-500">sur disque</span>
              </div>
              
              {/* Barre de répartition */}
              <div className="flex h-2 rounded-full overflow-hidden bg-zinc-700">
                {storage.images.size > 0 && (
                  <div 
                    className="bg-blue-500 transition-all" 
                    style={{ width: `${(storage.images.size / storage.total) * 100}%` }}
                    title={`Images: ${formatSize(storage.images.size)}`}
                  />
                )}
                {storage.videos.size > 0 && (
                  <div 
                    className="bg-purple-500 transition-all" 
                    style={{ width: `${(storage.videos.size / storage.total) * 100}%` }}
                    title={`Vidéos: ${formatSize(storage.videos.size)}`}
                  />
                )}
                {storage.audios.size > 0 && (
                  <div 
                    className="bg-green-500 transition-all" 
                    style={{ width: `${(storage.audios.size / storage.total) * 100}%` }}
                    title={`Audios: ${formatSize(storage.audios.size)}`}
                  />
                )}
              </div>
              
              {/* Légende */}
              <div className="flex items-center gap-3 mt-2 text-[10px]">
                {storage.images.size > 0 && (
                  <span className="flex items-center gap-1 text-blue-400">
                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                    {formatSize(storage.images.size)}
                  </span>
                )}
                {storage.videos.size > 0 && (
                  <span className="flex items-center gap-1 text-purple-400">
                    <span className="w-2 h-2 rounded-full bg-purple-500" />
                    {formatSize(storage.videos.size)}
                  </span>
                )}
                {storage.audios.size > 0 && (
                  <span className="flex items-center gap-1 text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500" />
                    {formatSize(storage.audios.size)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Note si pas de stats historiques */}
          {!storedStats && (
            <p className="text-[10px] text-zinc-600 italic text-center">
              Les stats seront enregistrées à partir de maintenant
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Composant pour la mosaïque d'images
function MediaMosaic({ previews }: { previews: string[] }) {
  const count = previews.length;
  
  if (count === 1) {
    return (
      <div className="h-full w-full">
        <MosaicImage src={previews[0]} />
      </div>
    );
  }
  
  if (count === 2) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5">
        {previews.map((url, i) => (
          <MosaicImage key={i} src={url} />
        ))}
      </div>
    );
  }
  
  if (count === 3) {
    return (
      <div className="grid h-full w-full grid-cols-2 gap-0.5">
        <div className="row-span-2">
          <MosaicImage src={previews[0]} />
        </div>
        <MosaicImage src={previews[1]} />
        <MosaicImage src={previews[2]} />
      </div>
    );
  }
  
  if (count === 4) {
    return (
      <div className="grid h-full w-full grid-cols-2 grid-rows-2 gap-0.5">
        {previews.map((url, i) => (
          <MosaicImage key={i} src={url} />
        ))}
      </div>
    );
  }
  
  // 5+ images : grille 3x3
  return (
    <div className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0.5">
      {previews.slice(0, 9).map((url, i) => (
        <MosaicImage key={i} src={url} />
      ))}
      {count < 9 && Array.from({ length: 9 - count }).map((_, i) => (
        <div key={`empty-${i}`} className="bg-zinc-800" />
      ))}
    </div>
  );
}

// Image de mosaïque avec fallback
function MosaicImage({ src }: { src: string }) {
  const [error, setError] = useState(false);
  const isVideo = src.includes('/videos/') || src.endsWith('.mp4');
  
  if (error || isVideo) {
    return (
      <div className="h-full w-full bg-zinc-800 flex items-center justify-center">
        {isVideo ? (
          <VideoIcon size={20} className="text-zinc-600" />
        ) : (
          <ImageIcon size={20} className="text-zinc-600" />
        )}
      </div>
    );
  }
  
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className="h-full w-full object-cover"
      onError={() => setError(true)}
    />
  );
}
