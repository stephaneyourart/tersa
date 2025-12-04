/**
 * Edge "Flora" - Connexion fluide et organique style FLORA
 * Utilise les courbes Bézier standard de ReactFlow pour la compatibilité
 * 
 * HIGHLIGHT AU HOVER : L'edge grossit x3 quand un nœud connecté est survolé
 */

import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';
import { useHoveredNodeOptional } from '@/providers/hovered-node';

// Compensation pour le décalage CSS des handles (-3.5rem = -14px)
// Le handle source (droite) est décalé vers la droite, donc on soustrait
// Le handle target (gauche) est décalé vers la gauche, donc on ajoute
const HANDLE_OFFSET = 14;

export const FloraEdge = ({
  id,
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
  // Hook pour le highlight au hover (optionnel pour éviter l'erreur hors provider)
  const hoveredContext = useHoveredNodeOptional();
  const isHighlighted = hoveredContext?.isEdgeHighlighted(id) ?? false;
  
  // État visuel : selected > highlighted > normal
  const isEmphasized = selected || isHighlighted;

  // Ajuster les coordonnées pour toucher les bords des nœuds
  const adjustedSourceX = sourceX - HANDLE_OFFSET;
  const adjustedTargetX = targetX + HANDLE_OFFSET;

  // Utiliser getBezierPath standard de ReactFlow pour la compatibilité
  const [edgePath] = getBezierPath({
    sourceX: adjustedSourceX,
    sourceY,
    sourcePosition,
    targetX: adjustedTargetX,
    targetY,
    targetPosition,
    curvature: 0.4,
  });

  // Générer un ID unique pour le dégradé
  const gradientId = `flora-gradient-${id}`;
  
  // Couleurs selon l'état
  const colors = isEmphasized 
    ? { start: "rgba(255, 255, 255, 0.9)", mid: "rgba(255, 255, 255, 1)", end: "rgba(255, 255, 255, 0.9)" }
    : { start: "rgba(140, 140, 140, 0.5)", mid: "rgba(180, 180, 180, 0.8)", end: "rgba(140, 140, 140, 0.5)" };
  
  // Épaisseurs selon l'état (x3 pour highlight)
  const strokeWidth = isHighlighted ? 6 : selected ? 3 : 2;
  const shadowWidth = isHighlighted ? 12 : selected ? 5 : 4;
  const dotRadius = isHighlighted ? 5 : selected ? 3 : 2.5;

  return (
    <>
      {/* Définition du dégradé */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={colors.start} />
          <stop offset="50%" stopColor={colors.mid} />
          <stop offset="100%" stopColor={colors.end} />
        </linearGradient>
      </defs>
      
      {/* Ombre douce pour profondeur */}
      <path
        d={edgePath}
        fill="none"
        stroke={isHighlighted ? "rgba(255, 255, 255, 0.15)" : "rgba(0, 0, 0, 0.12)"}
        strokeWidth={shadowWidth}
        strokeLinecap="round"
        style={{ 
          filter: isHighlighted ? 'blur(4px)' : 'blur(2px)',
          transition: 'stroke-width 0.15s ease, filter 0.15s ease',
        }}
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
          transition: 'stroke-width 0.15s ease',
          ...style,
        }}
      />
      
      {/* Point lumineux qui voyage le long de la connexion */}
      <circle 
        r={dotRadius} 
        fill={isEmphasized ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.6)"}
        style={{ transition: 'r 0.15s ease' }}
      >
        <animateMotion dur={isHighlighted ? "1.5s" : "3s"} repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};
