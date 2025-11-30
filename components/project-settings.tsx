'use client';

/**
 * Composant Settings du projet
 * Permet de configurer les paramètres du projet, notamment le system prompt DVR
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  getProjectSettings, 
  updateProjectSettings,
  type ProjectSettings as ProjectSettingsType 
} from '@/lib/local-projects-store';
import { toast } from 'sonner';
import { SettingsIcon, SparklesIcon, FolderIcon, SaveIcon } from 'lucide-react';

// System prompt par défaut pour l'analyse DVR
const DEFAULT_DVR_SYSTEM_PROMPT = `Tu es un assistant spécialisé dans l'analyse de contenu multimédia pour la post-production vidéo.

Ton rôle est d'analyser le contexte de génération d'un élément (image, vidéo, audio) et d'en extraire des métadonnées structurées pour DaVinci Resolve.

À partir du prompt de génération et des informations fournies, tu dois identifier :
- Les personnages présents et leurs caractéristiques visuelles
- Le décor/lieu de la scène (environnement, ambiance, éclairage)
- Les actions en cours ou suggérées
- Les mouvements de caméra éventuels (plan large, gros plan, travelling, panoramique, etc.)
- L'ambiance générale (dramatique, joyeuse, mystérieuse, épique, intime, etc.)
- Le style visuel (cinématographique, anime, photoréaliste, etc.)

Tu dois répondre UNIQUEMENT au format JSON suivant, sans aucun texte avant ou après :
{
  "title": "Titre court et descriptif (max 50 caractères)",
  "decor": "Description du décor/lieu (max 30 caractères)", 
  "description": "Description complète de la scène incluant personnages, actions, ambiance, style"
}

Règles importantes :
- Le titre doit être concis mais évocateur, comme un nom de fichier professionnel
- Le décor doit être très court (30 chars max) : ex "Forêt enchantée", "Bureau moderne", "Plage coucher soleil"
- La description doit être détaillée et utile pour le montage : personnages, actions, mood, style
- Utilise un langage professionnel adapté à la post-production
- Si le prompt est en anglais, traduis en français
- Adapte le style de description au type de média (cinématique pour vidéo, descriptif pour image)`;

type ProjectSettingsProps = {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function ProjectSettingsDialog({
  projectId,
  open,
  onOpenChange,
}: ProjectSettingsProps) {
  const [settings, setSettings] = useState<ProjectSettingsType>({});
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Charger les settings au montage
  useEffect(() => {
    if (open && projectId) {
      const projectSettings = getProjectSettings(projectId);
      setSettings(projectSettings || {});
      setHasChanges(false);
    }
  }, [open, projectId]);

  // Handler pour les changements
  const handleChange = (field: keyof ProjectSettingsType, value: string) => {
    setSettings(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Reset le system prompt au défaut
  const handleResetPrompt = () => {
    setSettings(prev => ({ ...prev, dvrAnalysisSystemPrompt: DEFAULT_DVR_SYSTEM_PROMPT }));
    setHasChanges(true);
  };

  // Sauvegarder
  const handleSave = async () => {
    setIsSaving(true);
    try {
      updateProjectSettings(projectId, settings);
      toast.success('Settings sauvegardés');
      setHasChanges(false);
      onOpenChange(false);
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon size={20} />
            Settings du projet
          </DialogTitle>
          <DialogDescription>
            Configurez les paramètres spécifiques à ce projet
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="dvr" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dvr" className="flex items-center gap-2">
              <SparklesIcon size={14} />
              Analyse IA (DVR)
            </TabsTrigger>
            <TabsTrigger value="folders" className="flex items-center gap-2">
              <FolderIcon size={14} />
              Dossiers
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto py-4">
            <TabsContent value="dvr" className="mt-0 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="dvrSystemPrompt">
                    System Prompt pour l'analyse IA
                  </Label>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={handleResetPrompt}
                    className="text-xs"
                  >
                    Réinitialiser
                  </Button>
                </div>
                <Textarea
                  id="dvrSystemPrompt"
                  value={settings.dvrAnalysisSystemPrompt || DEFAULT_DVR_SYSTEM_PROMPT}
                  onChange={(e) => handleChange('dvrAnalysisSystemPrompt', e.target.value)}
                  placeholder="System prompt pour GPT-4.1 mini..."
                  className="min-h-[300px] font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Ce prompt est utilisé par GPT-4.1 mini pour analyser les éléments générés 
                  et préremplir les métadonnées avant l'envoi vers DaVinci Resolve.
                </p>
              </div>
            </TabsContent>

            <TabsContent value="folders" className="mt-0 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="dvrDefaultFolder">
                  Dossier DVR par défaut
                </Label>
                <Input
                  id="dvrDefaultFolder"
                  value={settings.dvrDefaultFolder || 'TersaFork'}
                  onChange={(e) => handleChange('dvrDefaultFolder', e.target.value)}
                  placeholder="TersaFork"
                />
                <p className="text-xs text-muted-foreground">
                  Dossier dans le Media Pool de DaVinci Resolve où les éléments seront importés.
                  Le dossier sera créé automatiquement s'il n'existe pas.
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dvrSearchShortcut">
                  Raccourci recherche Media Pool
                </Label>
                <Input
                  id="dvrSearchShortcut"
                  value={settings.dvrSearchShortcut || ''}
                  onChange={(e) => handleChange('dvrSearchShortcut', e.target.value)}
                  placeholder="Ex: cmd+shift+f"
                />
                <p className="text-xs text-muted-foreground">
                  Raccourci clavier pour activer la recherche dans le Media Pool de DVR.
                  Configure-le dans DaVinci Resolve → Keyboard Customization (cherche "Search Bin").
                  Format: cmd+shift+f ou ctrl+shift+f
                </p>
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <DialogFooter className="border-t pt-4">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || isSaving}
            className="gap-2"
          >
            <SaveIcon size={14} />
            {isSaving ? 'Sauvegarde...' : 'Sauvegarder'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export { DEFAULT_DVR_SYSTEM_PROMPT };
