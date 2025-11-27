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

// Types de nodes qui supportent le batch/runs parallèles
const BATCH_SUPPORTED_TYPES = ['image', 'video', 'audio', 'generate-image', 'generate-video'];

type NodeLayoutProps = {
  children: ReactNode;
  id: string;
  data?: Record<string, unknown> & {
    model?: string;
    source?: string;
    generated?: object;
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
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Vérifie si ce type de node supporte le batch
  const supportsBatch = BATCH_SUPPORTED_TYPES.includes(type);
  
  // Le batch control est visible si le node OU le contrôle est hovered
  const showBatchControl = isNodeHovered || isBatchControlHovered;

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
      {type !== 'drop' && Boolean(toolbar?.length) && (
        <NodeToolbar id={id} items={toolbar} />
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
              <div className="-translate-y-full -top-2 absolute right-0 left-0 flex shrink-0 flex-col gap-1">
                <p className="font-mono text-muted-foreground text-xs tracking-tighter">
                  {title}
                </p>
                {/* Chips model/params au hover */}
                {showBatchControl && (modelLabel || data?.advancedSettings) && (
                  <div className="flex flex-wrap gap-1 animate-in fade-in slide-in-from-top-1 duration-200">
                    {modelLabel && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-primary/10 text-primary border border-primary/20">
                        {modelLabel}
                      </span>
                    )}
                    {data?.advancedSettings?.width && data?.advancedSettings?.height && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {data.advancedSettings.width}×{data.advancedSettings.height}
                      </span>
                    )}
                    {data?.advancedSettings?.quality && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        {data.advancedSettings.quality}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
            <div
              className={cn(
                'node-container flex size-full flex-col divide-y rounded-[28px] bg-card p-2 ring-1 ring-border transition-all',
                className
              )}
            >
              <div className="overflow-hidden rounded-3xl bg-card">
                {children}
              </div>
            </div>
            
            {/* Contrôle des runs parallèles (comme Flora AI) */}
            {supportsBatch && (
              <BatchRunsControl
                nodeId={id}
                isVisible={showBatchControl}
                onRun={handleBatchRun}
                maxRuns={10}
                onHoverChange={setIsBatchControlHovered}
              />
            )}
          </div>
        </ContextMenuTrigger>
        <ContextMenuContent>
          <ContextMenuItem onClick={() => duplicateNode(id)}>
            <CopyIcon size={12} />
            <span>Duplicate</span>
          </ContextMenuItem>
          <ContextMenuItem onClick={handleFocus}>
            <EyeIcon size={12} />
            <span>Focus</span>
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem onClick={handleDelete} variant="destructive">
            <TrashIcon size={12} />
            <span>Delete</span>
          </ContextMenuItem>
          {process.env.NODE_ENV === 'development' && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={handleShowData}>
                <CodeIcon size={12} />
                <span>Show data</span>
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>
      </ContextMenu>
      {type !== 'video' && <Handle type="source" position={Position.Right} />}
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
