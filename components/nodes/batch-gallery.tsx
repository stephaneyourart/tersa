/**
 * Galerie des résultats de Batch Processing
 * Affiche les images/vidéos générées sous forme de grille
 */

'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Maximize2,
  X,
  Play,
  ImageIcon,
  Video,
  Volume2,
} from 'lucide-react';
import type { BatchJobResult } from '@/lib/batch';

type BatchGalleryProps = {
  results: BatchJobResult[];
  type: 'video' | 'image' | 'audio';
  onSelect?: (result: BatchJobResult) => void;
};

export function BatchGallery({ results, type, onSelect }: BatchGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filtrer uniquement les résultats réussis
  const successfulResults = results.filter(
    (r) => r.status === 'completed' && r.result
  );

  if (successfulResults.length === 0) {
    return null;
  }

  const handlePrevious = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(
        selectedIndex > 0 ? selectedIndex - 1 : successfulResults.length - 1
      );
    }
  };

  const handleNext = () => {
    if (selectedIndex !== null) {
      setSelectedIndex(
        selectedIndex < successfulResults.length - 1 ? selectedIndex + 1 : 0
      );
    }
  };

  const handleDownload = async (url: string, filename: string) => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (error) {
      console.error('Erreur téléchargement:', error);
    }
  };

  const getMediaComponent = (result: BatchJobResult, isFullSize: boolean = false) => {
    const url = result.result!;
    const className = isFullSize
      ? 'max-w-full max-h-[80vh] object-contain'
      : 'w-full h-full object-cover';

    switch (type) {
      case 'video':
        return (
          <video
            src={url}
            className={className}
            controls={isFullSize}
            muted={!isFullSize}
            loop
            autoPlay={isFullSize}
          />
        );
      case 'audio':
        return (
          <div className="flex items-center justify-center w-full h-full bg-muted">
            <audio src={url} controls={isFullSize} className="w-full max-w-xs" />
            {!isFullSize && <Volume2 className="h-8 w-8 text-muted-foreground" />}
          </div>
        );
      case 'image':
      default:
        return (
          <img
            src={url}
            alt={`Résultat ${result.index + 1}`}
            className={className}
          />
        );
    }
  };

  const getTypeIcon = () => {
    switch (type) {
      case 'video':
        return <Video className="h-3 w-3" />;
      case 'audio':
        return <Volume2 className="h-3 w-3" />;
      default:
        return <ImageIcon className="h-3 w-3" />;
    }
  };

  return (
    <>
      {/* Grille de miniatures */}
      <div className="p-2">
        <div className="flex items-center justify-between mb-2">
          <Badge variant="secondary" className="text-xs gap-1">
            {getTypeIcon()}
            {successfulResults.length} résultats
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-1.5 max-h-40 overflow-y-auto">
          {successfulResults.map((result, index) => (
            <div
              key={result.id}
              className="relative aspect-video bg-muted rounded overflow-hidden cursor-pointer group"
              onClick={() => {
                setSelectedIndex(index);
                onSelect?.(result);
              }}
              onDoubleClick={() => {
                setSelectedIndex(index);
                setIsModalOpen(true);
              }}
            >
              {getMediaComponent(result, false)}

              {/* Overlay au hover */}
              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedIndex(index);
                    setIsModalOpen(true);
                  }}
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-white"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDownload(
                      result.result!,
                      `batch-result-${index + 1}.${type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'png'}`
                    );
                  }}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>

              {/* Badge numéro */}
              <div className="absolute top-1 left-1">
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-black/60 text-white"
                >
                  #{index + 1}
                </Badge>
              </div>

              {/* Icône play pour vidéos */}
              {type === 'video' && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
                    <Play className="h-4 w-4 text-white ml-0.5" />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Modal plein écran */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 overflow-hidden">
          <DialogTitle className="sr-only">
            Résultat {selectedIndex !== null ? selectedIndex + 1 : ''} sur {successfulResults.length}
          </DialogTitle>
          
          {selectedIndex !== null && (
            <div className="relative flex flex-col">
              {/* Header */}
              <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between p-4 bg-gradient-to-b from-black/50 to-transparent">
                <Badge variant="secondary">
                  {selectedIndex + 1} / {successfulResults.length}
                </Badge>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() =>
                      handleDownload(
                        successfulResults[selectedIndex].result!,
                        `batch-result-${selectedIndex + 1}.${type === 'video' ? 'mp4' : type === 'audio' ? 'mp3' : 'png'}`
                      )
                    }
                  >
                    <Download className="h-5 w-5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20"
                    onClick={() => setIsModalOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              {/* Contenu */}
              <div className="flex items-center justify-center min-h-[60vh] bg-black p-8">
                {getMediaComponent(successfulResults[selectedIndex], true)}
              </div>

              {/* Navigation */}
              {successfulResults.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                    onClick={handlePrevious}
                  >
                    <ChevronLeft className="h-8 w-8" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 h-12 w-12"
                    onClick={handleNext}
                  >
                    <ChevronRight className="h-8 w-8" />
                  </Button>
                </>
              )}

              {/* Miniatures en bas */}
              <div className="flex gap-2 p-4 bg-black/80 overflow-x-auto">
                {successfulResults.map((result, index) => (
                  <button
                    key={result.id}
                    className={`flex-shrink-0 w-16 h-12 rounded overflow-hidden border-2 transition-colors ${
                      index === selectedIndex
                        ? 'border-primary'
                        : 'border-transparent hover:border-white/50'
                    }`}
                    onClick={() => setSelectedIndex(index)}
                  >
                    {type === 'image' ? (
                      <img
                        src={result.result!}
                        alt={`Miniature ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    ) : type === 'video' ? (
                      <video
                        src={result.result!}
                        className="w-full h-full object-cover"
                        muted
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <Volume2 className="h-4 w-4" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

