/**
 * API pour la gestion des presets de génération
 * Stockage persistant dans un fichier local
 */

import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const PRESETS_FILE = path.join(process.cwd(), 'data', 'generation-presets.json');
const DATA_DIR = path.join(process.cwd(), 'data');

// Interface du preset
interface GenerationPreset {
  id: string;
  name: string;
  description?: string;
  config: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  isBuiltIn: boolean;
}

interface PresetsData {
  presets: GenerationPreset[];
  currentPresetId: string | null;
}

// Assurer que le dossier data existe
async function ensureDataDir(): Promise<void> {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Lire les presets depuis le fichier
async function readPresets(): Promise<PresetsData> {
  try {
    await ensureDataDir();
    const content = await fs.readFile(PRESETS_FILE, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Fichier n'existe pas encore, retourner structure vide
    return { presets: [], currentPresetId: null };
  }
}

// Écrire les presets dans le fichier
async function writePresets(data: PresetsData): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(PRESETS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// GET: Récupérer tous les presets
export async function GET() {
  try {
    const data = await readPresets();
    return NextResponse.json(data);
  } catch (error) {
    console.error('[Presets API] Erreur lecture:', error);
    return NextResponse.json(
      { error: 'Erreur lecture des presets' },
      { status: 500 }
    );
  }
}

// POST: Créer ou mettre à jour un preset
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, preset, currentPresetId } = body;

    const data = await readPresets();

    switch (action) {
      case 'create': {
        // Créer un nouveau preset
        const newPreset: GenerationPreset = {
          ...preset,
          id: preset.id || `preset-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          isBuiltIn: false,
        };
        data.presets.push(newPreset);
        data.currentPresetId = newPreset.id;
        await writePresets(data);
        console.log('[Presets API] Créé:', newPreset.name);
        return NextResponse.json({ success: true, preset: newPreset });
      }

      case 'update': {
        // Mettre à jour un preset existant
        const index = data.presets.findIndex(p => p.id === preset.id);
        if (index === -1) {
          return NextResponse.json(
            { error: 'Preset non trouvé' },
            { status: 404 }
          );
        }
        data.presets[index] = {
          ...data.presets[index],
          ...preset,
          updatedAt: new Date().toISOString(),
        };
        await writePresets(data);
        console.log('[Presets API] Mis à jour:', preset.name);
        return NextResponse.json({ success: true, preset: data.presets[index] });
      }

      case 'delete': {
        // Supprimer un preset
        const presetIndex = data.presets.findIndex(p => p.id === preset.id);
        if (presetIndex === -1) {
          return NextResponse.json(
            { error: 'Preset non trouvé' },
            { status: 404 }
          );
        }
        const deleted = data.presets.splice(presetIndex, 1)[0];
        if (data.currentPresetId === preset.id) {
          data.currentPresetId = null;
        }
        await writePresets(data);
        console.log('[Presets API] Supprimé:', deleted.name);
        return NextResponse.json({ success: true });
      }

      case 'setCurrentPreset': {
        // Définir le preset courant
        data.currentPresetId = currentPresetId;
        await writePresets(data);
        return NextResponse.json({ success: true });
      }

      default:
        return NextResponse.json(
          { error: 'Action inconnue' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('[Presets API] Erreur:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}
