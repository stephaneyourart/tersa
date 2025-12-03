#!/bin/bash

echo "🚀 Démarrage du système de briefs..."

# Vérifier PostgreSQL
if brew services list | grep -q "postgresql@15.*started"; then
    echo "✅ PostgreSQL déjà démarré"
else
    echo "📦 Démarrage PostgreSQL..."
    brew services start postgresql@15
    sleep 2
fi

# Créer la base si elle n'existe pas
if ! psql -lqt | cut -d \| -f 1 | grep -qw tersafork; then
    echo "🗄️  Création de la base tersafork..."
    createdb tersafork
fi

# Appliquer les migrations
echo "🔄 Application des migrations..."
npx drizzle-kit push

# Démarrer Next.js
echo "🌐 Démarrage Next.js..."
npm run dev:local
