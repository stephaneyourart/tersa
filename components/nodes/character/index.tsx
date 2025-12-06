import { CharacterTransform } from './transform';

export type CharacterNodeProps = {
  type: string;
  data: {
    instructions?: string;
    // Potentially other settings like style, etc.
    advancedSettings?: unknown;
    generating?: boolean;
    error?: string;
  };
  id: string;
};

export const CharacterNode = (props: CharacterNodeProps) => {
  return <CharacterTransform {...props} title="Générateur de personnage" />;
};
