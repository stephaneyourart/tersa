/**
 * API de réparation des vidéos manquantes dans un projet
 * Utilise les logs pour retrouver les associations nodeId -> videoUrl
 */

import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Associations connues depuis les logs (projet project-1764806945743-ozx41d8)
const VIDEO_ASSOCIATIONS: Record<string, string> = {
  'video-plan-2-N6KDylwT': '/api/storage/videos/2iDdZX8NGjN_v2vh3E0m1-1764807533077-7AQXvTik.mp4',
  'video-plan-3-Y12YQigZ': '/api/storage/videos/judK9I7xU4JARVcOhObgj-1764807540856-ZfU6TfGL.mp4',
  'video-plan-3-enaMFkTr': '/api/storage/videos/DjjAYzgOHBjhC5sKhPp9M-1764807548883-rok7NyNC.mp4',
  'video-plan-4-Sm1moGL4': '/api/storage/videos/JD5EvgpM3gksXnhyLMYo9-1764807550435-5fhD3vwm.mp4',
  'video-plan-1-NGV15t2J': '/api/storage/videos/PBZp1oWepPQ4TRrhrtTEy-1764807554879-babsFWYe.mp4',
  'video-plan-4-BHu_tDWx': '/api/storage/videos/c65srFzpTvakHtAu9sSC6-1764807554110-dg6rv3no.mp4',
  'video-plan-2-tHl-9liC': '/api/storage/videos/VpQmeYNxUE4h9f3AhXifm-1764807557042-tD2K_0eL.mp4',
  'video-plan-1-10GnCRrp': '/api/storage/videos/BRr2p6UuLHKdGqr0rbqYT-1764807570221-4IDLcErQ.mp4',
};

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId } = body;

    if (!projectId) {
      return NextResponse.json({ error: 'projectId requis' }, { status: 400 });
    }

    // Lire le fichier projets synchronisé
    const projectsFile = path.join(process.cwd(), 'storage', 'projects-sync.json');
    const projectsData = await fs.readFile(projectsFile, 'utf-8');
    const projects = JSON.parse(projectsData);

    // Trouver le projet
    const projectIndex = projects.findIndex((p: any) => p.id === projectId);
    if (projectIndex === -1) {
      return NextResponse.json({ error: 'Projet non trouvé' }, { status: 404 });
    }

    const project = projects[projectIndex];
    let repaired = 0;

    // Parcourir les nœuds et réparer les vidéos
    if (project.data?.nodes) {
      for (const node of project.data.nodes) {
        if (node.type === 'video' && VIDEO_ASSOCIATIONS[node.id]) {
          const videoUrl = VIDEO_ASSOCIATIONS[node.id];
          
          // Mettre à jour le nœud avec l'URL de la vidéo
          if (!node.data.generated?.url) {
            node.data.generated = {
              url: videoUrl,
              type: 'video/mp4',
            };
            repaired++;
            console.log(`[Repair] Fixed node ${node.id} with ${videoUrl}`);
          }
        }
      }
    }

    // Sauvegarder le fichier
    if (repaired > 0) {
      projects[projectIndex] = project;
      await fs.writeFile(projectsFile, JSON.stringify(projects, null, 2));
    }

    return NextResponse.json({ 
      success: true, 
      repaired,
      message: `${repaired} nœuds vidéo réparés`
    });

  } catch (error) {
    console.error('[Repair API] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur serveur' },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    info: 'API de réparation des vidéos',
    usage: 'POST avec { projectId: "..." }',
    knownVideos: Object.keys(VIDEO_ASSOCIATIONS).length,
  });
}

