export const callsSupported = false;

export const screenShareSupported = false;

export const startCallService = (): (() => void) => () => undefined;

export const loadCallHistory: (convId: string) => Promise<void> = () => Promise.resolve();

export const startCall: (convId: string, dm: boolean, video: boolean) => Promise<void> = () => Promise.resolve();

export const joinCall: (convId: string, dm: boolean) => Promise<void> = () => Promise.resolve();

export const declineCall = (): void => undefined;

export const leaveCall = (): void => undefined;

export const toggleMic = (): void => undefined;

export const toggleCamera = (): Promise<void> => Promise.resolve();

export const toggleScreen = (): Promise<void> => Promise.resolve();
