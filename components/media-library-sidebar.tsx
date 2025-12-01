'use client';

/**
 * Media Library Sidebar
 * Ouvre depuis la gauche avec un chevron toggle
 * UI 100% noir/blanc, redimensionnable, zoom police
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import {
  useMediaLibraryStore,
  type MediaItem,
  type ColumnConfig,
  type SidebarSection,
  DEFAULT_COLUMNS,
} from '@/lib/media-library-store';
import {
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  X,
  Image,
  Video,
  Music,
  FileText,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  Settings2,
  RefreshCw,
  Sparkles,
  Folder,
  History,
  Layers,
  ZoomIn,
  ZoomOut,
  GripVertical,
  Check,
  Trash2,
  Star,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence, Reorder } from 'framer-motion';
import { Input } from './ui/input';
import { Button } from './ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from './ui/dropdown-menu';
import { Checkbox } from './ui/checkbox';
import { ScrollArea } from './ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from './ui/tooltip';

// Icônes par type de média avec couleurs du dashboard
const mediaTypeConfig: Record<string, { 
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  bgColor: string;
}> = {
  image: { icon: Image, color: 'text-violet-400', bgColor: 'bg-violet-500/20' },
  video: { icon: Video, color: 'text-rose-400', bgColor: 'bg-rose-500/20' },
  audio: { icon: Music, color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
  document: { icon: FileText, color: 'text-sky-400', bgColor: 'bg-sky-500/20' },
};

// Sections de la sidebar
const SECTIONS: Array<{
  id: SidebarSection;
  label: string;
  icon: React.ComponentType<{ className?: string; size?: number }>;
  description: string;
}> = [
  { id: 'media', label: 'Médias', icon: Layers, description: 'Tous les fichiers média' },
  { id: 'collections', label: 'Collections', icon: Folder, description: 'Collections sauvegardées' },
  { id: 'generators', label: 'Générateurs', icon: Sparkles, description: 'Modèles et presets' },
  { id: 'history', label: 'Historique', icon: History, description: 'Générations récentes' },
];

// Formater la taille de fichier
function formatFileSize(bytes?: number): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Formater la durée
function formatDuration(seconds?: number): string {
  if (!seconds) return '-';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Formater la date
function formatDate(dateString?: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Formater les dimensions
function formatDimensions(width?: number, height?: number): string {
  if (!width || !height) return '';
  return `${width} × ${height}`;
}

// Composant Tooltip pour textes longs
function LongTextTooltip({ 
  text, 
  maxLength = 30,
  fontSize,
  className,
}: { 
  text?: string; 
  maxLength?: number; 
  fontSize: number;
  className?: string;
}) {
  if (!text) return null;
  
  const needsTooltip = text.length > maxLength;
  const displayText = needsTooltip ? text.slice(0, maxLength) + '...' : text;
  
  if (!needsTooltip) {
    return <span style={{ fontSize }} className={className}>{text}</span>;
  }
  
  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={30000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            style={{ fontSize }} 
            className={cn("cursor-help", className)}
          >
            {displayText}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-md bg-neutral-900 border-neutral-700 text-white p-3"
        >
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
            {text}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Composant nom éditable avec tooltip chemin complet
function EditableName({
  media,
  fontSize,
  onRename,
}: {
  media: MediaItem;
  fontSize: number;
  onRename: (newName: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(media.name || media.filename.replace(/\.[^/.]+$/, '').replace(/-\d{13,}-[a-zA-Z0-9_-]+$/, ''));
  const [isLoading, setIsLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = async () => {
    setIsEditing(false);
    const trimmedValue = editValue.trim();
    const currentName = media.name || media.filename.replace(/\.[^/.]+$/, '').replace(/-\d{13,}-[a-zA-Z0-9_-]+$/, '');
    
    if (trimmedValue && trimmedValue !== currentName) {
      setIsLoading(true);
      try {
        await onRename(trimmedValue);
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
      setEditValue(media.name || media.filename.replace(/\.[^/.]+$/, '').replace(/-\d{13,}-[a-zA-Z0-9_-]+$/, ''));
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="w-full bg-white/10 border border-white/30 rounded px-1 py-0.5 text-white outline-none focus:border-white/50"
        style={{ fontSize }}
        disabled={isLoading}
      />
    );
  }

  const displayName = media.name || media.filename.replace(/\.[^/.]+$/, '').replace(/-\d{13,}-[a-zA-Z0-9_-]+$/, '');

  return (
    <TooltipProvider delayDuration={0} skipDelayDuration={30000}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            style={{ fontSize }} 
            className={cn(
              "truncate block cursor-text hover:bg-white/10 rounded px-1 -mx-1 transition-colors",
              isLoading && "opacity-50"
            )}
            onClick={(e) => {
              e.stopPropagation();
              if (!isLoading) {
                setIsEditing(true);
              }
            }}
          >
            {displayName}
          </span>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          className="max-w-lg bg-neutral-900 border-neutral-700 text-white p-3"
        >
          <div className="space-y-1">
            <p className="font-medium">{displayName}</p>
            <p className="text-xs text-neutral-400 break-all">{media.path}</p>
            <p className="text-xs text-neutral-500 italic">Cliquez pour renommer</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Composant cellule éditable
function EditableCell({
  value,
  onChange,
  placeholder = '',
  fontSize,
}: {
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  fontSize: number;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    setIsEditing(false);
    if (editValue !== value) {
      onChange(editValue);
    }
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="text"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleSubmit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') {
            setEditValue(value || '');
            setIsEditing(false);
          }
        }}
        className="w-full bg-white/10 border border-white/20 rounded px-1 py-0.5 text-white outline-none focus:border-white/40"
        style={{ fontSize }}
      />
    );
  }

  return (
    <LongTextTooltip 
      text={value || placeholder}
      fontSize={fontSize}
      className={cn(
        "cursor-text hover:bg-white/5 px-1 py-0.5 rounded truncate block",
        !value && "text-neutral-500"
      )}
    />
  );
}

// Composant thumbnail SANS fond gris pour voir les ratios
function MediaThumbnail({ media, size = 50 }: { media: MediaItem; size?: number }) {
  const typeConfig = mediaTypeConfig[media.type] || mediaTypeConfig.document;
  const Icon = typeConfig.icon;
  const [error, setError] = useState(false);

  const thumbnailContent = (
    <div 
      className="rounded overflow-hidden flex items-center justify-center flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {error ? (
        <div className={cn("w-full h-full flex items-center justify-center", typeConfig.bgColor)}>
          <Icon className={typeConfig.color} size={size * 0.4} />
        </div>
      ) : media.type === 'image' ? (
        <img
          src={media.url}
          alt={media.name || media.filename}
          className="max-w-full max-h-full object-contain"
          loading="lazy"
          onError={() => setError(true)}
        />
      ) : media.type === 'video' ? (
        <video
          src={media.url}
          className="max-w-full max-h-full object-contain"
          muted
          preload="metadata"
          onError={() => setError(true)}
        />
      ) : (
        <div className={cn("w-full h-full flex items-center justify-center", typeConfig.bgColor)}>
          <Icon className={typeConfig.color} size={size * 0.4} />
        </div>
      )}
    </div>
  );

  // Pas de preview pour les non-visuels
  if (media.type !== 'image' && media.type !== 'video') {
    return thumbnailContent;
  }

  return (
    <TooltipProvider delayDuration={300} skipDelayDuration={30000}>
      <Tooltip>
        <TooltipTrigger asChild>
          {thumbnailContent}
        </TooltipTrigger>
        <TooltipContent 
          side="right" 
          className="p-1 bg-black border border-white/20"
          sideOffset={10}
        >
          {media.type === 'image' ? (
            <img
              src={media.url}
              alt={media.name || media.filename}
              className="max-w-[300px] max-h-[300px] object-contain rounded"
              loading="lazy"
            />
          ) : (
            <video
              src={media.url}
              className="max-w-[300px] max-h-[300px] object-contain rounded"
              muted
              autoPlay
              loop
              preload="metadata"
            />
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Icône DVR - brillante si transféré, grise sinon
function DvrIcon({ transferred, size = 16 }: { transferred: boolean; size?: number }) {
  return (
    <div 
      className={cn(
        "relative flex items-center justify-center",
        transferred 
          ? "opacity-100 drop-shadow-[0_0_4px_rgba(255,255,255,0.8)]" 
          : "opacity-25"
      )}
      style={{ width: size, height: size }}
    >
      <img 
        src="/dvr-icon.png" 
        alt="DVR" 
        className={cn(
          "w-full h-full object-contain",
          !transferred && "grayscale brightness-50",
          transferred && "brightness-125 saturate-150"
        )}
      />
    </div>
  );
}

// Composant ligne média avec surbrillance au hover
function MediaRow({
  media,
  columns,
  columnWidths,
  isSelected,
  onSelect,
  onSelectRange,
  onUpdateMetadata,
  onDragStart,
  onSendToDVR,
  onClearFavoritesSort,
  fontSize,
}: {
  media: MediaItem;
  columns: ColumnConfig[];
  columnWidths: Record<string, number>;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onSelectRange: (id: string) => void;
  onUpdateMetadata: (id: string, updates: Partial<MediaItem>) => void;
  onDragStart: (e: React.DragEvent, media: MediaItem) => void;
  onSendToDVR: (media: MediaItem) => void;
  onClearFavoritesSort: () => void;
  fontSize: number;
}) {
  
  const handleSendToDVR = useCallback((mediaItem: MediaItem) => {
    onSendToDVR(mediaItem);
  }, [onSendToDVR]);
  const typeConfig = mediaTypeConfig[media.type] || mediaTypeConfig.document;
  const Icon = typeConfig.icon;

  const renderCell = (column: ColumnConfig) => {
    const cellStyle = { fontSize };
    const width = columnWidths[column.id] || column.width;
    
    switch (column.id) {
      case 'preview':
        return <MediaThumbnail media={media} size={Math.max(40, fontSize * 4)} />;

      case 'name':
        // Nom éditable avec tooltip affichant le chemin complet
        return (
          <EditableName
            media={media}
            fontSize={fontSize}
            onRename={async (newName) => {
              // Appeler l'API de renommage
              try {
                const response = await fetch('/api/storage/rename', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    filePath: media.path,
                    newName,
                  }),
                });
                
                const result = await response.json();
                
                if (result.success) {
                  // Mettre à jour les métadonnées locales
                  onUpdateMetadata(media.id, { 
                    name: result.newName,
                    path: result.newPath,
                    url: result.newUrl,
                    filename: result.newFilename,
                  });
                  
                  // Si transféré dans DVR, notifier l'utilisateur qu'il faut renommer manuellement
                  if (media.dvrTransferred) {
                    toast.info(`Clip renommé`, {
                      duration: 30000,
                      description: 'Pensez à renommer aussi dans DaVinci Resolve.',
                    });
                  } else {
                    toast.success(`Clip renommé en "${result.newName}"`, { duration: 5000 });
                  }
                } else {
                  throw new Error(result.error);
                }
              } catch (error) {
                toast.error(error instanceof Error ? error.message : 'Erreur lors du renommage', { duration: 30000 });
              }
            }}
          />
        );

      case 'type':
        return (
          <span className={cn("flex items-center justify-center", typeConfig.color)}>
            <Icon size={Math.max(fontSize + 4, 18)} className="flex-shrink-0" />
          </span>
        );

      case 'format':
        return <span style={cellStyle}>{media.format || ''}</span>;

      case 'scene':
        return (
          <EditableCell
            value={media.scene}
            onChange={(value) => onUpdateMetadata(media.id, { scene: value })}
            fontSize={fontSize}
          />
        );

      case 'decor':
        return (
          <EditableCell
            value={media.decor}
            onChange={(value) => onUpdateMetadata(media.id, { decor: value })}
            fontSize={fontSize}
          />
        );

      case 'description':
        return (
          <EditableCell
            value={media.description}
            onChange={(value) => onUpdateMetadata(media.id, { description: value })}
            fontSize={fontSize}
          />
        );

      case 'dimensions':
        return (
          <span style={cellStyle}>
            {media.width && media.height ? `${media.width} × ${media.height}` : ''}
          </span>
        );

      case 'duration':
        return <span style={cellStyle}>{formatDuration(media.duration)}</span>;

      case 'fps':
        return <span style={cellStyle}>{media.fps ? `${media.fps}` : '-'}</span>;

      case 'fileSize':
        return <span style={cellStyle}>{formatFileSize(media.fileSize)}</span>;

      case 'isGenerated':
        return media.isGenerated ? (
          <Sparkles size={fontSize} className="text-amber-400" />
        ) : (
          <span style={cellStyle} className="text-neutral-500">-</span>
        );

      case 'modelId':
        return <LongTextTooltip text={media.modelId} fontSize={fontSize} maxLength={20} />;

      case 'prompt':
        return <LongTextTooltip text={media.prompt} fontSize={fontSize} maxLength={40} />;

      case 'aspectRatio':
        // Calculer le ratio depuis les dimensions si disponibles
        const ratio = media.width && media.height 
          ? (media.width / media.height).toFixed(2) 
          : media.aspectRatio || '';
        return <span style={cellStyle}>{ratio}</span>;

      case 'seed':
        return <span style={cellStyle}>{media.seed || ''}</span>;

      case 'dvrTransferred':
        return (
          <button
            onClick={(e) => {
              e.stopPropagation();
              // Appeler l'API DVR pour envoyer le média
              handleSendToDVR(media);
            }}
            className="p-1 rounded hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            title="Ouvrir dans DaVinci Resolve"
          >
            <ArrowUpRight size={fontSize} />
          </button>
        );

      case 'dvrProject':
        return <LongTextTooltip text={media.dvrProject} fontSize={fontSize} maxLength={20} />;

      case 'favorites':
        // Affichage des étoiles de 0 à 5
        const currentStars = media.favorites || 0;
        return (
          <div 
            data-favorites="true"
            className="flex items-center gap-1"
          >
            {[1, 2, 3, 4, 5].map((starValue) => (
              <button
                key={starValue}
                type="button"
                data-favorites="true"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  // Verrouiller l'ordre actuel pour éviter le re-tri
                  onClearFavoritesSort();
                  const newValue = starValue === currentStars ? starValue - 1 : starValue;
                  onUpdateMetadata(media.id, { favorites: newValue });
                }}
                className="p-0.5 hover:scale-125 transition-transform cursor-pointer"
              >
                <Star 
                  size={fontSize + 2} 
                  style={starValue <= currentStars ? { fill: '#d4a054', color: '#d4a054' } : undefined}
                  className={cn(
                    "pointer-events-none transition-colors",
                    starValue > currentStars && "text-white/25 hover:text-amber-200/40"
                  )}
                />
              </button>
            ))}
          </div>
        );

      case 'tags':
        return <LongTextTooltip text={media.tags?.join(', ')} fontSize={fontSize} maxLength={30} />;

      case 'createdAt':
        return <span style={cellStyle}>{formatDate(media.createdAt)}</span>;

      case 'updatedAt':
        return <span style={cellStyle}>{formatDate(media.updatedAt)}</span>;

      case 'usedInProjects':
        return <span style={cellStyle}>{media.usedInProjects?.length || 0}</span>;

      default:
        return <span style={cellStyle}>-</span>;
    }
  };

  const handleSelect = (e?: React.MouseEvent | React.KeyboardEvent) => {
    const shiftKey = e && 'shiftKey' in e ? e.shiftKey : false;
    if (shiftKey) {
      onSelectRange(media.id);
    } else {
      onSelect(media.id);
    }
  };

  // Calculer les positions sticky pour les colonnes fixes (type, preview, name après checkbox)
  // Checkbox est à left:0, puis type, preview, name sont sticky
  const checkboxWidth = 40; // w-10 = 40px
  const typeCol = columns.find(c => c.id === 'type');
  const typeWidth = typeCol ? (columnWidths['type'] || typeCol.width) : 40;
  const previewCol = columns.find(c => c.id === 'preview');
  const previewWidth = previewCol ? (columnWidths['preview'] || previewCol.width) : 60;
  
  const [isHovering, setIsHovering] = useState(false);
  
  // Couleurs opaques pour les colonnes sticky (évite la transparence au scroll)
  const hoverBg = '#1a1a1a'; // ~équivalent à black + white/8
  const selectedBg = '#2a2a2a'; // ~équivalent à black + white/15
  const baseBg = 'black';
  
  // Background uniforme pour toutes les cellules
  const rowBg = isSelected ? selectedBg : (isHovering ? hoverBg : baseBg);
  
  const getStickyStyle = (columnId: string): React.CSSProperties => {
    if (columnId === 'checkbox') {
      return { position: 'sticky', left: 0, zIndex: 2 };
    }
    if (columnId === 'type') {
      return { position: 'sticky', left: checkboxWidth, zIndex: 2 };
    }
    if (columnId === 'preview') {
      return { position: 'sticky', left: checkboxWidth + typeWidth, zIndex: 2 };
    }
    if (columnId === 'name') {
      return { position: 'sticky', left: checkboxWidth + typeWidth + previewWidth, zIndex: 2 };
    }
    return {};
  };
  
  // Les colonnes sticky
  const stickyColumnIds = ['type', 'preview', 'name'];
  
  return (
    <tr
      draggable
      onDragStart={(e) => {
        // Ne pas démarrer le drag si on clique sur les étoiles
        const target = e.target as HTMLElement;
        if (target.closest('[data-favorites]')) {
          e.preventDefault();
          return;
        }
        onDragStart(e, media);
      }}
      onClick={handleSelect}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      className="group border-b border-white/5 cursor-pointer"
    >
      {/* Checkbox de sélection - sticky avec padding gauche */}
      <td 
        className="w-10 pl-3 pr-1 align-middle" 
        style={{ fontSize, backgroundColor: rowBg, ...getStickyStyle('checkbox') }}
      >
        <div className="flex items-center justify-center h-full pt-0.5">
          <Checkbox
            checked={isSelected}
            onClick={(e) => {
              e.stopPropagation();
              handleSelect(e);
            }}
            className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black cursor-pointer"
          />
        </div>
      </td>

      {/* Colonnes dynamiques */}
      {columns.map((column) => {
        const width = columnWidths[column.id] || column.width;
        const isSticky = stickyColumnIds.includes(column.id);
        const stickyStyle = isSticky ? getStickyStyle(column.id) : {};
        const needsCenter = column.id === 'type';
        const isFavorites = column.id === 'favorites';
        
        if (isFavorites) {
          return (
            <td
              key={column.id}
              data-favorites="true"
              onClick={(e) => e.stopPropagation()}
              className="px-1 py-1 text-white/80"
              style={{ 
                width, 
                minWidth: width, 
                maxWidth: width,
                backgroundColor: rowBg,
              }}
            >
              {renderCell(column)}
            </td>
          );
        }
        
        return (
          <td
            key={column.id}
            className={cn(
              "px-1 py-1 text-white/80",
              needsCenter && "text-center"
            )}
            style={{ 
              width, 
              minWidth: width, 
              maxWidth: width,
              backgroundColor: rowBg,
              ...stickyStyle,
            }}
          >
            {renderCell(column)}
          </td>
        );
      })}
    </tr>
  );
}

