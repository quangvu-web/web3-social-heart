/// <reference types="vite/client" />

interface Window {
  __FUN_PROFILE_APP_BOOTSTRAP_STARTED__?: boolean;
  __FUN_PROFILE_APP_MOUNTED__?: boolean;
  __FUN_PROFILE_APP_RECOVERY_RENDERED__?: boolean;
}

declare module 'virtual:pwa-register/react' {
  export function useRegisterSW(options?: {
    onRegisterError?: (error: unknown) => void;
  }): {
    needRefresh: [boolean, (value: boolean) => void];
    offlineReady: [boolean, (value: boolean) => void];
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_BITCOIN_SNAP_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
