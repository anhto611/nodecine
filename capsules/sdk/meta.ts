/**
 * What the Studio needs to know about a node beyond its definition: how it looks in the Library.
 * Declared in each node's manifest; the types live here so a capsule and the Studio mean the same.
 */
export type IconKey = 'bolt' | 'doc' | 'term' | 'mic' | 'wave' | 'layers' | 'chip' | 'screen' | 'down' | 'branch' | 'bot' | 'brush';
export type LibraryGroup = 'source' | 'script' | 'visual' | 'audio' | 'output' | 'resource' | 'other';

export type NodeMeta = { icon: IconKey; group: LibraryGroup; layout?: 'wide' };

/**
 * Every group there is, in the order the Library shows them: the steps of the pipeline in the order
 * a video is made, then the rest. A node whose group is missing lands in Other.
 */
export const GROUP_ORDER: LibraryGroup[] = ['source', 'script', 'visual', 'audio', 'output', 'resource', 'other'];

/** What every node body receives. */
export type BodyProps = { nodeId: string };
