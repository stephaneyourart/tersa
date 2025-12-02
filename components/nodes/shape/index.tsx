'use client';

import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { NodeResizer, useReactFlow, type NodeProps } from '@xyflow/react';
import { memo, useState, useCallback } from 'react';
import { ArrowUpIcon, ArrowDownIcon, TrashIcon, PaletteIcon, CopyIcon } from 'lucide-react';

// Palette de couleurs
const SHAPE_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#fca5a5', '#fdba74', '#fde047', '#86efac', '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4',
  '#991b1b', '#9a3412', '#854d0e', '#166534', '#155e75', '#1e40af', '#5b21b6', '#9d174d',
  '#ffffff', '#e5e5e5', '#a3a3a3', '#737373', '#525252', '#262626', '#171717', '#000000',
];

export type ShapeNodeData = {
  color: string;
  width?: number;
  height?: number;
  zIndex?: number;
  opacity?: number;
  borderRadius?: number;
};

export type ShapeNodeProps = NodeProps & {
  data: ShapeNodeData;
};

const ShapeNodeComponent = ({ id, data, selected, style }: ShapeNodeProps & { style?: React.CSSProperties }) => {
  const { deleteElements, getNodes, setNodes, updateNodeData, addNodes } = useReactFlow();
  const [colorPickerOpen, setColorPickerOpen] = useState(false);
  
  const {
    color = '#6366f1',
    opacity = 100,
    borderRadius = 0,
  } = data;

  // Supprimer le shape
  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  // Dupliquer le shape
  const handleDuplicate = useCallback(() => {
    const nodes = getNodes();
    const currentNode = nodes.find(n => n.id === id);
    if (!currentNode) return;

    const newNode = {
      ...currentNode,
      id: `shape-${Date.now()}`,
      position: {
        x: currentNode.position.x + 20,
        y: currentNode.position.y + 20,
      },
      selected: false,
    };
    addNodes(newNode);
  }, [getNodes, id, addNodes]);

  // Passer au premier plan (z-index très élevé)
  const handleBringToFront = useCallback(() => {
    setNodes((nodes) => {
      const maxZ = Math.max(...nodes.map(n => n.zIndex ?? 0), 0);
      return nodes.map(n => 
        n.id === id ? { ...n, zIndex: maxZ + 1000 } : n
      );
    });
  }, [setNodes, id]);

  // Passer en arrière-plan (z-index très négatif)
  const handleSendToBack = useCallback(() => {
    setNodes((nodes) => {
      const minZ = Math.min(...nodes.map(n => n.zIndex ?? 0), 0);
      return nodes.map(n => 
        n.id === id ? { ...n, zIndex: minZ - 1000 } : n
      );
    });
  }, [setNodes, id]);

  // Changer la couleur
  const handleColorChange = useCallback((newColor: string) => {
    updateNodeData(id, { color: newColor });
    setColorPickerOpen(false);
  }, [updateNodeData, id]);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        {/* Resizer - visible quand sélectionné */}
        <NodeResizer
          minWidth={30}
          minHeight={30}
          isVisible={selected}
          lineClassName="!border-primary"
          handleClassName="!w-2.5 !h-2.5 !bg-primary !border-2 !border-background !rounded-sm"
        />
        
        {/* Le rectangle */}
        <div
          className={cn(
            'w-full h-full cursor-move',
            selected && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
          )}
          style={{
            backgroundColor: color,
            opacity: opacity / 100,
            borderRadius: `${borderRadius}px`,
            width: style?.width ?? '100%',
            height: style?.height ?? '100%',
            minWidth: 30,
            minHeight: 30,
          }}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      </ContextMenuTrigger>
      
      <ContextMenuContent className="min-w-[160px]">
        {/* Color picker inline */}
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Couleur</p>
          <div className="grid grid-cols-8 gap-1">
            {SHAPE_COLORS.map((c) => (
              <button
                key={c}
                className={cn(
                  "w-5 h-5 rounded border border-border/50 hover:scale-110 transition-transform",
                  c === color && "ring-2 ring-primary ring-offset-1"
                )}
                style={{ backgroundColor: c }}
                onClick={() => handleColorChange(c)}
              />
            ))}
          </div>
        </div>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleBringToFront}>
          <ArrowUpIcon size={14} />
          <span>Premier plan</span>
        </ContextMenuItem>
        <ContextMenuItem onClick={handleSendToBack}>
          <ArrowDownIcon size={14} />
          <span>Arrière-plan</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleDuplicate}>
          <CopyIcon size={14} />
          <span>Dupliquer</span>
        </ContextMenuItem>
        
        <ContextMenuSeparator />
        
        <ContextMenuItem onClick={handleDelete} className="text-destructive focus:text-destructive">
          <TrashIcon size={14} />
          <span>Supprimer</span>
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
};

export const ShapeNode = memo(ShapeNodeComponent);
