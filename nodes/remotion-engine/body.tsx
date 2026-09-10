'use client';
import type React from 'react';
import type { BodyProps } from '@/nodes/kit';
import { EngineStatusBody } from '@/components/node-runtime/resource-bodies';
export const RemotionEngineBody: React.FC<BodyProps> = (props) => <EngineStatusBody {...props} settings />;
