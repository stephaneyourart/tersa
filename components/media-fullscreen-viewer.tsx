'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { XIcon, DownloadIcon, ExternalLinkIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { download } from '@/lib/download';

interface MediaFullscreenViewerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mediaUrl: string;
  mediaType: 'image' | 'video';
  title?: string;
}

export function MediaFullscreenViewer({
  open,
  onOpenChange,
  mediaUrl,
  mediaType,
  title,
}: MediaFullscreenViewerProps) {
  const [isLoading, setIsLoading] = useState(true);
  
  // Reset loading state when media changes
  useEffect(() => {
    if (open) {
      setIsLoading(true);
    }
  }, [open, mediaUrl]);
  
  const handleDownload = useCallback(() => {
    try {
      const mimeType = mediaType === 'video' ? 'video/mp4' : 'image/png';
      const extension = mediaType === 'video' ? 'mp4' : 'png';
      download({ url: mediaUrl, type: mimeType }, title || `media-${Date.now()}`, extension);
    } catch (error) {
      console.error('Download error:', error);
    }
  }, [mediaUrl, mediaType, title]);
  
  const handleOpenExternal = useCallback(() => {
    window.open(mediaUrl, '_blank');
  }, [mediaUrl]);
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 overflow-hidden bg-black/95 border-none">
        {/* Toolbar */}
        <div className="absolute top-4 right-4 z-50 flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={handleDownload}
            title="Télécharger"
          >
            <DownloadIcon size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={handleOpenExternal}
            title="Ouvrir dans un nouvel onglet"
          >
            <ExternalLinkIcon size={18} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full bg-black/50 text-white hover:bg-black/70"
            onClick={() => onOpenChange(false)}
            title="Fermer"
          >
            <XIcon size={18} />
          </Button>
        </div>
        
        {/* Title */}
        {title && (
          <div className="absolute top-4 left-4 z-50">
            <p className="text-white/80 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
              {title}
            </p>
          </div>
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          </div>
        )}
        
        {/* Media content */}
        <div className="flex items-center justify-center w-full h-full p-4">
          {mediaType === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={mediaUrl}
              alt={title || 'Fullscreen preview'}
              className="max-w-full max-h-[90vh] object-contain"
              onLoad={() => setIsLoading(false)}
              style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s' }}
            />
          ) : (
            <video
              src={mediaUrl}
              className="max-w-full max-h-[90vh] object-contain"
              controls
              autoPlay
              loop
              onLoadedData={() => setIsLoading(false)}
              style={{ opacity: isLoading ? 0 : 1, transition: 'opacity 0.3s' }}
            />
          )}
        </div>
        
        {/* Instruction */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-50">
          <p className="text-white/50 text-xs bg-black/50 px-3 py-1 rounded-full">
            Résolution native • Échap pour fermer
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
