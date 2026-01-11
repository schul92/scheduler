/**
 * API Utilities
 *
 * Retry logic, timeout handling, and error recovery for API calls.
 */

import { AuthError, PermissionError, NotFoundError } from './api/teams';
import { captureError } from './sentry';

/**
 * Retry options
 */
export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Base delay in ms between retries (default: 1000) */
  baseDelay?: number;
  /** Whether to use exponential backoff (default: true) */
  exponentialBackoff?: boolean;
  /** Context for error logging */
  context?: string;
}

/**
 * Check if an error is retriable
 * Auth errors, permission errors, and validation errors should not be retried
 */
function isRetriableError(error: unknown): boolean {
  if (error instanceof AuthError) return false;
  if (error instanceof PermissionError) return false;
  if (error instanceof NotFoundError) return false;

  // Check error message for known non-retriable patterns
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('unauthorized')) return false;
    if (msg.includes('forbidden')) return false;
    if (msg.includes('not found')) return false;
    if (msg.includes('invalid')) return false;
    if (msg.includes('validation')) return false;
  }

  return true;
}

/**
 * Execute a function with retry logic
 *
 * @param fn - Async function to execute
 * @param options - Retry configuration
 * @returns Result of the function
 * @throws Last error if all retries fail
 *
 * @example
 * const teams = await withRetry(
 *   () => getUserTeams(),
 *   { maxRetries: 3, context: 'getUserTeams' }
 * );
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    exponentialBackoff = true,
    context = 'unknown',
  } = options;

  let lastError: Error;
  let attempt = 0;

  while (attempt < maxRetries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      attempt++;

      // Don't retry non-retriable errors
      if (!isRetriableError(error)) {
        throw error;
      }

      // Log retry attempt
      console.log(
        `[Retry] ${context} - Attempt ${attempt}/${maxRetries} failed:`,
        lastError.message
      );

      // If we have more retries, wait before trying again
      if (attempt < maxRetries) {
        const delay = exponentialBackoff
          ? baseDelay * Math.pow(2, attempt - 1)
          : baseDelay;

        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  // All retries exhausted - capture error and throw
  captureError(lastError!, {
    context,
    attempts: attempt,
    maxRetries,
  });

  throw lastError!;
}

/**
 * Execute a promise with a timeout
 *
 * @param promise - Promise to execute
 * @param ms - Timeout in milliseconds
 * @param context - Context for error messages
 * @returns Result of the promise
 * @throws TimeoutError if the promise doesn't resolve in time
 *
 * @example
 * const data = await withTimeout(
 *   fetchData(),
 *   10000,
 *   'fetchData'
 * );
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number = 15000,
  context: string = 'operation'
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${context} timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * Execute a function with both retry and timeout
 *
 * @param fn - Async function to execute
 * @param timeoutMs - Timeout per attempt in ms
 * @param retryOptions - Retry configuration
 * @returns Result of the function
 *
 * @example
 * const teams = await withRetryAndTimeout(
 *   () => getUserTeams(),
 *   10000,
 *   { maxRetries: 3, context: 'getUserTeams' }
 * );
 */
export async function withRetryAndTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number = 10000,
  retryOptions: RetryOptions = {}
): Promise<T> {
  const context = retryOptions.context || 'operation';

  return withRetry(
    () => withTimeout(fn(), timeoutMs, context),
    retryOptions
  );
}

/**
 * Simple debounce function for API calls
 *
 * @param fn - Function to debounce
 * @param delay - Debounce delay in ms
 * @returns Debounced function
 */
export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: NodeJS.Timeout | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  };
}

/**
 * Create a cached version of an async function
 * Results are cached for a specified duration
 *
 * @param fn - Async function to cache
 * @param ttlMs - Cache duration in ms
 * @returns Cached function
 */
export function withCache<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  ttlMs: number = 60000
): T {
  const cache = new Map<string, { value: any; expiresAt: number }>();

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = JSON.stringify(args);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const result = await fn(...args);
    cache.set(key, { value: result, expiresAt: now + ttlMs });

    return result;
  }) as T;
}
