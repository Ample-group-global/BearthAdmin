import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so Turbopack does not walk up and
  // pick a stray lockfile (e.g. ~/Desktop/pnpm-lock.yaml) as the root.
  turbopack: {
    root: __dirname,
  },
  bundlePagesRouterDependencies: true,
  serverExternalPackages: [
    "pino",
    "pino-pretty",
    "thread-stream",
    "sharp",
    "archiver",
  ],
  webpack(config) {
    config.externals = config.externals ?? [];
    if (Array.isArray(config.externals)) {
      config.externals.push(function ({ request }: { request: string }, callback: (err?: Error | null, result?: string) => void) {
        const nativeModules = [
          'archiver',
          'archiver-utils',
          'zip-stream',
          'readdir-glob',
          'glob',
          'lazystream',
          'normalize-path',
        ];
        if (nativeModules.some(m => request === m || request.startsWith(m + '/'))) {
          return callback(null, 'commonjs ' + request);
        }
        callback();
      });
    }
    return config;
  },
};

export default nextConfig;
