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
  className?: string;
};

export const SendToDVRButton = ({
  isVisible,
  onClick,
  onHoverChange,
  disabled = false,
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
        // Toujours blanc sur fond noir
        'bg-black text-white hover:bg-gray-800',
        isVisible && 'opacity-100 scale-100',
        className
      )}
    >
      <SendIcon size={14} />
      <span className="text-xs font-medium">Send</span>
    </Button>
  );
};
