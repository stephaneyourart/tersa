/**
 * Composant et hook pour gérer les médias expirés
 * Détecte quand une URL WaveSpeed/Fal n'est plus accessible
 */

import { useState, useEffect, useCallback } from 'react';
import { GhostIcon, AlertTriangleIcon, RefreshCwIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

type ExpiredMediaProps = {
  className?: string;
  message?: string;
  onRetry?: () => void;
};

export function ExpiredMedia({ className, message, onRetry }: ExpiredMediaProps) {
  return (
    <div 
      className={cn(
        'flex flex-col items-center justify-center gap-3 bg-black rounded-b-xl p-8 min-h-[200px]',
        className
      )}
    >
      <div className="relative">
        <GhostIcon size={48} className="text-muted-foreground/50 animate-pulse" />
        <AlertTriangleIcon 
          size={18} 
          className="absolute -bottom-1 -right-1 text-amber-500" 
        />
      </div>
      <div className="text-center space-y-2">
        <p className="text-sm font-medium text-muted-foreground">
          Média expiré
        </p>
        <p className="text-xs text-muted-foreground/70 max-w-[200px]">
          {message || "Ce fichier n'a pas été téléchargé et n'est plus disponible sur WaveSpeed"}
        </p>
        {onRetry && (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onRetry}
            className="mt-2 gap-1.5"
          >
            <RefreshCwIcon size={12} />
            Réessayer
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * Hook pour détecter si un média est expiré/inaccessible
 * Vérifie l'URL immédiatement et met à jour l'état
 * Gère aussi les fichiers locaux qui peuvent avoir été supprimés par un autre projet
 */
export function useMediaExpired(url: string | undefined, isLocal: boolean = false) {
  const [isExpired, setIsExpired] = useState(false);
  const [isChecking, setIsChecking] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Vérifier si c'est une URL locale
  const checkIsLocalUrl = useCallback((url: string) => {
    if (!url) return true;
    return (
      url.startsWith('/api/storage/') ||
      url.startsWith('/storage/') ||
      url.startsWith('blob:') ||
      url.startsWith('data:') ||
      url.startsWith('file://') ||
      /^[A-Z]:\\/.test(url) ||
      (url.startsWith('/') && !url.startsWith('//'))
    );
  }, []);

  // Vérification de l'URL (locale ou distante)
  const checkUrl = useCallback(async () => {
    if (!url) {
      setIsExpired(false);
      return;
    }

    setIsChecking(true);
    
    const urlIsLocal = checkIsLocalUrl(url) || isLocal;
    
    try {
      if (urlIsLocal) {
        // Pour les fichiers locaux, vérifier s'ils existent sur le disque
        // (un autre projet peut avoir supprimé le fichier)
        const response = await fetch('/api/file-exists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filePath: url }),
        });
        
        if (response.ok) {
          const data = await response.json();
          setIsExpired(!data.exists);
        } else {
          // En cas d'erreur API, on tente un HEAD
          const headResponse = await fetch(url, { method: 'HEAD' });
          setIsExpired(!headResponse.ok);
        }
      } else {
        // Pour les URLs distantes (WaveSpeed, etc.)
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store',
        });
        
        clearTimeout(timeoutId);
        setIsExpired(!response.ok);
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setIsExpired(true);
      } else {
        // Erreur réseau - ne pas marquer comme expiré automatiquement
        console.warn('URL check failed:', url);
      }
    } finally {
      setIsChecking(false);
      setLastChecked(new Date());
    }
  }, [url, isLocal, checkIsLocalUrl]);

  // Vérifier au montage et quand l'URL change
  useEffect(() => {
    if (url) {
      checkUrl();
    } else {
      setIsExpired(false);
    }
  }, [url, checkUrl]);

  // Fonction pour marquer manuellement comme expiré (appelé par onError)
  const markAsExpired = useCallback(() => {
    setIsExpired(true);
  }, []);

  // Fonction pour réessayer la vérification
  const retry = useCallback(() => {
    setIsExpired(false);
    checkUrl();
  }, [checkUrl]);

  return {
    isExpired,
    isChecking,
    lastChecked,
    markAsExpired,
    retry,
  };
}

/**
 * Vérifie si une URL est locale (ne peut pas expirer)
 */
export function isLocalUrl(url: string): boolean {
  if (!url) return false;
  return (
    url.startsWith('/api/storage/') ||
    url.startsWith('/storage/') ||
    url.startsWith('blob:') ||
    url.startsWith('data:') ||
    url.startsWith('file://') ||
    /^[A-Z]:\\/.test(url) ||
    (url.startsWith('/') && !url.startsWith('//'))
  );
}
