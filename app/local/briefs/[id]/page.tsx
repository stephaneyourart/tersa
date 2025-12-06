'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ArrowLeftIcon,
  ArrowDownIcon,
  ArrowRightIcon,
  UploadIcon,
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  TrashIcon,
  PlayIcon,
  Loader2Icon,
  SparklesIcon,
  FilmIcon,
  RefreshCwIcon,
  CheckCircle2Icon,
  PencilIcon,
  FolderIcon,
  ChevronDownIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import type { Brief, BriefDocument } from '@/types/brief';
import { 
  formatTokens, 
  formatCost,
  calculateCost,
  countTextTokens,
  countImageTokens,
  countVideoTokens,
  countPDFTokens,
  countAudioTokens
} from '@/lib/token-counter';
import { useDropzone } from 'react-dropzone';

// ============================================================
// CONSTANTES
// ============================================================
const GEMINI_MAX_TOKENS = 2000000;

// Étapes du flow TypeForm
type Step = 'title' | 'synopsis' | 'storyboard' | 'moodboard' | 'ready';

const STEPS: { id: Step; label: string; icon: React.ElementType }[] = [
  { id: 'title', label: 'Titre', icon: FileTextIcon },
  { id: 'synopsis', label: 'Synopsis', icon: SparklesIcon },
  { id: 'storyboard', label: 'Storyboard', icon: FilmIcon },
  { id: 'moodboard', label: 'Moodboard', icon: FolderIcon },
  { id: 'ready', label: 'Prêt', icon: CheckCircle2Icon },
];

