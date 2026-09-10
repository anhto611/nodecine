export interface ReadPageOptions { screenshot: boolean; width: number; height: number }
export interface PageRead { url: string; domain: string; title?: string; description?: string; siteName?: string; publishedAt?: string; pictureAsset?: string; screenshotAsset?: string; shotProblem?: string }
