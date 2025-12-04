import { useMemo } from 'react';
import { useModelPreferences } from './use-model-preferences';
import modelsData from '@/lib/data/wavespeed-models.json';
import docsDb from '@/lib/data/wavespeed-docs-db.json';
import { videoModels as legacyVideoModels } from '@/lib/models/video';
import { imageModels as legacyImageModels } from '@/lib/models/image';
import { TersaModel, providers } from '@/lib/providers';
import { 
  WaveSpeedIcon, 
  KlingIcon, 
  GoogleIcon, 
  MinimaxIcon, 
  OpenAiIcon,
  LumaIcon,
  RunwayIcon,
  PixverseIcon,
  BlackForestLabsIcon,
  FalIcon,
} from '@/lib/icons';
import type { SVGProps } from 'react';

// Mapping des types WaveSpeed vers nos types internes
const TYPE_MAPPING: Record<string, 'image' | 'video' | 'audio'> = {
  'text-to-image': 'image',
  'image-to-image': 'image',
  'text-to-video': 'video',
  'image-to-video': 'video',
  'video-to-video': 'video',
  'text-to-audio': 'audio',
};

// Mapping des préfixes de model_uuid vers les icônes et noms de provider
type IconComponent = (props: SVGProps<SVGSVGElement>) => JSX.Element;

interface ProviderInfo {
  icon: IconComponent;
  name: string;
}

const PROVIDER_MAPPING: Record<string, ProviderInfo> = {
  'kwaivgi': { icon: KlingIcon, name: 'Kling' },
  'kling': { icon: KlingIcon, name: 'Kling' },
  'google': { icon: GoogleIcon, name: 'Google' },
  'minimax': { icon: MinimaxIcon, name: 'Minimax' },
  'hailuo': { icon: MinimaxIcon, name: 'Hailuo' },
  'openai': { icon: OpenAiIcon, name: 'OpenAI' },
  'luma': { icon: LumaIcon, name: 'Luma' },
  'runway': { icon: RunwayIcon, name: 'Runway' },
  'pixverse': { icon: PixverseIcon, name: 'Pixverse' },
  'black-forest-labs': { icon: BlackForestLabsIcon, name: 'Black Forest Labs' },
  'flux': { icon: BlackForestLabsIcon, name: 'Flux' },
  'stability': { icon: FalIcon, name: 'Stability AI' },
  'wavespeed-ai': { icon: WaveSpeedIcon, name: 'WaveSpeed' },
};

// Fonction pour extraire le provider depuis le model_uuid
function getProviderInfo(modelUuid: string): ProviderInfo {
  const lowerUuid = modelUuid.toLowerCase();
  
  // Chercher dans les clés du mapping
  for (const [key, info] of Object.entries(PROVIDER_MAPPING)) {
    if (lowerUuid.includes(key)) {
      return info;
    }
  }
  
  // Fallback: WaveSpeed par défaut
  return { icon: WaveSpeedIcon, name: 'WaveSpeed' };
}

// Fonction pour extraire un nom lisible depuis les données du modèle
// On utilise le champ SEO qui contient le vrai nom commercial
function getReadableModelName(modelName: string, seo?: string): string {
  // Si on a un SEO, extraire le nom avant le premier "|"
  if (seo) {
    const namePart = seo.split('|')[0].trim();
    // Enlever les suffixes comme "| WaveSpeedAI" etc.
    if (namePart.length > 0) {
      return namePart;
    }
  }
  
  // Fallback: construire un nom à partir de TOUT le chemin du modèle
  // Ex: "google/nano-banana-pro/text-to-image" -> "Nano Banana Pro Text To Image"
  const parts = modelName.split('/');
  
  // Ignorer le premier segment (provider comme "google", "wavespeed-ai", etc.)
  const relevantParts = parts.slice(1);
  
  // Convertir chaque partie en format lisible
  return relevantParts
    .map(part => 
      part
        .split('-')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ')
    )
    .join(' ');
}

export function useAvailableModels(type: 'image' | 'video' | 'audio') {
  const { isModelEnabled, loaded } = useModelPreferences();

  const models = useMemo(() => {
    // 1. Récupérer les modèles legacy correspondants au type
    const legacy = type === 'video' ? legacyVideoModels : 
                   type === 'image' ? legacyImageModels : 
                   {};

    // 2. Filtrer les modèles legacy :
    //    - Exclure ceux qui contiennent 'wavespeed' (gérés dynamiquement)
    //    - Garder UNIQUEMENT ceux qui sont explicitement activés dans les préférences
    const filteredLegacy = Object.fromEntries(
      Object.entries(legacy).filter(([key]) => {
        // Exclure les anciens modèles wavespeed hardcodés
        if (key.includes('wavespeed')) return false;
        // Vérifier si le modèle legacy est activé (par son ID)
        return isModelEnabled(key);
      })
    );

    // 3. Convertir les modèles WaveSpeed dynamiques
    const dynamicModels: Record<string, TersaModel> = {};
    
    if (loaded) {
      modelsData.data.items.forEach((item) => {
        // Vérifier si le type correspond
        const itemType = TYPE_MAPPING[item.type];
        if (itemType !== type) return;

        // Vérifier si activé dans les préférences
        if (!isModelEnabled(item.model_uuid)) return;

        // Obtenir les infos du provider (icône + nom)
        const providerInfo = getProviderInfo(item.model_uuid);
        
        // Obtenir un nom lisible pour le modèle (utiliser le SEO qui contient le nom commercial)
        const readableName = getReadableModelName(item.model_name, (item as any).seo);
        
        // Créer l'objet modèle compatible TersaModel
        const doc = (docsDb as any)[item.model_uuid];
        
        // Créer un ID unique pour le provider basé sur son nom (pour le groupement)
        const providerId = providerInfo.name.toLowerCase().replace(/\s+/g, '-');
        
        dynamicModels[item.model_uuid] = {
          // Utiliser le vrai nom du modèle, pas le nom technique
          label: readableName,
          chef: {
            ...providers.fal,
            name: providerInfo.name,
            icon: providerInfo.icon,
            id: providerId
          },
          providers: [
            {
              id: providerId,
              name: providerInfo.name,
              icon: providerInfo.icon,
              model: {
                modelId: item.model_uuid,
                generate: async (props: any) => {
                  throw new Error("Generation handled by server action");
                }
              },
              getCost: ({ duration, resolution }) => {
                const base = item.base_price / 1000000;
                if (type === 'video' && duration) {
                    return (duration / 5) * base;
                }
                return base;
              }
            }
          ]
        } as any;
      });
    }

    // 4. Fusionner (Legacy d'abord, puis WaveSpeed)
    return { ...filteredLegacy, ...dynamicModels };
  }, [type, loaded, isModelEnabled]);

  return models;
}

// Export des fonctions utilitaires pour la page Settings
export { getProviderInfo, getReadableModelName };
