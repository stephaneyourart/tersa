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
  SettingsIcon,
  FileTextIcon,
  Loader2Icon,
  SparklesIcon,
  BrainIcon,
  ImageIcon,
  VideoIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import type { Brief, ProjectGenerationConfig, ReasoningLevel } from '@/types/brief';

const DEFAULT_SYSTEM_PROMPT = `Tu es un assistant IA spécialisé dans la création de scénarios vidéo à partir de briefs.

## OBJECTIF
Analyser le brief fourni et générer un scénario complet découpé en scènes et plans, avec les éléments visuels nécessaires.

## STRUCTURE ATTENDUE

### 1. PERSONNAGES
Pour chaque personnage identifié dans le brief :
- Générer une description détaillée et cohérente
- Créer un code de référence : [PERSO:NomPersonnage]
- Créer 4 prompts de génération d'image :
  * Visage de face
  * Visage de profil
  * Corps entier de face
  * Vue de dos

Format prompt personnage : "Génère une image haute qualité pour [angle] du personnage [Nom]. Description : [description détaillée incluant traits physiques, vêtements, style, ambiance]. Style : cinématographique, éclairage professionnel, 4K."

### 2. LIEUX
Pour chaque lieu identifié :
- Description détaillée de l'environnement
- Créer un code de référence : [LIEU:NomLieu]
- Créer un prompt multi-angles

Format prompt lieu : "Génère plusieurs angles du lieu [Nom]. Description : [description complète incluant architecture, décoration, atmosphère, éclairage, style]. Générer : vue d'ensemble, plan rapproché, détails. Style : cinématographique, 4K."

### 3. SCÉNARIO
Découper en scènes numérotées, chaque scène contient :
- Numéro et titre de la scène
- Description narrative
- Plans numérotés (format: Scène X - Plan Y)

### 4. PLANS
Chaque plan doit contenir :
- Numéro unique (ex: Plan 1.1, Plan 1.2, etc.)
- Type : "character", "location", ou "shot"
- Prompt AUTO-SUFFISANT : décrire COMPLÈTEMENT la scène comme si le modèle ne connaissait RIEN du contexte
- Personnages impliqués (codes de référence)
- Lieux impliqués (codes de référence)
- Durée estimée en secondes

**RÈGLE CRITIQUE** : Les prompts de plans doivent être EXHAUSTIFS. Le modèle de génération n'a PAS accès au contexte global. Chaque prompt doit décrire :
- QUI (description physique complète des personnages présents)
- OÙ (description complète du lieu)
- QUOI (l'action précise)
- COMMENT (cadrage, mouvement caméra, ambiance, éclairage)

Exemple de prompt de plan :
"Plan moyen : Une femme de 30 ans aux cheveux bruns mi-longs, vêtue d'un tailleur gris élégant, marche avec confiance dans un bureau moderne aux murs blancs, bureau en bois clair à droite, grande baie vitrée en arrière-plan montrant la ville. Lumière naturelle douce, mouvement de caméra suivant son déplacement de gauche à droite, style cinématographique."

## FORMAT DE SORTIE JSON

\`\`\`json
{
  "title": "Titre du projet",
  "synopsis": "Résumé en 2-3 phrases",
  "characters": [
    {
      "name": "NomPersonnage",
      "description": "Description complète",
      "referenceCode": "[PERSO:NomPersonnage]",
      "prompts": {
        "face": "prompt face",
        "profile": "prompt profil",
        "fullBody": "prompt corps entier",
        "back": "prompt dos"
      }
    }
  ],
  "locations": [
    {
      "name": "NomLieu",
      "description": "Description complète",
      "referenceCode": "[LIEU:NomLieu]",
      "prompt": "prompt multi-angles"
    }
  ],
  "scenes": [
    {
      "sceneNumber": 1,
      "title": "Titre de la scène",
      "description": "Description narrative",
      "plans": [
        {
          "planNumber": 1,
          "sceneNumber": 1,
          "prompt": "Prompt EXHAUSTIF et AUTO-SUFFISANT",
          "characters": ["[PERSO:Jean]"],
          "locations": ["[LIEU:Bureau]"],
          "duration": 5,
          "type": "shot"
        }
      ]
    }
  ],
  "totalPlans": 0,
  "estimatedDuration": 0
}
\`\`\`

## CONSIGNES IMPORTANTES
1. Chaque prompt doit être AUTONOME - ne jamais assumer que le modèle a du contexte
2. Les descriptions doivent être TRÈS DÉTAILLÉES et VISUELLES
3. Maintenir la COHÉRENCE entre tous les plans (personnages, lieux)
4. Privilégier des plans de 3-8 secondes
5. Inclure des codes de référence pour lier personnages/lieux aux plans
6. Style : cinématographique, professionnel, haute qualité`;

