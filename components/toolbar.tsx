'use client';

import { nodeButtons } from '@/lib/node-buttons';
import { useNodeOperations } from '@/providers/node-operations';
import { Panel, useReactFlow } from '@xyflow/react';
import { memo, useState, useCallback } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { LibraryIcon } from 'lucide-react';
import { CollectionsLibraryModal } from './collections-library-modal';
import type { SavedCollection, CollectionCategory } from '@/lib/collections-library-store';

export const ToolbarInner = () => {
  const { getViewport, getNodes, setNodes } = useReactFlow();
  const { addNode } = useNodeOperations();
  const [libraryOpen, setLibraryOpen] = useState(false);

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

        {/* Bouton bibliothèque */}
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
      </Panel>

      <CollectionsLibraryModal
        open={libraryOpen}
        onOpenChange={setLibraryOpen}
        onSelectCollection={handleSelectCollection}
        onCategoryChange={handleCategoryChange}
      />
    </>
  );
};

export const Toolbar = memo(ToolbarInner);