// ============================================================
// COMPOSANT PRINCIPAL
// ============================================================
export default function BriefEditPage() {
  const router = useRouter();
  const params = useParams();
  const isNew = params.id === 'new';
  
  // Refs pour auto-scroll
  const synopsisRef = useRef<HTMLDivElement>(null);
  const storyboardRef = useRef<HTMLDivElement>(null);
  const moodboardRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef<HTMLDivElement>(null);
  const storyboardEndRef = useRef<HTMLDivElement>(null);
  
  // États de base
  const [brief, setBrief] = useState<Brief>({
    id: '',
    name: '',
    description: '',
    userId: 'local-user',
    totalTokens: 0,
    status: 'draft',
    createdAt: new Date(),
    documents: [],
  });
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(!isNew);
  const [saving, setSaving] = useState(false);

  // États TypeForm
  const [currentStep, setCurrentStep] = useState<Step>('title');
  const [synopsis, setSynopsis] = useState('');
  const [storyboard, setStoryboard] = useState('');
  const [isEditingStoryboard, setIsEditingStoryboard] = useState(false);
  const [generatingStoryboard, setGeneratingStoryboard] = useState(false);

  // Auto-scroll quand le storyboard se génère
  useEffect(() => {
    if (storyboardEndRef.current && generatingStoryboard) {
      storyboardEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [storyboard, generatingStoryboard]);

  // Charger le brief existant
  useEffect(() => {
    if (!isNew) {
      loadBrief();
    }
  }, [params.id, isNew]);

  const loadBrief = async () => {
    try {
      const response = await fetch(`/api/briefs/${params.id}`);
      if (response.ok) {
        const data = await response.json();
        setBrief(data);
        
        // Charger le synopsis s'il existe
        const textDoc = data.documents?.find((d: BriefDocument) => d.type === 'text' && d.name === '__brief_content__');
        if (textDoc && textDoc.content) {
          // Essayer de parser le contenu comme JSON pour récupérer synopsis + storyboard
          try {
            const parsed = JSON.parse(textDoc.content);
            if (parsed.synopsis) setSynopsis(parsed.synopsis);
            if (parsed.storyboard) {
              setStoryboard(parsed.storyboard);
              setCurrentStep('ready'); // Si on a déjà un storyboard, aller à la fin
            }
          } catch {
            // Ancien format - considérer comme synopsis
            setSynopsis(textDoc.content);
          }
        }
        
        // Si on a un nom, passer au moins à l'étape synopsis
        if (data.name) {
          setCurrentStep(prev => prev === 'title' ? 'synopsis' : prev);
        }
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  // ============================================================
  // GÉNÉRATION STORYBOARD
  // ============================================================
  const handleGenerateStoryboard = async () => {
    if (!synopsis.trim()) return;

    setGeneratingStoryboard(true);
    setStoryboard('');
    setCurrentStep('storyboard');
    
    // Scroll vers la section storyboard
    setTimeout(() => {
      storyboardRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);

    try {
      const response = await fetch('/api/briefs/generate-storyboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ synopsis: synopsis.trim() }),
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la génération du storyboard');
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('Pas de reader disponible');
      }

      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n\n');
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'content':
                  setStoryboard(prev => prev + data.content);
                  break;
                case 'error':
                  throw new Error(data.error);
                case 'complete':
                  break;
              }
            } catch (e: any) {
              if (e.message && !e.message.includes('JSON')) {
                throw e;
              }
            }
          }
        }
        
        if (done) break;
      }
    } catch (error: any) {
      console.error('Erreur storyboard:', error);
      setStoryboard(prev => prev + `\n\n❌ Erreur : ${error.message}`);
    } finally {
      setGeneratingStoryboard(false);
    }
  };

  // ============================================================
  // SAUVEGARDE
  // ============================================================
  const saveBrief = async (): Promise<string | null> => {
    if (!brief.name.trim()) {
      alert('Veuillez donner un nom à votre creative plan');
      return null;
    }

    setSaving(true);
    try {
      // Préparer le contenu à sauvegarder (synopsis + storyboard)
      const contentToSave = JSON.stringify({
        synopsis: synopsis.trim(),
        storyboard: storyboard.trim(),
      });
      
      const contentTokens = countTextTokens(contentToSave).tokens;
      
      // Mettre à jour les documents avec le contenu
      const otherDocs = (brief.documents || []).filter(d => !(d.type === 'text' && d.name === '__brief_content__'));
      const newDocs = contentToSave.length > 10 ? [
        ...otherDocs,
        {
          id: `text-${Date.now()}`,
          briefId: brief.id,
          name: '__brief_content__',
          type: 'text' as const,
          size: new Blob([contentToSave]).size,
          storagePath: '',
          url: '',
          content: contentToSave,
          tokens: contentTokens,
          createdAt: new Date(),
        }
      ] : otherDocs;
      
      const briefToSave = {
        ...brief,
        documents: newDocs,
        totalTokens: newDocs.reduce((acc, d) => acc + (d.tokens || 0), 0),
      };

      const url = isNew ? '/api/briefs' : `/api/briefs/${params.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(briefToSave),
      });

      if (response.ok) {
        const saved = await response.json();
        setBrief(saved);
        
        if (isNew) {
          window.history.replaceState({}, '', `/local/briefs/${saved.id}`);
          return saved.id;
        }
        return params.id as string;
      } else {
        const error = await response.text();
        console.error('[Brief] Erreur sauvegarde:', error);
        return null;
      }
    } catch (error) {
      console.error('[Brief] Erreur:', error);
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleGenerateProject = async () => {
    const briefId = await saveBrief();
    if (briefId) {
      router.push(`/local/briefs/${briefId}/generate`);
    }
  };

  // ============================================================
  // GESTION DES FICHIERS (MOODBOARD)
  // ============================================================
  const handleFileUpload = async (files: File[]) => {
    setUploading(true);
    try {
      for (const file of files) {
        const doc: BriefDocument = {
          id: Math.random().toString(36),
          briefId: brief.id,
          name: file.name,
          type: getFileType(file.type),
          mimeType: file.type,
          size: file.size,
          storagePath: `/briefs/${brief.id}/${file.name}`,
          url: URL.createObjectURL(file),
          tokens: await estimateFileTokens(file),
          createdAt: new Date(),
        };

        setBrief(prev => ({
          ...prev,
          documents: [...(prev.documents || []), doc],
          totalTokens: prev.totalTokens + doc.tokens,
        }));
      }
    } catch (error) {
      console.error('Erreur upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (docId: string) => {
    setBrief(prev => {
      const doc = prev.documents?.find(d => d.id === docId);
      const newDocs = prev.documents?.filter(d => d.id !== docId) || [];
      return {
        ...prev,
        documents: newDocs,
        totalTokens: prev.totalTokens - (doc?.tokens || 0),
      };
    });
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileUpload,
    disabled: uploading,
  });

  const getFileType = (mimeType: string): 'text' | 'pdf' | 'image' | 'video' | 'audio' => {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType === 'application/pdf') return 'pdf';
    return 'text';
  };

  const estimateFileTokens = async (file: File): Promise<number> => {
    const type = getFileType(file.type);
    if (type === 'text') {
      const text = await file.text();
      return countTextTokens(text).tokens;
    }
    if (type === 'pdf') {
      const estimatedPages = Math.ceil(file.size / 50000);
      return countPDFTokens(estimatedPages).tokens;
    }
    if (type === 'image') return countImageTokens(1024, 1024).tokens;
    if (type === 'video') {
      const estimatedDuration = file.size / (1024 * 1024);
      return countVideoTokens(estimatedDuration, 1920, 1080).tokens;
    }
    if (type === 'audio') {
      const estimatedDuration = (file.size / (1024 * 1024)) * 60;
      return countAudioTokens(estimatedDuration).tokens;
    }
    return 0;
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image': return ImageIcon;
      case 'video': return VideoIcon;
      case 'pdf':
      case 'text': return FileTextIcon;
      default: return FileIcon;
    }
  };

  // ============================================================
  // NAVIGATION ENTRE ÉTAPES
  // ============================================================
  const scrollToStep = (step: Step) => {
    const refs: Record<Step, React.RefObject<HTMLDivElement | null>> = {
      title: { current: null }, // Le titre est toujours visible
      synopsis: synopsisRef,
      storyboard: storyboardRef,
      moodboard: moodboardRef,
      ready: readyRef,
    };
    
    refs[step]?.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const goToNextStep = (from: Step) => {
    const stepOrder: Step[] = ['title', 'synopsis', 'storyboard', 'moodboard', 'ready'];
    const currentIndex = stepOrder.indexOf(from);
    if (currentIndex < stepOrder.length - 1) {
      const nextStep = stepOrder[currentIndex + 1];
      setCurrentStep(nextStep);
      setTimeout(() => scrollToStep(nextStep), 100);
    }
  };

  // ============================================================
  // CONDITIONS DE VALIDATION
  // ============================================================
  const canProceedFromTitle = brief.name.trim().length >= 2;
  const canProceedFromSynopsis = synopsis.trim().length >= 20;
  const canProceedFromStoryboard = storyboard.trim().length >= 100 && !generatingStoryboard;
  const visibleDocs = brief.documents?.filter(d => d.name !== '__brief_content__') || [];

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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-zinc-950 text-foreground">
      {/* Header minimaliste */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border/30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/local/briefs">
            <Button variant="ghost" size="icon" className="rounded-full">
              <ArrowLeftIcon size={18} />
            </Button>
          </Link>
          
          {/* Indicateur d'étapes */}
          <div className="flex items-center gap-2">
            {STEPS.map((step, index) => {
              const stepOrder: Step[] = ['title', 'synopsis', 'storyboard', 'moodboard', 'ready'];
              const currentIndex = stepOrder.indexOf(currentStep);
              const stepIndex = stepOrder.indexOf(step.id);
              const isActive = step.id === currentStep;
              const isPast = stepIndex < currentIndex;
              const Icon = step.icon;
              
              return (
                <div key={step.id} className="flex items-center">
                  <button
                    onClick={() => {
                      setCurrentStep(step.id);
                      scrollToStep(step.id);
                    }}
                    disabled={stepIndex > currentIndex}
                    className={`flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-violet-500/20 text-violet-400'
                        : isPast
                          ? 'bg-emerald-500/20 text-emerald-400'
                          : 'bg-zinc-800/50 text-zinc-500'
                    } ${stepIndex <= currentIndex ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}`}
                  >
                    <Icon size={12} />
                    <span className="hidden sm:inline">{step.label}</span>
                  </button>
                  {index < STEPS.length - 1 && (
                    <div className={`w-4 h-0.5 mx-1 ${isPast ? 'bg-emerald-500/50' : 'bg-zinc-700'}`} />
                  )}
                </div>
              );
            })}
          </div>
          
          <Button 
            onClick={handleGenerateProject}
            disabled={!canProceedFromStoryboard || saving}
            className="gap-2 bg-emerald-600 hover:bg-emerald-700"
          >
            {saving ? <Loader2Icon size={16} className="animate-spin" /> : <PlayIcon size={16} />}
            <span className="hidden sm:inline">Générer</span>
          </Button>
        </div>
      </header>

      {/* Contenu principal - Style TypeForm */}
      <main className="pt-24 pb-32">
        <div className="max-w-3xl mx-auto px-6 space-y-32">
          
          {/* ============================================================ */}
          {/* ÉTAPE 1: TITRE */}
          {/* ============================================================ */}
          <section className="min-h-[60vh] flex flex-col justify-center">
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-violet-500/20 flex items-center justify-center">
                  <FileTextIcon size={20} className="text-violet-400" />
                </div>
                <span className="text-sm text-violet-400 font-medium">Étape 1</span>
              </div>
              
              <h1 className="text-4xl font-bold">
                Comment s'appelle votre projet ?
              </h1>
              
              <Input
                value={brief.name}
                onChange={(e) => setBrief({ ...brief, name: e.target.value })}
                placeholder="Ex: Spot publicitaire énergie propre"
                className="text-2xl h-16 bg-zinc-900/50 border-zinc-700 focus:border-violet-500"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canProceedFromTitle) {
                    goToNextStep('title');
                  }
                }}
              />
              
              {canProceedFromTitle && (
                <Button
                  onClick={() => goToNextStep('title')}
                  className="gap-2 bg-violet-600 hover:bg-violet-700"
                >
                  Continuer
                  <ArrowDownIcon size={16} />
                </Button>
              )}
            </div>
          </section>

          {/* ============================================================ */}
          {/* ÉTAPE 2: SYNOPSIS */}
          {/* ============================================================ */}
          <section 
            ref={synopsisRef}
            className={`min-h-[70vh] flex flex-col justify-center transition-opacity duration-500 ${
              currentStep === 'title' ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                  <SparklesIcon size={20} className="text-amber-400" />
                </div>
                <span className="text-sm text-amber-400 font-medium">Étape 2</span>
              </div>
              
              <h2 className="text-3xl font-bold">
                Décrivez votre idée en quelques lignes
              </h2>
              <p className="text-muted-foreground">
                Mistral Large transformera votre synopsis en un storyboard détaillé et professionnel.
              </p>
              
              <Textarea
                value={synopsis}
                onChange={(e) => setSynopsis(e.target.value)}
                placeholder={`Ex: "Donne moi une idée originale de petit film publicitaire d'au moins 7 plans, avec mari, femme, enfant, autour d'une énergie propre. Pas cucu, un peu émouvant, documentaire, pas uniquement joli."`}
                className="min-h-[200px] text-lg bg-zinc-900/50 border-zinc-700 focus:border-amber-500"
                disabled={generatingStoryboard}
              />
              
              {canProceedFromSynopsis && !storyboard && (
                <Button
                  onClick={handleGenerateStoryboard}
                  disabled={generatingStoryboard}
                  className="gap-2 bg-amber-600 hover:bg-amber-700"
                >
                  {generatingStoryboard ? (
                    <>
                      <Loader2Icon size={16} className="animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <SparklesIcon size={16} />
                      Générer le storyboard
                    </>
                  )}
                </Button>
              )}
            </div>
          </section>

          {/* ============================================================ */}
          {/* ÉTAPE 3: STORYBOARD */}
          {/* ============================================================ */}
          <section 
            ref={storyboardRef}
            className={`min-h-[80vh] flex flex-col justify-center transition-opacity duration-500 ${
              !storyboard && !generatingStoryboard ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                    <FilmIcon size={20} className="text-cyan-400" />
                  </div>
                  <div>
                    <span className="text-sm text-cyan-400 font-medium">Étape 3</span>
                    {generatingStoryboard && (
                      <Badge variant="outline" className="ml-2 text-cyan-400 border-cyan-400/50 animate-pulse">
                        Génération...
                      </Badge>
                    )}
                  </div>
                </div>
                
                {storyboard && !generatingStoryboard && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditingStoryboard(!isEditingStoryboard)}
                      className="gap-1"
                    >
                      <PencilIcon size={14} />
                      {isEditingStoryboard ? 'Aperçu' : 'Éditer'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateStoryboard}
                      className="gap-1"
                    >
                      <RefreshCwIcon size={14} />
                      Régénérer
                    </Button>
                  </div>
                )}
              </div>
              
              <h2 className="text-3xl font-bold">
                Votre storyboard
              </h2>
              
              {isEditingStoryboard ? (
                <Textarea
                  value={storyboard}
                  onChange={(e) => setStoryboard(e.target.value)}
                  className="min-h-[500px] font-mono text-sm bg-zinc-900/50 border-zinc-700 focus:border-cyan-500"
                />
              ) : (
                <Card className="bg-zinc-900/50 border-zinc-700 overflow-hidden">
                  <ScrollArea className="h-[500px] p-6">
                    <div className="prose prose-sm prose-invert max-w-none">
                      <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
                        {storyboard || '⏳ Le storyboard apparaîtra ici...'}
                      </pre>
                    </div>
                    <div ref={storyboardEndRef} />
                  </ScrollArea>
                </Card>
              )}
              
              {canProceedFromStoryboard && (
                <Button
                  onClick={() => goToNextStep('storyboard')}
                  className="gap-2 bg-cyan-600 hover:bg-cyan-700"
                >
                  Continuer
                  <ArrowDownIcon size={16} />
                </Button>
              )}
            </div>
          </section>

          {/* ============================================================ */}
          {/* ÉTAPE 4: MOODBOARD (Documents) */}
          {/* ============================================================ */}
          <section 
            ref={moodboardRef}
            className={`min-h-[60vh] flex flex-col justify-center transition-opacity duration-500 ${
              !canProceedFromStoryboard ? 'opacity-30 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="space-y-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-pink-500/20 flex items-center justify-center">
                  <FolderIcon size={20} className="text-pink-400" />
                </div>
                <span className="text-sm text-pink-400 font-medium">Étape 4 (optionnel)</span>
              </div>
              
              <h2 className="text-3xl font-bold">
                Ajoutez un moodboard
              </h2>
              <p className="text-muted-foreground">
                Images de référence, documents, vidéos d'inspiration... Ces fichiers aideront l'IA à comprendre votre vision.
              </p>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all ${
                  isDragActive 
                    ? 'border-pink-500 bg-pink-500/10' 
                    : 'border-zinc-700 hover:border-zinc-600 bg-zinc-900/30'
                }`}
              >
                <input {...getInputProps()} />
                <UploadIcon size={48} className="mx-auto mb-4 text-zinc-500" />
                <p className="text-lg font-medium mb-2">
                  {uploading ? 'Upload en cours...' : 'Glissez vos fichiers ici'}
                </p>
                <p className="text-sm text-muted-foreground">
                  Images, PDF, vidéos, audio
                </p>
              </div>

              {/* Liste des fichiers */}
              {visibleDocs.length > 0 && (
                <div className="grid grid-cols-2 gap-3">
                  {visibleDocs.map((doc) => {
                    const Icon = getFileIcon(doc.type);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-zinc-900/50 border border-zinc-700"
                      >
                        {doc.type === 'image' && doc.url ? (
                          <img src={doc.url} alt={doc.name} className="w-12 h-12 rounded object-cover" />
                        ) : (
                          <div className="w-12 h-12 rounded bg-zinc-800 flex items-center justify-center">
                            <Icon size={20} className="text-zinc-500" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {(doc.size / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeDocument(doc.id)}
                          className="flex-shrink-0 text-zinc-500 hover:text-red-400"
                        >
                          <TrashIcon size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              <Button
                onClick={() => goToNextStep('moodboard')}
                className="gap-2 bg-pink-600 hover:bg-pink-700"
              >
                {visibleDocs.length > 0 ? 'Continuer' : 'Passer cette étape'}
                <ArrowDownIcon size={16} />
              </Button>
            </div>
          </section>

          {/* ============================================================ */}
          {/* ÉTAPE 5: PRÊT À GÉNÉRER */}
          {/* ============================================================ */}
          <section 
            ref={readyRef}
            className={`min-h-[60vh] flex flex-col justify-center items-center text-center transition-opacity duration-500 ${
              currentStep !== 'ready' ? 'opacity-30' : 'opacity-100'
            }`}
          >
            <div className="space-y-8 max-w-xl">
              <div className="w-20 h-20 rounded-full bg-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2Icon size={40} className="text-emerald-400" />
              </div>
              
              <div>
                <h2 className="text-4xl font-bold mb-4">
                  Tout est prêt !
                </h2>
                <p className="text-xl text-muted-foreground">
                  Votre creative plan "<span className="text-white font-medium">{brief.name}</span>" est prêt à être transformé en projet.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  variant="outline"
                  onClick={async () => {
                    const saved = await saveBrief();
                    if (saved) alert('Sauvegardé !');
                  }}
                  disabled={saving}
                  className="gap-2"
                >
                  {saving ? <Loader2Icon size={16} className="animate-spin" /> : null}
                  Sauvegarder
                </Button>
                <Button
                  onClick={handleGenerateProject}
                  disabled={saving}
                  className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-lg px-8 py-6"
                >
                  {saving ? <Loader2Icon size={20} className="animate-spin" /> : <PlayIcon size={20} />}
                  Générer le projet
                  <ArrowRightIcon size={20} />
                </Button>
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
