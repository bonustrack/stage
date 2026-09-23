export interface SecureAccessOptions {
  thisDeviceOnly?: boolean;
  afterFirstUnlock?: boolean;
  accessGroup?: string;
  requireAuthentication?: boolean;
  authenticationPrompt?: string;
}

export type DeviceBoundAccessOptions = SecureAccessOptions & { thisDeviceOnly: true };

export interface SecureStorage {
  get: (key: string, options?: SecureAccessOptions) => Promise<string | null>;
  set: (key: string, value: string, options?: SecureAccessOptions) => Promise<void>;
  delete: (key: string) => Promise<void>;
}

export interface AppStorage {
  get: (key: string) => Promise<string | null>;
  set: (key: string, value: string) => Promise<void>;
  delete: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}
