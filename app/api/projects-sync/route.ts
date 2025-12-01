/**
 * API pour synchroniser les projets du localStorage vers le serveur
 * Permet à l'API media-library d'accéder aux données des nodes
 */

import { NextRequest, NextResponse } from 'next/server';
import { writeFile, readFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join, dirname } from 'path';

// Chemin du fichier de cache des projets
function getProjectsCachePath(): string {
  const storagePath = process.env.LOCAL_STORAGE_PATH;
  if (!storagePath) {
    throw new Error('LOCAL_STORAGE_PATH not defined');
  }
  return join(storagePath, '.cache', 'projects.json');
}

// POST - Recevoir et stocker les projets
export async function POST(request: NextRequest) {
  try {
    const { projects } = await request.json();
    
    if (!Array.isArray(projects)) {
      return NextResponse.json(
        { success: false, error: 'projects must be an array' },
        { status: 400 }
      );
    }

    const cachePath = getProjectsCachePath();
    
    // Créer le dossier si nécessaire
    await mkdir(dirname(cachePath), { recursive: true });
    
    // Sauvegarder les projets
    await writeFile(cachePath, JSON.stringify(projects, null, 2));
    
    console.log(`[Projects Sync] ${projects.length} projets synchronisés`);
    
    return NextResponse.json({
      success: true,
      count: projects.length,
    });
  } catch (error) {
    console.error('[Projects Sync] Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

// GET - Récupérer les projets (pour debug)
export async function GET() {
  try {
    const cachePath = getProjectsCachePath();
    
    if (!existsSync(cachePath)) {
      return NextResponse.json({ success: true, projects: [], count: 0 });
    }
    
    const content = await readFile(cachePath, 'utf-8');
    const projects = JSON.parse(content);
    
    return NextResponse.json({
      success: true,
      count: projects.length,
      projects,
    });
  } catch (error) {
    console.error('[Projects Sync] GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

