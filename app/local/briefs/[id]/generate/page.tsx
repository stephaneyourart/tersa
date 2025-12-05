'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeftIcon,
  PlayIcon,
  FileTextIcon,
  Loader2Icon,
  SparklesIcon,
  BrainIcon,
  ImageIcon,
  VideoIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  EuroIcon,
  LayersIcon,
  CopyIcon,
  InfoIcon,
  ChevronDownIcon,
  SettingsIcon,
  RotateCcw,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createLocalProject, updateLocalProject, getLocalProjectById } from '@/lib/local-projects-store';
import type { Brief, ProjectGenerationConfig, ReasoningLevel, QualityLevel } from '@/types/brief';
import { 
  DEFAULT_CHARACTER_CONFIG, 
  DEFAULT_DECOR_CONFIG, 
  DEFAULT_QUALITY_MODEL_CONFIG 
} from '@/lib/brief-defaults';
import {
  type CreativePlanSettings,
  type TestModeSpecs,
  type ProdModeSpecs,
  type Dimensions,
  type WaveSpeedAspectRatio,
  type WaveSpeedResolution,
  type FrameMode,
  DEFAULT_CREATIVE_PLAN_SETTINGS,
  loadCreativePlanSettings,
  saveCreativePlanSettings,
  resetCreativePlanSettings,
  AVAILABLE_TEXT_TO_IMAGE_MODELS,
  AVAILABLE_EDIT_MODELS,
  AVAILABLE_VIDEO_MODELS,
  AVAILABLE_ASPECT_RATIOS,
  AVAILABLE_RESOLUTIONS,
  DIMENSION_PRESETS,
  getAspectRatioFromDimensions,
} from '@/lib/creative-plan-settings';

// Le DEFAULT_SYSTEM_PROMPT est chargé depuis localStorage ou utilise la valeur par défaut
const STORAGE_KEY_SYSTEM_PROMPT = 'brief-system-prompt-default';

// ========== CONFIGURATION LLM PROVIDERS ==========
type LLMProvider = 'mistral' | 'openai';

const LLM_PROVIDERS: Record<LLMProvider, { 
  label: string; 
  description: string;
  models: { id: string; label: string; description: string; isDefault?: boolean }[];
  testModel: string; // Modèle utilisé en mode test
}> = {
  mistral: {
    label: 'Mistral',
    description: 'Plus créatif, moins filtré',
    testModel: 'mistral-small-latest',
    models: [
      { id: 'mistral-large-latest', label: 'Mistral Large', description: 'Le plus créatif', isDefault: true },
      { id: 'mistral-small-latest', label: 'Mistral Small', description: 'Rapide & économique' },
    ],
  },
  openai: {
    label: 'OpenAI',
    description: 'Classique, très structuré',
    testModel: 'gpt-4o',
    models: [
      { id: 'gpt-5.1-2025-11-13', label: 'GPT-5.1', description: 'Très détaillé', isDefault: true },
      { id: 'gpt-4o', label: 'GPT-4o', description: 'Rapide' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Économique' },
    ],
  },
};

const BUILTIN_SYSTEM_PROMPT = `Tu es un scénariste et réalisateur expert, doté d'une sensibilité littéraire et cinématographique aiguë.

## ARCHITECTURE DU PROJET

### 1. PERSONNAGES - Descriptions exhaustives (SEUL ENDROIT)
Chaque personnage a UN prompt "primary" extrêmement détaillé décrivant son apparence physique complète.
C'est LE SEUL ENDROIT où les descriptions physiques apparaissent.

### 2. DÉCORS - Descriptions exhaustives (SEUL ENDROIT)
Chaque décor a UN prompt "primary" extrêmement détaillé décrivant l'environnement complet.

### 3. PLANS - Trois prompts distincts par plan

#### A. prompt (ACTION VIDÉO)
Décrit l'ACTION, le MOUVEMENT, la PSYCHOLOGIE du plan. Sera utilisé pour animer la vidéo.

**STYLE REQUIS :** Littéraire, raffiné, cinématographique.
- Verbes d'action précis et évocateurs
- Mouvements de caméra (travelling, panoramique...)
- Rythme (lent, saccadé, fluide...)
- Psychologie (tension, hésitation...)

**INTERDICTION ABSOLUE :** Ne JAMAIS décrire l'apparence physique.
Utiliser uniquement des DÉSIGNATIONS SIMPLES : "l'homme", "la femme", "le vieux".

**EXEMPLE :**
"L'homme s'avance vers elle d'un pas hésitant. Elle se retourne lentement. Travelling avant, tension croissante."

#### B. promptImageDepart (COMPOSITION DÉBUT)
Décrit la COMPOSITION SPATIALE au DÉBUT du plan (21:9 cinémascope).
Position des personnages dans le cadre, postures, rapport au décor.

**EXEMPLE :**
"L'homme de dos au premier plan gauche. La femme au fond, assise, de profil."

#### C. promptImageFin (COMPOSITION FIN)
Décrit la COMPOSITION SPATIALE à la FIN du plan (21:9 cinémascope).
DÉDUITE de l'action : si "l'homme s'approche", la fin montre le rapprochement.

**EXEMPLE :**
"L'homme et la femme face à face, proches, au centre du cadre."

## FORMAT JSON OBLIGATOIRE

{
  "title": "Titre",
  "synopsis": "Synopsis (2-3 phrases)",
  "characters": [{
    "id": "perso-prenom",
    "name": "Prénom",
    "description": "Description narrative",
    "referenceCode": "[PERSO:Prénom]",
    "prompts": {
      "primary": "[DESCRIPTION PHYSIQUE 200+ mots]",
      "face": "Génère une image précise du visage de face...",
      "profile": "Génère une image précise du visage de profil...",
      "back": "Génère une image précise de ce personnage vu de dos..."
    }
  }],
  "decors": [{
    "id": "decor-nom",
    "name": "Nom",
    "description": "Description",
    "referenceCode": "[DECOR:Nom]",
    "prompts": {
      "primary": "[DESCRIPTION DÉCOR 150+ mots]",
      "angle2": "Propose un angle très différent...",
      "plongee": "Vue en plongée top down...",
      "contrePlongee": "Vue en forte contre plongée..."
    }
  }],
  "scenes": [{
    "id": "scene-1",
    "sceneNumber": 1,
    "title": "Titre",
    "description": "Synopsis",
    "plans": [{
      "id": "plan-1-1",
      "planNumber": 1,
      "prompt": "[ACTION LITTÉRAIRE - SANS description physique]",
      "promptImageDepart": "[COMPOSITION SPATIALE DÉBUT]",
      "promptImageFin": "[COMPOSITION SPATIALE FIN]",
      "characterRefs": ["perso-prenom"],
      "decorRef": "decor-nom",
      "duration": 5,
      "cameraMovement": "Mouvement caméra"
    }]
  }],
  "totalPlans": 4,
  "estimatedDuration": 60
}

## RÈGLES ABSOLUES
1. Descriptions physiques UNIQUEMENT dans prompts "primary"
2. Dans les plans : "l'homme", "la femme" - JAMAIS de descriptions
3. promptImageFin = conséquence logique de l'action
4. Les prompts variantes sont FIXES, ne pas modifier`;

// Helper pour charger le system prompt sauvegardé
function getDefaultSystemPrompt(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_SYSTEM_PROMPT);
    if (saved) return saved;
  }
  return BUILTIN_SYSTEM_PROMPT;
}

// Composant pour éditer les dimensions (width × height) - MODE TEST uniquement
function DimensionInput({ 
  label, 
  dims, 
  onChange 
}: { 
  label: string; 
  dims?: Dimensions; 
  onChange: (dims: Dimensions) => void;
}) {
  const width = dims?.width || 256;
  const height = dims?.height || 256;
  const ratio = getAspectRatioFromDimensions({ width, height });
  
  return (
    <div className="p-2 bg-background/50 rounded border border-border/30">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
        <span className="text-[9px] text-muted-foreground/60">{ratio}</span>
      </div>
      <div className="flex items-center gap-1">
        <Input
          type="number"
          min={64}
          max={4096}
          step={64}
          className="h-6 text-[10px] px-1 w-14 text-center"
          value={width}
          onChange={(e) => onChange({ width: parseInt(e.target.value) || 256, height })}
        />
        <span className="text-[10px] text-muted-foreground">×</span>
        <Input
          type="number"
          min={64}
          max={4096}
          step={64}
          className="h-6 text-[10px] px-1 w-14 text-center"
          value={height}
          onChange={(e) => onChange({ width, height: parseInt(e.target.value) || 256 })}
        />
      </div>
    </div>
  );
}

