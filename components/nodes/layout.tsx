import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { useNodeOperations } from '@/providers/node-operations';
import { Handle, Position, useReactFlow } from '@xyflow/react';
import { CodeIcon, CopyIcon, EyeIcon, TrashIcon } from 'lucide-react';
import { type ReactNode, useState, useRef, useEffect } from 'react';
import { NodeToolbar } from './toolbar';
import { BatchRunsControl } from './batch-runs-control';
import { ReplaceMediaButton } from './replace-media-button';

// Types de nodes qui supportent le batch/runs parallèles
const BATCH_SUPPORTED_TYPES = ['image', 'video', 'audio', 'generate-image', 'generate-video'];

// Types de nodes qui supportent le remplacement de média
const REPLACE_SUPPORTED_TYPES = ['image', 'video'];

type NodeLayoutProps = {
  children: ReactNode;
  id: string;
  data?: Record<string, unknown> & {
    model?: string;
    source?: string;
    content?: { url: string; type: string };
    generated?: { url: string; type: string };
    advancedSettings?: {
      aspectRatio?: string;
      width?: number;
      height?: number;
      quality?: string;
    };
  };
  title: string;
  type: string;
  toolbar?: {
    tooltip?: string;
    children: ReactNode;
  }[];
  className?: string;
  onBatchRun?: (count: number) => void;
  modelLabel?: string; // Nom du modèle pour l'affichage
};

