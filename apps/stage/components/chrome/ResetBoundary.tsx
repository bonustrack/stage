import { Component } from 'react';
import type { ReactNode } from 'react';

interface ResetBoundaryProps {
  resetKey: unknown;
  fallback: () => ReactNode;
  onError?: (error: unknown) => void;
  children: ReactNode;
}
interface State {
  failed: boolean;
}

export class ResetBoundary extends Component<ResetBoundaryProps, State> {
  override state: State = { failed: false };

  static getDerivedStateFromError(): State {
    return { failed: true };
  }

  override componentDidUpdate(prev: ResetBoundaryProps): void {
    if (prev.resetKey !== this.props.resetKey && this.state.failed) this.setState({ failed: false });
  }

  override componentDidCatch(error: unknown): void {
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback() : this.props.children;
  }
}
