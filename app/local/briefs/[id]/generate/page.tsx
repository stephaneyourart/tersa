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
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { createLocalProject, updateLocalProject, getLocalProjectById } from '@/lib/local-projects-store';
import type { Brief, ProjectGenerationConfig, ReasoningLevel } from '@/types/brief';

const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant IA expert en création de scénarios vidéo.

## MISSION
Analyse le brief et génère une structure de projet complète au format JSON.

## FORMAT DE SORTIE (JSON STRICT)
Tu DOIS retourner UNIQUEMENT un JSON valide sans markdown:

{
  "title": "Titre du projet",
  "synopsis": "Synopsis général (2-3 phrases)",
  "characters": [
    {
      "id": "perso-prenom",
      "name": "Prénom",
      "description": "Description complète",
      "referenceCode": "[PERSO:Prénom]",
      "prompts": {
        "face": "Portrait frontal détaillé...",
        "profile": "Portrait de profil détaillé...",
        "fullBody": "Photo en pied détaillée...",
        "back": "Vue de dos détaillée..."
      }
    }
  ],
  "locations": [
    {
      "id": "lieu-nom",
      "name": "Nom du lieu",
      "description": "Description complète",
      "referenceCode": "[LIEU:Nom]",
      "prompts": {
        "angle1": "Vue principale détaillée...",
        "angle2": "Vue alternative...",
        "angle3": "Vue ambiance/détail..."
      }
    }
  ],
  "scenes": [
    {
      "id": "scene-1",
      "sceneNumber": 1,
      "title": "Titre de la scène",
      "description": "Synopsis de la scène",
      "plans": [
        {
          "id": "plan-1-1",
          "planNumber": 1,
          "prompt": "Prompt COMPLET et AUTO-SUFFISANT pour la vidéo...",
          "characterRefs": ["perso-prenom"],
          "locationRef": "lieu-nom",
          "duration": 5,
          "cameraMovement": "Description mouvement caméra"
        }
      ]
    }
  ],
  "totalPlans": 4,
  "estimatedDuration": 60
}

