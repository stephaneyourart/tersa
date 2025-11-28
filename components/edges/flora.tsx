/**
 * Edge "Flora" - Connexion fluide et organique style FLORA
 * Utilise les courbes Bézier standard de ReactFlow pour la compatibilité
 */

import {
  BaseEdge,
  type EdgeProps,
  getBezierPath,
} from '@xyflow/react';

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

  return (
    <>
      {/* Définition du dégradé */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={selected ? "rgba(200, 200, 200, 0.8)" : "rgba(140, 140, 140, 0.5)"} />
          <stop offset="50%" stopColor={selected ? "rgba(255, 255, 255, 1)" : "rgba(180, 180, 180, 0.8)"} />
          <stop offset="100%" stopColor={selected ? "rgba(200, 200, 200, 0.8)" : "rgba(140, 140, 140, 0.5)"} />
        </linearGradient>
      </defs>
      
      {/* Ombre douce pour profondeur */}
      <path
        d={edgePath}
        fill="none"
        stroke="rgba(0, 0, 0, 0.12)"
        strokeWidth={selected ? 5 : 4}
        strokeLinecap="round"
        style={{ filter: 'blur(2px)' }}
      />
      
      {/* Ligne principale avec dégradé */}
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: `url(#${gradientId})`,
          strokeWidth: selected ? 3 : 2,
          strokeLinecap: 'round',
          transition: 'stroke-width 0.15s ease',
          ...style,
        }}
      />
      
      {/* Point lumineux qui voyage le long de la connexion */}
      <circle r={selected ? 3 : 2.5} fill={selected ? "rgba(255, 255, 255, 0.95)" : "rgba(255, 255, 255, 0.6)"}>
        <animateMotion dur="3s" repeatCount="indefinite" path={edgePath} />
      </circle>
    </>
  );
};
