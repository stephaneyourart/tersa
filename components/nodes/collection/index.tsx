'use client';

/**
 * CollectionNode - Nœud conteneur pour regrouper plusieurs médias
 * 
 * Caractéristiques :
 * - Affichage galerie visuelle
 * - Toggle on/off au hover sur chaque élément
 * - Une seule sortie qui agrège les éléments actifs
 * - Metadata au hover sur chaque élément
 * - Items OFF = dimmés
 */

import { Handle, Position, useReactFlow } from '@xyflow/react';
import type { NodeProps, Node } from '@xyflow/react';
import {
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTextIcon,
  Trash2Icon,
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  LayersIcon,
} from 'lucide-react';
import { nanoid } from 'nanoid';
import { useState, useCallback, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

// Type pour un preset (configuration de toggles)
export type CollectionPreset = {
  id: string;
  name: string;
  itemStates: Record<string, boolean>; // itemId -> enabled
};

// Type pour un item dans la collection
export type CollectionItem = {
  id: string;
  type: 'image' | 'video' | 'audio' | 'text';
  enabled: boolean; // État par défaut (utilisé si pas de preset actif)
  // Pour images/vidéos
  url?: string;
  width?: number;
  height?: number;
  // Pour audio
  duration?: number;
  // Pour texte
  text?: string;
  // Métadonnées communes
  name?: string;
  createdAt?: string;
};

export type CollectionNodeData = {
  label?: string;
  items: CollectionItem[];
  collapsed?: boolean;
  activeTab?: 'image' | 'video' | 'audio' | 'text' | 'all';
  presets?: CollectionPreset[];
  activePresetId?: string;
};

type CollectionNodeProps = NodeProps<Node<CollectionNodeData>>;

// Composant barre de presets avec scroll horizontal
const PresetsBar = ({
  presets,
  activePresetId,
  editingPresetId,
  presetNameValue,
  presetInputRef,
  onSelectPreset,
  onCreatePreset,
  onDeletePreset,
  onStartEditing,
  onNameChange,
  onSaveName,
  onCancelEdit,
}: {
  presets: CollectionPreset[];
  activePresetId?: string;
  editingPresetId: string | null;
  presetNameValue: string;
  presetInputRef: React.RefObject<HTMLInputElement | null>;
  onSelectPreset: (id: string | null) => void;
  onCreatePreset: () => void;
  onDeletePreset: (id: string) => void;
  onStartEditing: (preset: CollectionPreset) => void;
  onNameChange: (value: string) => void;
  onSaveName: () => void;
  onCancelEdit: () => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Si c'est un pinch-to-zoom, laisser passer
      if (e.ctrlKey || e.metaKey) return;
      
      // Intercepter et convertir en scroll horizontal (fluide)
      e.stopPropagation();
      e.preventDefault();
      el.scrollBy({
        left: e.deltaY || e.deltaX,
        behavior: 'auto'
      });
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  return (
    <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border/50 nodrag">
      {/* Icône fixe à gauche */}
      <LayersIcon size={12} className="text-muted-foreground shrink-0" />
      
      {/* Zone scrollable */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-1.5 overflow-x-auto overflow-y-visible py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
      >
        {/* Preset "Default" */}
        <button
          onClick={() => onSelectPreset(null)}
          className={cn(
            'px-2 py-1 rounded text-[10px] font-medium transition-colors leading-none shrink-0 whitespace-nowrap',
            !activePresetId
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-accent text-muted-foreground'
          )}
        >
          Default
        </button>

        {/* Presets existants */}
        {presets.map((preset) => (
          <div key={preset.id} className="relative group flex items-center shrink-0">
            {editingPresetId === preset.id ? (
              <input
                ref={presetInputRef}
                value={presetNameValue}
                onChange={(e) => onNameChange(e.target.value)}
                onBlur={onSaveName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onSaveName();
                  if (e.key === 'Escape') onCancelEdit();
                }}
                className="min-w-16 px-2 py-1 rounded text-[10px] font-medium bg-background border border-border outline-none leading-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                onClick={() => onSelectPreset(preset.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  onStartEditing(preset);
                }}
                className={cn(
                  'px-2 py-1 rounded text-[10px] font-medium transition-colors leading-none whitespace-nowrap',
                  activePresetId === preset.id
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-accent text-muted-foreground'
                )}
              >
                {preset.name}
              </button>
            )}
            
            {/* Bouton supprimer au hover */}
            {activePresetId === preset.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeletePreset(preset.id);
                }}
                className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2Icon size={8} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Bouton ajouter fixe à droite */}
      <button
        onClick={onCreatePreset}
        className="p-1 rounded hover:bg-accent text-muted-foreground transition-colors shrink-0"
        title="Nouveau preset"
      >
        <PlusIcon size={12} />
      </button>
    </div>
  );
};

// Composant galerie avec scroll isolé du canvas
const CollectionGallery = ({
  items,
  onToggle,
  onDelete,
  onTextChange,
}: {
  items: CollectionItem[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      // Si c'est un pinch-to-zoom (ctrlKey), laisser passer pour le zoom du canvas
      if (e.ctrlKey || e.metaKey) {
        return;
      }
      
      // Sinon, intercepter pour le scroll interne
      e.stopPropagation();
      el.scrollTop += e.deltaY;
    };

    el.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    return () => el.removeEventListener('wheel', handleWheel, { capture: true });
  }, []);

  if (items.length === 0) {
    return (
      <div className="p-3">
        <p className="text-xs text-muted-foreground text-center py-8">
          Connectez des nœuds pour ajouter des éléments
        </p>
      </div>
    );
  }

  // Décider du layout : 1 ou 2 colonnes selon le nombre d'items
  const useGrid = items.length >= 2;

  return (
    <div
      ref={scrollRef}
      className="p-3 max-h-[380px] overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]"
    >
      <div className={cn(
        'gap-2',
        useGrid ? 'grid grid-cols-2' : 'flex flex-col'
      )}>
        {items.map((item) => (
          <CollectionItemVisual
            key={item.id}
            item={item}
            onToggle={onToggle}
            onDelete={onDelete}
            onTextChange={onTextChange}
            compact={useGrid}
          />
        ))}
      </div>
    </div>
  );
};

