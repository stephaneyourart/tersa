import { toast } from 'sonner';
import { parseError } from './parse';

export const handleError = (title: string, error: unknown) => {
  const description = parseError(error);

  // Les toasts d'erreur persistent jusqu'à fermeture manuelle
  toast.error(title, { 
    description,
    duration: Infinity,
    closeButton: true,
  });
};
