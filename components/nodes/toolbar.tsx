import { NodeToolbar as NodeToolbarRaw, useReactFlow } from '@xyflow/react';
import { Position } from '@xyflow/react';
import { Fragment, type ReactNode, useState, useRef, useEffect } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';

type NodeToolbarProps = {
  id: string;
  items:
    | {
        tooltip?: string;
        children: ReactNode;
      }[]
    | undefined;
  isNodeHovered?: boolean;
  onHoverChange?: (isHovered: boolean) => void;
};

export const NodeToolbar = ({ id, items, isNodeHovered, onHoverChange }: NodeToolbarProps) => {
  const { getNode } = useReactFlow();
  const node = getNode(id);
  const [isToolbarHovered, setIsToolbarHovered] = useState(false);
  const hideTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
    setIsToolbarHovered(true);
    onHoverChange?.(true);
  };

  const handleMouseLeave = () => {
    hideTimeoutRef.current = setTimeout(() => {
      setIsToolbarHovered(false);
      onHoverChange?.(false);
    }, 200);
  };

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  // Visible si le nœud est sélectionné OU hovered (nœud ou toolbar)
  const isVisible = node?.selected || isNodeHovered || isToolbarHovered;

  return (
    <NodeToolbarRaw
      isVisible={isVisible}
      position={Position.Bottom}
      className="flex items-center gap-1 rounded-full bg-background/40 p-1.5 backdrop-blur-sm"
    >
      <div 
        className="flex items-center gap-1"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {items?.map((button, index) =>
          button.tooltip ? (
            <Tooltip key={button.tooltip}>
              <TooltipTrigger asChild>{button.children}</TooltipTrigger>
              <TooltipContent>{button.tooltip}</TooltipContent>
            </Tooltip>
          ) : (
            <Fragment key={index}>{button.children}</Fragment>
          )
        )}
      </div>
    </NodeToolbarRaw>
  );
};
