/**
 * UI-only metadata per node type: icon and library group. The table itself lives with the node families.
 * The group is the only way nodes are sorted for the user; a node missing from the table lands in Other.
 */
export type IconKey = 'bolt' | 'doc' | 'term' | 'mic' | 'wave' | 'layers' | 'chip' | 'screen' | 'down' | 'branch' | 'bot';
export type LibraryGroup = 'source' | 'script' | 'visual' | 'audio' | 'output' | 'resource' | 'other';

export type NodeMeta = { icon: IconKey; group: LibraryGroup };

/**
 * Every group there is, in the order the Library shows them: the five steps of the pipeline in the
 * order a video is made, then the resource nodes, which are wired in from the side rather than along it.
 */
export const GROUP_ORDER: LibraryGroup[] = ['source', 'script', 'visual', 'audio', 'output', 'resource', 'other'];

export { NODE_META } from '@/nodes/index.client';
