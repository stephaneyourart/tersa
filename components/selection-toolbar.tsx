'use client';

/**
 * Toolbar contextuel pour la sélection multiple de nœuds
 * Utilise le même mécanisme que NodeToolbar de React Flow
 * pour un positionnement correct lors du zoom/pan
 */

import { NodeToolbar, Position, useStore } from '@xyflow/react';
import { FolderPlusIcon, LayoutGridIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from './ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { CategorySelectModal } from './collections-library-modal';
import type { CollectionCategory } from '@/lib/collections-library-store';

type SelectionToolbarProps = {
  onCreateCollection?: (nodeIds: string[], category: CollectionCategory) => void;
  onAutoformat?: (nodeIds: string[]) => void;
};

export const SelectionToolbar = ({
  onCreateCollection,
  onAutoformat,
}: SelectionToolbarProps) => {
  const [showCategorySelect, setShowCategorySelect] = useState(false);
  
  // Récupérer les IDs des nœuds sélectionnés depuis le store
  const selectedNodeIds = useStore((state) =>
    state.nodes.filter((n) => n.selected).map((n) => n.id)
  );

  // Mémoriser l'array pour éviter les re-renders inutiles
  const nodeIds = useMemo(() => selectedNodeIds, [selectedNodeIds.join(',')]);

  // Ne rien afficher si moins de 2 nœuds sélectionnés
  if (nodeIds.length < 2) {
    return null;
  }

  const handleCreateCollection = () => {
    setShowCategorySelect(true);
  };

  const handleCategorySelect = (category: CollectionCategory) => {
    onCreateCollection?.(nodeIds, category);
  };

  const handleAutoformat = () => {
    onAutoformat?.(nodeIds);
  };

  return (
    <>
      <NodeToolbar
        nodeId={nodeIds}
        isVisible={true}
        position={Position.Top}
        offset={16}
        className="flex items-center gap-1.5 rounded-full bg-background/90 p-1.5 backdrop-blur-sm border border-border/50 shadow-lg"
      >
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-accent"
              onClick={handleCreateCollection}
            >
              <FolderPlusIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Créer une collection</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full hover:bg-accent"
              onClick={handleAutoformat}
            >
              <LayoutGridIcon size={16} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Autoformat</TooltipContent>
        </Tooltip>
      </NodeToolbar>

      <CategorySelectModal
        open={showCategorySelect}
        onOpenChange={setShowCategorySelect}
        onSelect={handleCategorySelect}
      />
    </>
  );
};

