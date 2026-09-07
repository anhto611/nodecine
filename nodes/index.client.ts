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
import { EngineBody, LlmProviderBody, TtsProviderBody } from './resources/body';
import { TtsBody } from './tts/body';
import { TranscribeBody } from './transcribe/body';
import { AudioMixBody } from './audio/body';
import { CaptionsBody } from './captions/body';
import { AssemblerBody } from './assembler/body';
import { ExportBody } from './output/export-body';
import { VideoOutputBody } from './output/video-output-body';

/** The Studio side of every node family: the body each node type draws, and its icon and library group. */
export const NODE_BODIES: Record<string, React.FC<BodyProps>> = {
  'core/input-trigger': InputTriggerBody,
  'core/github-fetcher': GithubFetcherBody,
  'core/web-fetcher': WebFetcherBody,
  'core/static-script': StaticScriptBody,
  'core/art-director': ArtDirectorBody,
  'core/screenwriter': ScreenwriterBody,
  'core/llm-provider': LlmProviderBody,
  'core/tts-provider': TtsProviderBody,
  'core/remotion-engine': EngineBody,
  'core/hyperframes-engine': EngineBody,
  'core/tts-engine': TtsBody,
  'core/transcribe': TranscribeBody,
  'core/audio-mix': AudioMixBody,
  'core/captions': CaptionsBody,
  'core/timeline-assembler': AssemblerBody,
  'core/video-output': VideoOutputBody,
  'core/mp4-export': ExportBody,
};

export const NODE_META: Record<string, NodeMeta> = {
  'core/input-trigger': { icon: 'bolt', group: 'source' },
  'core/github-fetcher': { icon: 'branch', group: 'source' },
  'core/web-fetcher': { icon: 'doc', group: 'source' },
  'core/static-script': { icon: 'doc', group: 'source' },
  'core/art-director': { icon: 'screen', group: 'look' },
  'core/screenwriter': { icon: 'bot', group: 'process' },
  'core/llm-provider': { icon: 'term', group: 'provider' },
  'core/tts-provider': { icon: 'mic', group: 'provider' },
  'core/tts-engine': { icon: 'wave', group: 'process' },
  'core/transcribe': { icon: 'wave', group: 'process' },
  'core/audio-mix': { icon: 'wave', group: 'process' },
  'core/captions': { icon: 'doc', group: 'process' },
  'core/timeline-assembler': { icon: 'layers', group: 'process' },
  'core/remotion-engine': { icon: 'chip', group: 'engine' },
  'core/hyperframes-engine': { icon: 'chip', group: 'engine' },
  'core/video-output': { icon: 'screen', group: 'output' },
  'core/mp4-export': { icon: 'down', group: 'output' },
};
