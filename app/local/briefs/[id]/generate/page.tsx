'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
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
  BrainIcon,
  ImageIcon,
  VideoIcon,
  CheckCircle2Icon,
  CircleDotIcon,
  DollarSignIcon,
  LayersIcon,
  SaveIcon,
  PlusIcon,
  Trash2Icon,
  SettingsIcon,
  ClockIcon,
  HashIcon,
  FolderIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  LinkIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef, useCallback } from 'react';
import { createLocalProject, updateLocalProject } from '@/lib/local-projects-store';
import type { Brief } from '@/types/brief';

// Imports des nouveaux modules
import {
  LLM_PROVIDERS,
  LLM_MODELS,
  T2I_MODELS,
  I2I_MODELS,
  VIDEO_MODELS,
  ASPECT_RATIOS,
  RESOLUTIONS,
  REASONING_LEVELS,
  getVideoModelsForMode,
  modelSupportsReasoning,
  type LLMProvider,
  type AspectRatio,
  type Resolution,
  type ReasoningLevel,
} from '@/lib/models-registry';

import {
  type GenerationConfig,
  type VideoMode,
  DEFAULT_GENERATION_CONFIG,
  loadGenerationConfig,
  saveGenerationConfig,
  configToLegacyFormat,
} from '@/lib/generation-config';

import {
  type GenerationPreset,
  loadPresets,
  loadPresetsFromServer,
  getPreset,
  createPreset,
  updatePreset,
  deletePreset,
  getCurrentPresetId,
  setCurrentPresetId,
} from '@/lib/generation-presets';

import {
  calculateBudget,
  formatCurrency,
  type BudgetBreakdown,
} from '@/lib/budget-calculator';

// ============================================================
// SYSTEM PROMPT PAR DÉFAUT
// ============================================================

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

#### B. promptImageDepart (COMPOSITION DÉBUT)
Décrit la COMPOSITION SPATIALE au DÉBUT du plan (21:9 cinémascope).

#### C. promptImageFin (COMPOSITION FIN)
Décrit la COMPOSITION SPATIALE à la FIN du plan (21:9 cinémascope).
DÉDUITE de l'action.