## RÈGLES CRITIQUES
1. Chaque prompt doit être AUTONOME - décrire TOUT (qui, où, quoi, comment)
2. Inclure : vêtements, posture, expression, éclairage, ambiance
3. Style : cinématographique, professionnel, 4K
4. Plans de 3-8 secondes`;

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
    aiModel: 'gpt-4o',
    reasoningLevel: 'high',
    generateMediaDirectly: false,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    customInstructions: '',
    settings: {
      videoModel: 'kling-o1',
      imageModel: 'nanobanana-pro',
      videoCopies: 4,
      testMode: false,
    },
  });
  
  const [projectName, setProjectName] = useState('');

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
      setReasoning('🧠 Phase 1 : Analyse du brief...\n\n');

      const response = await fetch('/api/briefs/generate-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: params.id,
          projectName,
          config,
          isTestMode: config.settings?.testMode || false,
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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(line.slice(6));
            
            switch (data.type) {
              case 'phase_start':
                setCurrentPhase(data.phase);
                setReasoning(prev => prev + `\n${data.message}\n\n`);
                if (data.phase === 'analysis') {
                  setPhaseStatus(prev => ({ ...prev, analysis: 'running' }));
                } else if (data.phase === 'canvas_creation') {
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
                // Fallback si l'API n'a pas pu créer le projet
                canvasData = data.canvasData;
                projectStructure = data.projectStructure;
                // Stocker aussi la séquence de génération
                if (data.generationSequence) {
                  canvasData.generationSequence = data.generationSequence;
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
                  setReasoning(prev => prev + `   • ${s.locations} lieu(x)\n`);
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

                // Stocker la séquence de génération
                const generationSequence = data.generationSequence;

                // Toujours créer le projet côté client (localStorage)
                // L'API ne peut pas accéder à localStorage, donc on le fait ici
                let projectId: string | null = null;
                
                if (canvasData) {
                  setReasoning(prev => prev + `\n📝 Création du projet local...\n`);
                  const newProject = createLocalProject(projectName);
                  // Inclure la séquence de génération dans les données du projet
                  updateLocalProject(newProject.id, { 
                    data: {
                      ...canvasData,
                      generationSequence,
                    }
                  });
                  projectId = newProject.id;
                  setReasoning(prev => prev + `✅ Projet créé : ${projectId}\n`);
                  if (generationSequence) {
                    const imgCount = 
                      generationSequence.characterImages?.reduce((acc: number, c: {imageNodeIds: string[]}) => acc + c.imageNodeIds.length, 0) +
                      generationSequence.locationImages?.reduce((acc: number, l: {imageNodeIds: string[]}) => acc + l.imageNodeIds.length, 0);
                    const vidCount = generationSequence.videos?.length || 0;
                    setReasoning(prev => prev + `📦 Séquence : ${imgCount} images, ${vidCount} vidéos à générer\n`);
                  }
                }

                if (projectId) {
                  setReasoning(prev => prev + `\n🎨 Ouverture du canvas dans 2 secondes...`);
                  setPhaseStatus(prev => ({ ...prev, redirect: 'done' }));
                  setTimeout(() => {
                    router.push(`/local/canvas/${projectId}`);
                  }, 2000);
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
        }
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      setReasoning(prev => prev + `\n\n❌ Erreur: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  };

  // Composant indicateur de phase
  const PhaseIndicator = ({ phase, label }: { phase: string; label: string }) => {
    const status = phaseStatus[phase];
    return (
      <div className={`flex items-center gap-2 ${status === 'running' ? 'text-violet-400' : status === 'done' ? 'text-emerald-400' : 'text-muted-foreground'}`}>
        {status === 'done' ? (
          <CheckCircle2Icon size={16} />
        ) : status === 'running' ? (
          <Loader2Icon size={16} className="animate-spin" />
        ) : (
          <CircleDotIcon size={16} />
        )}
        <span className="text-sm font-medium">{label}</span>
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
        <p className="text-muted-foreground">Brief non trouvé</p>
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
                    <SelectItem value="gpt-4o">GPT-4o (Recommandé)</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rapide)</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                  </SelectContent>
                </Select>
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
                    Limite à 2 personnages, 2 plans max, prompts courts (3 phrases).
                  </p>
                </div>
              </div>
            </div>

            {/* Options si génération activée */}
            {config.generateMediaDirectly && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 mt-6 border-t border-border/30">
                <div>
                  <Label htmlFor="imageModel" className="mb-2 flex items-center gap-2">
                    <ImageIcon size={14} />
                    Modèle d'images
                  </Label>
                  <Select
                    value={config.settings?.imageModel}
                    onValueChange={(value) => 
                      setConfig({ 
                        ...config, 
                        settings: { ...config.settings, imageModel: value } 
                      })
                    }
                  >
                    <SelectTrigger id="imageModel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nanobanana-pro">NanoBanana Pro</SelectItem>
                      <SelectItem value="flux-pro">Flux Pro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="videoModel" className="mb-2 flex items-center gap-2">
                    <VideoIcon size={14} />
                    Modèle de vidéos
                  </Label>
                  <Select
                    value={config.settings?.videoModel}
                    onValueChange={(value) => 
                      setConfig({ 
                        ...config, 
                        settings: { ...config.settings, videoModel: value } 
                      })
                    }
                  >
                    <SelectTrigger id="videoModel">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kling-o1">Kling O1 (WaveSpeed)</SelectItem>
                      <SelectItem value="seedream">Seedream</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>System Prompt</DialogTitle>
            <DialogDescription>
              Ce prompt guide l'IA dans l'analyse du brief.
            </DialogDescription>
          </DialogHeader>
          
          <Textarea
            value={config.systemPrompt}
            onChange={(e) => setConfig({ ...config, systemPrompt: e.target.value })}
            rows={20}
            className="font-mono text-xs"
          />
          
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setConfig({ ...config, systemPrompt: DEFAULT_SYSTEM_PROMPT })}
            >
              Réinitialiser
            </Button>
            <Button onClick={() => setShowPromptDialog(false)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Raisonnement IA */}
      <Dialog open={showReasoningDialog} onOpenChange={(open) => !generating && setShowReasoningDialog(open)}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🧠 Génération du projet
              {generating && <Loader2Icon size={16} className="animate-spin" />}
            </DialogTitle>
            <DialogDescription>
              Suivez le processus de création en temps réel
            </DialogDescription>
          </DialogHeader>

          {/* Indicateurs de phases */}
          <div className="flex items-center gap-6 py-3 px-4 bg-muted/30 rounded-lg">
            <PhaseIndicator phase="analysis" label="Analyse" />
            <div className="h-px w-8 bg-border" />
            <PhaseIndicator phase="canvas" label="Canvas" />
            <div className="h-px w-8 bg-border" />
            <PhaseIndicator phase="redirect" label="Terminé" />
          </div>
          
          <ScrollArea className="flex-1 min-h-[400px] w-full rounded-md border p-4 bg-black/20">
            <pre className="text-sm whitespace-pre-wrap font-mono text-emerald-400/90">
              {reasoning || 'En attente...'}
              <div ref={reasoningEndRef} />
            </pre>
          </ScrollArea>
          
          <DialogFooter>
            <Button 
              onClick={() => setShowReasoningDialog(false)}
              disabled={generating}
              variant={generating ? 'outline' : 'default'}
            >
              {generating ? 'Génération en cours...' : 'Fermer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
