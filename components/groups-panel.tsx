'use client';

/**
 * Panneau latéral pour accéder aux groupes sauvegardés
 * S'ouvre depuis une icône dans le Controls
 */

import {
  getSavedGroups,
  deleteSavedGroup,
  renameSavedGroup,
  prepareGroupNodesForCanvas,
  type SavedGroup,
} from '@/lib/groups-store';
import { useReactFlow } from '@xyflow/react';
import type { Node, Edge } from '@xyflow/react';
import {
  BoxesIcon,
  MoreHorizontalIcon,
  SearchIcon,
  Trash2Icon,
  PencilIcon,
  XIcon,
} from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

type GroupsPanelProps = {
  isOpen: boolean;
  onClose: () => void;
};

export const GroupsPanel = ({ isOpen, onClose }: GroupsPanelProps) => {
  const { getViewport, setNodes, setEdges, getNodes, getEdges } = useReactFlow();
  const [groups, setGroups] = useState<SavedGroup[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'featured' | 'my'>('my');
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [hoveredGroupId, setHoveredGroupId] = useState<string | null>(null);

  // Charger les groupes
  useEffect(() => {
    if (isOpen) {
      setGroups(getSavedGroups());
    }
  }, [isOpen]);

  // Filtrer les groupes selon la recherche
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Ajouter un groupe au canvas
  const handleAddGroup = useCallback(
    (group: SavedGroup) => {
      const viewport = getViewport();
      
      // Calculer le centre du viewport
      const centerX =
        -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
      const centerY =
        -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;

      // Préparer les nœuds et edges
      const { nodes: newNodes, edges: newEdges } = prepareGroupNodesForCanvas(
        group,
        { x: centerX - 200, y: centerY - 150 }
      );

      // Désélectionner tous les nœuds existants
      setNodes((nodes: Node[]) =>
        [...nodes.map((n: Node) => ({ ...n, selected: false })), ...newNodes]
      );
      
      // Ajouter les edges
      setEdges((edges: Edge[]) => [...edges, ...newEdges]);

      toast.success(`Groupe "${group.name}" ajouté !`);
      onClose();
    },
    [getViewport, setNodes, setEdges, onClose]
  );

  // Renommer un groupe
  const handleRename = useCallback(
    (id: string) => {
      if (renameValue.trim()) {
        renameSavedGroup(id, renameValue.trim());
        setGroups(getSavedGroups());
        toast.success('Groupe renommé');
      }
      setRenamingId(null);
    },
    [renameValue]
  );

  // Supprimer un groupe
  const handleDelete = useCallback((id: string, name: string) => {
    deleteSavedGroup(id);
    setGroups(getSavedGroups());
    toast.success(`Groupe "${name}" supprimé`);
  }, []);

  // Démarrer le renommage
  const startRename = useCallback((group: SavedGroup) => {
    setRenamingId(group.id);
    setRenameValue(group.name);
  }, []);

  if (!isOpen) return null;

  return (
    <div className="absolute left-16 top-0 bottom-0 z-[100] w-80 border-r bg-card/98 backdrop-blur-md shadow-xl flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-2 flex-1">
          <SearchIcon size={16} className="text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search Groups..."
            className="h-8 flex-1 bg-transparent border-0 focus-visible:ring-0 px-0"
          />
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={onClose}
        >
          <XIcon size={16} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('featured')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'featured'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Featured
        </button>
        <button
          onClick={() => setActiveTab('my')}
          className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
            activeTab === 'my'
              ? 'text-foreground border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          My Groups
        </button>
      </div>

      {/* Groups List */}
      <div className="flex-1 overflow-y-auto p-2">
        {activeTab === 'featured' ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <BoxesIcon size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              Les groupes en vedette seront bientôt disponibles
            </p>
          </div>
        ) : filteredGroups.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <BoxesIcon size={48} className="text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              {searchQuery
                ? 'Aucun groupe trouvé'
                : 'Pas encore de groupes sauvegardés'}
            </p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Sélectionnez plusieurs nœuds et cliquez sur "Sauvegarder"
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {filteredGroups.map((group) => (
              <div
                key={group.id}
                className="flex items-center gap-3 p-3 rounded-lg hover:bg-accent/50 transition-colors cursor-pointer group"
                onMouseEnter={() => setHoveredGroupId(group.id)}
                onMouseLeave={() => setHoveredGroupId(null)}
                onClick={() => handleAddGroup(group)}
              >
                {/* Icône avec couleur */}
                <div
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                  style={{ backgroundColor: `${group.color}20` }}
                >
                  <BoxesIcon size={20} style={{ color: group.color }} />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  {renamingId === group.id ? (
                    <Input
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRename(group.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleRename(group.id);
                        if (e.key === 'Escape') setRenamingId(null);
                      }}
                      className="h-7 text-sm"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <>
                      <p className="font-medium text-sm truncate">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.nodeCount} Nodes
                      </p>
                    </>
                  )}
                </div>

                {/* Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreHorizontalIcon size={16} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-32">
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        startRename(group);
                      }}
                    >
                      <PencilIcon size={14} className="mr-2" />
                      Rename
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(group.id, group.name);
                      }}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2Icon size={14} className="mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

