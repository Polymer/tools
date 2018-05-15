interface ManifestEntry {
  url: string;
  revision: string;
}

declare module "workbox-build" {
  export interface WorkboxConfig {
    skipWaiting?: boolean;
    clientsClaim?: boolean;
    navigateFallback?: string;
    navigateFallbackBlacklist?: RegExp[];
    navigateFallbackWhitelist?: RegExp[];
    importScripts?: string[];
    ignoreUrlParametersMatching?: RegExp[];
    directoryIndex?: string;
    cacheId?: string;
    globDirectory?: string;
    globFollow?: boolean;
    globIgnores?: string[];
    globPatterns?: string[];
    globStrict?: boolean;
    maximumFileSizeToCacheInBytes?: number;
    dontCacheBustUrlsMatching?: RegExp;
    modifyUrlPrefix?: {
      [id: string]: string;
    };
    manifestTransforms?: {
      (
        entries: ManifestEntry[]
      ): {
          manifest: ManifestEntry[]
        }
    }[];
    runtimeCaching?: {
      urlPattern: RegExp;
      handler: string;
      options?: {
        networkTimeoutSeconds?: number;
        cacheName?: string;
        expiration?: {
          maxEntries?: number;
          maxAgeSeconds?: number;
        };
        cacheableResponse?: {
          statuses?: number[];
          headers?: {
            [id: string]: string;
          };
        };
        broadcastUpdate?: {
          channelName: string;
        };
        plugins?: object[];
      };
    }[];
  }

  export function generateSWString(
    options: WorkboxConfig
  ): Promise<{
    swString: string,
    warnings: string[]
  }>;

  export function getModuleUrl(
    moduleName: string,
    buildType?: string
  ): string;
}
