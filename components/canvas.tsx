'use client';

import { updateProjectAction } from '@/app/actions/project/update';
import { useAnalytics } from '@/hooks/use-analytics';
import { useSaveProject } from '@/hooks/use-save-project';
import { handleError } from '@/lib/error/handle';
import { isValidSourceTarget } from '@/lib/xyflow';
import { NodeDropzoneProvider } from '@/providers/node-dropzone';
import { NodeOperationsProvider } from '@/providers/node-operations';
import { useProject } from '@/providers/project';
import {
  Background,
  type IsValidConnection,
  type OnConnect,
  type OnConnectEnd,
  type OnConnectStart,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  type ReactFlowProps,
  getOutgoers,
  useReactFlow,
} from '@xyflow/react';
import {
  type Edge,
  type Node,
  applyEdgeChanges,
  applyNodeChanges,
} from '@xyflow/react';
import { LinkIcon, RefreshCwIcon, UploadIcon } from 'lucide-react';
import { nodeButtons } from '@/lib/node-buttons';
import { nanoid } from 'nanoid';
import type { MouseEvent, MouseEventHandler } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

// Hook pour la couleur de fond du canvas
const BG_STORAGE_KEY = 'tersa-canvas-bg-color';
const DEFAULT_BG = '#0a0a0a';

function useCanvasBgColor() {
  const [bgColor, setBgColor] = useState<string>(DEFAULT_BG);

  useEffect(() => {
    // Charger la couleur initiale
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(BG_STORAGE_KEY);
      if (stored) setBgColor(stored);
    }

    // Écouter les changements
    const handler = (e: Event) => {
      const customEvent = e as CustomEvent<string>;
      setBgColor(customEvent.detail);
    };

    window.addEventListener('tersa-bg-color-change', handler);
    return () => window.removeEventListener('tersa-bg-color-change', handler);
  }, []);

  return bgColor;
}

// Type pour l'historique
type HistoryState = {
  nodes: Node[];
  edges: Edge[];
};
import { useDebouncedCallback } from 'use-debounce';
import { ConnectionLine } from './connection-line';
import { edgeTypes } from './edges';
import { nodeTypes } from './nodes';
import { ProximityHandles } from './proximity-handles';
import { SelectionToolbar } from './selection-toolbar';
import { VideoSelectionToolbar } from './video-selection-toolbar';
import { toast } from 'sonner';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from './ui/context-menu';

// Types de nœuds qui supportent le remplacement de contenu
const REPLACEABLE_TYPES = ['text', 'image', 'video'];

// Vérifier si un nœud a du contenu
const nodeHasContent = (node: Node): boolean => {
  const data = node.data as Record<string, unknown>;
  return Boolean(data?.content || data?.generated || data?.text);
};

// Type pour une connexion en attente (pour le menu Replace/Connect)
type PendingConnection = {
  sourceId: string;
  targetId: string;
  sourceNode: Node;
  targetNode: Node;
  position: { x: number; y: number };
} | null;

type CanvasProps = ReactFlowProps & {
  initialNodes?: Node[];
  initialEdges?: Edge[];
  initialViewport?: { x: number; y: number; zoom: number };
  onAutoSave?: (nodes: Node[], edges: Edge[], viewport: { x: number; y: number; zoom: number }) => void;
};