// Composant pour sélectionner un aspect ratio - MODE PROD
function AspectRatioSelect({ 
  label, 
  value, 
  onChange 
}: { 
  label: string; 
  value: WaveSpeedAspectRatio; 
  onChange: (ratio: WaveSpeedAspectRatio) => void;
}) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      <Select value={value} onValueChange={(v) => onChange(v as WaveSpeedAspectRatio)}>
        <SelectTrigger className="h-7 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {AVAILABLE_ASPECT_RATIOS.map(ar => (
            <SelectItem key={ar.id} value={ar.id} className="text-xs">
              {ar.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function GenerateProjectPage() {
  const router = useRouter();
  const params = useParams();
  
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [reasoning, setReasoning] = useState<string>('');
  const [currentPhase, setCurrentPhase] = useState<string>('');
  const [savePromptAsDefault, setSavePromptAsDefault] = useState(false);
  const [phaseStatus, setPhaseStatus] = useState<Record<string, 'pending' | 'running' | 'done'>>({
    analysis: 'pending',
    canvas: 'pending',
    redirect: 'pending',
  });
  const [isTestVideoMode, setIsTestVideoMode] = useState(false); // Mode TEST-VIDEO (sans LLM)
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (reasoningEndRef.current && showReasoningDialog) {
      reasoningEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [reasoning, showReasoningDialog]);
  
  // État pour le provider LLM (Mistral par défaut - plus créatif)
  const [llmProvider, setLlmProvider] = useState<LLMProvider>('mistral');
  
  const [config, setConfig] = useState<Partial<ProjectGenerationConfig>>({
    aiModel: 'mistral-large-latest', // Mistral Large par défaut - prompts plus créatifs
    reasoningLevel: 'high',
    generateMediaDirectly: false,
    systemPrompt: BUILTIN_SYSTEM_PROMPT, // Sera mis à jour dans useEffect
    customInstructions: '',
    quality: 'elevee' as QualityLevel, // Qualité élevée par défaut
    settings: {
      videoModel: 'kling-v2.6-pro-first-last', // KLING v2.6 pour first+last frame
      imageModel: 'nano-banana-pro-ultra-wavespeed',
      couplesPerPlan: 1, // N = nombre de couples (first/last) par plan
      videosPerCouple: 4, // M = nombre de vidéos par couple
      videoDuration: 10, // 10 secondes par défaut
      videoAspectRatio: '16:9', // 16:9 par défaut
      testMode: false,
    },
    advancedPromptConfig: {
      characterConfig: DEFAULT_CHARACTER_CONFIG,
      decorConfig: DEFAULT_DECOR_CONFIG,
      modelConfig: DEFAULT_QUALITY_MODEL_CONFIG,
    },
  });
  
  // Helper pour changer de provider et mettre à jour le modèle par défaut
  const handleProviderChange = (provider: LLMProvider) => {
    setLlmProvider(provider);
    const defaultModel = LLM_PROVIDERS[provider].models.find(m => m.isDefault)?.id 
      || LLM_PROVIDERS[provider].models[0].id;
    setConfig(prev => ({ ...prev, aiModel: defaultModel }));
  };
  
  const [projectName, setProjectName] = useState('');
  const [modelsSpecsOpen, setModelsSpecsOpen] = useState(false);
  const [creativePlanSettings, setCreativePlanSettings] = useState<CreativePlanSettings>(DEFAULT_CREATIVE_PLAN_SETTINGS);

  // Charger le system prompt et les settings Creative Plan au montage
  useEffect(() => {
    const savedPrompt = getDefaultSystemPrompt();
    setConfig(prev => ({ ...prev, systemPrompt: savedPrompt }));
    
    // Charger les Creative Plan Settings
    const cpSettings = loadCreativePlanSettings();
    setCreativePlanSettings(cpSettings);
  }, []);
  
  // Handler pour les changements Creative Plan
  const updateCreativePlan = (updater: (prev: CreativePlanSettings) => CreativePlanSettings) => {
    setCreativePlanSettings(prev => {
      const next = updater(prev);
      // Sauvegarder immédiatement
      saveCreativePlanSettings(next);
      return next;
    });
  };
  
  // Reset Creative Plan aux defaults
  const handleResetCreativePlan = () => {
    const defaults = resetCreativePlanSettings();
    setCreativePlanSettings(defaults);
  };

  useEffect(() => {
    loadBrief();
  }, [params.id]);

  const loadBrief = async () => {
    try {
      const response = await fetch(`/api/briefs/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setBrief(data);
        setProjectName(`${data.name} v1`);
      }
    } catch (error) {
      console.error('Erreur:', error);
    } finally {
      setLoading(false);
    }
  };

  // ========== MODE TEST RAPIDE ==========
  // Paramètres fixes : Mistral Small, first-only, 2 images, 2 vidéos 5s
  const handleTestGenerate = async () => {
    const testProjectName = projectName.trim() || `${brief?.name || 'Test'} - TEST`;
    
    setIsTestVideoMode(false); // Pas le mode TEST-VIDEO
    setGenerating(true);
    setReasoning('');
    setShowReasoningDialog(true);
    setPhaseStatus({ analysis: 'running', canvas: 'pending', redirect: 'pending' });
    setCurrentPhase('analysis');

    // Config fixe pour le mode test
    const testConfig = {
      aiModel: 'mistral-small-latest',
      llmProvider: 'mistral' as LLMProvider,
      reasoningLevel: 'low',
      systemPrompt: config.systemPrompt,
      settings: {
        testMode: true,
        frameMode: 'first-only' as FrameMode, // First frame uniquement
        couplesPerPlan: 2, // 2 images à générer
        videosPerCouple: 2, // 2 vidéos à générer
        videoDuration: 5, // 5 secondes
        videoAspectRatio: '16:9',
      },
    };

    setReasoning(`🧪 MODE TEST RAPIDE
   → LLM: Mistral Small (rapide & économique)
   → Mode: First frame uniquement (pas de last frame)
   → Images: 2 par plan
   → Vidéos: 2 × 5 secondes par plan
   → Prompts: simplifiés (2 persos max, 2 plans max)

`);

    try {
      const response = await fetch('/api/briefs/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: params.id,
          projectName: testProjectName,
          config: testConfig,
          isTestMode: true,
        }),
      });

      await processGenerationResponse(response, testProjectName, true);
    } catch (error: any) {
      console.error('Erreur génération test:', error);
      setReasoning(prev => prev + `\n❌ Erreur : ${error.message}`);
      setPhaseStatus({ analysis: 'done', canvas: 'done', redirect: 'done' });
    } finally {
      setGenerating(false);
    }
  };

  // ========== MODE TEST-VIDEO ==========
  // Génère 2 images + 2 vidéos avec prompts fixes pour tester la pipeline vidéo
  // AUCUN appel LLM - prompts codés en dur
  // PAS de dialogue - va directement au canvas
  const handleTestVideoGenerate = async () => {
    setIsTestVideoMode(true);
    setGenerating(true);
    // PAS de dialogue - on va directement au canvas après génération

    // Prompts fixes pour le test
    const PROMPT_IMAGE_FIRST = "un chihuahua noir avec une tache blanche sur le front assis dans l'herbe";
    const PROMPT_IMAGE_LAST = "un chihuahua noir avec une tache blanche sur le front marchant dans l'herbe";
    const PROMPT_ACTION = "le chihuaha se lève et marche dans l'herbe";

    // Modèles à utiliser
    const IMAGE_MODEL = 'nano-banana-pro-ultra-wavespeed';
    const VIDEO_MODEL_FIRST_ONLY = 'kwaivgi/kling-v2.6-pro/image-to-video';
    const VIDEO_MODEL_FIRST_LAST = 'kwaivgi/kling-v2.5-turbo-pro/image-to-video';

    try {
      // Créer le projet local
      const testProjectName = `Test Vidéo - ${new Date().toLocaleString('fr-FR')}`;
      const newProject = createLocalProject(testProjectName);
      const projectId = newProject.id;

      // ========== GÉNÉRATION DES IMAGES ==========
      // Générer IMAGE FIRST
      const imageFirstResponse = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: `test-video-img-first-${Date.now()}`,
          prompt: PROMPT_IMAGE_FIRST,
          model: IMAGE_MODEL,
          projectId,
          testMode: false,
          aspectRatio: '21:9',
          resolution: '4k',
        }),
      });

      if (!imageFirstResponse.ok) {
        const error = await imageFirstResponse.text();
        throw new Error(`Erreur image FIRST: ${error}`);
      }
      const imageFirstData = await imageFirstResponse.json();
      const imageFirstUrl = imageFirstData.nodeData?.generated?.url || imageFirstData.nodeData?.url;

      // Générer IMAGE LAST
      const imageLastResponse = await fetch('/api/image/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: `test-video-img-last-${Date.now()}`,
          prompt: PROMPT_IMAGE_LAST,
          model: IMAGE_MODEL,
          projectId,
          testMode: false,
          aspectRatio: '21:9',
          resolution: '4k',
        }),
      });

      if (!imageLastResponse.ok) {
        const error = await imageLastResponse.text();
        throw new Error(`Erreur image LAST: ${error}`);
      }
      const imageLastData = await imageLastResponse.json();
      const imageLastUrl = imageLastData.nodeData?.generated?.url || imageLastData.nodeData?.url;

      // ========== GÉNÉRATION DES VIDÉOS ==========
      // Vidéo 1: First Only avec Kling v2.6 Pro
      const videoFirstOnlyResponse = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: `test-video-first-only-${Date.now()}`,
          prompt: PROMPT_ACTION,
          model: VIDEO_MODEL_FIRST_ONLY,
          projectId,
          imagePrompt: imageFirstUrl,
          copies: 1,
        }),
      });

      let videoFirstOnlyUrl = null;
      if (videoFirstOnlyResponse.ok) {
        const videoFirstOnlyData = await videoFirstOnlyResponse.json();
        videoFirstOnlyUrl = videoFirstOnlyData.results?.[0]?.nodeData?.generated?.url;
      }

      // Vidéo 2: First+Last avec Kling v2.5 Turbo Pro
      const videoFirstLastResponse = await fetch('/api/video/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nodeId: `test-video-first-last-${Date.now()}`,
          prompt: PROMPT_ACTION,
          model: VIDEO_MODEL_FIRST_LAST,
          projectId,
          imagePrompt: imageFirstUrl,
          lastFrameImage: imageLastUrl,
          copies: 1,
        }),
      });

      let videoFirstLastUrl = null;
      if (videoFirstLastResponse.ok) {
        const videoFirstLastData = await videoFirstLastResponse.json();
        videoFirstLastUrl = videoFirstLastData.results?.[0]?.nodeData?.generated?.url;
      }

      // ========== CRÉER LES NŒUDS DANS LE CANVAS ==========
      const nodes = [
        // Nœud texte pour le prompt action
        {
          id: `text-action-${Date.now()}`,
          type: 'text',
          position: { x: 100, y: 100 },
          data: {
            title: 'Prompt Action',
            text: PROMPT_ACTION,
            isTest: true,
          },
        },
        // Nœud image FIRST
        {
          id: `img-first-${Date.now()}`,
          type: 'image',
          position: { x: 100, y: 250 },
          data: {
            title: 'Image FIRST',
            prompt: PROMPT_IMAGE_FIRST,
            generated: { url: imageFirstUrl },
            isGenerated: true,
            isTest: true,
          },
        },
        // Nœud image LAST
        {
          id: `img-last-${Date.now()}`,
          type: 'image',
          position: { x: 500, y: 250 },
          data: {
            title: 'Image LAST',
            prompt: PROMPT_IMAGE_LAST,
            generated: { url: imageLastUrl },
            isGenerated: true,
            isTest: true,
          },
        },
        // Nœud vidéo First Only
        {
          id: `video-first-only-${Date.now()}`,
          type: 'video',
          position: { x: 100, y: 500 },
          data: {
            title: 'Vidéo First Only (Kling v2.6)',
            prompt: PROMPT_ACTION,
            model: VIDEO_MODEL_FIRST_ONLY,
            generated: videoFirstOnlyUrl ? { url: videoFirstOnlyUrl } : undefined,
            isGenerated: !!videoFirstOnlyUrl,
            isTest: true,
          },
        },
        // Nœud vidéo First+Last
        {
          id: `video-first-last-${Date.now()}`,
          type: 'video',
          position: { x: 500, y: 500 },
          data: {
            title: 'Vidéo First+Last (Kling v2.5)',
            prompt: PROMPT_ACTION,
            model: VIDEO_MODEL_FIRST_LAST,
            generated: videoFirstLastUrl ? { url: videoFirstLastUrl } : undefined,
            isGenerated: !!videoFirstLastUrl,
            isTest: true,
          },
        },
      ];

      // Sauvegarder dans le projet
      updateLocalProject(projectId, {
        data: {
          nodes,
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      });

      // Aller directement au canvas
      router.push(`/local/canvas/${projectId}`);

    } catch (error: any) {
      console.error('Erreur génération test vidéo:', error);
      alert(`Erreur Test Vidéo: ${error.message}`);
    } finally {
      setGenerating(false);
      setIsTestVideoMode(false);
    }
  };

  // ========== MODE PRODUCTION ==========
  const handleGenerate = async () => {
    if (!projectName.trim()) {
      alert('Veuillez donner un nom au projet');
      return;
    }

    setIsTestVideoMode(false); // Pas le mode TEST-VIDEO
    setGenerating(true);
    setReasoning('');
    setShowReasoningDialog(true);
    setPhaseStatus({ analysis: 'running', canvas: 'pending', redirect: 'pending' });
    setCurrentPhase('analysis');

    // Récupérer le frameMode depuis les creativePlanSettings PROD
    const frameMode = creativePlanSettings.prod?.frameMode || 'first-last';
    const frameModeLabel = frameMode === 'first-only' ? '🖼️ FIRST frame seul' : '🎬 FIRST + LAST frames';
    const providerLabel = LLM_PROVIDERS[llmProvider].label;
    
    setReasoning(`🎬 MODE PRODUCTION
   → LLM: ${providerLabel} (${config.aiModel})
   → Mode: ${frameModeLabel}
   → Images: haute résolution
   → Vidéos: ${config.settings?.videosPerCouple || 4} × ${config.settings?.videoDuration || 10}s par couple

`);

    try {
      const response = await fetch('/api/briefs/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: params.id,
          projectName,
          config: {
            ...config,
            llmProvider,
            settings: {
              ...config.settings,
              testMode: false,
              frameMode,
            },
          },
          isTestMode: false,
        }),
      });

      await processGenerationResponse(response, projectName, false);
    } catch (error: any) {
      console.error('Erreur génération:', error);
      setReasoning(prev => prev + `\n❌ Erreur : ${error.message}`);
      setPhaseStatus({ analysis: 'done', canvas: 'done', redirect: 'done' });
    } finally {
      setGenerating(false);
    }
  };

  // ========== TRAITEMENT RÉPONSE COMMUNE ==========
  const processGenerationResponse = async (response: Response, projName: string, isTestMode: boolean) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur: ${response.statusText}`);
    }

    // Lire le stream SSE
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Pas de reader disponible');
    }

    let canvasData: any = null;
    let projectStructure: any = null;
    let buffer = '';
    let generationSequenceData: any = null;
    let createdProjectId: string | null = null;

    // Fonction pour traiter une ligne SSE
    const processLine = (line: string) => {
      if (!line.startsWith('data: ')) return;

      try {
        const data = JSON.parse(line.slice(6));
        
        switch (data.type) {
          case 'phase_start':
            setCurrentPhase(data.phase);
            if (data.phase === 'analysis') {
              setReasoning(prev => prev + data.message + '\n');
              setPhaseStatus(prev => ({ ...prev, analysis: 'running' }));
            } else if (data.phase === 'canvas_creation') {
              setReasoning(prev => prev + `\n${data.message}\n`);
              setPhaseStatus(prev => ({ ...prev, analysis: 'done', canvas: 'running' }));
            }
            break;

          case 'reasoning':
            setReasoning(prev => prev + data.content);
            break;

          case 'phase_complete':
            setReasoning(prev => prev + `\n\n${data.message}\n`);
            if (data.nodeCount) {
              setReasoning(prev => prev + `📦 ${data.nodeCount} nœuds créés\n`);
            }
            break;

          case 'progress':
            setReasoning(prev => prev + `${data.message}\n`);
            break;

          case 'project_data':
            canvasData = data.canvasData;
            projectStructure = data.projectStructure;
            generationSequenceData = data.generationSequence;
            
            if (canvasData) {
              setReasoning(prev => prev + `\n📝 Création du projet local...\n`);
              const newProject = createLocalProject(projName);
              
              updateLocalProject(newProject.id, { 
                data: {
                  ...canvasData,
                  generationSequence: generationSequenceData,
                  testMode: isTestMode,
                }
              });
              
              createdProjectId = newProject.id;
              setReasoning(prev => prev + `✅ Projet créé : ${createdProjectId}\n`);
              
              if (generationSequenceData) {
                const imgCount = 
                  (generationSequenceData.characterImages?.reduce((acc: number, c: {imageNodeIds: string[]}) => acc + c.imageNodeIds.length, 0) || 0) +
                  (generationSequenceData.locationImages?.reduce((acc: number, l: {imageNodeIds: string[]}) => acc + l.imageNodeIds.length, 0) || 0);
                const vidCount = generationSequenceData.videos?.length || 0;
                setReasoning(prev => prev + `📦 Séquence : ${imgCount} images, ${vidCount} vidéos à générer\n`);
              }
            }
            break;

          case 'complete':
            setPhaseStatus(prev => ({ ...prev, canvas: 'done', redirect: 'running' }));
            setReasoning(prev => prev + `\n\n🎉 ${data.message}\n`);
            
            if (data.summary) {
              const s = data.summary;
              setReasoning(prev => prev + `\n📊 Résumé :\n`);
              setReasoning(prev => prev + `   • ${s.characters} personnage(s)\n`);
              setReasoning(prev => prev + `   • ${s.locations || s.decors || 0} décor(s)\n`);
              setReasoning(prev => prev + `   • ${s.scenes} scène(s)\n`);
              setReasoning(prev => prev + `   • ${s.plans} plan(s)\n`);
              setReasoning(prev => prev + `   • ${s.nodes} nœuds dans le canvas\n`);
              if (s.imagesToGenerate) {
                setReasoning(prev => prev + `   • ${s.imagesToGenerate} images à générer\n`);
              }
              if (s.videosToGenerate) {
                setReasoning(prev => prev + `   • ${s.videosToGenerate} vidéos à générer\n`);
              }
            }

            if (createdProjectId) {
              setReasoning(prev => prev + `\n🎨 Ouverture du canvas dans 2 secondes...`);
              setPhaseStatus(prev => ({ ...prev, redirect: 'done' }));
              setTimeout(() => {
                router.push(`/local/canvas/${createdProjectId}`);
              }, 2000);
            } else {
              setReasoning(prev => prev + `\n⚠️ Projet non créé, vérifiez les logs.`);
            }
            break;

          case 'error':
            setReasoning(prev => prev + `\n\n❌ Erreur: ${data.error}\n`);
            if (data.details) {
              setReasoning(prev => prev + `\nDétails: ${data.details}\n`);
            }
            break;
        }
      } catch (e) {
        console.error('Erreur parse SSE:', e, line);
      }
    };

    // Lire le stream
    while (true) {
      const { done, value } = await reader.read();
      
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';
        
        for (const line of lines) {
          processLine(line);
        }
      }
      
      if (done) {
        if (buffer.trim()) {
          processLine(buffer);
        }
        break;
      }
    }
  };

  // Composant indicateur de phase - Style compact (sans spinner)
  const PhaseIndicator = ({ phase, label }: { phase: string; label: string }) => {
    const status = phaseStatus[phase];
    const isDone = status === 'done';
    const isRunning = status === 'running';
    
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
        isDone 
          ? 'bg-[#00ff41]/20 text-[#00ff41]' 
          : isRunning 
            ? 'bg-[#00ff41]/10 text-[#00ff41]' 
            : 'bg-zinc-800 text-zinc-500'
      }`}>
        {isDone ? (
          <CheckCircle2Icon size={12} />
        ) : (
          <CircleDotIcon size={12} />
        )}
        <span>{label}</span>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2Icon size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!brief) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Creative plan non trouvé</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href={`/local/briefs/${params.id}`}>
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeftIcon size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Générer le projet</h1>
              <p className="text-sm text-muted-foreground">{brief.name}</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        <div className="space-y-6">
          {/* BOUTON TEST RAPIDE - En haut bien visible */}
          <Card className="p-6 bg-amber-500/10 border-amber-500/50">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <span className="text-2xl">🧪</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-amber-400">Test Rapide</h2>
                  <p className="text-sm text-muted-foreground">
                    Mistral Small • First frame • 2 images • 2 vidéos 5s
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleTestGenerate}
                disabled={generating}
                size="lg"
                className="bg-amber-500 hover:bg-amber-600 text-black font-bold px-8"
              >
                {generating ? (
                  <Loader2Icon size={20} className="animate-spin mr-2" />
                ) : (
                  <PlayIcon size={20} className="mr-2" />
                )}
                Lancer Test
              </Button>
            </div>
          </Card>

          {/* BOUTON TEST-VIDEO - Test spécifique génération vidéo */}
          <Card className="p-6 bg-violet-500/10 border-violet-500/50">
            <div className="flex items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <span className="text-2xl">🎬</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-violet-400">Test Vidéo</h2>
                  <p className="text-sm text-muted-foreground">
                    Chihuahua • 2 images 4K 21:9 • 2 vidéos (First Only + First & Last)
                  </p>
                </div>
              </div>
              <Button 
                onClick={handleTestVideoGenerate}
                disabled={generating}
                size="lg"
                className="bg-violet-500 hover:bg-violet-600 text-white font-bold px-8"
              >
                {generating ? (
                  <Loader2Icon size={20} className="animate-spin mr-2" />
                ) : (
                  <VideoIcon size={20} className="mr-2" />
                )}
                Test Vidéo
              </Button>
            </div>
          </Card>

          {/* Nom du projet */}
          <Card className="p-6">
            <Label htmlFor="projectName" className="text-base font-semibold mb-3 block">
              Nom du projet
            </Label>
            <Input
              id="projectName"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ex: Vidéo promotionnelle Q1 2025 v1"
              className="text-lg"
            />
          </Card>

          {/* Configuration IA */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <BrainIcon size={20} className="text-violet-400" />
              <h2 className="text-lg font-semibold">Intelligence Artificielle</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Provider LLM */}
              <div>
                <Label htmlFor="llmProvider" className="mb-2 block">
                  Provider IA
                </Label>
                <Select
                  value={llmProvider}
                  onValueChange={(value) => handleProviderChange(value as LLMProvider)}
                >
                  <SelectTrigger id="llmProvider">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(LLM_PROVIDERS).map(([key, provider]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          {provider.label}
                          {key === 'mistral' && (
                            <Badge variant="secondary" className="text-[10px] px-1 py-0">Créatif</Badge>
                          )}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {LLM_PROVIDERS[llmProvider].description}
                </p>
              </div>

              {/* Modèle IA (dépend du provider) */}
              <div>
                <Label htmlFor="aiModel" className="mb-2 block">
                  Modèle d'analyse
                </Label>
                <Select
                  value={config.aiModel}
                  onValueChange={(value) => setConfig({ ...config, aiModel: value })}
                >
                  <SelectTrigger id="aiModel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_PROVIDERS[llmProvider].models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label} ({model.description})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  Mode test → {LLM_PROVIDERS[llmProvider].testModel.replace('-latest', '')}
                </p>
              </div>

              {/* Niveau de raisonnement */}
              <div>
                <Label htmlFor="reasoningLevel" className="mb-2 block">
                  Niveau de raisonnement
                </Label>
                <Select
                  value={config.reasoningLevel}
                  onValueChange={(value) => setConfig({ ...config, reasoningLevel: value as ReasoningLevel })}
                  disabled={llmProvider === 'mistral'} // Mistral n'a pas de reasoning_effort
                >
                  <SelectTrigger id="reasoningLevel">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Faible (rapide)</SelectItem>
                    <SelectItem value="medium">Moyen (équilibré)</SelectItem>
                    <SelectItem value="high">Élevé (précis)</SelectItem>
                  </SelectContent>
                </Select>
                {llmProvider === 'mistral' && (
                  <p className="text-xs text-amber-500 mt-1">Non applicable à Mistral</p>
                )}
              </div>
            </div>

            {/* Instructions personnalisées */}
            <div className="mt-6">
              <Label htmlFor="customInstructions" className="mb-2 block">
                Instructions supplémentaires (optionnel)
              </Label>
              <Textarea
                id="customInstructions"
                value={config.customInstructions}
                onChange={(e) => setConfig({ ...config, customInstructions: e.target.value })}
                placeholder="Ex: Privilégier un style documentaire, ambiance sombre..."
                rows={3}
              />
            </div>

            {/* System Prompt */}
            <div className="mt-6 flex items-center justify-between p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center gap-2">
                <FileTextIcon size={18} className="text-muted-foreground" />
                <span className="text-sm font-medium">System Prompt</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowPromptDialog(true)}
              >
                Voir / Éditer
              </Button>
            </div>
          </Card>

          {/* Configuration Qualité */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <SparklesIcon size={20} className="text-emerald-400" />
              <h2 className="text-lg font-semibold">Qualité de génération</h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Sélecteur de qualité */}
              <div className="col-span-2">
                <Label className="mb-3 block">Niveau de qualité des images</Label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, quality: 'normal' as QualityLevel })}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      config.quality === 'normal' 
                        ? 'border-violet-500 bg-violet-500/10' 
                        : 'border-border/50 hover:border-border'
                    }`}
                  >
                    <div className="font-semibold mb-1">Normal</div>
                    <p className="text-xs text-muted-foreground">
                      Génération rapide, qualité standard
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Modèles : nano-banana / nano-banana edit
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfig({ ...config, quality: 'elevee' as QualityLevel })}
                    className={`p-4 rounded-lg border-2 transition-all text-left ${
                      config.quality === 'elevee' 
                        ? 'border-emerald-500 bg-emerald-500/10' 
                        : 'border-border/50 hover:border-border'
                    }`}
                  >
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      Élevée
                      <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">
                        Recommandé
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Qualité supérieure, résolution 2K
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      Modèles : nano-banana-pro / edit
                    </p>
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Models & Specs - Collapsible - NOUVELLE STRUCTURE EXHAUSTIVE */}
          <Card className="p-0 overflow-hidden">
            <Collapsible open={modelsSpecsOpen} onOpenChange={setModelsSpecsOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full p-6 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-2">
                    <SettingsIcon size={20} className="text-orange-400" />
                    <h2 className="text-lg font-semibold">Models & Specs</h2>
                    <Badge variant="outline" className="text-xs ml-2">
                      {config.quality === 'elevee' ? 'PROD' : 'TEST'}
                    </Badge>
                  </div>
                  <ChevronDownIcon 
                    size={20} 
                    className={`text-muted-foreground transition-transform ${modelsSpecsOpen ? 'rotate-180' : ''}`} 
                  />
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="px-6 pb-6 space-y-6 border-t border-border/30 pt-4">
                  {/* Note info + Reset */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      Ces paramètres s'appliquent à <strong>tous</strong> vos projets futurs.
                    </p>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={handleResetCreativePlan}
                      className="text-xs gap-1 h-7"
                    >
                      <RotateCcw size={12} />
                      Reset
                    </Button>
                  </div>
                  
                  {/* ============================================ */}
                  {/* SECTION TEST - Config pour bouton Test Rapide */}
                  {/* ============================================ */}
                  <div className="space-y-4 p-4 rounded-lg border bg-amber-500/5 border-amber-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <span className="text-amber-400 font-bold text-sm">T</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-amber-400">PARAMÈTRES TEST</h4>
                          <span className="text-[10px] bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full">Bouton "Test Rapide" en haut</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">Génération rapide • Petites dimensions • Modèles économiques</p>
                      </div>
                    </div>
                    
                    {/* Mode Frame TEST */}
                    <div className="mb-4 p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 block">Mode de génération vidéo</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => updateCreativePlan(s => ({
                            ...s,
                            test: { 
                              ...s.test, 
                              frameMode: 'first-last' as FrameMode,
                              // Auto-sélectionner un modèle compatible first+last
                              videoModel: 'kling-v2.5-turbo-pro-first-last'
                            }
                          }))}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            (creativePlanSettings.test?.frameMode || 'first-last') === 'first-last'
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-border/50 hover:border-border'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1">🎬 FIRST + LAST frames</div>
                          <p className="text-[10px] text-muted-foreground">
                            2 images (début + fin) • Animation interpolée
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCreativePlan(s => ({
                            ...s,
                            test: { 
                              ...s.test, 
                              frameMode: 'first-only' as FrameMode,
                              // Auto-sélectionner un modèle compatible first-only
                              videoModel: 'kling-v2.6-pro-i2v'
                            }
                          }))}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            creativePlanSettings.test?.frameMode === 'first-only'
                              ? 'border-amber-500 bg-amber-500/10'
                              : 'border-border/50 hover:border-border'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1">🖼️ FIRST frame seul</div>
                          <p className="text-[10px] text-muted-foreground">
                            1 image (début) • Kling v2.6 Pro I2V
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Modèles TEST */}
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Modèle T2I</Label>
                        <Select
                          value={creativePlanSettings.test?.textToImageModel || 'google/nano-banana/text-to-image'}
                          onValueChange={(v) => updateCreativePlan(s => ({
                            ...s,
                            test: { ...s.test, textToImageModel: v }
                          }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_TEXT_TO_IMAGE_MODELS.map(m => (
                              <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Modèle Edit</Label>
                        <Select
                          value={creativePlanSettings.test?.editModel || 'google/nano-banana/edit'}
                          onValueChange={(v) => updateCreativePlan(s => ({
                            ...s,
                            test: { ...s.test, editModel: v }
                          }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_EDIT_MODELS.map(m => (
                              <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Modèle Vidéo</Label>
                        <Select
                          value={creativePlanSettings.test?.videoModel || 'kling-v2.6-pro-i2v'}
                          onValueChange={(v) => updateCreativePlan(s => ({
                            ...s,
                            test: { ...s.test, videoModel: v }
                          }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_VIDEO_MODELS
                              .filter(m => {
                                // Filtrer selon le mode frame
                                const frameMode = creativePlanSettings.test?.frameMode || 'first-last';
                                if (frameMode === 'first-only') return m.supportsFirstOnly;
                                return m.supportsStartEnd;
                              })
                              .map(m => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Durée vidéo (sec)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          className="h-8 text-xs"
                          value={creativePlanSettings.test?.videoDuration || 5}
                          onChange={(e) => updateCreativePlan(s => ({
                            ...s,
                            test: { ...s.test, videoDuration: parseInt(e.target.value) || 5 }
                          }))}
                        />
                      </div>
                    </div>
                    
                    {/* Dimensions TEST - Tableau exhaustif */}
                    <div className="mt-4 pt-4 border-t border-amber-500/20">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3 block">
                        Dimensions en pixels (largeur × hauteur)
                      </Label>
                      <div className="grid gap-2 grid-cols-2 md:grid-cols-4 text-xs">
                        <DimensionInput label="Perso primaire" dims={creativePlanSettings.test?.characterPrimary} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, characterPrimary: d } }))} />
                        <DimensionInput label="Perso face" dims={creativePlanSettings.test?.characterFace} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, characterFace: d } }))} />
                        <DimensionInput label="Perso profil" dims={creativePlanSettings.test?.characterProfile} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, characterProfile: d } }))} />
                        <DimensionInput label="Perso dos" dims={creativePlanSettings.test?.characterBack} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, characterBack: d } }))} />
                        <DimensionInput label="Décor primaire" dims={creativePlanSettings.test?.decorPrimary} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, decorPrimary: d } }))} />
                        <DimensionInput label="Décor angle 2" dims={creativePlanSettings.test?.decorAngle2} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, decorAngle2: d } }))} />
                        <DimensionInput label="Décor plongée" dims={creativePlanSettings.test?.decorPlongee} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, decorPlongee: d } }))} />
                        <DimensionInput label="Décor contre-pl." dims={creativePlanSettings.test?.decorContrePlongee} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, decorContrePlongee: d } }))} />
                        <DimensionInput label="Plan first" dims={creativePlanSettings.test?.planFirst} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, planFirst: d } }))} />
                        {/* Plan last uniquement en mode first-last */}
                        {(creativePlanSettings.test?.frameMode || 'first-last') === 'first-last' && (
                          <DimensionInput label="Plan last" dims={creativePlanSettings.test?.planLast} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, planLast: d } }))} />
                        )}
                        <DimensionInput label="Vidéo" dims={creativePlanSettings.test?.videoDimensions} onChange={(d) => updateCreativePlan(s => ({ ...s, test: { ...s.test, videoDimensions: d } }))} />
                      </div>
                    </div>
                  </div>
                  
                  {/* ============================================ */}
                  {/* SECTION PROD - Config pour bouton Production */}
                  {/* ============================================ */}
                  <div className="space-y-4 p-4 rounded-lg border bg-emerald-500/10 border-emerald-500/50 ring-2 ring-emerald-500/30">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-emerald-400 font-bold text-sm">P</span>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-bold text-emerald-400">PARAMÈTRES PRODUCTION</h4>
                          <span className="text-[10px] bg-emerald-500 text-black px-2 py-0.5 rounded-full font-bold">Bouton "Générer" en bas</span>
                        </div>
                        <p className="text-[10px] text-muted-foreground">WaveSpeed • Nano Banana Pro Ultra • Aspect Ratio + Resolution</p>
                      </div>
                    </div>
                    
                    {/* Mode Frame PROD */}
                    <div className="mb-4 p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-2 block">Mode de génération vidéo</Label>
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => updateCreativePlan(s => ({
                            ...s,
                            prod: { 
                              ...s.prod, 
                              frameMode: 'first-last' as FrameMode,
                              // Auto-sélectionner un modèle compatible first+last
                              videoModel: 'kling-v2.1-start-end'
                            }
                          }))}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            (creativePlanSettings.prod?.frameMode || 'first-last') === 'first-last'
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-border/50 hover:border-border'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1">🎬 FIRST + LAST frames</div>
                          <p className="text-[10px] text-muted-foreground">
                            2 images (début + fin) • Animation interpolée
                          </p>
                        </button>
                        <button
                          type="button"
                          onClick={() => updateCreativePlan(s => ({
                            ...s,
                            prod: { 
                              ...s.prod, 
                              frameMode: 'first-only' as FrameMode,
                              // Auto-sélectionner un modèle compatible first-only
                              videoModel: 'kling-v2.6-pro-i2v'
                            }
                          }))}
                          className={`p-3 rounded-lg border-2 transition-all text-left ${
                            creativePlanSettings.prod?.frameMode === 'first-only'
                              ? 'border-emerald-500 bg-emerald-500/10'
                              : 'border-border/50 hover:border-border'
                          }`}
                        >
                          <div className="text-xs font-semibold mb-1">🖼️ FIRST frame seul</div>
                          <p className="text-[10px] text-muted-foreground">
                            1 image (début) • Kling v2.6 Pro I2V
                          </p>
                        </button>
                      </div>
                    </div>

                    {/* Modèles PROD - FIXES (non modifiables) + Résolution + Vidéo */}
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                      {/* Modèle T2I - FIXE */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Modèle T2I (fixe)</Label>
                        <div className="h-8 px-3 flex items-center text-xs bg-emerald-500/10 rounded border border-emerald-500/30 text-emerald-300">
                          Nano Banana Pro Ultra
                        </div>
                      </div>
                      {/* Modèle Edit - FIXE */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Modèle Edit (fixe)</Label>
                        <div className="h-8 px-3 flex items-center text-xs bg-emerald-500/10 rounded border border-emerald-500/30 text-emerald-300">
                          Nano Banana Pro Edit Ultra
                        </div>
                      </div>
                      {/* Résolution globale */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Résolution</Label>
                        <Select
                          value={creativePlanSettings.prod?.resolution || '4k'}
                          onValueChange={(v) => updateCreativePlan(s => ({
                            ...s,
                            prod: { ...s.prod, resolution: v as WaveSpeedResolution }
                          }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_RESOLUTIONS.map(r => (
                              <SelectItem key={r.id} value={r.id} className="text-xs">
                                {r.label} - {r.description}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* Modèle Vidéo */}
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Modèle Vidéo</Label>
                        <Select
                          value={creativePlanSettings.prod?.videoModel || 'kling-v2.1-start-end'}
                          onValueChange={(v) => updateCreativePlan(s => ({
                            ...s,
                            prod: { ...s.prod, videoModel: v }
                          }))}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {AVAILABLE_VIDEO_MODELS
                              .filter(m => {
                                // Filtrer selon le mode frame
                                const frameMode = creativePlanSettings.prod?.frameMode || 'first-last';
                                if (frameMode === 'first-only') return m.supportsFirstOnly;
                                return m.supportsStartEnd;
                              })
                              .map(m => (
                                <SelectItem key={m.id} value={m.id} className="text-xs">{m.name}</SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    
                    {/* Durée vidéo */}
                    <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">Durée vidéo (sec)</Label>
                        <Input
                          type="number"
                          min={1}
                          max={30}
                          className="h-8 text-xs"
                          value={creativePlanSettings.prod?.videoDuration || 10}
                          onChange={(e) => updateCreativePlan(s => ({
                            ...s,
                            prod: { ...s.prod, videoDuration: parseInt(e.target.value) || 10 }
                          }))}
                        />
                      </div>
                    </div>
                    
                    {/* Aspect Ratios PROD */}
                    <div className="mt-4 pt-4 border-t border-emerald-500/20">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wide mb-3 block">
                        Aspect Ratios (WaveSpeed)
                      </Label>
                      
                      {/* Personnages */}
                      <div className="mb-4">
                        <p className="text-[10px] text-emerald-400 mb-2 font-medium">Personnages</p>
                        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                          <AspectRatioSelect 
                            label="Primaire" 
                            value={creativePlanSettings.prod?.characterPrimaryRatio || '9:16'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, characterPrimaryRatio: r } }))} 
                          />
                          <AspectRatioSelect 
                            label="Visage face" 
                            value={creativePlanSettings.prod?.characterFaceRatio || '1:1'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, characterFaceRatio: r } }))} 
                          />
                          <AspectRatioSelect 
                            label="Profil" 
                            value={creativePlanSettings.prod?.characterProfileRatio || '1:1'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, characterProfileRatio: r } }))} 
                          />
                          <AspectRatioSelect 
                            label="Vue de dos" 
                            value={creativePlanSettings.prod?.characterBackRatio || '9:16'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, characterBackRatio: r } }))} 
                          />
                        </div>
                      </div>
                      
                      {/* Décors */}
                      <div className="mb-4">
                        <p className="text-[10px] text-emerald-400 mb-2 font-medium">Décors</p>
                        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                          <AspectRatioSelect 
                            label="Primaire" 
                            value={creativePlanSettings.prod?.decorPrimaryRatio || '16:9'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, decorPrimaryRatio: r } }))} 
                          />
                          <AspectRatioSelect 
                            label="Angle 2" 
                            value={creativePlanSettings.prod?.decorAngle2Ratio || '16:9'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, decorAngle2Ratio: r } }))} 
                          />
                          <AspectRatioSelect 
                            label="Plongée" 
                            value={creativePlanSettings.prod?.decorPlongeeRatio || '16:9'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, decorPlongeeRatio: r } }))} 
                          />
                          <AspectRatioSelect 
                            label="Contre-plongée" 
                            value={creativePlanSettings.prod?.decorContrePlongeeRatio || '16:9'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, decorContrePlongeeRatio: r } }))} 
                          />
                        </div>
                      </div>
                      
                      {/* Plans (First/Last frames) */}
                      <div>
                        <p className="text-[10px] text-emerald-400 mb-2 font-medium">
                          {(creativePlanSettings.prod?.frameMode || 'first-last') === 'first-only' 
                            ? 'Plans (First frame uniquement pour vidéo)'
                            : 'Plans (First/Last frames pour vidéo)'
                          }
                        </p>
                        <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                          <AspectRatioSelect 
                            label="First frame" 
                            value={creativePlanSettings.prod?.planFirstRatio || '21:9'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, planFirstRatio: r } }))} 
                          />
                          {/* Last frame uniquement en mode first-last */}
                          {(creativePlanSettings.prod?.frameMode || 'first-last') === 'first-last' && (
                            <AspectRatioSelect 
                              label="Last frame" 
                              value={creativePlanSettings.prod?.planLastRatio || '21:9'} 
                              onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, planLastRatio: r } }))} 
                            />
                          )}
                          <AspectRatioSelect 
                            label="Vidéo" 
                            value={creativePlanSettings.prod?.videoRatio || '16:9'} 
                            onChange={(r) => updateCreativePlan(s => ({ ...s, prod: { ...s.prod, videoRatio: r } }))} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </Card>

          {/* Configuration Média */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <SparklesIcon size={20} className="text-violet-400" />
              <h2 className="text-lg font-semibold">Génération des médias</h2>
            </div>

            {/* Options */}
            <div className="space-y-4">
              <div className="flex items-start gap-3 p-4 bg-muted/20 rounded-lg">
                <Checkbox
                  id="generateMediaDirectly"
                  checked={config.generateMediaDirectly}
                  onCheckedChange={(checked) => 
                    setConfig({ ...config, generateMediaDirectly: checked as boolean })
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="generateMediaDirectly" className="font-medium cursor-pointer">
                    Générer les médias directement
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    L'IA génère automatiquement images et vidéos après création du canvas.
                  </p>
                </div>
              </div>

              {/* Paramètres Vidéo - Nouvelle logique N × M */}
              <div className="pt-4 border-t border-border/30 space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <LayersIcon size={16} className="text-blue-400" />
                  <span className="text-sm font-medium">Configuration par plan</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* N = Couples par plan */}
                  <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <Label htmlFor="couplesPerPlan" className="mb-2 flex items-center gap-2 text-sm font-medium text-blue-400">
                      <ImageIcon size={14} />
                      N = Couples d'images par plan
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Chaque couple = 1 first-frame + 1 last-frame (mises en scène différentes)
                    </p>
                    <Select
                      value={String(config.settings?.couplesPerPlan || 1)}
                      onValueChange={(value) => 
                        setConfig({ 
                          ...config, 
                          settings: { ...config.settings, couplesPerPlan: parseInt(value) } 
                        })
                      }
                    >
                      <SelectTrigger id="couplesPerPlan" className="border-blue-500/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 couple (défaut)</SelectItem>
                        <SelectItem value="2">2 couples</SelectItem>
                        <SelectItem value="3">3 couples</SelectItem>
                        <SelectItem value="4">4 couples</SelectItem>
                        <SelectItem value="5">5 couples</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* M = Vidéos par couple */}
                  <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                    <Label htmlFor="videosPerCouple" className="mb-2 flex items-center gap-2 text-sm font-medium text-violet-400">
                      <VideoIcon size={14} />
                      M = Vidéos par couple
                    </Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Nombre de variations vidéo générées pour chaque couple d'images
                    </p>
                    <Select
                      value={String(config.settings?.videosPerCouple || 4)}
                      onValueChange={(value) => 
                        setConfig({ 
                          ...config, 
                          settings: { ...config.settings, videosPerCouple: parseInt(value) } 
                        })
                      }
                    >
                      <SelectTrigger id="videosPerCouple" className="border-violet-500/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 vidéo</SelectItem>
                        <SelectItem value="2">2 vidéos</SelectItem>
                        <SelectItem value="4">4 vidéos (défaut)</SelectItem>
                        <SelectItem value="6">6 vidéos</SelectItem>
                        <SelectItem value="8">8 vidéos</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Résumé visuel N × M */}
                <div className="p-3 bg-muted/30 rounded-lg">
                  <div className="flex items-center gap-2 text-sm">
                    <InfoIcon size={14} className="text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Pour chaque plan : <span className="text-blue-400 font-medium">{config.settings?.couplesPerPlan || 1}</span> couple(s) × <span className="text-violet-400 font-medium">{config.settings?.videosPerCouple || 4}</span> vidéo(s) = <span className="text-emerald-400 font-semibold">{(config.settings?.couplesPerPlan || 1) * (config.settings?.videosPerCouple || 4)}</span> vidéos/plan
                    </span>
                  </div>
                </div>

                {/* Autres paramètres vidéo */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                  <div>
                    <Label htmlFor="videoDuration" className="mb-2 flex items-center gap-2 text-sm">
                      ⏱️ Durée vidéo
                    </Label>
                    <Select
                      value={String(config.settings?.videoDuration || 10)}
                      onValueChange={(value) => 
                        setConfig({ 
                          ...config, 
                          settings: { ...config.settings, videoDuration: parseInt(value) } 
                        })
                      }
                    >
                      <SelectTrigger id="videoDuration">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="5">5 secondes</SelectItem>
                        <SelectItem value="10">10 secondes</SelectItem>
                        <SelectItem value="15">15 secondes</SelectItem>
                        <SelectItem value="20">20 secondes</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="videoAspectRatio" className="mb-2 flex items-center gap-2 text-sm">
                      📐 Format vidéo
                    </Label>
                    <Select
                      value={config.settings?.videoAspectRatio || '16:9'}
                      onValueChange={(value) => 
                        setConfig({ 
                          ...config, 
                          settings: { ...config.settings, videoAspectRatio: value } 
                        })
                      }
                    >
                      <SelectTrigger id="videoAspectRatio">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="16:9">16:9 (Paysage)</SelectItem>
                        <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                        <SelectItem value="1:1">1:1 (Carré)</SelectItem>
                        <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Estimation du budget */}
          <Card className="p-6 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-4">
              <EuroIcon size={20} className="text-emerald-400" />
              <h2 className="text-lg font-semibold">Estimation du budget</h2>
            </div>

            {/* Modèles utilisés */}
            <div className="space-y-3 mb-6">
              <div className="text-sm font-medium text-muted-foreground">Modèles utilisés :</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <ImageIcon size={14} className="text-blue-400" />
                    <span className="text-sm font-medium">Text-to-Image (primaires)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Nano Banana Pro Ultra (WaveSpeed)</p>
                  <p className="text-xs text-emerald-400 font-mono">0.02€ / image</p>
                </div>
                <div className="p-3 bg-background/50 rounded-lg border border-border/30">
                  <div className="flex items-center gap-2 mb-1">
                    <CopyIcon size={14} className="text-violet-400" />
                    <span className="text-sm font-medium">Edit (variantes + frames)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Nano Banana Pro Edit Ultra (WaveSpeed)</p>
                  <p className="text-xs text-emerald-400 font-mono">0.025€ / image</p>
                </div>
                <div className="p-3 bg-background/50 rounded-lg border border-border/30 md:col-span-2">
                  <div className="flex items-center gap-2 mb-1">
                    <VideoIcon size={14} className="text-amber-400" />
                    <span className="text-sm font-medium">Vidéo First+Last Frame</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Kling v2.6 Pro First+Last (WaveSpeed)</p>
                  <p className="text-xs text-emerald-400 font-mono">0.08€ × durée (secondes) / vidéo</p>
                </div>
              </div>
            </div>

            {/* Calcul dynamique */}
            <div className="p-4 bg-background/80 rounded-lg border border-emerald-500/20">
              <div className="text-sm font-medium mb-3">Estimation pour un projet type :</div>
              <div className="grid grid-cols-2 gap-4 text-xs">
                {/* Hypothèses */}
                <div className="space-y-1">
                  <p className="text-muted-foreground">Personnages estimés : <span className="text-white">~3</span></p>
                  <p className="text-muted-foreground">Décors estimés : <span className="text-white">~3</span></p>
                  <p className="text-muted-foreground">Plans estimés : <span className="text-white">~6</span></p>
                </div>
                {/* Détails */}
                <div className="space-y-1 border-l border-border/30 pl-4">
                  <p className="text-blue-400">
                    Images primaires : {3 + 3} × 0.02€ = <span className="font-mono">{((3 + 3) * 0.02).toFixed(2)}€</span>
                  </p>
                  <p className="text-violet-400">
                    Variantes : {(3 + 3) * 3} × 0.025€ = <span className="font-mono">{((3 + 3) * 3 * 0.025).toFixed(2)}€</span>
                  </p>
                  <p className="text-blue-400">
                    Frames (N={config.settings?.couplesPerPlan || 1}) : {6 * (config.settings?.couplesPerPlan || 1) * 2} × 0.025€ = <span className="font-mono">{(6 * (config.settings?.couplesPerPlan || 1) * 2 * 0.025).toFixed(2)}€</span>
                  </p>
                  <p className="text-amber-400">
                    Vidéos (N×M={config.settings?.couplesPerPlan || 1}×{config.settings?.videosPerCouple || 4}) : {6 * (config.settings?.couplesPerPlan || 1) * (config.settings?.videosPerCouple || 4)} × {(config.settings?.videoDuration || 10) * 0.08}€ = <span className="font-mono">{(6 * (config.settings?.couplesPerPlan || 1) * (config.settings?.videosPerCouple || 4) * (config.settings?.videoDuration || 10) * 0.08).toFixed(2)}€</span>
                  </p>
                </div>
              </div>
              
              {/* Total estimé */}
              <div className="mt-4 pt-4 border-t border-emerald-500/20 flex items-center justify-between">
                <span className="text-sm font-medium">Budget estimé total :</span>
                <span className="text-2xl font-bold text-emerald-400">
                  ~{(
                    // Primaires (perso + décors)
                    (3 + 3) * 0.02 +
                    // Variantes (3 par perso/décor)
                    (3 + 3) * 3 * 0.025 +
                    // Frames first/last (2 × N couples × plans)
                    6 * (config.settings?.couplesPerPlan || 1) * 2 * 0.025 +
                    // Vidéos (N × M × plans × durée × coût)
                    6 * (config.settings?.couplesPerPlan || 1) * (config.settings?.videosPerCouple || 4) * (config.settings?.videoDuration || 10) * 0.08
                  ).toFixed(2)}€
                </span>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                💡 Ce budget varie selon le nombre réel de personnages, décors et plans analysés par l'IA.
              </p>
            </div>
          </Card>

          {/* Action */}
          <div className="flex justify-end gap-4">
            <Button
              variant="outline"
              onClick={() => router.push(`/local/briefs/${params.id}`)}
              disabled={generating}
            >
              Annuler
            </Button>
            <Button
              onClick={handleGenerate}
              disabled={generating || !projectName.trim()}
              className="gap-2 min-w-[200px] bg-emerald-600 hover:bg-emerald-700"
            >
              {generating ? (
                <>
                  <Loader2Icon size={16} className="animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <PlayIcon size={16} />
                  🎬 Générer (Production)
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* Dialog System Prompt */}
      <Dialog open={showPromptDialog} onOpenChange={setShowPromptDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>System Prompt</DialogTitle>
            <DialogDescription>
              Ce prompt guide l'IA dans l'analyse du brief et la génération des plans.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 min-h-0">
            <Textarea
              value={config.systemPrompt}
              onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
              rows={25}
              className="font-mono text-xs"
            />
          </ScrollArea>
          
          {/* Checkbox sauvegarder par défaut */}
          <div className="flex items-center gap-3 py-3 px-1 border-t border-border/30">
            <Checkbox
              id="saveAsDefault"
              checked={savePromptAsDefault}
              onCheckedChange={(checked) => setSavePromptAsDefault(checked as boolean)}
            />
            <Label htmlFor="saveAsDefault" className="text-sm cursor-pointer">
              Sauvegarder comme prompt par défaut
            </Label>
          </div>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setConfig({ ...config, systemPrompt: BUILTIN_SYSTEM_PROMPT });
                // Effacer aussi la sauvegarde
                localStorage.removeItem(STORAGE_KEY_SYSTEM_PROMPT);
                setSavePromptAsDefault(false);
              }}
            >
              Réinitialiser (défaut)
            </Button>
            <Button 
              onClick={() => {
                // Sauvegarder si demandé
                if (savePromptAsDefault && config.systemPrompt) {
                  localStorage.setItem(STORAGE_KEY_SYSTEM_PROMPT, config.systemPrompt);
                }
                setShowPromptDialog(false);
              }}
            >
              {savePromptAsDefault ? 'Sauvegarder & Fermer' : 'Fermer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Génération - UI épurée */}
      <Dialog open={showReasoningDialog} onOpenChange={(open) => !generating && setShowReasoningDialog(open)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden bg-zinc-950 border-zinc-800">
          {/* Header minimaliste */}
          <div className="flex-shrink-0 pb-4 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {generating ? (
                  <div className="w-10 h-10 rounded-full bg-[#00ff41]/20 flex items-center justify-center flex-shrink-0">
                    <Loader2Icon size={20} className="animate-spin text-[#00ff41]" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <CheckCircle2Icon size={20} className="text-emerald-400" />
                  </div>
                )}
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold text-white">
                    {generating ? 'Génération en cours' : 'Génération terminée'}
                  </h2>
                  <p className="text-xs text-zinc-500 whitespace-nowrap">
                    {isTestVideoMode 
                      ? '🎬 Test Vidéo (sans LLM) • Prompts fixes' 
                      : `${LLM_PROVIDERS[llmProvider].label}: ${config.settings?.testMode ? `${LLM_PROVIDERS[llmProvider].testModel} (Test)` : config.aiModel}${llmProvider === 'openai' ? ` • Reasoning ${config.reasoningLevel || 'high'}` : ''}`
                    }
                  </p>
                </div>
              </div>
              
              {/* Phases en mode compact */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <PhaseIndicator phase="analysis" label={isTestVideoMode ? "Images" : "Analyse"} />
                <div className="w-6 h-px bg-zinc-700" />
                <PhaseIndicator phase="canvas" label={isTestVideoMode ? "Vidéos" : "Canvas"} />
                <div className="w-6 h-px bg-zinc-700" />
                <PhaseIndicator phase="redirect" label="OK" />
              </div>
            </div>
          </div>
          
          {/* Zone de log - Sans bordure interne */}
          <div className="flex-1 min-h-0 overflow-auto py-4">
            <pre className="text-sm whitespace-pre-wrap font-sans text-zinc-300 leading-relaxed">
              {reasoning || '⏳ Initialisation...'}
            </pre>
            <div ref={reasoningEndRef} />
          </div>
          
          {/* Footer discret */}
          {!generating && (
            <div className="flex-shrink-0 pt-4 border-t border-zinc-800">
              <Button 
                onClick={() => setShowReasoningDialog(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
              >
                Continuer vers le canvas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
