/** UI-only metadata per node type: icon and library group. The table itself lives with the node families. */
export type IconKey = 'bolt' | 'doc' | 'term' | 'mic' | 'wave' | 'layers' | 'chip' | 'screen' | 'down' | 'branch' | 'bot';
export type LibraryGroup = 'source' | 'look' | 'provider' | 'process' | 'engine' | 'output';

export type NodeMeta = { icon: IconKey; group: LibraryGroup | string };

export const GROUP_ORDER: LibraryGroup[] = ['source', 'look', 'provider', 'process', 'engine', 'output'];

export { NODE_META } from '@/nodes/index.client';
