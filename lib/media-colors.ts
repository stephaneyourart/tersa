/**
 * Code couleur des médias - COHÉRENT PARTOUT DANS L'APP
 * 
 * 🖼️ IMAGES = Vert Matrix (#00ff41 / emerald-500)
 * 🎬 VIDÉOS = Fuchsia (#d946ef / fuchsia-500)
 * 
 * Ces couleurs doivent être utilisées pour :
 * - Les icônes
 * - Les strokes autour des nœuds
 * - Les couleurs de remplissage pendant la génération
 * - Les indicateurs de progression
 * - Tous les éléments UI liés aux médias
 */

// Couleurs principales
export const MEDIA_COLORS = {
  // Images - Vert Matrix
  image: {
    primary: '#00ff41',        // Vert matrix pur
    secondary: '#22c55e',      // emerald-500 pour compatibilité Tailwind
    muted: 'rgba(0, 255, 65, 0.2)',
    glow: 'rgba(0, 255, 65, 0.4)',
    text: 'text-[#00ff41]',
    bg: 'bg-[#00ff41]',
    border: 'border-[#00ff41]',
    ring: 'ring-[#00ff41]',
    // Classes Tailwind alternatives
    tw: {
      text: 'text-emerald-400',
      bg: 'bg-emerald-500',
      border: 'border-emerald-500',
      ring: 'ring-emerald-500',
    },
  },
  
  // Vidéos - Fuchsia
  video: {
    primary: '#d946ef',        // Fuchsia pur
    secondary: '#a855f7',      // purple-500 alternative
    muted: 'rgba(217, 70, 239, 0.2)',
    glow: 'rgba(217, 70, 239, 0.4)',
    text: 'text-fuchsia-500',
    bg: 'bg-fuchsia-500',
    border: 'border-fuchsia-500',
    ring: 'ring-fuchsia-500',
    tw: {
      text: 'text-fuchsia-400',
      bg: 'bg-fuchsia-500',
      border: 'border-fuchsia-500',
      ring: 'ring-fuchsia-500',
    },
  },
} as const;

// Gradients pour le skeleton de génération
export const GENERATION_GRADIENTS = {
  image: {
    gradient: 'linear-gradient(to top, rgba(0, 255, 65, 0.9) 0%, rgba(34, 197, 94, 0.6) 40%, rgba(52, 211, 153, 0.3) 70%, rgba(110, 231, 183, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(0, 255, 65, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(0, 255, 65, 0.4)',
  },
  video: {
    gradient: 'linear-gradient(to top, rgba(217, 70, 239, 0.9) 0%, rgba(168, 85, 247, 0.6) 40%, rgba(192, 132, 252, 0.3) 70%, rgba(216, 180, 254, 0.1) 100%)',
    glow: 'linear-gradient(90deg, transparent 0%, rgba(217, 70, 239, 0.5) 50%, transparent 100%)',
    shadow: '0 0 20px 2px rgba(217, 70, 239, 0.4)',
  },
} as const;

// Couleur selon le type de média
export function getMediaColor(type: 'image' | 'video' | 'image-edit') {
  if (type === 'video') {
    return MEDIA_COLORS.video;
  }
  return MEDIA_COLORS.image;
}

// Classes Tailwind pour les icônes
export function getMediaIconClass(type: 'image' | 'video' | 'image-edit') {
  if (type === 'video') {
    return 'text-fuchsia-400';
  }
  return 'text-[#00ff41]';
}

// Classes Tailwind pour les bordures de nœuds
export function getMediaBorderClass(type: 'image' | 'video' | 'image-edit', isGenerating = false) {
  const base = type === 'video' ? 'border-fuchsia-500' : 'border-[#00ff41]';
  if (isGenerating) {
    return `${base} border-2 animate-pulse`;
  }
  return base;
}

