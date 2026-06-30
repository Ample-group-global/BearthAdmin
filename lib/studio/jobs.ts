// Persist across Next.js hot reloads in dev via globalThis
declare global {
  // eslint-disable-next-line no-var
  var _bearthJobs: Map<string, any> | undefined;
}

if (!globalThis._bearthJobs) globalThis._bearthJobs = new Map<string, any>();

export const JOBS: Map<string, any> = globalThis._bearthJobs!;
