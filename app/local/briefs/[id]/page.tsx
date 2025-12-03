'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import {
  ArrowLeftIcon,
  UploadIcon,
  FileTextIcon,
  ImageIcon,
  VideoIcon,
  FileIcon,
  TrashIcon,
  PlayIcon,
  Loader2Icon,
  CoinsIcon,
  AlertCircleIcon,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
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

const GEMINI_MAX_TOKENS = 2000000; // 2M tokens max pour Gemini 3

export default function BriefEditPage() {
  const router = useRouter();
  const params = useParams();
  const isNew = params.id === 'new';
  
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
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveBrief = async () => {
    if (!brief.name.trim()) {
      alert('Veuillez donner un nom à votre brief');
      return;
    }

    setSaving(true);
    try {
      const url = isNew ? '/api/briefs' : `/api/briefs/${params.id}`;
      const method = isNew ? 'POST' : 'PATCH';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      });

      if (response.ok) {
        const saved = await response.json();
        if (isNew) {
          router.push(`/local/briefs/${saved.id}`);
        } else {
          setBrief(saved);
        }
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      alert('Erreur lors de la sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleFileUpload = async (files: File[]) => {
    setUploading(true);
    try {
      // TODO: Implémenter l'upload vers Supabase Storage
      // Pour l'instant, on simule
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
          estimatedCost: formatCost(calculateCost(prev.totalTokens + doc.tokens)),
        }));
      }
    } catch (error) {
      console.error('Erreur lors de l\'upload:', error);
    } finally {
      setUploading(false);
    }
  };

  const removeDocument = (docId: string) => {
    setBrief(prev => {
      const doc = prev.documents?.find(d => d.id === docId);
      const newDocs = prev.documents?.filter(d => d.id !== docId) || [];
      const newTotal = prev.totalTokens - (doc?.tokens || 0);
      
      return {
        ...prev,
        documents: newDocs,
        totalTokens: newTotal,
        estimatedCost: formatCost(calculateCost(newTotal)),
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
      // Estimation basique : 1 page = 300 mots en moyenne
      // TODO: Extraire le nombre réel de pages du PDF
      const estimatedPages = Math.ceil(file.size / 50000); // ~50KB par page
      return countPDFTokens(estimatedPages).tokens;
    }
    
    if (type === 'image') {
      // Estimation avec résolution standard
      return countImageTokens(1024, 1024).tokens;
    }
    
    if (type === 'video') {
      // Estimation : 1 seconde par MB (approximatif)
      const estimatedDuration = file.size / (1024 * 1024);
      return countVideoTokens(estimatedDuration, 1920, 1080).tokens;
    }
    
    if (type === 'audio') {
      // Estimation : 1 minute par MB
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

  const tokenUsagePercent = (brief.totalTokens / GEMINI_MAX_TOKENS) * 100;
  const isOverLimit = brief.totalTokens > GEMINI_MAX_TOKENS;

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2Icon size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/local/briefs">
              <Button variant="ghost" size="icon" className="rounded-full">
                <ArrowLeftIcon size={18} />
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">
                {isNew ? 'Nouveau Brief' : 'Éditer le Brief'}
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={saveBrief}
              disabled={saving}
            >
              {saving ? 'Sauvegarde...' : 'Sauvegarder'}
            </Button>
            {!isNew && brief.status !== 'generating' && (
              <Button 
                onClick={() => router.push(`/local/briefs/${params.id}/generate`)}
                className="gap-2"
                disabled={isOverLimit}
              >
                <PlayIcon size={16} />
                Générer le projet
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Formulaire principal */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations de base */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Informations</h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Nom du brief *
                  </label>
                  <Input
                    value={brief.name}
                    onChange={(e) => setBrief({ ...brief, name: e.target.value })}
                    placeholder="Ex: Vidéo promotionnelle Q1 2025"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Description (optionnel)
                  </label>
                  <Textarea
                    value={brief.description || ''}
                    onChange={(e) => setBrief({ ...brief, description: e.target.value })}
                    placeholder="Décrivez brièvement le contenu de ce brief..."
                    rows={3}
                  />
                </div>
              </div>
            </Card>

            {/* Zone d'upload */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Documents</h2>
              
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-violet-500 bg-violet-500/5' 
                    : 'border-border/50 hover:border-border'
                }`}
              >
                <input {...getInputProps()} />
                <UploadIcon size={40} className="mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm font-medium mb-1">
                  {uploading ? 'Upload en cours...' : 'Glissez vos fichiers ici'}
                </p>
                <p className="text-xs text-muted-foreground">
                  ou cliquez pour parcourir
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Supportés : Texte, PDF, Images, Vidéos, Audio
                </p>
              </div>

              {/* Liste des documents */}
              {brief.documents && brief.documents.length > 0 && (
                <div className="mt-6 space-y-2">
                  {brief.documents.map((doc) => {
                    const Icon = getFileIcon(doc.type);
                    return (
                      <div
                        key={doc.id}
                        className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                      >
                        <Icon size={20} className="text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{doc.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTokens(doc.tokens)} • {(doc.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => removeDocument(doc.id)}
                          className="flex-shrink-0"
                        >
                          <TrashIcon size={14} />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

          {/* Panneau latéral - Stats */}
          <div className="space-y-6">
            {/* Token Counter */}
            <Card className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <CoinsIcon size={18} className="text-violet-400" />
                <h2 className="text-lg font-semibold">Estimation</h2>
              </div>

              <div className="space-y-4">
                {/* Barre de progression */}
                <div>
                  <div className="flex items-center justify-between text-sm mb-2">
                    <span className="text-muted-foreground">Tokens</span>
                    <span className={`font-mono font-medium ${isOverLimit ? 'text-destructive' : ''}`}>
                      {formatTokens(brief.totalTokens)}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        isOverLimit 
                          ? 'bg-destructive' 
                          : tokenUsagePercent > 80 
                            ? 'bg-yellow-500' 
                            : 'bg-violet-500'
                      }`}
                      style={{ width: `${Math.min(tokenUsagePercent, 100)}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Limite : {formatTokens(GEMINI_MAX_TOKENS)}
                  </p>
                </div>

                {/* Coût estimé */}
                <div className="pt-4 border-t border-border/50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Coût estimé</span>
                    <span className="text-lg font-bold text-emerald-400">
                      {brief.estimatedCost || '$0.00'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Basé sur Gemini 3 (input)
                  </p>
                </div>

                {/* Avertissement */}
                {isOverLimit && (
                  <div className="flex gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30">
                    <AlertCircleIcon size={16} className="text-destructive flex-shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <p className="font-medium text-destructive mb-1">Limite dépassée</p>
                      <p className="text-destructive/80">
                        Réduisez le nombre de documents pour rester sous la limite de tokens.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </Card>

            {/* Stats */}
            <Card className="p-6">
              <h2 className="text-lg font-semibold mb-4">Statistiques</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Documents</span>
                  <span className="font-medium">{brief.documents?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Taille totale</span>
                  <span className="font-medium">
                    {((brief.documents?.reduce((acc, d) => acc + d.size, 0) || 0) / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status</span>
                  <span className="font-medium capitalize">{brief.status}</span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

