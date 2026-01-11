/**
 * Error Boundary Component
 *
 * Catches React render errors and displays a fallback UI.
 * Also reports errors to Sentry for production monitoring.
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { captureError, addBreadcrumb } from '../lib/sentry';
import { spacing, borderRadius, fontSize } from '../lib/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console in development
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Add breadcrumb for debugging
    addBreadcrumb('Error boundary triggered', 'error', {
      componentStack: errorInfo.componentStack,
    });

    // Report to Sentry
    captureError(error, {
      context: 'ErrorBoundary',
      componentStack: errorInfo.componentStack,
    });
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default fallback UI
      return (
        <View style={styles.container}>
          <View style={styles.content}>
            <Text style={styles.emoji}>!</Text>
            <Text style={styles.title}>Something went wrong</Text>
            <Text style={styles.message}>
              We're sorry, but something unexpected happened. Please try again.
            </Text>
            <TouchableOpacity style={styles.button} onPress={this.handleRetry}>
              <Text style={styles.buttonText}>Try Again</Text>
            </TouchableOpacity>
            {__DEV__ && this.state.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorTitle}>Error Details (Dev Only):</Text>
                <Text style={styles.errorText}>{this.state.error.message}</Text>
              </View>
            )}
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xl,
  },
  content: {
    alignItems: 'center',
    maxWidth: 300,
  },
  emoji: {
    fontSize: 48,
    marginBottom: spacing.lg,
    color: '#ef4444',
    fontWeight: '700',
  },
  title: {
    fontSize: fontSize.xl,
    fontWeight: '700',
    color: '#ffffff',
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  message: {
    fontSize: fontSize.base,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
  },
  button: {
    backgroundColor: '#c9a45c',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: borderRadius.lg,
  },
  buttonText: {
    fontSize: fontSize.base,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  errorDetails: {
    marginTop: spacing.xl,
    padding: spacing.md,
    backgroundColor: '#2d2d2d',
    borderRadius: borderRadius.md,
    width: '100%',
  },
  errorTitle: {
    fontSize: fontSize.sm,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: spacing.xs,
  },
  errorText: {
    fontSize: fontSize.xs,
    color: '#9ca3af',
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
