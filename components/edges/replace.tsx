/**
 * Edge "Replace" - Connexion verte matrix pour le mode remplacement
 * Utilisé quand on tire une connexion vers un nœud de même type avec contenu
 */

import { BaseEdge, type EdgeProps, getSimpleBezierPath } from '@xyflow/react';

export const ReplaceEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
}: EdgeProps) => {
  const [edgePath] = getSimpleBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      {/* Glow effect */}
      <BaseEdge
        id={`${id}-glow`}
        path={edgePath}
        style={{
          stroke: '#00ff41',
          strokeWidth: 6,
          strokeOpacity: 0.3,
          filter: 'blur(4px)',
        }}
      />
      {/* Main edge - Matrix green */}
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: '#00ff41',
          strokeWidth: 2,
          strokeDasharray: '8, 4',
          animation: 'dash 0.5s linear infinite',
        }}
      />
      <style>
        {`
          @keyframes dash {
            to {
              stroke-dashoffset: -12;
            }
          }
        `}
      </style>
    </>
  );
};

