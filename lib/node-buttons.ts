import { AudioWaveformIcon, FileIcon, VideoIcon, UserIcon } from 'lucide-react';

import { CodeIcon, ImageIcon, TextIcon } from 'lucide-react';

export const nodeButtons = [
  {
    id: 'text',
    label: 'Text',
    icon: TextIcon,
  },
  {
    id: 'image',
    label: 'Image',
    icon: ImageIcon,
  },
  {
    id: 'audio',
    label: 'Audio',
    icon: AudioWaveformIcon,
  },
  {
    id: 'video',
    label: 'Video',
    icon: VideoIcon,
  },
  {
    id: 'character',
    label: 'Personnage',
    icon: UserIcon,
  },
  {
    id: 'code',
    label: 'Code',
    icon: CodeIcon,
    data: {
      content: { language: 'javascript' },
    },
  },
  {
    id: 'file',
    label: 'File',
    icon: FileIcon,
  },
];
