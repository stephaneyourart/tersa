'use client';

import { cn } from '@/lib/utils';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';
import { Input } from '@/components/ui/input';
import { useReactFlow, type NodeProps } from '@xyflow/react';
import { memo, useState, useCallback, useRef, useEffect } from 'react';
import { TrashIcon, CopyIcon } from 'lucide-react';

// Palette de couleurs
const LABEL_COLORS = [
  '#ffffff', '#e5e5e5', '#a3a3a3', '#737373', '#525252', '#262626', '#171717', '#000000',
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#fca5a5', '#fdba74', '#fde047', '#86efac', '#67e8f9', '#93c5fd', '#c4b5fd', '#f9a8d4',
  '#991b1b', '#9a3412', '#854d0e', '#166534', '#155e75', '#1e40af', '#5b21b6', '#9d174d',
];


export type LabelNodeData = {
  text: string;
  color: string;
  fontSize: number;
};

export type LabelNodeProps = NodeProps & {
  data: LabelNodeData;
};

const LabelNodeComponent = ({ id, data, selected }: LabelNodeProps) => {
  const { deleteElements, getNodes, setNodes, updateNodeData, addNodes } = useReactFlow();
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(data.text || 'Texte');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  
  const {
    text = 'Texte',
    color = '#ffffff',
    fontSize = 32,
  } = data;

  // Focus sur l'input quand on passe en mode édition
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  // Supprimer le label
  const handleDelete = useCallback(() => {
    deleteElements({ nodes: [{ id }] });
  }, [deleteElements, id]);

  // Dupliquer le label
  const handleDuplicate = useCallback(() => {
    const nodes = getNodes();
    const currentNode = nodes.find(n => n.id === id);
    if (!currentNode) return;

    const newNode = {
      ...currentNode,
      id: `label-${Date.now()}`,
      position: {
        x: currentNode.position.x + 20,
        y: currentNode.position.y + 20,
      },
      selected: false,
    };
    addNodes(newNode);
  }, [getNodes, id, addNodes]);

  // Changer la couleur
  const handleColorChange = useCallback((newColor: string) => {
    updateNodeData(id, { color: newColor });
  }, [updateNodeData, id]);

  // Changer la taille
  const handleSizeChange = useCallback((newSize: number) => {
    updateNodeData(id, { fontSize: newSize });
  }, [updateNodeData, id]);

  // Double-clic pour éditer (avec stopPropagation pour éviter le conflit avec le canvas)
  const handleDoubleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditText(text);
    setIsEditing(true);
  }, [text]);

  // Sauvegarder le texte
  const handleSave = useCallback(() => {
    updateNodeData(id, { text: editText || 'Texte' });
    setIsEditing(false);
  }, [updateNodeData, id, editText]);

  // Annuler l'édition
  const handleCancel = useCallback(() => {
    setEditText(text);
    setIsEditing(false);
  }, [text]);

  // Gérer les touches
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  }, [handleSave, handleCancel]);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={cn(
            'cursor-move select-none whitespace-pre-wrap',
            selected && 'outline outline-2 outline-primary outline-offset-4'
          )}
          style={{
            color,
            fontSize: `${fontSize}px`,
            fontWeight: 600,
            lineHeight: 1.2,
            textShadow: '0 2px 4px rgba(0,0,0,0.5)',
            minWidth: '50px',
          }}
          onDoubleClick={handleDoubleClick}
        >
          {isEditing ? (
            <textarea
              ref={inputRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onBlur={handleSave}
              onKeyDown={handleKeyDown}
              className="bg-transparent border-none outline-none resize-none"
              style={{
                color,
                fontSize: `${fontSize}px`,
                fontWeight: 600,
                lineHeight: 1.2,
                minWidth: '100px',
                width: 'auto',
              }}
              rows={1}
            />
          ) : (
            text
          )}
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="min-w-[180px]">
        {/* Color picker */}
        <div className="px-2 py-1.5">
          <p className="text-xs font-medium text-muted-foreground mb-2">Couleur</p>
          <div className="grid grid-cols-8 gap-1">
            {LABEL_COLORS.map((c) => (
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
        
        {/* Size input */}
        <div className="px-2 py-1.5 flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-muted-foreground">Taille</span>
          <div className="flex items-center gap-1">
            <Input
              type="number"
              min={8}
              max={200}
              value={fontSize}
              onChange={(e) => handleSizeChange(parseInt(e.target.value) || 32)}
              className="w-16 h-7 text-xs text-center"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            />
            <span className="text-xs text-muted-foreground">px</span>
          </div>
        </div>
        
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

export const LabelNode = memo(LabelNodeComponent);

