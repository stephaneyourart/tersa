// Update schema to include description
export interface ModelParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'object';
  options?: string[];
  default?: string | number | boolean | null | object;
  min?: number;
  max?: number;
  description?: string;
}

// ... existing code ...
