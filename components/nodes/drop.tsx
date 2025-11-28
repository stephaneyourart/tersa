import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { nodeButtons } from '@/lib/node-buttons';
import { type XYPosition, useReactFlow } from '@xyflow/react';
import { RefreshCwIcon } from 'lucide-react';
import { nanoid } from 'nanoid';
import { useEffect, useRef, useMemo } from 'react';
import { NodeLayout } from './layout';

// Types de nœuds qui supportent le remplacement de contenu
const REPLACEABLE_TYPES = ['text', 'image', 'video'];

type DropNodeProps = {
  data: {
    isSource?: boolean;
    position: XYPosition;
    // Infos du nœud source pour l'option "Replace"
    sourceNodeType?: string;
    sourceNodeId?: string;
    sourceHasContent?: boolean;
  };
  id: string;
};

export const DropNode = ({ data, id }: DropNodeProps) => {
  const { addNodes, deleteElements, getNode, addEdges, getNodeConnections, setEdges } =
    useReactFlow();
  const ref = useRef<HTMLDivElement>(null);

  // Déterminer si on peut proposer l'option "Replace"
  const canReplace = useMemo(() => {
    return (
      data.sourceHasContent &&
      data.sourceNodeType &&
      REPLACEABLE_TYPES.includes(data.sourceNodeType)
    );
  }, [data.sourceHasContent, data.sourceNodeType]);

  // Label pour l'option Replace
  const replaceLabel = useMemo(() => {
    const typeLabels: Record<string, string> = {
      text: 'Text',
      image: 'Image',
      video: 'Video',
    };
    return typeLabels[data.sourceNodeType || ''] || data.sourceNodeType;
  }, [data.sourceNodeType]);

  // Mettre à jour l'edge quand on survole "Replace"
  const handleReplaceHover = (isHovering: boolean) => {
    setEdges((eds) =>
      eds.map((edge) => {
        if (edge.source === id || edge.target === id) {
          return {
            ...edge,
            type: isHovering ? 'replace' : 'temporary',
          };
        }
        return edge;
      })
    );
  };

  // Handler pour "Replace" - crée un nœud du même type avec le contenu du source, SANS connexion
  const handleReplace = () => {
    console.log('[Replace] data:', data);
    console.log('[Replace] sourceNodeId:', data.sourceNodeId);
    console.log('[Replace] sourceNodeType:', data.sourceNodeType);
    
    if (!data.sourceNodeId || !data.sourceNodeType) {
      console.log('[Replace] ABORT: missing sourceNodeId or sourceNodeType');
      return;
    }

    const sourceNode = getNode(data.sourceNodeId);
    console.log('[Replace] sourceNode:', sourceNode);
    
    if (!sourceNode) {
      console.log('[Replace] ABORT: sourceNode not found');
      return;
    }

    const currentNode = getNode(id);
    const position = currentNode?.position || { x: 0, y: 0 };

    // Delete the drop node (et ses edges temporaires)
    deleteElements({
      nodes: [{ id }],
    });

    const newNodeId = nanoid();
    const sourceData = sourceNode.data as Record<string, unknown>;
    console.log('[Replace] sourceData:', sourceData);

    // Copier TOUT le contenu du nœud source (copie profonde complète)
    const newData = JSON.parse(JSON.stringify(sourceData));
    console.log('[Replace] newData:', newData);

    // Créer le nouveau nœud avec le contenu copié - PAS de connexion
    addNodes({
      id: newNodeId,
      type: data.sourceNodeType,
      position,
      data: newData,
      origin: [0, 0.5],
    });
    
    console.log('[Replace] Node created:', newNodeId);
  };

  const handleSelect = (type: string, options?: Record<string, unknown>) => {
    // Get the position of the current node
    const currentNode = getNode(id);
    const position = currentNode?.position || { x: 0, y: 0 };
    const sourceNodes = getNodeConnections({
      nodeId: id,
    });

    // Delete the drop node
    deleteElements({
      nodes: [{ id }],
    });

    const newNodeId = nanoid();
    const { data: nodeData, ...rest } = options ?? {};

    // Add the new node of the selected type
    addNodes({
      id: newNodeId,
      type,
      position,
      data: {
        ...(nodeData ? nodeData : {}),
      },
      origin: [0, 0.5],
      ...rest,
    });

    for (const sourceNode of sourceNodes) {
      addEdges({
        id: nanoid(),
        source: data.isSource ? newNodeId : sourceNode.source,
        target: data.isSource ? sourceNode.source : newNodeId,
        type: 'flora',
      });
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        // Delete the drop node when Escape is pressed
        deleteElements({
          nodes: [{ id }],
        });
      }
    };

    const handleClick = (event: MouseEvent) => {
      // Get the DOM element for this node
      const nodeElement = ref.current;

      // Check if the click was outside the node
      if (nodeElement && !nodeElement.contains(event.target as Node)) {
        deleteElements({
          nodes: [{ id }],
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    setTimeout(() => {
      window.addEventListener('click', handleClick);
    }, 50);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, [deleteElements, id]);

  return (
    <div ref={ref}>
      <NodeLayout id={id} data={data} type="drop" title="Add a new node">
        <Command className="rounded-lg">
          <CommandInput placeholder="Type a command or search..." />
          <CommandList>
            <CommandEmpty>No results found.</CommandEmpty>
            
            {/* Option "Replace" - visible si le nœud source a du contenu */}
            {canReplace && (
              <>
                <CommandGroup heading="Replace">
                  <CommandItem
                    onSelect={handleReplace}
                    onMouseEnter={() => handleReplaceHover(true)}
                    onMouseLeave={() => handleReplaceHover(false)}
                  >
                    <RefreshCwIcon size={16} />
                    <span>Replace {replaceLabel}</span>
                  </CommandItem>
                </CommandGroup>
                <CommandSeparator />
              </>
            )}
            
            <CommandGroup heading="Add node">
              {nodeButtons
                .filter(
                  (button) => button.id !== 'file' && button.id !== 'tweet'
                )
                .map((button) => (
                  <CommandItem
                    key={button.id}
                    onSelect={() => handleSelect(button.id, button.data)}
                  >
                    <button.icon size={16} />
                    {button.label}
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </NodeLayout>
    </div>
  );
};
