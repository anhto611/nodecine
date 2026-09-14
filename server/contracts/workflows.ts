import { workflowStore } from '@/server/workflows';
import { ensureServerRegistrations } from './register';

/** The workflow files as this app reads them: against every capsule it registers. */
export const workflows = workflowStore(ensureServerRegistrations);