## FORMAT JSON OBLIGATOIRE
{
  "title": "Titre",
  "synopsis": "Synopsis (2-3 phrases)",
  "characters": [...],
  "decors": [...],
  "scenes": [...],
  "totalPlans": 4,
  "estimatedDuration": 60
}`;

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================

export default function GenerateProjectPage() {
  const router = useRouter();
  const params = useParams();
  
  // États de base
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [reasoning, setReasoning] = useState<string>('');
  const [projectName, setProjectName] = useState('');
  const reasoningEndRef = useRef<HTMLDivElement>(null);
  
  // États des phases de génération
  const [phaseStatus, setPhaseStatus] = useState<Record<string, 'pending' | 'running' | 'done'>>({
    analysis: 'pending',
    canvas: 'pending',
    redirect: 'pending',
  });

  // Configuration de génération
  const [config, setConfig] = useState<GenerationConfig>(DEFAULT_GENERATION_CONFIG);
  
  // Presets - initialisé avec loadPresets() pour avoir les built-in immédiatement
  const [presets, setPresets] = useState<GenerationPreset[]>(() => {
    if (typeof window !== 'undefined') {
      return loadPresets();
    }
    return [];
  });
  const [currentPresetId, setCurrentPresetIdState] = useState<string | null>(null);
  const [presetModified, setPresetModified] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [showNewPresetDialog, setShowNewPresetDialog] = useState(false);
  
  // Budget
  const [budget, setBudget] = useState<BudgetBreakdown | null>(null);

  // Auto-scroll reasoning
  useEffect(() => {
    if (reasoningEndRef.current && showReasoningDialog) {
      reasoningEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [reasoning, showReasoningDialog]);

  // Charger la config et les presets au montage
  useEffect(() => {
    // Charger les presets depuis le serveur (fichier local) pour persistance
    loadPresetsFromServer().then(({ presets: allPresets, currentPresetId: serverId }) => {
      console.log('[Generate] Presets chargés depuis serveur:', allPresets.length, allPresets.map(p => p.name));
      setPresets(allPresets);
      
      // Utiliser l'ID du serveur en priorité, sinon localStorage
      const currentId = serverId || getCurrentPresetId();
      
      if (currentId) {
        // Un preset est sélectionné → charger SA config (pas la config modifiée)
        const preset = allPresets.find(p => p.id === currentId);
        if (preset) {
          console.log('[Generate] Chargement du preset:', preset.name);
          setConfig(preset.config);
          setCurrentPresetIdState(currentId);
          setPresetModified(false);
        } else {
          // Preset non trouvé, charger la config sauvegardée
          console.log('[Generate] Preset non trouvé, chargement config sauvegardée');
          const savedConfig = loadGenerationConfig();
          setConfig(savedConfig);
        }
      } else {
        // Pas de preset sélectionné → charger la config sauvegardée
        const savedConfig = loadGenerationConfig();
        setConfig(savedConfig);
      }
    }).catch(error => {
      console.error('[Generate] Erreur chargement presets:', error);
      // Fallback: charger depuis localStorage
      const allPresets = loadPresets();
      setPresets(allPresets);
      const savedConfig = loadGenerationConfig();
      setConfig(savedConfig);
    });
  }, []);
  
  // Recalculer le budget quand la config change
  useEffect(() => {
    const newBudget = calculateBudget(config);
    setBudget(newBudget);
  }, [config]);
  
  // Sauvegarder la config quand elle change
  useEffect(() => {
    saveGenerationConfig(config);
  }, [config]);

  // Charger le brief
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

  // ============================================================
  // HANDLERS CONFIG
  // ============================================================

  const updateConfig = useCallback(<K extends 'llm' | 't2i' | 'i2i' | 'video' | 'quantities'>(
    section: K,
    updates: Partial<GenerationConfig[K]>
  ) => {
    setConfig(prev => ({
      ...prev,
      [section]: { ...(prev[section] as object), ...updates },
    }));
    setPresetModified(true);
  }, []);

  const handleLLMProviderChange = (provider: LLMProvider) => {
    const firstModel = LLM_MODELS[provider][0];
    setConfig(prev => ({
      ...prev,
      llm: {
        provider,
        model: firstModel.id,
        reasoningLevel: firstModel.supportsReasoning ? 'medium' : undefined,
      },
    }));
    setPresetModified(true);
  };

  const handleLLMModelChange = (modelId: string) => {
    const supportsReasoning = modelSupportsReasoning(config.llm.provider, modelId);
    setConfig(prev => ({
      ...prev,
      llm: {
        ...prev.llm,
        model: modelId,
        reasoningLevel: supportsReasoning ? (prev.llm.reasoningLevel || 'medium') : undefined,
      },
    }));
    setPresetModified(true);
  };

  const handleVideoModeChange = (mode: VideoMode) => {
    const availableModels = getVideoModelsForMode(mode);
    const currentModelAvailable = availableModels.find(m => m.id === config.video.model);
    
    setConfig(prev => ({
      ...prev,
      video: {
        ...prev.video,
        mode,
        model: currentModelAvailable?.id || availableModels[0]?.id || prev.video.model,
      },
    }));
    setPresetModified(true);
  };

  // ============================================================
  // HANDLERS PRESETS
  // ============================================================

  const handlePresetChange = (presetId: string) => {
    const preset = getPreset(presetId);
    if (preset) {
      setConfig(preset.config);
      setCurrentPresetIdState(presetId);
      setCurrentPresetId(presetId);
      setPresetModified(false);
    }
  };

  const handleSavePreset = () => {
    if (currentPresetId) {
      const currentPreset = presets.find(p => p.id === currentPresetId);
      // Si c'est un preset built-in, ouvrir le dialogue pour créer une copie
      if (currentPreset?.isBuiltIn) {
        setNewPresetName(`${currentPreset.name} (modifié)`);
        setShowNewPresetDialog(true);
        return;
      }
      // Sinon, mettre à jour le preset utilisateur existant
      const updated = updatePreset(currentPresetId, { config });
      if (updated) {
        setPresets(loadPresets());
        setPresetModified(false);
      }
    } else {
      setShowNewPresetDialog(true);
    }
  };

  const handleCreatePreset = () => {
    if (!newPresetName.trim()) return;
    
    const preset = createPreset(newPresetName.trim(), config);
    setPresets(loadPresets());
    setCurrentPresetIdState(preset.id);
    setCurrentPresetId(preset.id);
    setPresetModified(false);
    setNewPresetName('');
    setShowNewPresetDialog(false);
  };

  const handleDeletePreset = (presetId: string) => {
    if (deletePreset(presetId)) {
      setPresets(loadPresets());
      if (currentPresetId === presetId) {
        setCurrentPresetIdState(null);
        setCurrentPresetId(null);
      }
    }
  };

  // ============================================================
  // GÉNÉRATION
  // ============================================================

  const handleGenerate = async () => {
    if (!projectName.trim()) {
      alert('Veuillez donner un nom au projet');
      return;
    }

    setGenerating(true);
    setReasoning('');
    setShowReasoningDialog(true);
    setPhaseStatus({ analysis: 'running', canvas: 'pending', redirect: 'pending' });

    const providerLabel = config.llm.provider === 'openai' ? 'OpenAI' : 'Mistral';
    setReasoning(`🎬 GÉNÉRATION DE PROJET
   → LLM: ${providerLabel} (${config.llm.model})
   → Mode vidéo: ${config.video.mode === 'image-first' ? 'IMAGE FIRST' : 'IMAGES FIRST AND LAST'}
   → Plans: ${config.quantities.plansCount}
   → Jeux d'images: ${config.quantities.imageSetsPerPlan} par plan
   → Vidéos: ${config.quantities.videosPerImageSet} par jeu
   → Durée: ${config.video.duration}s