export default function GenerateProjectPage() {
  const router = useRouter();
  const params = useParams();
  
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showPromptDialog, setShowPromptDialog] = useState(false);
  const [showReasoningDialog, setShowReasoningDialog] = useState(false);
  const [reasoning, setReasoning] = useState<string>('');
  const reasoningEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll vers le bas quand le raisonnement change
  useEffect(() => {
    if (reasoningEndRef.current && showReasoningDialog) {
      reasoningEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [reasoning, showReasoningDialog]);
  
  const [config, setConfig] = useState<Partial<ProjectGenerationConfig>>({
    aiModel: 'gpt-5.1-2025-11-13',
    reasoningLevel: 'high',
    generateMediaDirectly: false,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    customInstructions: '',
    settings: {
      videoModel: 'kling-o1',
      imageModel: 'nanobanana-pro',
      videoCopies: 4,
      testMode: false, // Mode test : limite à 2 personnages et 2 plans
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
    setReasoning('🚀 Initialisation...\n\n');
    setShowReasoningDialog(true);

    try {
      const response = await fetch('/api/briefs/generate-with-tools', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          briefId: params.id,
          projectName,
          config,
        }),
      });

      if (!response.ok) {
        throw new Error(`Erreur: ${response.statusText}`);
      }

      // Lire le stream SSE
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Pas de reader disponible');
      }

      let projectId = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.trim()) continue;

          if (line.startsWith('event: ')) {
            const eventType = line.slice(7);
            continue;
          }

          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              // Gérer les différents types d'événements
              if (data.step === 'init' || data.step === 'analyzing') {
                setReasoning(prev => prev + `${data.message}\n\n`);
              } else if (data.chunk) {
                // STREAM DU RAISONNEMENT EN TEMPS RÉEL
                setReasoning(prev => prev + data.chunk);
              } else if (data.content) {
                setReasoning(prev => prev + data.content);
              } else if (data.toolName) {
                if (data.params) {
                  setReasoning(prev => prev + `\n\n🛠️  ${data.toolName}(${JSON.stringify(data.params, null, 2).substring(0, 100)}...)\n`);
                } else if (data.success !== undefined) {
                  if (data.success) {
                    setReasoning(prev => prev + `   ✅ ${data.data?.message || 'Succès'}\n`);
                  } else {
                    setReasoning(prev => prev + `   ❌ ${data.error}\n`);
                  }
                }
              } else if (data.projectId) {
                projectId = data.projectId;
                setReasoning(prev => prev + `\n\n🎉 Projet généré avec succès !\n`);
              } else if (data.message && !data.step) {
                setReasoning(prev => prev + `\n\n❌ ${data.message}\n`);
              }
            } catch (e) {
              console.error('Erreur parse SSE:', e, line);
            }
          }
        }
      }

      // Rediriger vers le canvas du projet
      if (projectId) {
        setReasoning(prev => prev + `\n\n🎨 Ouverture du canvas...`);
        setTimeout(() => {
          router.push(`/local/canvas/${projectId}`);
        }, 1500);
      }
    } catch (error: any) {
      console.error('Erreur:', error);
      setReasoning(prev => prev + `\n\n❌ Erreur: ${error.message}`);
    } finally {
      setGenerating(false);
    }
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
                    <SelectItem value="gpt-5.1-2025-11-13">GPT-5.1 (Recommandé)</SelectItem>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini (Rapide)</SelectItem>
                    <SelectItem value="gemini-3">Gemini 3</SelectItem>
                    <SelectItem value="gemini-2-flash">Gemini 2 Flash</SelectItem>
                    <SelectItem value="claude-3.5-sonnet">Claude 3.5 Sonnet</SelectItem>
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

            {/* Génération automatique */}
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
                    L'IA génère automatiquement les images (personnages, lieux) et les vidéos,
                    puis les envoie vers DaVinci Resolve.
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
                    Limite la génération à 2 personnages max et 2 plans max pour tester rapidement le workflow.
                  </p>
                </div>
              </div>
            </div>

            {/* Options de génération (si activé) */}
            {config.generateMediaDirectly && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-border/30">
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
                      <SelectItem value="dall-e-3">DALL-E 3</SelectItem>
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
                      <SelectItem value="kling-o1">Kling O1 (via WaveSpeed)</SelectItem>
                      <SelectItem value="seedream">Seedream</SelectItem>
                      <SelectItem value="kling-turbo">Kling Turbo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="videoCopies" className="mb-2 block">
                    Nombre de copies par vidéo
                  </Label>
                  <Select
                    value={String(config.settings?.videoCopies || 4)}
                    onValueChange={(value) => 
                      setConfig({ 
                        ...config, 
                        settings: { ...config.settings, videoCopies: parseInt(value) } 
                      })
                    }
                  >
                    <SelectTrigger id="videoCopies">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">1 copie</SelectItem>
                      <SelectItem value="2">2 copies</SelectItem>
                      <SelectItem value="4">4 copies (recommandé)</SelectItem>
                      <SelectItem value="8">8 copies</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground mt-2">
                    Plusieurs variations seront générées pour chaque plan vidéo
                  </p>
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
                  Génération en cours...
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
              Ce prompt guide l'IA dans l'analyse du brief et la génération du scénario.
              Vous pouvez l'éditer pour l'adapter à vos besoins.
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
              Sauvegarder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Raisonnement IA */}
      <Dialog open={showReasoningDialog} onOpenChange={setShowReasoningDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              🧠 Raisonnement de l'IA
              {generating && <Loader2Icon size={16} className="animate-spin" />}
            </DialogTitle>
            <DialogDescription>
              Suivez le processus de réflexion de GPT-5.1 en temps réel
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="h-[60vh] w-full rounded-md border p-4">
            <pre className="text-sm whitespace-pre-wrap font-mono">
              {reasoning || 'En attente...'}
              <div ref={reasoningEndRef} />
            </pre>
          </ScrollArea>
          
          <DialogFooter>
            <Button 
              onClick={() => setShowReasoningDialog(false)}
              disabled={generating}
            >
              {generating ? 'Génération en cours...' : 'Fermer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