// Composant pour un item visuel
const CollectionItemVisual = ({
  item,
  onToggle,
  onDelete,
  onTextChange,
  compact = false,
}: {
  item: CollectionItem;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onTextChange?: (id: string, text: string) => void;
  compact?: boolean;
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [nativeSize, setNativeSize] = useState<{ width: number; height: number } | null>(null);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNativeSize({ width: img.naturalWidth, height: img.naturalHeight });
  };

  const handleVideoLoad = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setNativeSize({ width: video.videoWidth, height: video.videoHeight });
  };

  const displaySize = nativeSize || (item.width && item.height ? { width: item.width, height: item.height } : null);

  return (
    <div
      className="relative w-full rounded-lg overflow-hidden transition-all"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Image - très sombre si OFF (brightness) mais en couleur */}
      <div
        className="w-full transition-all duration-200"
        style={{
          filter: item.enabled ? 'none' : 'brightness(0.15)',
        }}
      >
        {item.type === 'image' && item.url ? (
          <img
            src={item.url}
            alt={item.name || 'image'}
            className="w-full h-auto rounded-lg"
            onLoad={handleImageLoad}
          />
        ) : item.type === 'video' && item.url ? (
          <video
            src={item.url}
            className="w-full h-auto rounded-lg"
            muted
            onLoadedMetadata={handleVideoLoad}
          />
        ) : item.type === 'audio' ? (
          <div className={cn('w-full bg-green-950/30 flex items-center justify-center rounded-lg', compact ? 'h-16' : 'h-24')}>
            <MusicIcon size={compact ? 24 : 32} className="text-green-400" />
          </div>
        ) : item.type === 'text' ? (
          <div className="w-full bg-card border border-border/50 rounded-lg overflow-hidden min-h-[200px] max-h-[380px]">
            <textarea
              value={item.text || ''}
              onChange={(e) => onTextChange?.(item.id, e.target.value)}
              className="w-full h-full min-h-[200px] p-4 text-sm leading-relaxed text-foreground text-left bg-transparent resize-none outline-none [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] nodrag nowheel"
              placeholder="Texte..."
            />
          </div>
        ) : (
          <div className={cn('w-full bg-muted/30 flex items-center justify-center rounded-lg', compact ? 'h-16' : 'h-24')}>
            <ImageIcon size={compact ? 24 : 32} className="text-muted-foreground" />
          </div>
        )}
      </div>

      {/* Overlay en haut à gauche - visible au hover */}
      {isHovered && (
        <div className="absolute top-2 left-2 flex flex-col gap-1">
          {/* Toggle */}
          <button
            onClick={() => onToggle(item.id)}
            className={cn(
              'flex items-center gap-1 px-1.5 py-0.5 rounded-full font-medium transition-colors',
              compact ? 'text-[9px]' : 'text-[10px]',
              item.enabled ? 'bg-green-500 text-white' : 'bg-black/60 text-white/80'
            )}
          >
            <div className={cn('rounded-full', compact ? 'w-2 h-2' : 'w-2.5 h-2.5', item.enabled ? 'bg-white' : 'bg-white/50')} />
            {item.enabled ? 'ON' : 'OFF'}
          </button>

          {/* Résolution */}
          {displaySize && (
            <span className={cn('bg-black/60 text-white/90 px-1.5 py-0.5 rounded font-medium', compact ? 'text-[9px]' : 'text-[10px]')}>
              {displaySize.width}×{displaySize.height}
            </span>
          )}
        </div>
      )}

      {/* Delete en haut à droite */}
      {isHovered && (
        <button
          onClick={() => onDelete(item.id)}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/60 hover:bg-red-500/80 text-white/70 hover:text-white transition-colors"
        >
          <Trash2Icon size={compact ? 12 : 14} />
        </button>
      )}
    </div>
  );
};

