'use client';

import { nodeButtons } from '@/lib/node-buttons';
import { useNodeOperations } from '@/providers/node-operations';
import { Panel, useReactFlow } from '@xyflow/react';
import { memo, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { LibraryIcon, SquareIcon, TypeIcon, Trash2Icon, SettingsIcon, BrainCircuitIcon } from 'lucide-react';
import { CollectionsLibraryModal } from './collections-library-modal';
import type { SavedCollection, CollectionCategory } from '@/lib/collections-library-store';
import { useCleanupMode } from '@/providers/cleanup-mode';
import { ProjectSettingsDialog } from './project-settings';
import { useProject } from '@/providers/project';
import Link from 'next/link';

export const ToolbarInner = () => {
  const { getViewport, getNodes, setNodes } = useReactFlow();
  const { addNode } = useNodeOperations();
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const { startCleanupMode } = useCleanupMode();
  const project = useProject();

  const handleAddNode = (type: string, options?: Record<string, unknown>) => {
    // Get the current viewport
    const viewport = getViewport();

    // Calculate the center of the current viewport
    const centerX =
      -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
    const centerY =
      -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;

    const position = { x: centerX, y: centerY };
    const { data: nodeData, ...rest } = options ?? {};

    addNode(type, {
      position,
      data: {
        ...(nodeData ? nodeData : {}),
      },
      ...rest,
    });
  };

  // Insérer une collection depuis la bibliothèque
  const handleSelectCollection = (collection: SavedCollection, category: CollectionCategory) => {
    const viewport = getViewport();
    const centerX =
      -viewport.x / viewport.zoom + window.innerWidth / 2 / viewport.zoom;
    const centerY =
      -viewport.y / viewport.zoom + window.innerHeight / 2 / viewport.zoom;

    addNode('collection', {
      position: { x: centerX, y: centerY },
      data: {
        label: collection.name,
        items: collection.items,
        presets: collection.presets,
        headerColor: category.color,
        categoryId: category.id,
      },
    });
  };

  // Mettre à jour les nœuds du canvas quand une catégorie change
  const handleCategoryChange = useCallback((category: CollectionCategory) => {
    setNodes((nodes) =>
      nodes.map((node) => {
        if (node.type === 'collection') {
          const data = node.data as { categoryId?: string };
          if (data.categoryId === category.id) {
            return {
              ...node,
              data: {
                ...node.data,
                headerColor: category.color,
              },
            };
          }
        }
        return node;
      })
    );
  }, [setNodes]);

  return (
    <>
      <Panel
        position="bottom-center"
        className="z-50 m-4 mb-8 flex items-center rounded-full border bg-card/90 p-2 drop-shadow-xs backdrop-blur-sm"
      >
        {nodeButtons.map((button) => (
          <Tooltip key={button.id}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-11 w-11"
                onClick={() => handleAddNode(button.id, button.data)}
              >
                <button.icon size={20} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{button.label}</TooltipContent>
          </Tooltip>
        ))}

        {/* Séparateur */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Bouton Rectangle - crée directement au centre */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={() => {
                handleAddNode('shape', { 
                  data: { 
                    color: '#1e3a5f', // Bleu foncé
                    opacity: 100,
                    borderRadius: 0,
                  },
                  style: { width: 300, height: 200, zIndex: -1000 },
                  zIndex: -1000, // Arrière-plan par défaut
                });
              }}
            >
              <SquareIcon size={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Rectangle</TooltipContent>
        </Tooltip>

        {/* Bouton Texte - crée directement au centre */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={() => {
                handleAddNode('label', { 
                  data: { 
                    text: 'Texte',
                    color: '#ffffff', // Blanc par défaut
                    fontSize: 32,
                  },
                  zIndex: 10000, // Premier plan par défaut
                });
              }}
            >
              <TypeIcon size={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Texte</TooltipContent>
        </Tooltip>

        {/* Séparateur */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Bouton bibliothèque de collections */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={() => setLibraryOpen(true)}
            >
              <LibraryIcon size={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Bibliothèque de collections</TooltipContent>
        </Tooltip>

        {/* Séparateur */}
        <div className="w-px h-6 bg-border mx-1" />

        {/* Bouton Poubelle (Cleanup Mode) */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-11 w-11 hover:bg-red-600 hover:text-white"
              onClick={startCleanupMode}
            >
              <Trash2Icon size={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Nettoyer (supprimer plusieurs éléments)</TooltipContent>
        </Tooltip>

        {/* Bouton Settings */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="rounded-full h-11 w-11"
              onClick={() => setShowSettings(true)}
            >
              <SettingsIcon size={20} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Settings du projet</TooltipContent>
        </Tooltip>

        {/* Bouton Modèles IA */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Link href="/settings/models">
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full h-11 w-11"
              >
                <BrainCircuitIcon size={20} />
              </Button>
            </Link>
          </TooltipTrigger>
          <TooltipContent>Gérer les modèles IA</TooltipContent>
        </Tooltip>
      </Panel>

      <CollectionsLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onSelectCollection={handleSelectCollection}
        onCategoryChange={handleCategoryChange}
      />

      {/* Dialog Settings du projet */}
      {project && (
        <ProjectSettingsDialog
          projectId={project.id}
          open={showSettings}
          onOpenChange={setShowSettings}
        />
      )}
    </>
  );
};

export const Toolbar = memo(ToolbarInner);