export const NodeLayout = ({
  children,
  type,
  id,
  data,
  toolbar,
  title,
  className,
  onBatchRun,
  modelLabel,
}: NodeLayoutProps) => {
  const { deleteElements, setCenter, getNode, updateNode, addNodes, addEdges, getEdges } = useReactFlow();
  const { duplicateNode } = useNodeOperations();
  const [showData, setShowData] = useState(false);
  const [isNodeHovered, setIsNodeHovered] = useState(false);
  const [isBatchControlHovered, setIsBatchControlHovered] = useState(false);
  const [isToolbarHovered, setIsToolbarHovered] = useState(false);
  const [isReplaceHovered, setIsReplaceHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Vérifie si ce type de node supporte le batch
  const supportsBatch = BATCH_SUPPORTED_TYPES.includes(type);
  
  // Vérifie si ce type de node supporte le remplacement de média
  const supportsReplace = REPLACE_SUPPORTED_TYPES.includes(type);
  
  // Vérifie si le nœud a du contenu (uploadé ou généré) - donc pas vide
  const hasMediaContent = Boolean(data?.content?.url || data?.generated?.url);
  
  // Les contrôles sont visibles si le node OU un des contrôles est hovered
  const showBatchControl = isNodeHovered || isBatchControlHovered || isToolbarHovered || isReplaceHovered;

  // Handlers de hover avec délai
  const handleNodeMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsNodeHovered(true);
  };

  const handleNodeMouseLeave = () => {
    // Délai de 300ms pour laisser le temps d'aller sur le contrôle
    hideTimeoutRef.current = setTimeout(() => {
      setIsNodeHovered(false);
    }, 300);
  };

  // Cleanup du timeout
  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Handler pour le batch run
  const handleBatchRun = async (count: number) => {
    if (onBatchRun) {
      // Utiliser le callback fourni par le composant parent
      onBatchRun(count);
    } else {
      // Comportement par défaut: dupliquer le node N-1 fois
      const currentNode = getNode(id);
      if (!currentNode) return;

      const edges = getEdges().filter(e => e.target === id || e.source === id);
      
      for (let i = 1; i < count; i++) {
        const newNodeId = `${id}-batch-${i}-${Date.now()}`;
        const offsetY = (currentNode.measured?.height ?? 200) + 50;
        
        // Dupliquer le node
        addNodes({
          ...currentNode,
          id: newNodeId,
          position: {
            x: currentNode.position.x,
            y: currentNode.position.y + (offsetY * i),
          },
          selected: false,
        });

        // Dupliquer les connections
        for (const edge of edges) {
          addEdges({
            ...edge,
            id: `${edge.id}-batch-${i}`,
            source: edge.source === id ? newNodeId : edge.source,
            target: edge.target === id ? newNodeId : edge.target,
          });
        }
      }
    }
  };

  const handleFocus = () => {
    const node = getNode(id);

    if (!node) {
      return;
    }

    const { x, y } = node.position;
    const width = node.measured?.width ?? 0;

    setCenter(x + width / 2, y, {
      duration: 1000,
    });
  };

  const handleDelete = () => {
    deleteElements({
      nodes: [{ id }],
    });
  };

  const handleShowData = () => {
    setTimeout(() => {
      setShowData(true);
    }, 100);
  };

  const handleSelect = (open: boolean) => {
    if (!open) {
      return;
    }

    const node = getNode(id);

    if (!node) {
      return;
    }

    if (!node.selected) {
      updateNode(id, { selected: true });
    }
  };

  return (
    <>
      {/* Toolbar visible au hover seulement */}
      {type !== 'drop' && Boolean(toolbar?.length) && (
        <NodeToolbar 
          id={id} 
          items={toolbar} 
          isNodeHovered={showBatchControl}
          onHoverChange={setIsToolbarHovered}
        />
      )}
      {type !== 'file' && type !== 'tweet' && (
        <Handle type="target" position={Position.Left} />
      )}
      <ContextMenu onOpenChange={handleSelect}>
        <ContextMenuTrigger>
          <div 
            className="relative size-full h-auto w-sm"
            onMouseEnter={handleNodeMouseEnter}
            onMouseLeave={handleNodeMouseLeave}
          >
            {type !== 'drop' && (
              <div className="-translate-y-full -top-2 absolute right-0 left-0 flex shrink-0 items-center justify-between">
                <p className="font-mono text-muted-foreground text-xs tracking-tighter">
                  {title}
                </p>
              </div>
            )}
            <div
              className={cn(
                'node-container flex size-full flex-col divide-y rounded-[20px] bg-card transition-all',
                className
              )}
            >
              <div className="overflow-hidden rounded-[17px] bg-card">
                {children}
              </div>
            </div>
            
            {/* Contrôles en bas à droite : Replace + Batch runs */}
            <div className="absolute bottom-3 right-3 z-50 flex items-center gap-2">
              {/* Bouton Replace - visible seulement si le nœud a du contenu */}
              {supportsReplace && hasMediaContent && (
                <ReplaceMediaButton
                  nodeId={id}
                  isVisible={showBatchControl}
                  mediaType={type as 'image' | 'video'}
                  onHoverChange={setIsReplaceHovered}
                />
              )}
            
            {/* Contrôle des runs parallèles (comme Flora AI) */}
            {supportsBatch && (
              <BatchRunsControl
                nodeId={id}
                isVisible={showBatchControl}
                onRun={handleBatchRun}
                maxRuns={100}
                onHoverChange={setIsBatchControlHovered}
                  className="static"
              />
            )}
            </div>
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent className="min-w-[100px]">
          <ContextMenuItem onClick={() => duplicateNode(id)}>
            <CopyIcon size={10} />
            <span>Dupliquer</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleFocus}>
            <EyeIcon size={10} />
            <span>Centrer</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDelete} variant="destructive">
            <TrashIcon size={10} />
            <span>Supprimer</span>
          </ContextMenuItem>
          {process.env.NODE_ENV === 'development' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleShowData}>
                <CodeIcon size={10} />
                <span>Data</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      <Handle type="source" position={Position.Right} />
      <Dialog open={showData} onOpenChange={setShowData}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Node data</DialogTitle>
            <DialogDescription>
              Data for node{' '}
              <code className="rounded-sm bg-secondary px-2 py-1 font-mono">
                {id}
              </code>
            </DialogDescription>
          </DialogHeader>
          <pre className="overflow-x-auto rounded-lg bg-black p-4 text-sm text-white">
            {JSON.stringify(data, null, 2)}
          </pre>
        </DialogContent>
      </Dialog>
    </>
  );
};