// Types pour les onglets
const ITEM_TYPES = ['image', 'video', 'audio', 'text'] as const;
type ItemType = typeof ITEM_TYPES[number];

const TYPE_ICONS: Record<ItemType, typeof ImageIcon> = {
  image: ImageIcon,
  video: VideoIcon,
  audio: MusicIcon,
  text: FileTextIcon,
};

export const CollectionNode = ({ id, data, selected }: CollectionNodeProps) => {
  const { updateNodeData } = useReactFlow();
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [presetNameValue, setPresetNameValue] = useState('');
  const presetInputRef = useRef<HTMLInputElement>(null);
  
  const items = data.items || [];
  const collapsed = data.collapsed ?? false;
  const activeTab = data.activeTab || 'all';
  const presets = data.presets || [];
  const activePresetId = data.activePresetId;
  const activePreset = presets.find(p => p.id === activePresetId);

  // Calculer l'état enabled de chaque item selon le preset actif
  const getItemEnabled = useCallback((item: CollectionItem) => {
    if (!activePreset) return item.enabled;
    return activePreset.itemStates[item.id] ?? item.enabled;
  }, [activePreset]);

  const enabledCount = items.filter((i) => getItemEnabled(i)).length;

  // Compter les items par type
  const countByType = ITEM_TYPES.reduce((acc, type) => {
    acc[type] = items.filter((i) => i.type === type).length;
    return acc;
  }, {} as Record<ItemType, number>);

  // Filtrer les items selon l'onglet actif et ajouter l'état enabled calculé
  const filteredItems = (activeTab === 'all' ? items : items.filter((i) => i.type === activeTab))
    .map(item => ({ ...item, enabled: getItemEnabled(item) }));
  
  const setActiveTab = (tab: ItemType | 'all') => {
    updateNodeData(id, { activeTab: tab });
  };

  // Toggle un item - modifie le preset actif ou l'item directement
  const handleToggleItem = useCallback(
    (itemId: string) => {
      if (activePreset) {
        // Modifier l'état dans le preset actif
        const currentState = activePreset.itemStates[itemId] ?? items.find(i => i.id === itemId)?.enabled ?? true;
        const newPresets = presets.map(p => 
          p.id === activePreset.id 
            ? { ...p, itemStates: { ...p.itemStates, [itemId]: !currentState } }
            : p
        );
        updateNodeData(id, { presets: newPresets });
      } else {
        // Modifier l'item directement
        const newItems = items.map((item) =>
          item.id === itemId ? { ...item, enabled: !item.enabled } : item
        );
        updateNodeData(id, { items: newItems });
      }
    },
    [id, items, presets, activePreset, updateNodeData]
  );

  const handleDeleteItem = useCallback(
    (itemId: string) => {
      const newItems = items.filter((item) => item.id !== itemId);
      // Aussi nettoyer les presets
      const newPresets = presets.map(p => {
        const { [itemId]: _, ...restStates } = p.itemStates;
        return { ...p, itemStates: restStates };
      });
      updateNodeData(id, { items: newItems, presets: newPresets });
    },
    [id, items, presets, updateNodeData]
  );

  const handleTextChange = useCallback(
    (itemId: string, text: string) => {
      const newItems = items.map((item) =>
        item.id === itemId ? { ...item, text } : item
      );
      updateNodeData(id, { items: newItems });
    },
    [id, items, updateNodeData]
  );

  const toggleCollapse = useCallback(() => {
    updateNodeData(id, { collapsed: !collapsed });
  }, [id, collapsed, updateNodeData]);

  // Créer un nouveau preset
  const handleCreatePreset = useCallback(() => {
    const newPreset: CollectionPreset = {
      id: nanoid(),
      name: `Preset ${presets.length + 1}`,
      itemStates: items.reduce((acc, item) => ({ ...acc, [item.id]: true }), {}),
    };
    updateNodeData(id, { 
      presets: [...presets, newPreset],
      activePresetId: newPreset.id 
    });
  }, [id, items, presets, updateNodeData]);

  // Sélectionner un preset
  const handleSelectPreset = useCallback((presetId: string | null) => {
    updateNodeData(id, { activePresetId: presetId || undefined });
  }, [id, updateNodeData]);

  // Commencer l'édition du nom d'un preset
  const startEditingPreset = useCallback((preset: CollectionPreset) => {
    setEditingPresetId(preset.id);
    setPresetNameValue(preset.name);
    setTimeout(() => presetInputRef.current?.focus(), 0);
  }, []);

  // Sauvegarder le nom du preset
  const handleSavePresetName = useCallback(() => {
    if (!editingPresetId) return;
    const newPresets = presets.map(p => 
      p.id === editingPresetId ? { ...p, name: presetNameValue.trim() || p.name } : p
    );
    updateNodeData(id, { presets: newPresets });
    setEditingPresetId(null);
  }, [id, editingPresetId, presetNameValue, presets, updateNodeData]);

  // Supprimer un preset
  const handleDeletePreset = useCallback((presetId: string) => {
    const newPresets = presets.filter(p => p.id !== presetId);
    updateNodeData(id, { 
      presets: newPresets,
      activePresetId: activePresetId === presetId ? undefined : activePresetId
    });
  }, [id, presets, activePresetId, updateNodeData]);

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden bg-card shadow-lg transition-all',
        collapsed ? 'w-[180px]' : 'w-[380px]',
        selected && 'ring-2 ring-primary'
      )}
    >
      {/* Handle d'entrée (gauche) - pour ajouter des items */}
      <Handle
        type="target"
        position={Position.Left}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />

      {/* Header jaune */}
      <div 
        className="flex items-center gap-2 px-4 py-3 nodrag nowheel"
        style={{ backgroundColor: '#F6C744' }}
        onDoubleClick={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex-1 min-w-0">
          <input
            value={data.label || 'Collection'}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            className="w-full text-sm font-semibold text-black bg-transparent border-none outline-none cursor-text"
            style={{ caretColor: 'black' }}
          />
          <p className="text-xs text-black/60">
            {enabledCount}/{items.length} actifs
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 text-black hover:bg-black/10"
          onClick={toggleCollapse}
        >
          {collapsed ? (
            <ChevronDownIcon size={16} />
          ) : (
            <ChevronUpIcon size={16} />
          )}
        </Button>
      </div>

      {/* Onglets par type */}
      {!collapsed && (
        <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border/50">
          {ITEM_TYPES.map((type) => {
            const Icon = TYPE_ICONS[type];
            const count = countByType[type];
            const isActive = activeTab === type;
            const hasItems = count > 0;
            
            return (
              <button
                key={type}
                onClick={() => hasItems && setActiveTab(isActive ? 'all' : type)}
                className={cn(
                  'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
                  hasItems ? 'cursor-pointer' : 'cursor-default',
                  isActive 
                    ? 'bg-primary text-primary-foreground' 
                    : hasItems 
                      ? 'hover:bg-accent text-foreground' 
                      : 'text-muted-foreground/40'
                )}
                disabled={!hasItems}
              >
                <Icon size={14} />
                {hasItems && <span>{count}</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Barre de presets */}
      {!collapsed && (
        <PresetsBar
          presets={presets}
          activePresetId={activePresetId}
          editingPresetId={editingPresetId}
          presetNameValue={presetNameValue}
          presetInputRef={presetInputRef}
          onSelectPreset={handleSelectPreset}
          onCreatePreset={handleCreatePreset}
          onDeletePreset={handleDeletePreset}
          onStartEditing={startEditingPreset}
          onNameChange={setPresetNameValue}
          onSaveName={handleSavePresetName}
          onCancelEdit={() => setEditingPresetId(null)}
        />
      )}

      {/* Galerie visuelle avec scroll invisible */}
      {!collapsed && (
        <CollectionGallery
          items={filteredItems}
          onToggle={handleToggleItem}
          onDelete={handleDeleteItem}
          onTextChange={handleTextChange}
        />
      )}

      {/* Footer compact si collapsed */}
      {collapsed && items.length > 0 && (
        <div className="px-4 py-2 text-xs text-muted-foreground">
          {items.length} élément{items.length > 1 ? 's' : ''}
        </div>
      )}

      {/* Handle de sortie (droite) */}
      <Handle
        type="source"
        position={Position.Right}
        className="!w-3 !h-3 !bg-primary !border-2 !border-background"
      />
    </div>
  );
};