`);

    try {
      const legacyConfig = configToLegacyFormat(config);
      
      const response = await fetch('/api/briefs/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: params.id,
          projectName,
          config: legacyConfig,
          isTestMode: false,
        }),
      });

      await processGenerationResponse(response, projectName);
    } catch (error: any) {
      console.error('Erreur génération:', error);
      setReasoning(prev => prev + `\n❌ Erreur : ${error.message}`);
      setPhaseStatus({ analysis: 'done', canvas: 'done', redirect: 'done' });
    } finally {
      setGenerating(false);
    }
  };

  const processGenerationResponse = async (response: Response, projName: string) => {
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `Erreur: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Pas de reader disponible');
    }

    let canvasData: any = null;
    let buffer = '';
    let generationSequenceData: any = null;
    let createdProjectId: string | null = null;

    const processLine = (line: string) => {
      if (!line.startsWith('data: ')) return;

      try {
        const data = JSON.parse(line.slice(6));
        
        switch (data.type) {
          case 'phase_start':
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
            generationSequenceData = data.generationSequence;
            
            if (canvasData) {
              setReasoning(prev => prev + `\n📝 Création du projet local...\n`);
              const newProject = createLocalProject(projName);
              
              updateLocalProject(newProject.id, { 
                data: {
                  ...canvasData,
                  generationSequence: generationSequenceData,
                  testMode: false,
                }
              });
              
              createdProjectId = newProject.id;
              setReasoning(prev => prev + `✅ Projet créé : ${createdProjectId}\n`);
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
            }

            if (createdProjectId) {
              setReasoning(prev => prev + `\n🎨 Ouverture du canvas dans 2 secondes...`);
              setPhaseStatus(prev => ({ ...prev, redirect: 'done' }));
              setTimeout(() => {
                router.push(`/local/canvas/${createdProjectId}`);
              }, 2000);
            }
            break;

          case 'error':
            setReasoning(prev => prev + `\n\n❌ Erreur: ${data.error}\n`);
            break;
        }
      } catch (e) {
        console.error('Erreur parse SSE:', e, line);
      }
    };

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

  // ============================================================
  // COMPOSANTS UI
  // ============================================================

  const PhaseIndicator = ({ phase, label }: { phase: string; label: string }) => {
    const status = phaseStatus[phase];
    const isDone = status === 'done';
    const isRunning = status === 'running';
    
    return (
      <div className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
        isDone 
          ? 'bg-emerald-500/20 text-emerald-400' 
          : isRunning 
            ? 'bg-blue-500/20 text-blue-400' 
            : 'bg-zinc-800 text-zinc-500'
      }`}>
        {isDone ? (
          <CheckCircle2Icon size={12} />
        ) : isRunning ? (
          <Loader2Icon size={12} className="animate-spin" />
        ) : (
          <CircleDotIcon size={12} />
        )}
        <span>{label}</span>
      </div>
    );
  };

  // ============================================================
  // RENDER
  // ============================================================

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

  const availableVideoModels = getVideoModelsForMode(config.video.mode);
  const currentLLMSupportsReasoning = modelSupportsReasoning(config.llm.provider, config.llm.model);

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
          
          {/* ============================================================ */}
          {/* SECTION 1: NOM DU PROJET */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <FolderIcon size={20} className="text-blue-400" />
              <h2 className="text-lg font-semibold">Nom du projet</h2>
            </div>
            <Input
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              placeholder="Ex: Vidéo promotionnelle Q1 2025 v1"
              className="text-lg"
            />
          </Card>

          {/* ============================================================ */}
          {/* SECTION 2: PRESETS */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <SettingsIcon size={20} className="text-violet-400" />
                <h2 className="text-lg font-semibold">Presets</h2>
                {presetModified && (
                  <Badge variant="outline" className="text-amber-400 border-amber-400/50">
                    Modifié
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowNewPresetDialog(true)}
                  className="gap-1"
                >
                  <PlusIcon size={14} />
                  Nouveau
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSavePreset}
                  disabled={!presetModified && !!currentPresetId}
                  className="gap-1"
                >
                  <SaveIcon size={14} />
                  Sauvegarder
                </Button>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <Select value={currentPresetId || ''} onValueChange={handlePresetChange}>
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Sélectionner un preset..." />
                </SelectTrigger>
                <SelectContent>
                  {presets.map(preset => (
                    <SelectItem key={preset.id} value={preset.id}>
                      <div className="flex items-center gap-2">
                        {preset.name}
                        {preset.isBuiltIn && (
                          <Badge variant="secondary" className="text-[10px]">Intégré</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {currentPresetId && !presets.find(p => p.id === currentPresetId)?.isBuiltIn && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDeletePreset(currentPresetId)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2Icon size={16} />
                </Button>
              )}
            </div>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 3: LLM */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <BrainIcon size={20} className="text-emerald-400" />
              <h2 className="text-lg font-semibold">LLM</h2>
            </div>

            <div className="space-y-4">
              {/* Provider */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Provider</Label>
                <div className="flex gap-3">
                  {LLM_PROVIDERS.map(provider => (
                    <button
                      key={provider}
                      onClick={() => handleLLMProviderChange(provider)}
                      className={`flex-1 p-3 rounded-lg border-2 transition-all ${
                        config.llm.provider === provider
                          ? 'border-emerald-500 bg-emerald-500/10'
                          : 'border-border/50 hover:border-border'
                      }`}
                    >
                      <div className="font-semibold capitalize">{provider === 'openai' ? 'OpenAI' : 'Mistral'}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Modèle */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">Modèle</Label>
                <Select value={config.llm.model} onValueChange={handleLLMModelChange}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LLM_MODELS[config.llm.provider].map(model => (
                      <SelectItem key={model.id} value={model.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-sm">{model.displayName}</span>
                          <span className="text-xs text-muted-foreground">({model.description})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Niveau de raisonnement (si supporté) */}
              {currentLLMSupportsReasoning && (
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    Niveau de raisonnement
                  </Label>
                  <Select 
                    value={config.llm.reasoningLevel || 'medium'} 
                    onValueChange={(v) => updateConfig('llm', { reasoningLevel: v as ReasoningLevel })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {REASONING_LEVELS.map(level => (
                        <SelectItem key={level.id} value={level.id}>
                          <span className="font-mono">{level.label}</span>
                          <span className="text-xs text-muted-foreground ml-2">({level.description})</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              {!currentLLMSupportsReasoning && config.llm.provider === 'openai' && (
                <p className="text-xs text-muted-foreground">
                  ℹ️ Le niveau de raisonnement est disponible uniquement avec o3
                </p>
              )}
            </div>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 4: MODÈLES DE GÉNÉRATION D'IMAGE */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <ImageIcon size={20} className="text-blue-400" />
              <h2 className="text-lg font-semibold">Modèles de génération d'image</h2>
            </div>

            <div className="space-y-6">
              {/* T2I - Text to Image */}
              <div className="p-4 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-blue-400 font-semibold">T2I</span>
                  <span className="text-sm text-muted-foreground">Text to Image (images primaires)</span>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Modèle</Label>
                    <Select 
                      value={config.t2i.model} 
                      onValueChange={(v) => updateConfig('t2i', { model: v })}
                    >
                      <SelectTrigger className="text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {T2I_MODELS.map(model => (
                          <SelectItem key={model.id} value={model.id} className="text-xs font-mono">
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Aspect Ratio</Label>
                      <Select 
                        value={config.t2i.aspectRatio} 
                        onValueChange={(v) => updateConfig('t2i', { aspectRatio: v as AspectRatio })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASPECT_RATIOS.map(ar => (
                            <SelectItem key={ar.id} value={ar.id}>
                              {ar.label} <span className="text-muted-foreground">({ar.description})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Résolution</Label>
                      <Select 
                        value={config.t2i.resolution} 
                        onValueChange={(v) => updateConfig('t2i', { resolution: v as Resolution })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOLUTIONS.map(r => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                          </SelectItem>
                        ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>

              {/* I2I - Image to Image */}
              <div className="p-4 bg-violet-500/5 border border-violet-500/20 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-violet-400 font-semibold">I2I</span>
                  <span className="text-sm text-muted-foreground">Image to Image (first & last frames)</span>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Pour les images secondaires, first et last frames des plans
                </p>
                
                <div className="space-y-4">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Modèle</Label>
                    <Select 
                      value={config.i2i.model} 
                      onValueChange={(v) => updateConfig('i2i', { model: v })}
                    >
                      <SelectTrigger className="text-xs font-mono">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {I2I_MODELS.map(model => (
                          <SelectItem key={model.id} value={model.id} className="text-xs font-mono">
                            {model.displayName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Aspect Ratio</Label>
                      <Select 
                        value={config.i2i.aspectRatio} 
                        onValueChange={(v) => updateConfig('i2i', { aspectRatio: v as AspectRatio })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ASPECT_RATIOS.map(ar => (
                            <SelectItem key={ar.id} value={ar.id}>
                              {ar.label} <span className="text-muted-foreground">({ar.description})</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Résolution</Label>
                      <Select 
                        value={config.i2i.resolution} 
                        onValueChange={(v) => updateConfig('i2i', { resolution: v as Resolution })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {RESOLUTIONS.map(r => (
                            <SelectItem key={r.id} value={r.id}>
                              {r.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 5: MODÈLES DE GÉNÉRATION DE VIDÉO */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <VideoIcon size={20} className="text-amber-400" />
              <h2 className="text-lg font-semibold">Modèles de génération de vidéo</h2>
            </div>

            {/* Sélection du mode */}
            <div className="mb-6">
              <Label className="text-sm text-muted-foreground mb-3 block">Mode</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  onClick={() => handleVideoModeChange('image-first')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    config.video.mode === 'image-first'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="font-semibold mb-1">IMAGE FIRST</div>
                  <p className="text-xs text-muted-foreground">
                    1 image en entrée → vidéo générée
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Modèles: Kling 2.6, Kling 2.5 Turbo
                  </p>
                </button>
                
                <button
                  onClick={() => handleVideoModeChange('images-first-last')}
                  className={`p-4 rounded-lg border-2 transition-all text-left ${
                    config.video.mode === 'images-first-last'
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-border/50 hover:border-border'
                  }`}
                >
                  <div className="font-semibold mb-1">IMAGES FIRST AND LAST</div>
                  <p className="text-xs text-muted-foreground">
                    2 images en entrée → interpolation vidéo
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Modèle: Kling 2.5 Turbo uniquement
                  </p>
                </button>
              </div>
            </div>

            {/* Paramètres du mode sélectionné */}
            <div className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-amber-400 font-semibold">
                  {config.video.mode === 'image-first' ? 'IMAGE FIRST' : 'IMAGES FIRST AND LAST'}
                </span>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Modèle</Label>
                  <Select 
                    value={config.video.model} 
                    onValueChange={(v) => updateConfig('video', { model: v })}
                  >
                    <SelectTrigger className="text-xs font-mono">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {availableVideoModels.map(model => (
                        <SelectItem key={model.id} value={model.id} className="text-xs font-mono">
                          {model.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">
                    {VIDEO_MODELS.find(m => m.id === config.video.model)?.guidanceField || 'guidance_scale'}
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.1}
                    value={config.video.guidanceValue}
                    onChange={(e) => updateConfig('video', { guidanceValue: parseFloat(e.target.value) || 0.5 })}
                    className="font-mono"
                  />
                </div>
              </div>
              
              {config.video.mode === 'images-first-last' && (
                <p className="text-xs text-amber-400 mt-3">
                  ⚠️ Seul kwaivgi/kling-v2.5-turbo-pro/image-to-video supporte le mode first+last
                </p>
              )}
            </div>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 6: NOMBRE DE PLANS */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <HashIcon size={20} className="text-cyan-400" />
              <h2 className="text-lg font-semibold">Nombre de plans</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Nombre de plans à générer dans le projet
            </p>
            <Select 
              value={String(config.quantities.plansCount)} 
              onValueChange={(v) => updateConfig('quantities', { plansCount: parseInt(v) })}
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 4, 6, 8, 10, 12, 15, 20].map(n => (
                  <SelectItem key={n} value={String(n)}>{n} plan{n > 1 ? 's' : ''}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 6bis: IMAGES SECONDAIRES */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ImageIcon size={20} className="text-violet-400" />
              <h2 className="text-lg font-semibold">Images secondaires</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Les images secondaires (I2I) sont générées à partir de l'image primaire pour créer les first/last frames des vidéos.
            </p>
            
            <button
              onClick={() => updateConfig('quantities', { generateSecondaryImages: !config.quantities.generateSecondaryImages })}
              className={`flex items-center gap-3 p-4 rounded-lg border-2 transition-all w-full ${
                config.quantities.generateSecondaryImages
                  ? 'border-violet-500 bg-violet-500/10'
                  : 'border-border/50 hover:border-border'
              }`}
            >
              {config.quantities.generateSecondaryImages ? (
                <ToggleRightIcon size={28} className="text-violet-400" />
              ) : (
                <ToggleLeftIcon size={28} className="text-muted-foreground" />
              )}
              <div className="text-left">
                <div className="font-semibold">
                  {config.quantities.generateSecondaryImages ? 'Oui - Générer les images secondaires' : 'Non - Ne pas générer'}
                </div>
                <p className="text-xs text-muted-foreground">
                  {config.quantities.generateSecondaryImages 
                    ? 'Les images I2I (first/last frames) seront générées pour chaque plan'
                    : 'Seules les images primaires T2I seront générées'
                  }
                </p>
              </div>
            </button>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 7: JEUX D'IMAGES INPUT */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <LayersIcon size={20} className="text-pink-400" />
              <h2 className="text-lg font-semibold">Jeux d'images input</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-3">
              Un jeu d'images = 
              {config.video.mode === 'image-first' 
                ? ' 1 IMAGE FIRST pour le modèle vidéo'
                : ' 1 couple (IMAGE FIRST + IMAGE LAST) pour le modèle vidéo'
              }
            </p>

            {/* Option: First frame = Image primaire - CHECKBOX VISIBLE */}
            <div className="p-4 bg-pink-500/5 border border-pink-500/30 rounded-lg mb-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.quantities.firstFrameIsPrimary}
                  onChange={() => updateConfig('quantities', { firstFrameIsPrimary: !config.quantities.firstFrameIsPrimary })}
                  className="mt-1 w-5 h-5 rounded border-2 border-pink-500 text-pink-500 focus:ring-pink-500 accent-pink-500"
                />
                <div className="flex-1">
                  <div className="font-semibold text-pink-400 flex items-center gap-2">
                    <LinkIcon size={16} />
                    Choisir Image Primaire comme First Frame
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {config.quantities.firstFrameIsPrimary 
                      ? '✓ L\'image primaire (T2I) sera directement connectée au nœud vidéo - PAS de génération I2I pour first frame'
                      : 'Le first frame sera généré par I2I (édition) à partir de l\'image primaire'
                    }
                  </p>
                </div>
              </label>
            </div>
            
            <div className="grid grid-cols-2 gap-6">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Jeux d'images par plan
                </Label>
                <Select 
                  value={String(config.quantities.imageSetsPerPlan)} 
                  onValueChange={(v) => updateConfig('quantities', { imageSetsPerPlan: parseInt(v) })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Vidéos par jeu d'images
                </Label>
                <Select 
                  value={String(config.quantities.videosPerImageSet)} 
                  onValueChange={(v) => updateConfig('quantities', { videosPerImageSet: parseInt(v) })}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[1, 2, 3, 4, 5, 6].map(n => (
                      <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-muted/30 rounded-lg">
              <p className="text-sm text-muted-foreground">
                Total par plan: <span className="text-white font-medium">{config.quantities.imageSetsPerPlan}</span> jeu(x) × <span className="text-white font-medium">{config.quantities.videosPerImageSet}</span> vidéo(s) = <span className="text-emerald-400 font-semibold">{config.quantities.imageSetsPerPlan * config.quantities.videosPerImageSet}</span> vidéos/plan
              </p>
            </div>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 8: DURÉE DES VIDÉOS */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <ClockIcon size={20} className="text-orange-400" />
              <h2 className="text-lg font-semibold">Durée des vidéos</h2>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => updateConfig('video', { duration: 5 })}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  config.video.duration === 5
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-border/50 hover:border-border'
                }`}
              >
                <div className="text-2xl font-bold">5</div>
                <div className="text-sm text-muted-foreground">secondes</div>
              </button>
              
              <button
                onClick={() => updateConfig('video', { duration: 10 })}
                className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                  config.video.duration === 10
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-border/50 hover:border-border'
                }`}
              >
                <div className="text-2xl font-bold">10</div>
                <div className="text-sm text-muted-foreground">secondes</div>
              </button>
            </div>
          </Card>

          {/* ============================================================ */}
          {/* SECTION 9: ESTIMATION DU BUDGET */}
          {/* ============================================================ */}
          <Card className="p-6 border-emerald-500/30 bg-emerald-500/5">
            <div className="flex items-center gap-2 mb-4">
              <DollarSignIcon size={20} className="text-emerald-400" />
              <h2 className="text-lg font-semibold">Estimation du budget</h2>
            </div>

            {budget && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-muted-foreground mb-1">LLM</div>
                    <div className="font-mono text-xs text-muted-foreground mb-1">{budget.llm.model}</div>
                    <div className="text-emerald-400">{formatCurrency(budget.llm.cost, budget.currency)}</div>
                  </div>
                  
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-muted-foreground mb-1">Images T2I</div>
                    <div className="text-xs text-muted-foreground mb-1">{budget.t2i.count} × {formatCurrency(budget.t2i.costPerImage, budget.currency)}</div>
                    <div className="text-emerald-400">{formatCurrency(budget.t2i.total, budget.currency)}</div>
                  </div>
                  
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-muted-foreground mb-1">Images I2I</div>
                    <div className="text-xs text-muted-foreground mb-1">{budget.i2i.count} × {formatCurrency(budget.i2i.costPerImage, budget.currency)}</div>
                    <div className="text-emerald-400">{formatCurrency(budget.i2i.total, budget.currency)}</div>
                  </div>
                  
                  <div className="p-3 bg-background/50 rounded-lg">
                    <div className="text-muted-foreground mb-1">Vidéos</div>
                    <div className="text-xs text-muted-foreground mb-1">{budget.video.count} × {budget.video.duration}s × {formatCurrency(budget.video.costPerSecond, budget.currency)}/s</div>
                    <div className="text-emerald-400">{formatCurrency(budget.video.total, budget.currency)}</div>
                  </div>
                </div>
                
                <div className="pt-4 border-t border-emerald-500/20 flex items-center justify-between">
                  <span className="text-sm font-medium">Total estimé</span>
                  <span className="text-2xl font-bold text-emerald-400">
                    ~{formatCurrency(budget.total, budget.currency)}
                  </span>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  💡 Estimation basée sur 3 personnages et 3 décors. Le coût réel dépend du contenu analysé.
                </p>
              </div>
            )}
          </Card>

          {/* ============================================================ */}
          {/* SYSTEM PROMPT */}
          {/* ============================================================ */}
          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileTextIcon size={20} className="text-muted-foreground" />
                <span className="font-medium">System Prompt</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowPromptDialog(true)}>
                Voir / Éditer
              </Button>
            </div>
          </Card>

          {/* ============================================================ */}
          {/* BOUTONS D'ACTION */}
          {/* ============================================================ */}
          <div className="flex justify-end gap-4 pt-4">
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
                  Générer le projet
                </>
              )}
            </Button>
          </div>
        </div>
      </main>

      {/* ============================================================ */}
      {/* DIALOG: System Prompt */}
      {/* ============================================================ */}
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
              value={config.systemPrompt || BUILTIN_SYSTEM_PROMPT}
              onChange={(e) => setConfig(prev => ({ ...prev, systemPrompt: e.target.value }))}
              rows={25}
              className="font-mono text-xs"
            />
          </ScrollArea>
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfig(prev => ({ ...prev, systemPrompt: BUILTIN_SYSTEM_PROMPT }))}
            >
              Réinitialiser
            </Button>
            <Button onClick={() => setShowPromptDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: Nouveau Preset */}
      {/* ============================================================ */}
      <Dialog open={showNewPresetDialog} onOpenChange={setShowNewPresetDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nouveau preset</DialogTitle>
            <DialogDescription>
              Sauvegardez la configuration actuelle comme preset réutilisable.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <Label htmlFor="presetName" className="mb-2 block">Nom du preset</Label>
            <Input
              id="presetName"
              value={newPresetName}
              onChange={(e) => setNewPresetName(e.target.value)}
              placeholder="Ex: Ma config production 4K"
            />
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewPresetDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleCreatePreset} disabled={!newPresetName.trim()}>
              Créer le preset
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ============================================================ */}
      {/* DIALOG: Génération en cours */}
      {/* ============================================================ */}
      <Dialog open={showReasoningDialog} onOpenChange={(open) => !generating && setShowReasoningDialog(open)}>
        <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col overflow-hidden bg-zinc-950 border-zinc-800">
          <div className="flex-shrink-0 pb-4 border-b border-zinc-800">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                {generating ? (
                  <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center flex-shrink-0">
                    <Loader2Icon size={20} className="animate-spin text-blue-400" />
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
                  <p className="text-xs text-zinc-500">
                    {config.llm.provider === 'openai' ? 'OpenAI' : 'Mistral'}: {config.llm.model}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                <PhaseIndicator phase="analysis" label="Analyse" />
                <div className="w-6 h-px bg-zinc-700" />
                <PhaseIndicator phase="canvas" label="Canvas" />
                <div className="w-6 h-px bg-zinc-700" />
                <PhaseIndicator phase="redirect" label="OK" />
              </div>
            </div>
          </div>
          
          <div className="flex-1 min-h-0 overflow-auto py-4">
            <pre className="text-sm whitespace-pre-wrap font-sans text-zinc-300 leading-relaxed">
              {reasoning || '⏳ Initialisation...'}
            </pre>
            <div ref={reasoningEndRef} />
          </div>
          
          {!generating && (
            <div className="flex-shrink-0 pt-4 border-t border-zinc-800">
              <Button 
                onClick={() => setShowReasoningDialog(false)}
                className="w-full bg-zinc-800 hover:bg-zinc-700 text-white"
              >
                Fermer
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