// Composant header de colonne avec resize handle
function ColumnHeader({
  column,
  columnWidth,
  sortColumn,
  sortDirection,
  onSort,
  onResize,
  fontSize,
  stickyStyle = {},
}: {
  column: ColumnConfig;
  columnWidth: number;
  sortColumn: string;
  sortDirection: 'asc' | 'desc';
  onSort: (column: string) => void;
  onResize: (columnId: string, width: number) => void;
  fontSize: number;
  stickyStyle?: React.CSSProperties;
}) {
  const isSorted = sortColumn === column.id;
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = columnWidth;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startXRef.current;
      const newWidth = Math.max(40, startWidthRef.current + diff);
      onResize(column.id, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  const needsCenter = column.id === 'type';
  
  return (
    <th
      className={cn(
        'px-1 py-1 font-medium text-white/60 transition-colors select-none whitespace-nowrap relative group/header bg-black',
        needsCenter ? 'text-center' : 'text-left',
        isSorted && 'text-white'
      )}
      style={{ width: columnWidth, minWidth: columnWidth, maxWidth: columnWidth, fontSize, ...stickyStyle }}
    >
      <span 
        className={cn(
          "flex items-center gap-1 cursor-pointer hover:text-white/80",
          needsCenter && "justify-center"
        )}
        onClick={() => onSort(column.id)}
      >
        {column.label}
        {isSorted && (
          sortDirection === 'asc' ? (
            <ArrowUp size={fontSize - 2} />
          ) : (
            <ArrowDown size={fontSize - 2} />
          )
        )}
      </span>
      
      {/* Resize handle */}
      <div
        className={cn(
          "absolute right-0 top-0 w-1 h-full cursor-col-resize transition-colors",
          isResizing ? "bg-white/50" : "bg-transparent hover:bg-white/30"
        )}
        onMouseDown={handleResizeStart}
      />
    </th>
  );
}

// Composant sélecteur de colonnes avec drag & drop
function ColumnSelector({
  columns,
  onToggleColumn,
  onReorderColumns,
  onReset,
  fontSize,
}: {
  columns: ColumnConfig[];
  onToggleColumn: (columnId: string, visible: boolean) => void;
  onReorderColumns: (columns: ColumnConfig[]) => void;
  onReset: () => void;
  fontSize: number;
}) {
  const [orderedColumns, setOrderedColumns] = useState(columns);

  useEffect(() => {
    setOrderedColumns(columns);
  }, [columns]);

  const handleReorder = (newOrder: ColumnConfig[]) => {
    const updated = newOrder.map((col, index) => ({ ...col, order: index }));
    setOrderedColumns(updated);
    onReorderColumns(updated);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0 flex-shrink-0"
          title="Configurer les colonnes"
        >
          <Settings2 size={fontSize} />
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-neutral-900 border-neutral-700 text-white max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">Configuration des colonnes</DialogTitle>
        </DialogHeader>
        
        <div className="text-xs text-white/50 mb-2">
          Cochez pour afficher, glissez pour réordonner
        </div>
        
        <ScrollArea className="h-[400px] pr-4">
          <Reorder.Group 
            axis="y" 
            values={orderedColumns} 
            onReorder={handleReorder}
            className="space-y-1"
          >
            {orderedColumns.map((col) => (
              <Reorder.Item
                key={col.id}
                value={col}
                className={cn(
                  "flex items-center gap-2 px-2 py-1.5 rounded cursor-grab active:cursor-grabbing",
                  "bg-neutral-800 hover:bg-neutral-700 transition-colors"
                )}
              >
                <GripVertical size={14} className="text-white/40 flex-shrink-0" />
                <Checkbox
                  id={col.id}
                  checked={col.visible}
                  onCheckedChange={(checked) => onToggleColumn(col.id, !!checked)}
                  className="border-white/30 data-[state=checked]:bg-white data-[state=checked]:text-black"
                />
                <label 
                  htmlFor={col.id} 
                  className="flex-1 text-sm text-white/80 cursor-pointer"
                >
                  {col.label}
                </label>
                {col.visible && (
                  <Check size={14} className="text-green-400 flex-shrink-0" />
                )}
              </Reorder.Item>
            ))}
          </Reorder.Group>
        </ScrollArea>
        
        <div className="flex justify-end pt-2 border-t border-white/10">
          <Button
            variant="ghost"
            size="sm"
            onClick={onReset}
            className="text-white/60 hover:text-white"
          >
            Réinitialiser
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Composant section
function SidebarSectionComponent({
  section,
  isExpanded,
  onToggle,
  children,
  fontSize,
}: {
  section: typeof SECTIONS[0];
  isExpanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  fontSize: number;
}) {
  const Icon = section.icon;

  return (
    <div className="border-b border-white/10">
      <button
        onClick={onToggle}
        className="w-full px-3 py-2 flex items-center gap-2 hover:bg-white/5 transition-colors"
        style={{ fontSize }}
      >
        <span className="text-white/60">
          {isExpanded ? <ChevronDown size={fontSize} /> : <ChevronRight size={fontSize} />}
        </span>
        <Icon size={fontSize} className="text-white/60" />
        <span className="font-medium text-white">{section.label}</span>
        <span className="text-white/40 ml-auto" style={{ fontSize: fontSize - 2 }}>{section.description}</span>
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Composant principal
export function MediaLibrarySidebar() {
  const {
    isOpen,
    closeSidebar,
    toggleSidebar,
    expandedSections,
    toggleSection,
    medias,
    isLoading,
    fetchMedias,
    selectedMediaIds,
    toggleMediaSelection,
    selectMediaRange,
    clearSelection,
    deleteSelectedMedias,
    columns,
    sort,
    setSort,
    lockCurrentOrder,
    filters,
    setFilters,
    setColumnVisibility,
    reorderColumns,
    setColumnWidth,
    resetColumns,
    updateMediaMetadata,
    getVisibleColumns,
    getSortedMedias,
    sidebarWidth,
    setSidebarWidth,
    fontSize,
    increaseFontSize,
    decreaseFontSize,
  } = useMediaLibraryStore();

  const [searchValue, setSearchValue] = useState('');
  const [isResizing, setIsResizing] = useState(false);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  // lastSelectedId est maintenant géré dans le store
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollState, setScrollState] = useState({ canScrollLeft: false, canScrollRight: false });

  // Initialiser les largeurs de colonnes
  useEffect(() => {
    const widths: Record<string, number> = {};
    columns.forEach((col) => {
      widths[col.id] = col.width;
    });
    setColumnWidths(widths);
  }, [columns]);

  // Charger les médias à l'ouverture
  useEffect(() => {
    if (isOpen && medias.length === 0) {
      fetchMedias();
    }
  }, [isOpen, medias.length, fetchMedias]);

  // Mettre à jour l'état des flèches de scroll horizontal
  const updateScrollState = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    
    const { scrollLeft, scrollWidth, clientWidth } = container;
    setScrollState({
      canScrollLeft: scrollLeft > 0,
      canScrollRight: scrollLeft + clientWidth < scrollWidth - 1,
    });
  }, []);

  // Observer les changements de scroll et de taille
  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    updateScrollState();
    container.addEventListener('scroll', updateScrollState);
    
    // Observer le redimensionnement
    const resizeObserver = new ResizeObserver(updateScrollState);
    resizeObserver.observe(container);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      resizeObserver.disconnect();
    };
  }, [updateScrollState, isOpen, sidebarWidth]);

  // Fonctions de navigation horizontale
  const scrollLeft = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: -200, behavior: 'smooth' });
  }, []);

  const scrollRight = useCallback(() => {
    const container = tableContainerRef.current;
    if (!container) return;
    container.scrollBy({ left: 200, behavior: 'smooth' });
  }, []);

  // Mettre à jour le filtre de recherche avec debounce
  useEffect(() => {
    const timeout = setTimeout(() => {
      setFilters({ search: searchValue || undefined });
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchValue, setFilters]);

  // Raccourcis clavier CMD+/CMD- pour zoom
  useEffect(() => {
    if (!isOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          increaseFontSize();
        } else if (e.key === '-') {
          e.preventDefault();
          decreaseFontSize();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, increaseFontSize, decreaseFontSize]);

  // Fermer la sidebar quand on clique en dehors (sans bloquer le scroll du canvas)
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      
      // Vérifier si le clic est dans la sidebar
      if (sidebarRef.current && sidebarRef.current.contains(target)) return;
      
      // Ignorer les clics sur le bouton toggle
      const toggleButton = document.querySelector('[title="Bibliothèque de médias (⌘⇧M)"]');
      if (toggleButton && toggleButton.contains(target)) return;
      
      // Ignorer les clics sur les portails Radix (dropdowns, dialogs, etc.)
      const radixPortal = (target as HTMLElement).closest?.('[data-radix-popper-content-wrapper], [data-radix-portal], [role="dialog"], [role="menu"]');
      if (radixPortal) return;
      
      closeSidebar();
    };

    // Délai pour éviter de fermer immédiatement à l'ouverture
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, closeSidebar]);

  // Gestion du resize de la sidebar
  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const newWidth = e.clientX;
      setSidebarWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, setSidebarWidth]);

  // Handle column resize
  const handleColumnResize = useCallback((columnId: string, width: number) => {
    setColumnWidths((prev) => ({ ...prev, [columnId]: width }));
    setColumnWidth(columnId, width);
  }, [setColumnWidth]);

  // Gérer le drag start pour le drag & drop vers le canvas
  const handleDragStart = useCallback((e: React.DragEvent, media: MediaItem) => {
    const dragData = {
      type: 'media-library-item',
      media: {
        id: media.id,
        url: media.url,
        type: media.type,
        name: media.name || media.filename,
        width: media.width,
        height: media.height,
        duration: media.duration,
      },
    };
    
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  // Ouvrir DVR dans le bon dossier et copier le nom du clip
  // Vérifie d'abord si le clip existe dans DVR
  const handleSendMediaToDVR = useCallback(async (media: MediaItem) => {
    try {
      const clipName = media.name || media.filename;
      
      // Déterminer le dossier cible attendu
      const expectedFolder = media.isGenerated ? 'TersaFork' : 'TersaFork/Imports from disk';
      
      // D'abord, vérifier si le clip existe encore dans DVR
      const checkResponse = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check-clip',
          clipName,
          targetFolder: expectedFolder,
          searchBothFolders: true, // Chercher aussi dans l'autre dossier
        }),
      });

      const checkResult = await checkResponse.json();
      
      if (!checkResult.success) {
        // DVR non accessible
        throw new Error(checkResult.error || 'DaVinci Resolve non accessible');
      }
      
      if (!checkResult.found) {
        // Clip non trouvé dans DVR
        toast.error(`Clip introuvable dans DVR`, {
          duration: 30000,
          description: `"${clipName}" n'existe plus dans DaVinci Resolve. Il a peut-être été supprimé ou déplacé.`,
          action: {
            label: 'Re-transférer',
            onClick: async () => {
              // Déclencher un nouveau transfert vers DVR puis ouvrir DVR
              try {
                const importResponse = await fetch('/api/davinci-resolve', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    action: 'import',
                    filePath: media.path,
                    targetFolder: expectedFolder,
                    clipName,
                    metadata: {
                      scene: media.scene,
                      description: media.description,
                    },
                  }),
                });
                
                const importResult = await importResponse.json();
                
                if (importResult.success) {
                  // Mettre à jour le statut dvrTransferred
                  updateMediaMetadata(media.id, { dvrTransferred: true });
                  
                  // Copier le nom dans le presse-papier et ouvrir DVR
                  await navigator.clipboard.writeText(clipName);
                  
                  await fetch('/api/davinci-resolve', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      action: 'focus-search',
                      clipName,
                      targetFolder: expectedFolder,
                    }),
                  });
                  
                  toast.success(`"${clipName}" re-transféré et copié`, { 
                    duration: 30000,
                    description: 'DVR ouvert. Collez dans la recherche.',
                  });
                } else {
                  throw new Error(importResult.error);
                }
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Erreur lors du re-transfert', { duration: 30000 });
              }
            },
          },
        });
        return;
      }
      
      // Clip trouvé ! Vérifier s'il est dans un dossier différent
      const actualFolder = checkResult.clip_info?.folder;
      
      // Copier le nom dans le presse-papier
      await navigator.clipboard.writeText(clipName);
      
      // Utiliser le dossier où le clip a été trouvé (pas le dossier attendu)
      const targetFolder = actualFolder || expectedFolder;
      
      const response = await fetch('/api/davinci-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'focus-search',
          clipName,
          targetFolder,
        }),
      });

      const result = await response.json();
      
      if (result.success) {
        // Informer si le clip était dans un dossier différent
        if (actualFolder && actualFolder !== expectedFolder) {
          toast.success(`"${clipName}" trouvé dans ${actualFolder}`, {
            duration: 30000,
            description: 'Nom copié dans le presse-papier. Collez dans la recherche DVR.',
          });
        } else {
          toast.success(`"${clipName}" copié dans le presse-papier`, {
            duration: 30000,
            description: 'Collez dans la barre de recherche DVR',
          });
        }
      } else {
        throw new Error(result.error || 'Erreur DVR');
      }
    } catch (error) {
      console.error('[MediaLibrary] Erreur DVR:', error);
      toast.error(error instanceof Error ? error.message : 'Erreur lors de l\'ouverture DVR', { duration: 30000 });
    }
  }, [updateMediaMetadata]);

  const visibleColumns = getVisibleColumns();
  const sortedMedias = getSortedMedias();

  return (
    <>
      {/* Chevron toggle en haut à gauche (toujours visible) - pointer-events uniquement sur le bouton */}
      <div className="fixed top-4 left-4 z-50 pointer-events-none">
        <button
          onClick={toggleSidebar}
          className={cn(
            'pointer-events-auto flex items-center justify-center w-8 h-8 rounded-lg transition-all',
            isOpen 
              ? 'bg-white text-black hover:bg-white/90' 
              : 'bg-black/80 text-white hover:bg-black border border-white/20'
          )}
          title="Bibliothèque de médias (⌘⇧M)"
        >
          {isOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      <AnimatePresence>
        {isOpen && (
          <>

            {/* Sidebar depuis la gauche */}
            <motion.div
              ref={sidebarRef}
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed left-0 top-0 h-full bg-black z-50 flex flex-col shadow-2xl border-r border-white/10"
              style={{ 
                width: sidebarWidth,
                overscrollBehavior: 'contain', // Empêche le scroll de se propager
              }}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-white/10">
                <h2 className="font-semibold text-white" style={{ fontSize: fontSize + 4 }}>Bibliothèque</h2>
                <div className="flex items-center gap-1">
                  {/* Zoom controls */}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={decreaseFontSize}
                    className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                    title="Réduire la police (⌘-)"
                  >
                    <ZoomOut size={14} />
                  </Button>
                  <span className="text-white/40 text-xs w-6 text-center">{fontSize}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={increaseFontSize}
                    className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                    title="Agrandir la police (⌘+)"
                  >
                    <ZoomIn size={14} />
                  </Button>
                  <div className="w-px h-4 bg-white/20 mx-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchMedias()}
                    disabled={isLoading}
                    className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                  >
                    <RefreshCw size={14} className={cn(isLoading && 'animate-spin')} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={closeSidebar}
                    className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0"
                  >
                    <X size={16} />
                  </Button>
                </div>
              </div>

              {/* Sections - zone scrollable simplifiée */}
              <div className="flex-1 overflow-y-auto" style={{ overscrollBehavior: 'contain' }}>
                {SECTIONS.map((section) => (
                  <SidebarSectionComponent
                    key={section.id}
                    section={section}
                    isExpanded={expandedSections[section.id]}
                    onToggle={() => toggleSection(section.id)}
                    fontSize={fontSize}
                  >
                    {section.id === 'media' && (
                      <div className="flex flex-col">
                        {/* Barre de filtres et recherche */}
                        <div className="bg-black px-2 py-2 border-b border-white/10">
                          <div className="flex items-center gap-1 flex-nowrap">
                            {/* Bouton Trash - visible seulement si sélection */}
                            {selectedMediaIds.size > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={async () => {
                                  if (confirm(`Supprimer ${selectedMediaIds.size} média(s) ? Cette action est irréversible.`)) {
                                    const result = await deleteSelectedMedias();
                                    if (result.deleted > 0) {
                                      // Rafraîchir la liste
                                      fetchMedias();
                                    }
                                  }
                                }}
                                className="text-red-400 hover:text-red-300 hover:bg-red-500/20 h-7 w-7 p-0 flex-shrink-0"
                                title={`Supprimer ${selectedMediaIds.size} média(s)`}
                              >
                                <Trash2 size={fontSize} />
                              </Button>
                            )}

                            {/* Filtres de type */}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-white/60 hover:text-white hover:bg-white/10 h-7 w-7 p-0 flex-shrink-0"
                                >
                                  <Filter size={fontSize} />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="bg-neutral-900 border-white/10">
                                <DropdownMenuLabel className="text-white/60" style={{ fontSize }}>
                                  Type de média
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-white/10" />
                                {(['image', 'video', 'audio', 'document'] as const).map((type) => {
                                  const config = mediaTypeConfig[type];
                                  const TypeIcon = config.icon;
                                  const isActive = filters.type?.includes(type);
                                  return (
                                    <DropdownMenuCheckboxItem
                                      key={type}
                                      checked={isActive}
                                      onCheckedChange={(checked) => {
                                        const currentTypes = filters.type || [];
                                        if (checked) {
                                          setFilters({ type: [...currentTypes, type] });
                                        } else {
                                          setFilters({
                                            type: currentTypes.filter((t) => t !== type),
                                          });
                                        }
                                      }}
                                      className="text-white/80 focus:bg-white/10"
                                      style={{ fontSize }}
                                    >
                                      <TypeIcon size={fontSize} className={cn("mr-2", config.color)} />
                                      <span className="capitalize">{type}</span>
                                    </DropdownMenuCheckboxItem>
                                  );
                                })}
                                <DropdownMenuSeparator className="bg-white/10" />
                                <DropdownMenuCheckboxItem
                                  checked={filters.isGenerated === true}
                                  onCheckedChange={(checked) => {
                                    setFilters({ isGenerated: checked ? true : undefined });
                                  }}
                                  className="text-white/80 focus:bg-white/10"
                                  style={{ fontSize }}
                                >
                                  <Sparkles size={fontSize} className="mr-2 text-amber-400" />
                                  Générés uniquement
                                </DropdownMenuCheckboxItem>
                                <DropdownMenuCheckboxItem
                                  checked={filters.dvrTransferred === true}
                                  onCheckedChange={(checked) => {
                                    setFilters({ dvrTransferred: checked ? true : undefined });
                                  }}
                                  className="text-white/80 focus:bg-white/10"
                                  style={{ fontSize }}
                                >
                                  <span className="mr-2 w-4 h-4 flex items-center justify-center">
                                    <DvrIcon transferred={true} size={fontSize} />
                                  </span>
                                  Dans DVR uniquement
                                </DropdownMenuCheckboxItem>
                              </DropdownMenuContent>
                            </DropdownMenu>

                            {/* Configuration colonnes */}
                            <ColumnSelector
                              columns={columns}
                              onToggleColumn={setColumnVisibility}
                              onReorderColumns={reorderColumns}
                              onReset={resetColumns}
                              fontSize={fontSize}
                            />

                            {/* Flèches de navigation horizontale */}
                            <div className="flex items-center gap-0.5">
                              <button
                                onClick={scrollLeft}
                                disabled={!scrollState.canScrollLeft}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  scrollState.canScrollLeft 
                                    ? "text-white/60 hover:text-white hover:bg-white/10" 
                                    : "text-white/20 cursor-default"
                                )}
                                title="Défiler à gauche"
                              >
                                <ChevronLeft size={14} />
                              </button>
                              <button
                                onClick={scrollRight}
                                disabled={!scrollState.canScrollRight}
                                className={cn(
                                  "p-1 rounded transition-colors",
                                  scrollState.canScrollRight 
                                    ? "text-white/60 hover:text-white hover:bg-white/10" 
                                    : "text-white/20 cursor-default"
                                )}
                                title="Défiler à droite"
                              >
                                <ChevronRight size={14} />
                              </button>
                            </div>

                            {/* Barre de recherche - à droite */}
                            <div className="relative flex-1 min-w-[80px]">
                              <Search
                                size={fontSize}
                                className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40"
                              />
                              <Input
                                value={searchValue}
                                onChange={(e) => setSearchValue(e.target.value)}
                                placeholder="Rechercher..."
                                className="pl-7 bg-white/5 border-white/10 text-white placeholder:text-white/40 h-7"
                                style={{ fontSize }}
                              />
                            </div>
                          </div>

                          {/* Compteur et sélection */}
                          <div className="flex items-center justify-between pt-2 text-white/40" style={{ fontSize: fontSize - 1 }}>
                            <span>
                              {sortedMedias.length} média{sortedMedias.length > 1 ? 's' : ''}
                              {selectedMediaIds.size > 0 && (
                                <span className="ml-2 text-white/60">
                                  ({selectedMediaIds.size} sélectionné{selectedMediaIds.size > 1 ? 's' : ''})
                                </span>
                              )}
                            </span>
                            {selectedMediaIds.size > 0 && (
                              <button
                                onClick={clearSelection}
                                className="text-white/60 hover:text-white"
                              >
                                Désélectionner
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Zone de la table avec scroll vertical et horizontal */}
                        <div 
                          ref={tableContainerRef}
                          className="flex-1 overflow-auto pb-3 pr-2 bg-black"
                          style={{ 
                            maxHeight: 'calc(100vh - 280px)',
                            overscrollBehavior: 'contain' // Empêche le scroll de se propager au canvas
                          }}
                        >
                          <table className="w-max min-w-full" style={{ borderCollapse: 'separate', borderSpacing: 0 }}>
                              <thead className="sticky top-0 z-10 bg-black">
                                <tr className="border-b border-white/10">
                                  {/* Checkbox header - sticky avec padding gauche */}
                                  <th 
                                    className="w-10 pl-3 pr-1 bg-black" 
                                    style={{ position: 'sticky', left: 0, zIndex: 20 }}
                                  />
                                  {visibleColumns.map((column) => {
                                    // Calculer la position sticky pour type, preview et name
                                    const checkboxWidth = 40;
                                    const typeCol = visibleColumns.find(c => c.id === 'type');
                                    const typeWidth = typeCol ? (columnWidths['type'] || typeCol.width) : 40;
                                    const previewCol = visibleColumns.find(c => c.id === 'preview');
                                    const previewWidth = previewCol ? (columnWidths['preview'] || previewCol.width) : 60;
                                    
                                    let stickyStyle: React.CSSProperties = {};
                                    if (column.id === 'type') {
                                      stickyStyle = { position: 'sticky', left: checkboxWidth, zIndex: 20, backgroundColor: 'black' };
                                    } else if (column.id === 'preview') {
                                      stickyStyle = { position: 'sticky', left: checkboxWidth + typeWidth, zIndex: 20, backgroundColor: 'black' };
                                    } else if (column.id === 'name') {
                                      stickyStyle = { position: 'sticky', left: checkboxWidth + typeWidth + previewWidth, zIndex: 20, backgroundColor: 'black' };
                                    }
                                    
                                    return (
                                      <ColumnHeader
                                        key={column.id}
                                        column={column}
                                        columnWidth={columnWidths[column.id] || column.width}
                                        sortColumn={sort.column}
                                        sortDirection={sort.direction}
                                        onSort={setSort}
                                        onResize={handleColumnResize}
                                        fontSize={fontSize}
                                        stickyStyle={stickyStyle}
                                      />
                                    );
                                  })}
                                </tr>
                              </thead>
                              <tbody>
                                {isLoading ? (
                                  <tr>
                                    <td
                                      colSpan={visibleColumns.length + 1}
                                      className="text-left py-8 text-white/40 pl-4"
                                      style={{ fontSize }}
                                    >
                                      <div className="flex items-center gap-2">
                                        <RefreshCw size={fontSize + 4} className="animate-spin" />
                                        <span>Chargement...</span>
                                      </div>
                                    </td>
                                  </tr>
                                ) : sortedMedias.length === 0 ? (
                                  <tr>
                                    <td
                                      colSpan={visibleColumns.length + 1}
                                      className="text-center py-8 text-white/40"
                                      style={{ fontSize }}
                                    >
                                      Aucun média trouvé
                                    </td>
                                  </tr>
                                ) : (
                                  sortedMedias.map((media) => (
                                    <MediaRow
                                      key={media.id}
                                      media={media}
                                      columns={visibleColumns}
                                      columnWidths={columnWidths}
                                      isSelected={selectedMediaIds.has(media.id)}
                                      onSelect={(id) => {
                                        // Clic simple : toggle la sélection (lastSelectedId géré dans le store)
                                        console.log('[MediaLibrary] Select:', id);
                                        toggleMediaSelection(id);
                                      }}
                                      onSelectRange={(id) => {
                                        // Shift+clic : sélection de plage (lastSelectedId géré dans le store)
                                        console.log('[MediaLibrary] SelectRange:', id);
                                        selectMediaRange(id);
                                      }}
                                      onUpdateMetadata={updateMediaMetadata}
                                      onDragStart={handleDragStart}
                                      onSendToDVR={handleSendMediaToDVR}
                                      onClearFavoritesSort={() => {
                                        // Verrouiller l'ordre actuel pour éviter le re-tri
                                        lockCurrentOrder();
                                      }}
                                      fontSize={fontSize}
                                    />
                                  ))
                                )}
                              </tbody>
                            </table>
                        </div>
                      </div>
                    )}

                    {section.id === 'collections' && (
                      <div className="px-3 py-3 text-white/40" style={{ fontSize }}>
                        Collections sauvegardées (à venir)
                      </div>
                    )}

                    {section.id === 'generators' && (
                      <div className="px-3 py-3 text-white/40" style={{ fontSize }}>
                        Presets et modèles favoris (à venir)
                      </div>
                    )}

                    {section.id === 'history' && (
                      <div className="px-3 py-3 text-white/40" style={{ fontSize }}>
                        Historique des générations (à venir)
                      </div>
                    )}
                  </SidebarSectionComponent>
                ))}
              </div>

              {/* Footer avec infos */}
              <div className="px-3 py-2 border-t border-white/10 text-white/40" style={{ fontSize: fontSize - 1 }}>
                <span>Glisser un média vers le canvas • ⌘+/⌘- pour zoomer</span>
              </div>

              {/* Handle de resize sur le bord droit */}
              <div
                ref={resizeRef}
                className="absolute right-0 top-0 w-2 h-full cursor-ew-resize hover:bg-white/20 transition-colors"
                onMouseDown={() => setIsResizing(true)}
              />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
