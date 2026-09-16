import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AppErrorFallback } from './AppErrorFallback';
import { isChunkLoadError } from '@/lib/appRecovery';

interface AppErrorBoundaryProps {
  children: ReactNode;
  fallbackTitle?: string;
}

interface AppErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] render error', error, info);
  }

  render() {
    const { error } = this.state;
    if (error) {
      const chunkError = isChunkLoadError(error);
      return (
        <AppErrorFallback
          title={chunkError ? 'Phiên bản ứng dụng đã được cập nhật' : this.props.fallbackTitle}
          message={chunkError ? 'Vui lòng tải lại để dùng phiên bản mới nhất của FUN Profile.' : undefined}
          code={chunkError ? 'route_chunk_error' : 'render_error'}
          error={error}
          updateMode={chunkError}
        />
      );
    }
    return this.props.children;
  }
}
