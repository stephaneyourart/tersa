/**
 * Page d'accès local
 * Accessible uniquement en mode LOCAL_MODE=true
 */

import { redirect } from 'next/navigation';

export default function LocalPage() {
  // Rediriger vers la liste des projets
  redirect('/local/projects');
}

