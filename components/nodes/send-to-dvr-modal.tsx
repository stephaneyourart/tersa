/**
 * Modale Send to DaVinci Resolve
 * Permet de configurer les métadonnées avant d'envoyer vers DVR
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2Icon, SparklesIcon, SendIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type DVRMediaMetadata = {
  title: string;        // Nom du fichier (50 chars max) + extension
  scene: string;        // Champ Scene dans DVR
  decor: string;        // Champ Comments dans DVR (30 chars max)
  description: string;  // Champ Description dans DVR
};

type SendToDVRModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (metadata: DVRMediaMetadata) => Promise<void>;
  
  // Contexte pour la génération IA
  mediaType: 'image' | 'video' | 'audio';
  mediaUrl: string;
  isGenerated: boolean;  // true si généré, false si importé
  generationPrompt?: string;  // Le prompt utilisé pour la génération
  sourceImages?: string[];    // URLs des images sources (pour vidéo)
  
  // Métadonnées pré-calculées (si disponibles)
  initialMetadata?: {
    title?: string;
    decor?: string;
    description?: string;
  };
  
  // État
  isAnalyzing?: boolean;
  isSending?: boolean;
};

export const SendToDVRModal = ({
  open,
  onOpenChange,
  onSend,
  mediaType,
  mediaUrl,
  isGenerated,
  generationPrompt,
  sourceImages,
  initialMetadata,
  isAnalyzing = false,
  isSending = false,
}: SendToDVRModalProps) => {
  // État des champs
  const [title, setTitle] = useState('');
  const [scene, setScene] = useState('');
  const [decor, setDecor] = useState('');
  const [description, setDescription] = useState('');
  
  // État d'édition (pour savoir si l'utilisateur a modifié manuellement)
  const [titleEdited, setTitleEdited] = useState(false);
  const [decorEdited, setDecorEdited] = useState(false);
  const [descriptionEdited, setDescriptionEdited] = useState(false);

  // Initialiser avec les données existantes quand la modale s'ouvre
  useEffect(() => {
    if (open) {
      // Si on a des métadonnées pré-calculées, les utiliser
      if (initialMetadata) {
        setTitle(initialMetadata.title || '');
        setDecor(initialMetadata.decor || '');
        setDescription(initialMetadata.description || '');
        // Ne pas marquer comme édité pour permettre l'écrasement par l'IA si nécessaire
        setTitleEdited(!!initialMetadata.title);
        setDecorEdited(!!initialMetadata.decor);
        setDescriptionEdited(!!initialMetadata.description);
      } else {
        setTitle('');
        setDecor('');
        setDescription('');
        setTitleEdited(false);
        setDecorEdited(false);
        setDescriptionEdited(false);
      }
      setScene('');
    }
  }, [open, initialMetadata]);

  // Mettre à jour les champs avec les données de l'IA (seulement si pas édité manuellement)
  const updateFromAI = useCallback((aiData: { title?: string; decor?: string; description?: string }) => {
    if (aiData.title && !titleEdited) {
      setTitle(aiData.title.slice(0, 50));
    }
    if (aiData.decor && !decorEdited) {
      setDecor(aiData.decor.slice(0, 30));
    }
    if (aiData.description && !descriptionEdited) {
      setDescription(aiData.description);
    }
  }, [titleEdited, decorEdited, descriptionEdited]);

  // Exposer la fonction updateFromAI via une ref ou un callback
  // Pour l'instant, on l'expose via un effet qui écoute un événement custom
  useEffect(() => {
    const handler = (e: CustomEvent<{ title?: string; decor?: string; description?: string }>) => {
      updateFromAI(e.detail);
    };
    
    window.addEventListener('dvr-ai-analysis-complete' as string, handler as EventListener);
    return () => window.removeEventListener('dvr-ai-analysis-complete' as string, handler as EventListener);
  }, [updateFromAI]);

  // Extension du fichier selon le type de média
  const getExtension = () => {
    switch (mediaType) {
      case 'image': return '.png';
      case 'video': return '.mp4';
      case 'audio': return '.mp3';
      default: return '';
    }
  };

  // Valider que le titre n'est pas vide
  const isValid = title.trim().length > 0;

  // Handler pour l'envoi
  const handleSend = async () => {
    if (!isValid) return;
    
    await onSend({
      title: title.trim() + getExtension(),
      scene: scene.trim(),
      decor: decor.trim(),
      description: description.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SendIcon size={18} />
            Envoyer vers DaVinci Resolve
          </DialogTitle>
          <DialogDescription>
            Configurez les métadonnées avant d'importer dans le Media Pool
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Titre */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="title" className="flex items-center gap-1">
                Titre <span className="text-destructive">*</span>
              </Label>
              <span className="text-xs text-muted-foreground">
                {title.length}/50
              </span>
            </div>
            <div className="relative">
              <Input
                id="title"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value.slice(0, 50));
                  setTitleEdited(true);
                }}
                placeholder="Nom du fichier..."
                className={cn(
                  'pr-8',
                  isAnalyzing && !titleEdited && 'animate-pulse'
                )}
              />
              {isAnalyzing && !titleEdited && (
                <SparklesIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Extension {getExtension()} ajoutée automatiquement
            </p>
          </div>

          {/* Scène */}
          <div className="grid gap-2">
            <Label htmlFor="scene">Scène</Label>
            <Input
              id="scene"
              value={scene}
              onChange={(e) => setScene(e.target.value)}
              placeholder="Nom de la scène..."
            />
            <p className="text-xs text-muted-foreground">
              → Champ "Scene" dans DaVinci Resolve
            </p>
          </div>

          {/* Décor */}
          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="decor">Décor</Label>
              <span className="text-xs text-muted-foreground">
                {decor.length}/30
              </span>
            </div>
            <div className="relative">
              <Input
                id="decor"
                value={decor}
                onChange={(e) => {
                  setDecor(e.target.value.slice(0, 30));
                  setDecorEdited(true);
                }}
                placeholder={isGenerated ? "Prérempli par l'IA..." : "Décrivez le décor..."}
                className={cn(
                  'pr-8',
                  isAnalyzing && !decorEdited && 'animate-pulse'
                )}
              />
              {isAnalyzing && !decorEdited && (
                <SparklesIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              → Champ "Comments" dans DaVinci Resolve
            </p>
          </div>

          {/* Description */}
          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <div className="relative">
              <Textarea
                id="description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  setDescriptionEdited(true);
                }}
                placeholder={isGenerated ? "Prérempli par l'IA..." : "Décrivez la scène..."}
                className={cn(
                  'min-h-[100px] resize-none',
                  isAnalyzing && !descriptionEdited && 'animate-pulse'
                )}
              />
              {isAnalyzing && !descriptionEdited && (
                <SparklesIcon size={14} className="absolute right-3 top-3 text-gray-500 animate-pulse" />
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              → Champ "Description" dans DaVinci Resolve
            </p>
          </div>

          {/* Indicateur de source */}
          {isGenerated && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md p-2">
              <SparklesIcon size={12} />
              <span>Les champs sont préremplis par l'IA à partir du prompt de génération</span>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSending}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSend}
            disabled={!isValid || isSending || isAnalyzing}
            className="bg-black hover:bg-gray-800 text-white gap-2"
          >
            {isSending ? (
              <>
                <Loader2Icon size={14} className="animate-spin" />
                Envoi en cours...
              </>
            ) : (
              <>
                <SendIcon size={14} />
                Envoyer vers DVR
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/**
 * Icône DVR pour indiquer qu'un élément a été transféré
 * En noir et blanc (grayscale)
 */
export const DVRTransferredBadge = ({ 
  className,
}: { 
  className?: string;
}) => {
  return (
    <div 
      className={cn(
        'flex items-center justify-center pointer-events-none',
        className
      )}
      title="Transféré vers DaVinci Resolve"
    >
      {/* Icône DaVinci Resolve en noir et blanc */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img 
        src="/dvr-icon.png" 
        alt="DaVinci Resolve" 
        className="w-10 h-10 object-contain drop-shadow-lg grayscale"
      />
    </div>
  );
};
