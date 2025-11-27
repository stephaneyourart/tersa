/**
 * Page d'accès local au canvas
 * Accessible uniquement en mode LOCAL_MODE=true
 */

import { redirect } from 'next/navigation';

export default function LocalPage() {
  // Rediriger vers le canvas local
  redirect('/local/canvas');
}

