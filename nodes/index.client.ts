'use client';
import type React from 'react';
import type { BodyProps } from './kit';
import type { NodeMeta } from '@/lib/node-meta';
import { InputTriggerBody } from './input/body';
import { GithubFetcherBody } from './github/body';
import { WebFetcherBody } from './web/body';
import { StaticScriptBody } from './script/body';
import { ArtDirectorBody } from './art-director/body';
import { ScreenwriterBody } from './screenwriter/body';
import { StockMediaBody } from './stock/body';
import { SceneBreakdownBody } from './breakdown/body';
import { EngineBody, LlmProviderBody, TtsProviderBody } from './resources/body';
import { TtsBody } from './tts/body';
import { TranscribeBody } from './transcribe/body';
import { AudioMixBody } from './audio/body';
import { AudioInputBody } from './audio/import-body';
import { CaptionsBody } from './captions/body';
import { CaptionExportBody } from './captions/export-body';
import { AssemblerBody } from './assembler/body';
import { ExportBody } from './output/export-body';
import { CoverBody } from './output/cover-body';
import { VideoOutputBody } from './output/video-output-body';

/** The Studio side of every node family: the body each node type draws, and its icon and library group. */
export const NODE_BODIES: Record<string, React.FC<BodyProps>> = {
  'core/input-trigger': InputTriggerBody,
  'core/github-fetcher': GithubFetcherBody,
  'core/web-fetcher': WebFetcherBody,
  'core/static-script': StaticScriptBody,
  'core/stock-media': StockMediaBody,
  'core/scene-breakdown': SceneBreakdownBody,
  'core/art-director': ArtDirectorBody,
  'core/screenwriter': ScreenwriterBody,
  'core/llm-provider': LlmProviderBody,
  'core/tts-provider': TtsProviderBody,
  'core/remotion-engine': EngineBody,
  'core/hyperframes-engine': EngineBody,
  'core/tts-engine': TtsBody,
  'core/transcribe': TranscribeBody,
  'core/audio-input': AudioInputBody,
  'core/audio-mix': AudioMixBody,
  'core/captions': CaptionsBody,
  'core/caption-export': CaptionExportBody,
  'core/timeline-assembler': AssemblerBody,
  'core/video-output': VideoOutputBody,
  'core/mp4-export': ExportBody,
  'core/cover-export': CoverBody,
};

export const NODE_META: Record<string, NodeMeta> = {
  'core/input-trigger': { icon: 'bolt', group: 'source' },
  'core/github-fetcher': { icon: 'branch', group: 'source' },
  'core/web-fetcher': { icon: 'doc', group: 'source' },
  'core/static-script': { icon: 'doc', group: 'script' },
  'core/screenwriter': { icon: 'bot', group: 'script' },
  'core/scene-breakdown': { icon: 'bot', group: 'script' },
  'core/stock-media': { icon: 'screen', group: 'look' },
  'core/art-director': { icon: 'screen', group: 'look' },
  'core/audio-input': { icon: 'mic', group: 'audio' },
  'core/tts-engine': { icon: 'wave', group: 'audio' },
  'core/transcribe': { icon: 'wave', group: 'audio' },
  'core/audio-mix': { icon: 'wave', group: 'audio' },
  'core/captions': { icon: 'doc', group: 'audio' },
  'core/caption-export': { icon: 'down', group: 'output' },
  'core/timeline-assembler': { icon: 'layers', group: 'output' },
  'core/video-output': { icon: 'screen', group: 'output' },
  'core/mp4-export': { icon: 'down', group: 'output' },
  'core/cover-export': { icon: 'screen', group: 'output' },
  'core/llm-provider': { icon: 'term', group: 'resource' },
  'core/tts-provider': { icon: 'mic', group: 'resource' },
  'core/remotion-engine': { icon: 'chip', group: 'resource' },
  'core/hyperframes-engine': { icon: 'chip', group: 'resource' },
};