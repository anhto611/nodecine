export interface StockRequest { provider: 'pexels' | 'pixabay'; query: string; orientation: 'landscape' | 'portrait' | 'square'; longEdge: number; want: 'auto' | 'clip' | 'still'; used: string[] }
export interface StockResult { kind: 'clip' | 'photo'; assetUrl: string; author: string; page: string; width: number; height: number; durationSec?: number }
