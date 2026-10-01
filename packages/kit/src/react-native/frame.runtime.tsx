import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode,
} from 'react';
import {
  frameNavOf, missingRequired, resolveFrameColor, withFormValues, withScreen, type FrameAction, type FrameColor,
  type FrameNav,
} from '../frame';
import { FRAME_ROOT_FLOW, type FrameFlow } from '../frame.flow';
import { kitPalette, type KitPalette, type Scheme } from '../tokens';
import { KitThemeProvider, useKitPalette } from './theme-context';

export interface FrameActionSource {
  label?: string;
}

export type FrameActionHandler = (action: FrameAction, source: FrameActionSource) => Promise<void> | void;

interface FrameRuntime {
  dark: boolean;
  scheme: Scheme;
  palette: KitPalette;
  enabled: boolean;
  busy: boolean;
  dispatch: (action: FrameAction, source: FrameActionSource) => Promise<void>;
  usable: (action: FrameAction | undefined) => boolean;
  openUrl?: (url: string) => void;
}

const idle = (): Promise<void> => Promise.resolve();

const RuntimeContext = createContext<FrameRuntime>({
  dark: false, scheme: 'light', palette: kitPalette('light'), enabled: false, busy: false, dispatch: idle,
  usable: () => false,
});

export function useFrameRuntime(): FrameRuntime {
  return useContext(RuntimeContext);
}

export function useFrameColor(): (c: FrameColor | undefined) => string | undefined {
  const { scheme, palette } = useFrameRuntime();
  return (c) => resolveFrameColor(c, scheme, palette);
}

export function FrameRuntimeProvider({ dark, onAction, disabled, onOpenUrl, navigate, screen, children }: {
  dark: boolean;
  onAction?: FrameActionHandler;
  disabled?: boolean;
  onOpenUrl?: (url: string) => void;
  navigate?: (nav: FrameNav) => void;
  screen?: string;
  children: ReactNode;
}): React.ReactElement {
  const palette = useKitPalette();
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const enabled = onAction !== undefined && disabled !== true;
  const dispatch = useCallback(async (action: FrameAction, source: FrameActionSource): Promise<void> => {
    const nav = frameNavOf(action);
    if (nav !== undefined) {
      navigate?.(nav);
      return;
    }
    if (!enabled || onAction === undefined || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await onAction(screen === undefined ? action : withScreen(action, screen), source);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [enabled, onAction, navigate, screen]);
  const usable = useCallback((action: FrameAction | undefined): boolean => (
    frameNavOf(action) === undefined ? enabled && !busy : navigate !== undefined
  ), [enabled, busy, navigate]);
  const value = useMemo<FrameRuntime>(() => ({
    dark, scheme: dark ? 'dark' : 'light', palette, enabled, busy, dispatch, usable, openUrl: onOpenUrl,
  }), [dark, palette, enabled, busy, dispatch, usable, onOpenUrl]);
  return <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>;
}

const FlowContext = createContext<FrameFlow>(FRAME_ROOT_FLOW);

export const FrameFlowProvider = FlowContext.Provider;

export function useFrameFlow(): FrameFlow {
  return useContext(FlowContext);
}

export function FrameThemeScope({ theme, children }: { theme?: Scheme; children: ReactNode }): React.ReactElement {
  const runtime = useFrameRuntime();
  const value = useMemo<FrameRuntime | null>(() => (theme === undefined || theme === runtime.scheme
    ? null
    : { ...runtime, dark: theme === 'dark', scheme: theme, palette: kitPalette(theme) }), [theme, runtime]);
  if (value === null) return <>{children}</>;
  return (
    <KitThemeProvider value={value.palette} scheme={value.scheme}>
      <RuntimeContext.Provider value={value}>{children}</RuntimeContext.Provider>
    </KitThemeProvider>
  );
}

interface FormScope {
  register: (name: string, value: unknown, required: boolean) => () => void;
  set: (name: string, value: unknown) => void;
  run: (action: FrameAction | undefined, source: FrameActionSource) => Promise<void>;
  submit: (source: FrameActionSource) => Promise<void>;
  change: (name: string, value: unknown, action: FrameAction | undefined) => Promise<void>;
  missing: string[];
}

const FormContext = createContext<FormScope | null>(null);

export function useFormScope(): FormScope | null {
  return useContext(FormContext);
}

export function FrameFormScope({ submitAction, children }: {
  submitAction?: FrameAction;
  children: ReactNode;
}): React.ReactElement {
  const { dispatch } = useFrameRuntime();
  const values = useRef(new Map<string, unknown>());
  const required = useRef(new Set<string>());
  const [missing, setMissing] = useState<string[]>([]);
  const run = useCallback((action: FrameAction | undefined, source: FrameActionSource): Promise<void> => (
    action === undefined ? idle() : dispatch(withFormValues(action, Object.fromEntries(values.current)), source)
  ), [dispatch]);
  const register = useCallback((name: string, value: unknown, isRequired: boolean): (() => void) => {
    values.current.set(name, value);
    if (isRequired) required.current.add(name);
    return () => {
      values.current.delete(name);
      required.current.delete(name);
    };
  }, []);
  const set = useCallback((name: string, value: unknown): void => { values.current.set(name, value); }, []);
  const scope = useMemo<FormScope>(() => ({
    register,
    set,
    run,
    submit: (source) => {
      const absent = missingRequired(required.current, Object.fromEntries(values.current));
      setMissing(absent);
      return absent.length === 0 ? run(submitAction, source) : idle();
    },
    change: (name, value, action) => {
      set(name, value);
      return run(action, {});
    },
    missing,
  }), [register, set, run, submitAction, missing]);
  return <FormContext.Provider value={scope}>{children}</FormContext.Provider>;
}

export function useFormField(name: string, initial: unknown, required: boolean | undefined): FormScope | null {
  const scope = useFormScope();
  const register = scope?.register;
  useEffect(() => register?.(name, initial, required === true), [register, name, initial, required]);
  return scope;
}
