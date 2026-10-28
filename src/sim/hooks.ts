import type { World } from './types';
/** Late-bound functions to break import cycles. */
export const startIsyanHook: { fn: (w: World) => void } = { fn: () => {} };
