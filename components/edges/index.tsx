import { AnimatedEdge } from './animated';
import { FloraEdge } from './flora';
import { ReplaceEdge } from './replace';
import { TemporaryEdge } from './temporary';

export const edgeTypes = {
  animated: AnimatedEdge,
  flora: FloraEdge,
  temporary: TemporaryEdge,
  replace: ReplaceEdge,
  // Utiliser flora comme type par défaut
  default: FloraEdge,
};
