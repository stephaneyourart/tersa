/**
 * Redirection vers la liste des projets
 * L'accès direct à /local/canvas redirige vers /local/projects
 */

import { redirect } from 'next/navigation';

export default function LocalCanvasPage() {
  redirect('/local/projects');
}

