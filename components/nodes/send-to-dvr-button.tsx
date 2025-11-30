/**
 * Bouton Send to DaVinci Resolve
 * Affiché en hover au-dessus des nœuds image/video/audio
 */

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { SendIcon } from 'lucide-react';

type SendToDVRButtonProps = {
  isVisible: boolean;
  onClick: () => void;
  onHoverChange?: (hovered: boolean) => void;
  disabled?: boolean;
  isImported?: boolean; // true si l'élément est importé (pas généré)
  className?: string;
};

export const SendToDVRButton = ({
  isVisible,
  onClick,
  onHoverChange,
  disabled = false,
  isImported = false,
  className,
}: SendToDVRButtonProps) => {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onMouseEnter={() => onHoverChange?.(true)}
      onMouseLeave={() => onHoverChange?.(false)}
      disabled={disabled}
      className={cn(
        'h-8 gap-1.5 rounded-full px-3 shadow-lg transition-all duration-200',
        'border-none',
        'opacity-0 scale-95',
        // Blanc sur noir pour importés, noir sur blanc pour générés
        isImported 
          ? 'bg-black text-white hover:bg-gray-800' 
          : 'bg-white text-black hover:bg-gray-100',
        isVisible && 'opacity-100 scale-100',
        className
      )}
    >
      <SendIcon size={14} />
      <span className="text-xs font-medium">Send</span>
    </Button>
  );
};
