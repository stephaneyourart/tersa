/**
 * Edge "Flora" - Connexion fluide et organique style FLORA
 * 
 * ÉPAISSEUR : x2 par défaut (strokeWidth 4), x3 au hover (12)
 * Le hover est géré par CSS (classe .edge-highlighted ajoutée par le canvas)
 * 
 * OPTIMISÉ : Épaisseur adaptée au zoom pour rester visible en zoom out
 */

import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
  useStore,
} from '@xyflow/react';

// Compensation pour le décalage CSS des handles (-3.5rem = -14px)
const HANDLE_OFFSET = 14;

// Hook pour obtenir l'épaisseur adaptée au zoom
function useAdaptiveStrokeWidth(baseWidth: number): number {
  const zoom = useStore((state) => state.transform[2]);
  // En zoom out, augmenter l'épaisseur pour que les lignes restent visibles
  // Minimum 1.5x plus épais à zoom 0.1
  const zoomFactor = Math.max(1, 1.5 / Math.max(zoom, 0.1));
  return Math.min(baseWidth * zoomFactor, baseWidth * 3); // Max 3x
}

// Épaisseurs : x2 par défaut
const STROKE_WIDTH_DEFAULT = 4;      // Base x2
const STROKE_WIDTH_SELECTED = 5;
const SHADOW_WIDTH_DEFAULT = 8;      // Ombre proportionnelle
const SHADOW_WIDTH_SELECTED = 10;

export const FloraEdge = ({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  selected,
}: EdgeProps) => {
  // Ajuster les coordonnées pour toucher les bords des nœuds
  const adjustedSourceX = sourceX - HANDLE_OFFSET;
  const adjustedTargetX = targetX + HANDLE_OFFSET;

  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY,
    targetPosition,
    curvature: 0.4,
  });

  const gradientId = `flora-gradient-${id}`;
  
  // Épaisseurs adaptées au zoom
  const baseStroke = selected ? STROKE_WIDTH_SELECTED : STROKE_WIDTH_DEFAULT;
  const baseShadow = selected ? SHADOW_WIDTH_SELECTED : SHADOW_WIDTH_DEFAULT;
  const strokeWidth = useAdaptiveStrokeWidth(baseStroke);
  const shadowWidth = useAdaptiveStrokeWidth(baseShadow);

  return (
    <g 
      className="flora-edge-group"
      data-edge-id={id}
      data-source={source}
      data-target={target}
    >
      {/* Définition du dégradé */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={selected ? "rgba(200, 200, 200, 0.8)" : "rgba(160, 160, 160, 0.6)"} />
          <stop offset="50%" stopColor={selected ? "rgba(255, 255, 255, 1)" : "rgba(200, 200, 200, 0.9)"} />
          <stop offset="100%" stopColor={selected ? "rgba(200, 200, 200, 0.8)" : "rgba(160, 160, 160, 0.6)"} />
        </linearGradient>
      </defs>
      
      {/* Ombre douce pour profondeur */}
      <path
        className="flora-edge-shadow"
        d={edgePath}
        fill="none"
        stroke="rgba(0, 0, 0, 0.15)"
        strokeWidth={shadowWidth}
        strokeLinecap="round"
        style={{ filter: 'blur(3px)' }}
      />
      
      {/* Ligne principale avec dégradé */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth,
          strokeLinecap: 'round',
          ...style,
        }}
        className="flora-edge-main"
      />
    </g>
  );
};
