import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database';
import { briefs, briefDocuments } from '@/schema';
import { eq } from 'drizzle-orm';

// GET /api/briefs - Liste tous les briefs
export async function GET(request: NextRequest) {
  try {
    const userId = 'local-user'; // TODO: Récupérer depuis l'auth
    
    const allBriefs = await database
      .select()
      .from(briefs)
      .where(eq(briefs.userId, userId))
      .orderBy(briefs.createdAt);

    // Charger les documents pour chaque brief
    const briefsWithDocs = await Promise.all(
      allBriefs.map(async (brief) => {
        const docs = await database
          .select()
          .from(briefDocuments)
          .where(eq(briefDocuments.briefId, brief.id));
        
        return {
          ...brief,
          documents: docs,
        };
      })
    );

    return NextResponse.json(briefsWithDocs);
  } catch (error) {
    console.error('Erreur GET /api/briefs:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// POST /api/briefs - Créer un nouveau brief
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userId = 'local-user'; // TODO: Récupérer depuis l'auth

    const [newBrief] = await database
      .insert(briefs)
      .values({
        name: body.name,
        description: body.description,
        userId,
        totalTokens: body.totalTokens || 0,
        estimatedCost: body.estimatedCost,
        status: 'draft',
      })
      .returning();

    // Insérer les documents s'il y en a
    if (body.documents && body.documents.length > 0) {
      await database.insert(briefDocuments).values(
        body.documents.map((doc: any) => ({
          id: doc.id,
          briefId: newBrief.id,
          name: doc.name,
          type: doc.type,
          mimeType: doc.mimeType,
          size: doc.size,
          storagePath: doc.storagePath || '',
          url: doc.url || '',
          content: doc.content,
          tokens: doc.tokens,
          metadata: doc.metadata,
          // Convertir la date string en Date si nécessaire
          createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
        }))
      );
    }

    return NextResponse.json(newBrief, { status: 201 });
  } catch (error) {
    console.error('Erreur POST /api/briefs:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création' },
      { status: 500 }
    );
  }
}

