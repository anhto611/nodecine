'use client';
import type React from 'react';
import type { BodyProps } from '@/nodes/kit';
import { ProviderBody } from '@/components/node-runtime/resource-bodies';
export const LlmProviderBody: React.FC<BodyProps> = (props) => <ProviderBody {...props} kind="llm" />;