export const Canvas = ({ children, ...props }: CanvasProps) => {
  const project = useProject();
  const canvasBgColor = useCanvasBgColor();
  const {
    onConnect,
    onConnectStart,
    onConnectEnd,
    onEdgesChange,
    onNodesChange,
    nodes: propsNodes,
    edges: propsEdges,
    initialNodes: localInitialNodes,
    initialEdges: localInitialEdges,
    initialViewport,
    onAutoSave,
    ...rest
  } = props ?? {};
  const content = project?.content as { nodes: Node[]; edges: Edge[] };
  const [nodes, setNodes] = useState<Node[]>(
    localInitialNodes ?? propsNodes ?? content?.nodes ?? []
  );
  const [edges, setEdges] = useState<Edge[]>(
    localInitialEdges ?? propsEdges ?? content?.edges ?? []
  );
  const [copiedNodes, setCopiedNodes] = useState<Node[]>([]);
  const [copiedEdges, setCopiedEdges] = useState<Edge[]>([]);
  const [pendingConnection, setPendingConnection] = useState<PendingConnection>(null);
  const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Historique pour undo/redo
  const historyRef = useRef<HistoryState[]>([]);
  const historyIndexRef = useRef<number>(-1);
  const isUndoingRef = useRef<boolean>(false);
  const historyInitializedRef = useRef<boolean>(false);
  const MAX_HISTORY = 50;

  const {
    getEdges,
    toObject,
    screenToFlowPosition,
    flowToScreenPosition,
    getNodes,
    getNode,
    updateNode,
  } = useReactFlow();
  const analytics = useAnalytics();
  const [saveState, setSaveState] = useSaveProject();

  const save = useDebouncedCallback(async () => {
    const flowObject = toObject();
    
    // Mode local avec onAutoSave
    if (onAutoSave) {
      onAutoSave(
        flowObject.nodes as Node[], 
        flowObject.edges as Edge[], 
        flowObject.viewport as { x: number; y: number; zoom: number }
      );
      return;
    }
    
    // Mode cloud avec project
    if (saveState.isSaving || !project?.userId || !project?.id) {
      return;
    }

    try {
      setSaveState((prev) => ({ ...prev, isSaving: true }));

      const response = await updateProjectAction(project.id, {
        content: flowObject,
      });

      if ('error' in response) {
        throw new Error(response.error);
      }

      setSaveState((prev) => ({ ...prev, lastSaved: new Date() }));
    } catch (error) {
      handleError('Error saving project', error);
    } finally {
      setSaveState((prev) => ({ ...prev, isSaving: false }));
    }
  }, 1000);

  // Initialiser l'historique avec l'état actuel au premier changement
  useEffect(() => {
    if (!historyInitializedRef.current && nodes.length > 0) {
      historyRef.current = [{
        nodes: JSON.parse(JSON.stringify(nodes)),
        edges: JSON.parse(JSON.stringify(edges)),
      }];
      historyIndexRef.current = 0;
      historyInitializedRef.current = true;
    }
  }, [nodes, edges]);

  // Sauvegarder l'état actuel dans l'historique
  const pushHistory = useCallback(() => {
    if (isUndoingRef.current) return;
    
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(nodes)),
      edges: JSON.parse(JSON.stringify(edges)),
    };
    
    // Supprimer les états futurs si on a fait des undos
    if (historyIndexRef.current < historyRef.current.length - 1) {
      historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    }
    
    historyRef.current.push(currentState);
    historyIndexRef.current = historyRef.current.length - 1;
    
    // Limiter la taille de l'historique
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
      historyIndexRef.current--;
    }
    
    console.log('[History] Pushed state, index:', historyIndexRef.current, 'length:', historyRef.current.length);
  }, [nodes, edges]);

  // Undo - revenir à l'état précédent
  const undo = useCallback(() => {
    console.log('[Undo] Called, index:', historyIndexRef.current, 'length:', historyRef.current.length);
    
    if (historyIndexRef.current <= 0) {
      console.log('[Undo] Cannot undo - at beginning of history');
      return;
    }
    
    isUndoingRef.current = true;
    historyIndexRef.current--;
    const previousState = historyRef.current[historyIndexRef.current];
    
    if (previousState) {
      console.log('[Undo] Restoring state with', previousState.nodes.length, 'nodes');
      setNodes(JSON.parse(JSON.stringify(previousState.nodes)));
      setEdges(JSON.parse(JSON.stringify(previousState.edges)));
    }
    
    setTimeout(() => {
      isUndoingRef.current = false;
      save();
    }, 100);
  }, [save]);

  // Redo - aller à l'état suivant
  const redo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    
    isUndoingRef.current = true;
    historyIndexRef.current++;
    const nextState = historyRef.current[historyIndexRef.current];
    
    if (nextState) {
      setNodes(JSON.parse(JSON.stringify(nextState.nodes)));
      setEdges(JSON.parse(JSON.stringify(nextState.edges)));
    }
    
    setTimeout(() => {
      isUndoingRef.current = false;
      save();
    }, 100);
  }, [save]);

  // Hotkeys pour undo/redo - utiliser useEffect avec event listener natif
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z ou Ctrl+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        console.log('[Hotkey] Cmd+Z pressed');
        undo();
      }
      // Cmd+Shift+Z ou Ctrl+Shift+Z
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault();
        console.log('[Hotkey] Cmd+Shift+Z pressed');
        redo();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo]);

  const handleNodesChange = useCallback<OnNodesChange>(
    (changes) => {
      // Sauvegarder l'historique AVANT les changements significatifs (add, remove)
      const hasSignificantChange = changes.some(
        (c) => c.type === 'add' || c.type === 'remove'
      );
      
      setNodes((current) => {
        // Sauvegarder l'état actuel AVANT d'appliquer les changements
        if (hasSignificantChange && !isUndoingRef.current) {
          const currentState: HistoryState = {
            nodes: JSON.parse(JSON.stringify(current)),
            edges: JSON.parse(JSON.stringify(edges)),
          };
          
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
          }
          
          historyRef.current.push(currentState);
          historyIndexRef.current = historyRef.current.length - 1;
          
          if (historyRef.current.length > MAX_HISTORY) {
            historyRef.current.shift();
            historyIndexRef.current--;
          }
          
          console.log('[History] Pushed state before node change, index:', historyIndexRef.current);
        }
        
        const updated = applyNodeChanges(changes, current);
        save();
        onNodesChange?.(changes);
        return updated;
      });
    },
    [save, onNodesChange, edges]
  );

  const handleEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      // Sauvegarder l'historique AVANT les changements significatifs (add, remove)
      const hasSignificantChange = changes.some(
        (c) => c.type === 'add' || c.type === 'remove'
      );
      
      setEdges((current) => {
        // Sauvegarder l'état actuel AVANT d'appliquer les changements
        if (hasSignificantChange && !isUndoingRef.current) {
          const currentState: HistoryState = {
            nodes: JSON.parse(JSON.stringify(nodes)),
            edges: JSON.parse(JSON.stringify(current)),
          };
          
          if (historyIndexRef.current < historyRef.current.length - 1) {
            historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
          }
          
          historyRef.current.push(currentState);
          historyIndexRef.current = historyRef.current.length - 1;
          
          if (historyRef.current.length > MAX_HISTORY) {
            historyRef.current.shift();
            historyIndexRef.current--;
          }
          
          console.log('[History] Pushed state before edge change, index:', historyIndexRef.current);
        }
        
        const updated = applyEdgeChanges(changes, current);
        save();
        onEdgesChange?.(changes);
        return updated;
      });
    },
    [save, onEdgesChange, nodes]
  );

  const handleConnect = useCallback<OnConnect>(
    (connection, event?: globalThis.MouseEvent) => {
      const sourceNode = getNodes().find((n) => n.id === connection.source);
      const targetNode = getNodes().find((n) => n.id === connection.target);

      // Connexion vers un Collection Node - ajouter l'item à la collection
      if (
        sourceNode &&
        targetNode?.type === 'collection' &&
        ['image', 'video', 'audio', 'text'].includes(sourceNode.type || '')
      ) {
        const sourceData = sourceNode.data as Record<string, unknown>;
        const generated = sourceData.generated as { url?: string; width?: number; height?: number; duration?: number; text?: string } | undefined;
        const content = sourceData.content as { url?: string } | string | undefined;
        
        // Extraire les données selon le type
        let url: string | undefined;
        let width: number | undefined;
        let height: number | undefined;
        let duration: number | undefined;
        let text: string | undefined;

        if (sourceNode.type === 'image') {
          const contentUrl = typeof content === 'object' ? content?.url : undefined;
          url = generated?.url || contentUrl;
          width = generated?.width || (sourceData.width as number);
          height = generated?.height || (sourceData.height as number);
        } else if (sourceNode.type === 'video') {
          const contentUrl = typeof content === 'object' ? content?.url : undefined;
          url = generated?.url || contentUrl;
          width = generated?.width || (sourceData.width as number) || 1920;
          height = generated?.height || (sourceData.height as number) || 1080;
        } else if (sourceNode.type === 'audio') {
          const contentUrl = typeof content === 'object' ? content?.url : undefined;
          url = generated?.url || contentUrl;
          duration = generated?.duration || (sourceData.duration as number);
        } else if (sourceNode.type === 'text') {
          text = generated?.text || (typeof content === 'string' ? content : undefined) || (sourceData.text as string);
        }

        // Créer le nouvel item
        const newItemId = nanoid();
        const newItem = {
          id: newItemId,
          type: sourceNode.type as 'image' | 'video' | 'audio' | 'text',
          enabled: true,
          url,
          width,
          height,
          duration,
          text,
          name: (sourceData.customName as string) || undefined,
        };

        // Mettre à jour la collection
        const collectionData = targetNode.data as { 
          items?: unknown[]; 
          collapsed?: boolean;
          presets?: Array<{ id: string; name: string; itemStates: Record<string, boolean> }>;
        };
        const existingItems = (collectionData.items || []) as unknown[];
        
        // Ajouter le nouvel item comme ON dans tous les presets existants
        const updatedPresets = (collectionData.presets || []).map(preset => ({
          ...preset,
          itemStates: { ...preset.itemStates, [newItemId]: true }
        }));
        
        setNodes((nds) =>
          nds.map((n) =>
            n.id === targetNode.id
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    items: [...existingItems, newItem],
                    presets: updatedPresets,
                    collapsed: false, // Ouvrir la collection
                    activeTab: sourceNode.type, // Aller à l'onglet correspondant
                  },
                }
              : n
          )
        );

        save();
        toast.success('Élément ajouté à la collection');
        return; // Pas d'edge créé
      }

      // Vérifier si c'est une connexion "remplaçable"
      // (même type, les deux ont du contenu)
      if (
        sourceNode &&
        targetNode &&
        sourceNode.type === targetNode.type &&
        REPLACEABLE_TYPES.includes(sourceNode.type || '') &&
        nodeHasContent(sourceNode) &&
        nodeHasContent(targetNode)
      ) {
        // Stocker la connexion en attente et afficher le menu
        setPendingConnection({
          sourceId: connection.source!,
          targetId: connection.target!,
          sourceNode,
          targetNode,
          position: { x: (event as MouseEvent)?.clientX || 0, y: (event as MouseEvent)?.clientY || 0 },
        });

        // Créer un edge temporaire "replace" pour montrer visuellement
        const tempEdge: Edge = {
          id: `pending-${nanoid()}`,
          type: 'replace',
          source: connection.source!,
          target: connection.target!,
        };
        setEdges((eds: Edge[]) => eds.concat(tempEdge));

        return;
      }

      // Connexion normale
      const newEdge: Edge = {
        id: nanoid(),
        type: 'flora',
        ...connection,
      };
      setEdges((eds: Edge[]) => eds.concat(newEdge));
      save();
      onConnect?.(connection);
    },
    [save, onConnect, getNodes]
  );

  // Confirmer la connexion normale (depuis le menu Replace/Connect)
  const confirmNormalConnection = useCallback(() => {
    if (!pendingConnection) return;

    // Supprimer l'edge temporaire et créer l'edge normal
    setEdges((eds: Edge[]) => {
      const filtered = eds.filter(
        (e) =>
          !(e.source === pendingConnection.sourceId && e.target === pendingConnection.targetId && e.type === 'replace')
      );
      return filtered.concat({
        id: nanoid(),
        type: 'flora',
        source: pendingConnection.sourceId,
        target: pendingConnection.targetId,
      });
    });

    setPendingConnection(null);
    save();
  }, [pendingConnection, save]);

  // Réinitialiser récursivement tous les nœuds connectés en sortie (outgoers)
  const resetOutgoers = useCallback((startNodeId: string, visitedIds = new Set<string>()) => {
    if (visitedIds.has(startNodeId)) return;
    visitedIds.add(startNodeId);

    const nodes = getNodes();
    const edges = getEdges();
    const currentNode = nodes.find(n => n.id === startNodeId);
    
    if (!currentNode) return;

    const outgoers = getOutgoers(currentNode, nodes, edges);

    for (const outgoer of outgoers) {
      setNodes((nds: Node[]) =>
        nds.map((n) =>
          n.id === outgoer.id
            ? {
                ...n,
                data: {
                  ...n.data,
                  generated: undefined,
                  generating: false,
                  batchGenerating: false,
                  generatingStartTime: undefined,
                  batchStartTime: undefined,
                },
              }
            : n
        )
      );
      resetOutgoers(outgoer.id, visitedIds);
    }
  }, [getNodes, getEdges]);

  // Remplacer le contenu du nœud cible par celui du source
  const confirmReplaceConnection = useCallback(() => {
    if (!pendingConnection) return;

    const { sourceId, targetId } = pendingConnection;
    
    // Récupérer les données FRAÎCHES des nœuds (pas celles capturées)
    const freshSourceNode = getNode(sourceId);
    const freshTargetNode = getNode(targetId);
    
    console.log('[Replace] sourceId:', sourceId);
    console.log('[Replace] targetId:', targetId);
    console.log('[Replace] freshSourceNode:', freshSourceNode);
    console.log('[Replace] freshTargetNode:', freshTargetNode);
    
    if (!freshSourceNode || !freshTargetNode) {
      console.log('[Replace] ABORT: nodes not found');
      setPendingConnection(null);
      return;
    }

    const sourceData = freshSourceNode.data as Record<string, unknown>;
    console.log('[Replace] sourceData:', sourceData);

    // Copier TOUT le contenu du source (copie profonde complète)
    const newData = JSON.parse(JSON.stringify(sourceData));
    console.log('[Replace] newData:', newData);

    // Utiliser updateNode de ReactFlow pour mettre à jour le nœud cible
    updateNode(targetId, { data: newData });
    console.log('[Replace] updateNode called');

    // Réinitialiser les nœuds en aval du nœud cible
    resetOutgoers(targetId);

    // Supprimer l'edge temporaire - PAS de connexion créée en mode Replace
    setEdges((eds: Edge[]) =>
      eds.filter((e) => e.type !== 'replace')
    );

    setPendingConnection(null);
    save();
    console.log('[Replace] Done!');
  }, [pendingConnection, save, resetOutgoers, updateNode, getNode]);

  // Annuler la connexion en attente
  const cancelPendingConnection = useCallback(() => {
    if (!pendingConnection) return;

    // Supprimer l'edge temporaire
    setEdges((eds: Edge[]) =>
      eds.filter(
        (e) =>
          !(e.source === pendingConnection.sourceId && e.target === pendingConnection.targetId && e.type === 'replace')
      )
    );

    setPendingConnection(null);
  }, [pendingConnection]);

  const addNode = useCallback(
    (type: string, options?: Record<string, unknown>) => {
      const { data: nodeData, ...rest } = options ?? {};
      const newNode: Node = {
        id: nanoid(),
        type,
        data: {
          ...(nodeData ? nodeData : {}),
        },
        position: { x: 0, y: 0 },
        origin: [0, 0.5],
        ...rest,
      };

      setNodes((nds: Node[]) => nds.concat(newNode));
      save();

      analytics.track('toolbar', 'node', 'added', {
        type,
      });

      return newNode.id;
    },
    [save, analytics]
  );

  const duplicateNode = useCallback(
    (id: string) => {
      const node = getNode(id);

      if (!node || !node.type) {
        return;
      }

      const { id: oldId, ...rest } = node;

      const newId = addNode(node.type, {
        ...rest,
        position: {
          x: node.position.x + 200,
          y: node.position.y + 200,
        },
        selected: true,
      });

      setTimeout(() => {
        updateNode(id, { selected: false });
        updateNode(newId, { selected: true });
      }, 0);
    },
    [addNode, getNode, updateNode]
  );

  const handleConnectEnd = useCallback<OnConnectEnd>(
    (event, connectionState) => {
      // when a connection is dropped on the pane it's not valid

      if (!connectionState.isValid) {
        // we need to remove the wrapper bounds, in order to get the correct position
        const { clientX, clientY } =
          'changedTouches' in event ? event.changedTouches[0] : event;

        const sourceNode = connectionState.fromNode;
        const sourceId = sourceNode?.id;
        const isSourceHandle = connectionState.fromHandle?.type === 'source';

        if (!sourceId || !sourceNode) {
          return;
        }

        // Vérifier si on a lâché près d'un nœud (toNode existe dans connectionState)
        const toNode = connectionState.toNode;
        
        // Si on a un nœud cible de même type avec contenu, proposer Replace
        if (toNode && sourceNode.type === toNode.type && REPLACEABLE_TYPES.includes(sourceNode.type || '')) {
          const sourceData = sourceNode.data as Record<string, unknown>;
          const toData = toNode.data as Record<string, unknown>;
          const sourceHasContent = Boolean(sourceData?.content || sourceData?.generated || sourceData?.text);
          const toHasContent = Boolean(toData?.content || toData?.generated || toData?.text);
          
          if (sourceHasContent && toHasContent) {
            // Afficher le menu Replace/Connect
            setPendingConnection({
              sourceId: sourceId,
              targetId: toNode.id,
              sourceNode: sourceNode as Node,
              targetNode: toNode as Node,
              position: { x: clientX, y: clientY },
            });

            // Créer un edge temporaire "replace"
            setEdges((eds: Edge[]) =>
              eds.concat({
                id: `pending-${nanoid()}`,
                type: 'replace',
                source: sourceId,
                target: toNode.id,
              })
            );
            return;
          }
        }

        // Sinon, créer un DropNode comme avant
        const sourceData = sourceNode.data as Record<string, unknown>;
        const sourceHasContent = Boolean(
          sourceData?.content || sourceData?.generated || sourceData?.text
        );

        const newNodeId = addNode('drop', {
          position: screenToFlowPosition({ x: clientX, y: clientY }),
          data: {
            isSource: !isSourceHandle,
            // Passer les infos du nœud source pour l'option "Replace"
            sourceNodeType: sourceNode.type,
            sourceNodeId: sourceId,
            sourceHasContent,
          },
        });

        setEdges((eds: Edge[]) =>
          eds.concat({
            id: nanoid(),
            source: isSourceHandle ? sourceId : newNodeId,
            target: isSourceHandle ? newNodeId : sourceId,
            type: 'temporary',
          })
        );
      }
    },
    [addNode, screenToFlowPosition]
  );

  const isValidConnection = useCallback<IsValidConnection>(
    (connection) => {
      // we are using getNodes and getEdges helpers here
      // to make sure we create isValidConnection function only once
      const nodes = getNodes();
      const edges = getEdges();
      const target = nodes.find((node) => node.id === connection.target);

      // Prevent connecting audio nodes to anything except transcribe nodes
      if (connection.source) {
        const source = nodes.find((node) => node.id === connection.source);

        if (!source || !target) {
          return false;
        }

        const valid = isValidSourceTarget(source, target);

        if (!valid) {
          return false;
        }
      }

      // Prevent cycles
      const hasCycle = (node: Node, visited = new Set<string>()) => {
        if (visited.has(node.id)) {
          return false;
        }

        visited.add(node.id);

        for (const outgoer of getOutgoers(node, nodes, edges)) {
          if (outgoer.id === connection.source || hasCycle(outgoer, visited)) {
            return true;
          }
        }
      };

      if (!target || target.id === connection.source) {
        return false;
      }

      return !hasCycle(target);
    },
    [getNodes, getEdges]
  );

  const handleConnectStart = useCallback<OnConnectStart>(() => {
    // Delete any drop nodes when starting to drag a node
    setNodes((nds: Node[]) => nds.filter((n: Node) => n.type !== 'drop'));
    setEdges((eds: Edge[]) => eds.filter((e: Edge) => e.type !== 'temporary'));
    save();
  }, [save]);

  const addDropNode = useCallback<MouseEventHandler<HTMLDivElement>>(
    (event) => {
      if (!(event.target instanceof HTMLElement)) {
        return;
      }

      const { x, y } = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });

      addNode('drop', {
        position: { x, y },
      });
    },
    [addNode, screenToFlowPosition]
  );

  const handleSelectAll = useCallback(() => {
    setNodes((nodes: Node[]) =>
      nodes.map((node: Node) => ({ ...node, selected: true }))
    );
  }, []);

  // Import de fichier via input file caché
  const handleFileImport = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !contextMenuPosition) return;

    const { x, y } = screenToFlowPosition({
      x: contextMenuPosition.x,
      y: contextMenuPosition.y,
    });

    // Déterminer le type de nœud basé sur le type MIME
    let nodeType: string;
    if (file.type.startsWith('image/')) {
      nodeType = 'image';
    } else if (file.type.startsWith('video/')) {
      nodeType = 'video';
    } else if (file.type.startsWith('audio/')) {
      nodeType = 'audio';
    } else if (file.type.startsWith('text/') || file.type === 'application/json') {
      nodeType = 'text';
    } else {
      nodeType = 'file';
    }

    try {
      // Uploader le fichier
      const { uploadFile } = await import('@/lib/upload');
      const { url, type } = await uploadFile(file, 'files');

      // Créer le nœud avec le contenu uploadé
      addNode(nodeType, {
        position: { x, y },
        data: {
          content: {
            url,
            type,
            name: file.name,
          },
        },
      });
    } catch (error) {
      console.error('Erreur lors de l\'import:', error);
      toast.error('Erreur lors de l\'import du fichier');
    }

    // Réinitialiser l'input pour permettre de re-sélectionner le même fichier
    event.target.value = '';
  }, [addNode, screenToFlowPosition, contextMenuPosition]);

  // Fonction pour copie profonde des données d'un nœud
  const deepCloneNodeData = useCallback((data: Record<string, unknown>): Record<string, unknown> => {
    return JSON.parse(JSON.stringify(data));
  }, []);

  const handleCopy = useCallback(() => {
    const selectedNodes = getNodes().filter((node) => node.selected);
    if (selectedNodes.length > 0) {
      // Copie profonde des nœuds pour préserver tous leurs attributs
      const nodesToCopy = selectedNodes.map((node) => ({
        ...node,
        // Copie profonde des données pour préserver le statut généré, content, etc.
        data: deepCloneNodeData(node.data as Record<string, unknown>),
      }));
      setCopiedNodes(nodesToCopy);
      
      // Copier aussi les edges entre les nœuds sélectionnés
      const selectedNodeIds = new Set(selectedNodes.map(n => n.id));
      const edgesBetweenSelected = getEdges().filter(
        (edge) => selectedNodeIds.has(edge.source) && selectedNodeIds.has(edge.target)
      );
      // Copie profonde des edges pour préserver leur type (animated, etc.)
      const edgesToCopy = edgesBetweenSelected.map((edge) => ({
        ...edge,
        // Copier toutes les propriétés de l'edge
        data: edge.data ? deepCloneNodeData(edge.data as Record<string, unknown>) : undefined,
      }));
      setCopiedEdges(edgesToCopy);
    }
  }, [getNodes, getEdges, deepCloneNodeData]);

  const handlePaste = useCallback(() => {
    if (copiedNodes.length === 0) {
      return;
    }

    // Créer un mapping ancien ID -> nouveau ID
    const idMapping = new Map<string, string>();
    
    const newNodes = copiedNodes.map((node) => {
      const newId = nanoid();
      idMapping.set(node.id, newId);
      
      // Copie profonde des données pour préserver le statut généré/non-généré
      const clonedData = deepCloneNodeData(node.data as Record<string, unknown>);
      
      return {
        // Spread toutes les propriétés du nœud (incluant type, origin, measured, etc.)
        ...node,
        // Nouveau ID unique
        id: newId,
        // Préserver explicitement le type du nœud
        type: node.type,
        // Nouvelle position décalée
        position: {
          x: node.position.x + 100,
          y: node.position.y + 100,
        },
        // Sélectionner les nouveaux nœuds
        selected: true,
        // Copie profonde de toutes les données (content, generated, model, instructions, etc.)
        data: clonedData,
      };
    });

    // Recréer les edges avec les nouveaux IDs tout en préservant leur type
    const newEdges = copiedEdges.map((edge) => ({
      // Spread toutes les propriétés de l'edge (incluant type: 'animated', etc.)
      ...edge,
      // Nouveau ID unique pour l'edge
      id: nanoid(),
      // Mapper vers les nouveaux IDs des nœuds
      source: idMapping.get(edge.source) || edge.source,
      target: idMapping.get(edge.target) || edge.target,
      // Préserver explicitement le type de l'edge
      type: edge.type,
      // Copier les données de l'edge si présentes
      data: edge.data ? deepCloneNodeData(edge.data as Record<string, unknown>) : undefined,
    }));

    // Désélectionner tous les nœuds existants
    setNodes((nodes: Node[]) =>
      nodes.map((node: Node) => ({
        ...node,
        selected: false,
      }))
    );

    // Ajouter les nouveaux nœuds avec leur type et données préservés
    setNodes((nodes: Node[]) => [...nodes, ...newNodes]);
    
    // Ajouter les nouvelles connexions avec leur type préservé
    if (newEdges.length > 0) {
      setEdges((edges: Edge[]) => [...edges, ...newEdges]);
    }
    
    save();
  }, [copiedNodes, copiedEdges, save, deepCloneNodeData]);

  const handleDuplicateAll = useCallback(() => {
    const selected = getNodes().filter((node) => node.selected);

    for (const node of selected) {
      duplicateNode(node.id);
    }
  }, [getNodes, duplicateNode]);

  const handleContextMenu = useCallback((event: MouseEvent) => {
    // Stocker la position du clic droit pour créer le nœud à cet endroit
    setContextMenuPosition({ x: event.clientX, y: event.clientY });
    
    if (
      !(event.target instanceof HTMLElement) ||
      !event.target.classList.contains('react-flow__pane')
    ) {
      event.preventDefault();
    }
  }, []);

  useHotkeys('meta+a', handleSelectAll, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+d', handleDuplicateAll, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+c', handleCopy, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  useHotkeys('meta+v', handlePaste, {
    enableOnContentEditable: false,
    preventDefault: true,
  });

  // Labels pour les types de nœuds
  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      text: 'le texte',
      image: "l'image",
      video: 'la vidéo',
    };
    return labels[type] || type;
  };

  // Calculer la couleur des points de la grille en fonction du fond
  const gridColor = (() => {
    // Convertir hex en luminosité approximative
    const hex = canvasBgColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    // Si fond sombre, points clairs et vice versa
    return luminance < 0.5 ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  })();

  return (
    <NodeOperationsProvider addNode={addNode} duplicateNode={duplicateNode}>
      <NodeDropzoneProvider>
        <ContextMenu>
          <ContextMenuTrigger onContextMenu={handleContextMenu}>
            <ReactFlow
              deleteKeyCode={['Backspace', 'Delete']}
              nodes={nodes}
              onNodesChange={handleNodesChange}
              edges={edges}
              onEdgesChange={handleEdgesChange}
              onConnectStart={handleConnectStart}
              onConnect={handleConnect}
              onConnectEnd={handleConnectEnd}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              isValidConnection={isValidConnection}
              connectionLineComponent={ConnectionLine}
              panOnScroll
              fitView={!initialViewport}
              defaultViewport={initialViewport}
              zoomOnDoubleClick={false}
              panOnDrag={false}
              selectionOnDrag={true}
              onDoubleClick={addDropNode}
              minZoom={0.02}
              maxZoom={4}
              style={{ '--canvas-bg-color': canvasBgColor } as React.CSSProperties}
              proOptions={{ hideAttribution: true }}
              {...rest}
            >
              <Background 
                color={gridColor} 
                gap={20}
              />
              <ProximityHandles />
              <SelectionToolbar
                onCreateCollection={(nodeIds, category) => {
                  // Récupérer les nœuds sélectionnés
                  const selectedNodes = getNodes().filter((n) => nodeIds.includes(n.id));
                  if (selectedNodes.length < 2) return;

                  // Convertir les nœuds en items de collection
                  const items = selectedNodes
                    .filter((node) => ['image', 'video', 'audio', 'text'].includes(node.type || ''))
                    .map((node) => {
                      const data = node.data as Record<string, unknown>;
                      const generated = data.generated as { url?: string; width?: number; height?: number; duration?: number; text?: string } | undefined;
                      const content = data.content as { url?: string } | string | undefined;
                      
                      // Extraire l'URL et les dimensions selon le type
                      let url: string | undefined;
                      let width: number | undefined;
                      let height: number | undefined;
                      let duration: number | undefined;
                      let text: string | undefined;

                      if (node.type === 'image') {
                        // content peut être un objet {url, type} ou undefined
                        const contentUrl = typeof content === 'object' ? content?.url : undefined;
                        url = generated?.url || contentUrl;
                        width = generated?.width || (data.width as number);
                        height = generated?.height || (data.height as number);
                      } else if (node.type === 'video') {
                        const contentUrl = typeof content === 'object' ? content?.url : undefined;
                        url = generated?.url || contentUrl;
                        width = generated?.width || (data.width as number) || 1920;
                        height = generated?.height || (data.height as number) || 1080;
                      } else if (node.type === 'audio') {
                        const contentUrl = typeof content === 'object' ? content?.url : undefined;
                        url = generated?.url || contentUrl;
                        duration = generated?.duration || (data.duration as number);
                      } else if (node.type === 'text') {
                        // Pour le texte, content est une string ou generated.text
                        text = generated?.text || (typeof content === 'string' ? content : undefined) || (data.text as string);
                      }

                      return {
                        id: nanoid(),
                        type: node.type as 'image' | 'video' | 'audio' | 'text',
                        enabled: true,
                        url,
                        width,
                        height,
                        duration,
                        text,
                        name: (data.customName as string) || undefined,
                      };
                    });

                  if (items.length === 0) {
                    toast.error('Aucun élément compatible pour la collection');
                    return;
                  }

                  // Calculer la position moyenne pour placer la collection
                  const avgX = selectedNodes.reduce((sum, n) => sum + n.position.x, 0) / selectedNodes.length;
                  const avgY = selectedNodes.reduce((sum, n) => sum + n.position.y, 0) / selectedNodes.length;

                  // Créer le nœud collection
                  const collectionId = nanoid();
                  const collectionNode = {
                    id: collectionId,
                    type: 'collection',
                    position: { x: avgX, y: avgY },
                    data: {
                      label: 'Collection',
                      items,
                      headerColor: category.color,
                      categoryId: category.id,
                    },
                  };

                  // Ajouter la collection et désélectionner les nœuds
                  setNodes((nds) => [
                    ...nds.map((n) => ({ ...n, selected: false })),
                    collectionNode,
                  ]);

                  save();
                  toast.success(`Collection créée avec ${items.length} éléments`);
                }}
                onAutoformat={(nodeIds) => {
                  // Récupérer les nœuds sélectionnés
                  const selectedNodes = getNodes().filter((n) => nodeIds.includes(n.id));
                  if (selectedNodes.length < 2) return;

                  // Trouver le coin supérieur gauche de la sélection
                  const minX = Math.min(...selectedNodes.map((n) => n.position.x));
                  const minY = Math.min(...selectedNodes.map((n) => n.position.y));

                  // Calculer la taille moyenne des nœuds pour l'espacement
                  const avgWidth = selectedNodes.reduce((sum, n) => sum + (n.measured?.width ?? 300), 0) / selectedNodes.length;
                  const avgHeight = selectedNodes.reduce((sum, n) => sum + (n.measured?.height ?? 200), 0) / selectedNodes.length;
                  
                  // Espacement entre les nœuds
                  const gapX = avgWidth + 50;
                  const gapY = avgHeight + 50;

                  // Calculer le nombre de colonnes (racine carrée arrondie)
                  const cols = Math.ceil(Math.sqrt(selectedNodes.length));

                  // Trier les nœuds par position (haut-gauche vers bas-droite) pour un ordre prévisible
                  const sortedNodes = [...selectedNodes].sort((a, b) => {
                    const rowA = Math.floor(a.position.y / 100);
                    const rowB = Math.floor(b.position.y / 100);
                    if (rowA !== rowB) return rowA - rowB;
                    return a.position.x - b.position.x;
                  });

                  // Appliquer les nouvelles positions en grille
                  setNodes((nds) =>
                    nds.map((node) => {
                      const idx = sortedNodes.findIndex((n) => n.id === node.id);
                      if (idx === -1) return node;

                      const col = idx % cols;
                      const row = Math.floor(idx / cols);

                      return {
                        ...node,
                        position: {
                          x: minX + col * gapX,
                          y: minY + row * gapY,
                        },
                      };
                    })
                  );

                  save();
                  toast.success(`${nodeIds.length} nœuds arrangés`);
                }}
              />
              <VideoSelectionToolbar />
              {children}
              
              {/* Menu flottant Replace/Connect */}
              {pendingConnection && (() => {
                const screenPos = flowToScreenPosition({
                  x: pendingConnection.targetNode.position.x + 250,
                  y: pendingConnection.targetNode.position.y + 50,
                });
                return (
                  <div
                    className="fixed z-[9999] min-w-[180px] rounded-lg border bg-popover/95 backdrop-blur-sm p-1 shadow-lg"
                    style={{
                      left: screenPos.x,
                      top: screenPos.y,
                    }}
                  >
                    <button
                      onClick={confirmReplaceConnection}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      <RefreshCwIcon size={12} />
                      <span>Remplacer {getTypeLabel(pendingConnection.sourceNode.type || '')}</span>
                    </button>
                    <div className="my-1 h-px bg-border" />
                    <button
                      onClick={confirmNormalConnection}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-accent transition-colors"
                    >
                      <LinkIcon size={12} />
                      <span>Connecter normalement</span>
                    </button>
                    <button
                      onClick={cancelPendingConnection}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                    >
                      <span>Annuler</span>
                    </button>
                  </div>
                );
              })()}
            </ReactFlow>
          </ContextMenuTrigger>
          <ContextMenuContent>
            {nodeButtons
              .filter((button) => button.id !== 'file' && button.id !== 'tweet')
              .map((button) => (
                <ContextMenuItem
                  key={button.id}
                  onClick={() => {
                    // Utiliser la position du clic droit pour créer le nœud
                    const { x, y } = screenToFlowPosition({
                      x: contextMenuPosition?.x ?? 0,
                      y: contextMenuPosition?.y ?? 0,
                    });
                    addNode(button.id, {
                      position: { x, y },
                      data: button.data ?? {},
                    });
                  }}
                >
                  <button.icon size={12} />
                  <span>{button.label}</span>
                </ContextMenuItem>
              ))}
            <ContextMenuSeparator />
            <ContextMenuItem
              onClick={() => {
                // Déclencher le file picker
                fileInputRef.current?.click();
              }}
            >
              <UploadIcon size={12} />
              <span>Importer un fichier</span>
            </ContextMenuItem>
          </ContextMenuContent>
        </ContextMenu>
        {/* Input file caché pour l'import de fichiers */}
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          accept="image/*,video/*,audio/*,text/*,.pdf,.json,.md,.txt"
          onChange={handleFileImport}
        />
      </NodeDropzoneProvider>
    </NodeOperationsProvider>
  );
};
