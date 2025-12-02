import { AudioNode } from './audio';
import { CodeNode } from './code';
import { CollectionNode } from './collection';
import { DropNode } from './drop';
import { FileNode } from './file';
import { ImageNode } from './image';
import { LabelNode } from './label';
import { ShapeNode } from './shape';
import { TextNode } from './text';
import { TweetNode } from './tweet';
import { VideoNode } from './video';

export const nodeTypes = {
  image: ImageNode,
  text: TextNode,
  drop: DropNode,
  video: VideoNode,
  audio: AudioNode,
  code: CodeNode,
  file: FileNode,
  tweet: TweetNode,
  collection: CollectionNode,
  shape: ShapeNode,
  label: LabelNode,
};
