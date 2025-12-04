'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
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

// Le DEFAULT_SYSTEM_PROMPT est chargé depuis localStorage ou utilise la valeur par défaut
const STORAGE_KEY_SYSTEM_PROMPT = 'brief-system-prompt-default';

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
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    if (reasoningEndRef.current && showReasoningDialog) {
      reasoningEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [reasoning, showReasoningDialog]);
  
  const [config, setConfig] = useState<Partial<ProjectGenerationConfig>>({
    aiModel: 'gpt-5.1-2025-11-13', // GPT-5.1 par défaut pour des prompts de qualité
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
  
  const [projectName, setProjectName] = useState('');

  // Charger le system prompt sauvegardé au montage
  useEffect(() => {
    const savedPrompt = getDefaultSystemPrompt();
    setConfig(prev => ({ ...prev, systemPrompt: savedPrompt }));
  }, []);

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

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      alert('Veuillez donner un nom au projet');
      return;
    }

    setGenerating(true);
    setReasoning('');
    setShowReasoningDialog(true);
    setPhaseStatus({ analysis: 'running', canvas: 'pending', redirect: 'pending' });
    setCurrentPhase('analysis');

    try {
      // ========== PHASE 1 : ANALYSE ==========
      const isTestModeEnabled = config.settings?.testMode === true;
      console.log('[Generate] Mode Test:', isTestModeEnabled, 'config.settings:', config.settings);
      
      // Message initial clair sur le mode
      setReasoning(isTestModeEnabled 
        ? '🧪 MODE TEST ACTIVÉ\n   → LLM: GPT-4o (rapide)\n   → Images: petites résolutions\n   → Prompts: simplifiés\n\n'
        : `🎬 MODE PRODUCTION\n   → LLM: ${config.aiModel || 'GPT-5.1'}\n   → Images: haute résolution\n\n`
      );
      
      const response = await fetch('/api/briefs/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: params.id,
          projectName,
          config,
          isTestMode: isTestModeEnabled,
        }),
      });

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
              // Affichage propre sans doublon ni double emoji
              if (data.phase === 'analysis') {
                setReasoning(data.message + '\n');
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
              // ========== CRÉATION DU PROJET DÈS RÉCEPTION DES DONNÉES ==========
              // C'est le moment clé : on crée immédiatement le projet dans localStorage
              canvasData = data.canvasData;
              projectStructure = data.projectStructure;
              generationSequenceData = data.generationSequence;
              
              if (canvasData) {
                setReasoning(prev => prev + `\n📝 Création du projet local...\n`);
                const newProject = createLocalProject(projectName);
                
                // Récupérer le mode test depuis la config
                const isTestModeEnabled = config.settings?.testMode === true;
                
                // Inclure la séquence de génération ET le mode test dans les données du projet
                updateLocalProject(newProject.id, { 
                  data: {
                    ...canvasData,
                    generationSequence: generationSequenceData,
                    testMode: isTestModeEnabled, // Stocker le mode test pour le GenerationPanel
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
              
              // Résumé
              if (data.summary) {
                const s = data.summary;
                setReasoning(prev => prev + `\n📊 Résumé :\n`);
                setReasoning(prev => prev + `   • ${s.characters} personnage(s)\n`);
                setReasoning(prev => prev + `   • ${s.locations || s.decors || 0} décor(s)\n`);
                setReasoning(prev => prev + `   • ${s.scenes} scène(s)\n`);
                setReasoning(prev => prev + `   • ${s.plans} plan(s)\n`);
                setReasoning(prev => prev + `   • ${s.nodes} nœuds dans le canvas\n`);
                if (s.imagesToGenerate) {
                  setReasoning(prev => prev + `   • ${s.imagesToGenerate} images à générer (primaires + variantes)\n`);
                }
                if (s.videosToGenerate) {
                  setReasoning(prev => prev + `   • ${s.videosToGenerate} vidéos à générer\n`);
                }
              }

              // Redirection vers le canvas (le projet a déjà été créé dans project_data)
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
          // Traiter le buffer restant à la fin du stream
          if (buffer.trim()) {
            processLine(buffer);
          }
          break;
        }
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      setReasoning(prev => prev + `\n\n❌ Erreur: ${error.message}`);
    } finally {
      setGenerating(false);
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Modèle IA */}
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
                    <SelectItem value="gpt-5.1-2025-11-13">GPT-5.1 (Recommandé)</SelectItem>
                    <SelectItem value="o1-2024-12-17">o1 (Reasoning)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o (Rapide)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Économique)</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  GPT-5.1 génère des prompts beaucoup plus détaillés
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

              {/* Mode Test */}
              <div className="flex items-start gap-3 p-4 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                <Checkbox
                  id="testMode"
                  checked={config.settings?.testMode}
                  onCheckedChange={(checked) => 
                    setConfig({ 
                      ...config, 
                      settings: { ...config.settings, testMode: checked as boolean } 
                    })
                  }
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label htmlFor="testMode" className="font-medium cursor-pointer text-amber-500">
                    🧪 Mode Test (Rapide)
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    GPT-4o au lieu de GPT-5.1, limite à 2 personnages, 2 plans max, prompts courts.
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
              disabled={generating}
              className="gap-2 min-w-[200px]"
            >
              {generating ? (
                <>
                  <Loader2Icon size={16} className="animate-spin" />
                  Génération...
                </>
              ) : (
                <>
                  <PlayIcon size={16} />
                  Générer le projet
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
                    {config.settings?.testMode ? 'GPT-4o (Mode Test)' : config.aiModel} • Reasoning {config.reasoningLevel || 'high'}
                  </p>
                </div>
              </div>
              
              {/* Phases en mode compact */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <PhaseIndicator phase="analysis" label="Analyse" />
                <div className="w-6 h-px bg-zinc-700" />
                <PhaseIndicator phase="canvas" label="Canvas" />
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
