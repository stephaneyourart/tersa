/**
 * API pour créer des projets locaux côté serveur
 * 
 * Note: Les projets locaux sont normalement gérés côté client (localStorage).
 * Cette API sert de pont pour les cas où le serveur doit créer un projet
 * (ex: génération depuis un brief).
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, data } = body;

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    // Générer un ID unique
    const projectId = `project-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Créer la structure du projet
    const project = {
      id: projectId,
      name,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      data: data || {
        nodes: [],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      },
    };

    // Note: On ne peut pas accéder à localStorage côté serveur.
    // Le projet sera créé/synchronisé côté client lors du chargement.
    // On retourne juste les données pour que le client les stocke.

    return NextResponse.json({ 
      success: true,
      project,
      message: 'Project created successfully (needs client-side sync)',
    });
  } catch (error) {
    console.error('Erreur création projet local:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du projet' },
      { status: 500 }
    );
  }
}

