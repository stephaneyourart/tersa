import { NextRequest, NextResponse } from 'next/server';
import { database } from '@/lib/database';
import { briefs, briefDocuments } from '@/schema';
import { eq } from 'drizzle-orm';

// GET /api/briefs/[id] - Récupérer un brief
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const [brief] = await database
      .select()
      .from(briefs)
      .where(eq(briefs.id, params.id));

    if (!brief) {
      return NextResponse.json(
        { error: 'Brief non trouvé' },
        { status: 404 }
      );
    }

    // Charger les documents
    const docs = await database
      .select()
      .from(briefDocuments)
      .where(eq(briefDocuments.briefId, params.id));

    return NextResponse.json({
      ...brief,
      documents: docs,
    });
  } catch (error) {
    console.error('Erreur GET /api/briefs/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur serveur' },
      { status: 500 }
    );
  }
}

// PATCH /api/briefs/[id] - Mettre à jour un brief
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();

    const [updated] = await database
      .update(briefs)
      .set({
        name: body.name,
        description: body.description,
        totalTokens: body.totalTokens,
        estimatedCost: body.estimatedCost,
        status: body.status,
        updatedAt: new Date(),
      })
      .where(eq(briefs.id, params.id))
      .returning();

    if (!updated) {
      return NextResponse.json(
        { error: 'Brief non trouvé' },
        { status: 404 }
      );
    }

    // Mettre à jour les documents si nécessaire
    if (body.documents) {
      // Supprimer les anciens documents
      await database
        .delete(briefDocuments)
        .where(eq(briefDocuments.briefId, params.id));

      // Insérer les nouveaux
      if (body.documents.length > 0) {
        await database.insert(briefDocuments).values(
          body.documents.map((doc: any) => ({
            ...doc,
            briefId: params.id,
          }))
        );
      }
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Erreur PATCH /api/briefs/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour' },
      { status: 500 }
    );
  }
}

// DELETE /api/briefs/[id] - Supprimer un brief
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Supprimer d'abord les documents
    await database
      .delete(briefDocuments)
      .where(eq(briefDocuments.briefId, params.id));

    // Puis le brief
    await database
      .delete(briefs)
      .where(eq(briefs.id, params.id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur DELETE /api/briefs/[id]:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression' },
      { status: 500 }
    );
  }
}

