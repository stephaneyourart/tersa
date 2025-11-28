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
} from '@/lib/local-projects-store';
import { CopyIcon, FolderOpenIcon, MoreHorizontalIcon, PencilIcon, PlusIcon, TrashIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

export default function LocalProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<LocalProject[]>([]);
  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<LocalProject | null>(null);
  const [newName, setNewName] = useState('');

  // Charger les projets au montage
  useEffect(() => {
    setProjects(getLocalProjects());
  }, []);

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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between px-4">
          <h1 className="text-xl font-semibold">TersaFork</h1>
          <Button onClick={handleNewProject} className="gap-2">
            <PlusIcon size={16} />
            New project
          </Button>
        </div>
      </header>

      {/* Projects Grid */}
      <main className="container px-4 py-8">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mb-4 rounded-full bg-muted p-6">
              <FolderOpenIcon size={48} className="text-muted-foreground" />
            </div>
            <h2 className="mb-2 text-xl font-semibold">No projects yet</h2>
            <p className="mb-6 text-muted-foreground">
              Create your first project to get started
            </p>
            <Button onClick={handleNewProject} size="lg" className="gap-2">
              <PlusIcon size={18} />
              Create project
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rename project</DialogTitle>
          </DialogHeader>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Project name"
            onKeyDown={(e) => e.key === 'Enter' && handleRenameConfirm()}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setRenameDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleRenameConfirm}>Rename</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete project?</DialogTitle>
          </DialogHeader>
          <p className="text-muted-foreground">
            Are you sure you want to delete &quot;{selectedProject?.name}&quot;? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteConfirm}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Composant pour une carte de projet
interface ProjectCardProps {
  project: LocalProject;
  onOpen: (project: LocalProject) => void;
  onRename: (project: LocalProject) => void;
  onDuplicate: (project: LocalProject) => void;
  onDelete: (project: LocalProject) => void;
}

function ProjectCard({ project, onOpen, onRename, onDuplicate, onDelete }: ProjectCardProps) {
  return (
    <div className="group">
      {/* Thumbnail - clickable */}
      <div
        className="cursor-pointer overflow-hidden rounded-xl border border-border/50 bg-card transition-all hover:border-border hover:shadow-lg"
        onClick={() => onOpen(project)}
      >
        <div className="aspect-video w-full overflow-hidden bg-muted">
          {project.thumbnail ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={project.thumbnail}
              alt={project.name}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <div className="rounded-lg border-2 border-dashed border-border/50 p-8">
                <FolderOpenIcon size={32} className="text-muted-foreground/50" />
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Info + Menu */}
      <div className="flex items-start justify-between px-1 py-3">
        <div 
          className="min-w-0 flex-1 cursor-pointer"
          onClick={() => onOpen(project)}
        >
          <h3 className="truncate font-medium">{project.name}</h3>
          <p className="text-sm text-muted-foreground">
            {formatProjectDate(project.updatedAt)}
          </p>
        </div>
        
        {/* Menu button */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontalIcon size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => onOpen(project)} className="gap-2">
              <FolderOpenIcon size={16} />
              Open
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onRename(project)} className="gap-2">
              <PencilIcon size={16} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDuplicate(project)} className="gap-2">
              <CopyIcon size={16} />
              Duplicate
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => onDelete(project)} 
              className="gap-2 text-destructive focus:text-destructive"
            >
              <TrashIcon size={16} />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

