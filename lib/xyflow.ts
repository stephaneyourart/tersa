import type { AudioNodeProps } from '@/components/nodes/audio';
import type { CodeNodeProps } from '@/components/nodes/code';
import type { FileNodeProps } from '@/components/nodes/file';
import type { ImageNodeProps } from '@/components/nodes/image';
import type { TextNodeProps } from '@/components/nodes/text';
import type { TweetNodeProps } from '@/components/nodes/tweet';
import type { Node } from '@xyflow/react';

export const getTextFromTextNodes = (nodes: Node[]) => {
  const sourceTexts = nodes
    .filter((node) => node.type === 'text')
    .map((node) => (node.data as TextNodeProps['data']).text);

  const generatedTexts = nodes
    .filter((node) => node.type === 'text' && node.data.generated)
    .map((node) => (node.data as TextNodeProps['data']).generated?.text);

  return [...sourceTexts, ...generatedTexts].filter(Boolean) as string[];
};

export const getTranscriptionFromAudioNodes = (nodes: Node[]) => {
  const transcripts = nodes
    .filter((node) => node.type === 'audio')
    .map((node) => (node.data as AudioNodeProps['data']).transcript)
    .filter(Boolean) as string[];

  return transcripts;
};

export const getDescriptionsFromImageNodes = (nodes: Node[]) => {
  const descriptions = nodes
    .filter((node) => node.type === 'image')
    .map((node) => (node.data as ImageNodeProps['data']).description)
    .filter(Boolean) as string[];

  return descriptions;
};

export const getImagesFromImageNodes = (nodes: Node[]) => {
  const sourceImages = nodes
    .filter((node) => node.type === 'image')
    .map((node) => (node.data as ImageNodeProps['data']).content)
    .filter(Boolean) as { url: string; type: string }[];

  const generatedImages = nodes
    .filter((node) => node.type === 'image')
    .map((node) => (node.data as ImageNodeProps['data']).generated)
    .filter(Boolean) as { url: string; type: string }[];

  return [...sourceImages, ...generatedImages];
};

// Récupère les images depuis les nœuds collection (pour les vidéos connectées à des collections)
export const getImagesFromCollectionNodes = (nodes: Node[]) => {
  const images: { url: string; type: string }[] = [];
  
  for (const node of nodes) {
    if (node.type === 'collection') {
      const items = node.data?.items as { enabled?: boolean; url?: string; type?: string }[] | undefined;
      if (items && Array.isArray(items)) {
        for (const item of items) {
          if (item.enabled !== false && item.url) {
            images.push({ url: item.url, type: item.type || 'image/png' });
          }
        }
      }
    }
  }
  
  return images;
};

// Récupère les images depuis TOUS les nœuds connectés (images + collections)
export const getAllImagesFromNodes = (nodes: Node[]) => {
  const imageNodeImages = getImagesFromImageNodes(nodes);
  const collectionImages = getImagesFromCollectionNodes(nodes);
  return [...imageNodeImages, ...collectionImages];
};

export const isValidSourceTarget = (source: Node, target: Node) => {
  if (source.type === 'video' || source.type === 'drop') {
    return false;
  }

  if (target.type === 'audio' && source.type !== 'text') {
    return false;
  }

  if (target.type === 'file') {
    return false;
  }

  return true;
};

export const getCodeFromCodeNodes = (nodes: Node[]) => {
  const sourceCodes = nodes
    .filter((node) => node.type === 'code')
    .map((node) => (node.data as CodeNodeProps['data']).content)
    .filter(Boolean) as { text: string; language: string }[];

  const generatedCodes = nodes
    .filter((node) => node.type === 'code' && node.data.generated)
    .map((node) => (node.data as CodeNodeProps['data']).generated)
    .filter(Boolean) as { text: string; language: string }[];

  return [...sourceCodes, ...generatedCodes];
};

export const getFilesFromFileNodes = (nodes: Node[]) => {
  const files = nodes
    .filter((node) => node.type === 'file')
    .map((node) => (node.data as FileNodeProps['data']).content)
    .filter(Boolean) as { url: string; type: string; name: string }[];

  return files;
};

export const getTweetContentFromTweetNodes = (nodes: Node[]) => {
  const tweets = nodes
    .filter((node) => node.type === 'tweet')
    .map((node) => (node.data as TweetNodeProps['data']).content)
    .filter(Boolean) as NonNullable<TweetNodeProps['data']['content']>[];

  const tweetContent = tweets.map(
    (tweet) => `On ${tweet.date}, ${tweet.author} tweeted: ${tweet.text}`
  );

  return tweetContent;
};
