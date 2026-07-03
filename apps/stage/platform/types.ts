export interface SecureAccessOptions {
  thisDeviceOnly?: boolean;
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
}

export interface SecureStorage {
  get: (key: string, options?: SecureAccessOptions) => Promise<string | null>;
  set: (key: string, value: string, options?: SecureAccessOptions) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export interface AppStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  multiGet: (keys: readonly string[]) => Promise<readonly (readonly [string, string | null])[]>;
  clear: () => Promise<void>;
}
