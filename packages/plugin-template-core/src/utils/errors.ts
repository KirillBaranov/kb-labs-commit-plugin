/**
 * Error handling utilities for Plugin Template
 *
 * Custom error classes and factories for consistent error handling across the plugin.
 *
 * @example Basic usage
 * ```typescript
 * import { ValidationError, NotFoundError, createError } from './utils/errors';
 *
 * // Validation errors
 * throw new ValidationError('Email must be valid', 'email');
 *
 * // Not found errors
 * throw new NotFoundError('User', userId);
 *
 * // Generic errors with metadata
 * throw createError('OPERATION_FAILED', 'Could not process request', { userId });
 * ```
 */

/**
 * Base error class for plugin errors
 * Extends Error with additional metadata support
 */
export class PluginError extends Error {
  public readonly code: string;
  public readonly meta?: Record<string, unknown>;

  constructor(
    code: string,
    message: string,
    meta?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'PluginError';
    this.code = code;
    this.meta = meta;

    // Maintains proper stack trace for where error was thrown (V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      meta: this.meta,
      stack: this.stack
    };
  }
}

/**
 * Validation error - thrown when input validation fails
 *
 * @example
 * ```typescript
 * if (!isValidEmail(email)) {
 *   throw new ValidationError('Invalid email format', 'email', 'INVALID_EMAIL');
 * }
 * ```
 */
export class ValidationError extends PluginError {
  public readonly field: string;

  constructor(
    message: string,
    field: string,
    code: string = 'VALIDATION_ERROR',
    meta?: Record<string, unknown>
  ) {
    super(code, message, { ...meta, field });
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Not found error - thrown when resource doesn't exist
 *
 * @example
 * ```typescript
 * const user = await getUser(userId);
 * if (!user) {
 *   throw new NotFoundError('User', userId);
 * }
 * ```
 */
export class NotFoundError extends PluginError {
  public readonly resourceType: string;
  public readonly resourceId: string;

  constructor(
    resourceType: string,
    resourceId: string,
    meta?: Record<string, unknown>
  ) {
    super(
      'NOT_FOUND',
      `${resourceType} not found: ${resourceId}`,
      { ...meta, resourceType, resourceId }
    );
    this.name = 'NotFoundError';
    this.resourceType = resourceType;
    this.resourceId = resourceId;
  }
}

/**
 * Business rule error - thrown when business rules are violated
 *
 * @example
 * ```typescript
 * if (account.balance < amount) {
 *   throw new BusinessRuleError(
 *     'Insufficient funds',
 *     'INSUFFICIENT_FUNDS',
 *     { balance: account.balance, requested: amount }
 *   );
 * }
 * ```
 */
export class BusinessRuleError extends PluginError {
  constructor(
    message: string,
    code: string = 'BUSINESS_RULE_VIOLATION',
    meta?: Record<string, unknown>
  ) {
    super(code, message, meta);
    this.name = 'BusinessRuleError';
  }
}

/**
 * Permission error - thrown when operation is not permitted
 *
 * @example
 * ```typescript
 * if (!canUserPerformAction(user, 'delete')) {
 *   throw new PermissionError('delete', 'User lacks delete permission');
 * }
 * ```
 */
export class PermissionError extends PluginError {
  public readonly action: string;

  constructor(
    action: string,
    message?: string,
    meta?: Record<string, unknown>
  ) {
    super(
      'PERMISSION_DENIED',
      message || `Permission denied: ${action}`,
      { ...meta, action }
    );
    this.name = 'PermissionError';
    this.action = action;
  }
}

/**
 * Quota exceeded error - thrown when rate limits or quotas are exceeded
 *
 * @example
 * ```typescript
 * if (requestCount > limit) {
 *   throw new QuotaExceededError('api_requests', limit, requestCount);
 * }
 * ```
 */
export class QuotaExceededError extends PluginError {
  public readonly quotaType: string;
  public readonly limit: number;
  public readonly current: number;

  constructor(
    quotaType: string,
    limit: number,
    current: number,
    meta?: Record<string, unknown>
  ) {
    super(
      'QUOTA_EXCEEDED',
      `Quota exceeded for ${quotaType}: ${current}/${limit}`,
      { ...meta, quotaType, limit, current }
    );
    this.name = 'QuotaExceededError';
    this.quotaType = quotaType;
    this.limit = limit;
    this.current = current;
  }
}

/**
 * Configuration error - thrown when plugin configuration is invalid
 *
 * @example
 * ```typescript
 * if (!config.apiKey) {
 *   throw new ConfigurationError('API key is required', 'apiKey');
 * }
 * ```
 */
export class ConfigurationError extends PluginError {
  public readonly configKey?: string;

  constructor(
    message: string,
    configKey?: string,
    meta?: Record<string, unknown>
  ) {
    super('CONFIGURATION_ERROR', message, { ...meta, configKey });
    this.name = 'ConfigurationError';
    this.configKey = configKey;
  }
}

/**
 * Error factory - creates generic plugin errors with metadata
 *
 * @example
 * ```typescript
 * throw createError('OPERATION_FAILED', 'Could not process request', {
 *   userId,
 *   operation: 'update'
 * });
 * ```
 */
export function createError(
  code: string,
  message: string,
  meta?: Record<string, unknown>
): PluginError {
  return new PluginError(code, message, meta);
}

/**
 * Type guard to check if error is a PluginError
 */
export function isPluginError(error: unknown): error is PluginError {
  return error instanceof PluginError;
}

/**
 * Type guard to check if error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if error is a NotFoundError
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Error formatter for logging
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   ctx.logger.error('Operation failed', formatErrorForLogging(error));
 * }
 * ```
 */
export function formatErrorForLogging(error: unknown): Record<string, unknown> {
  if (isPluginError(error)) {
    return {
      name: error.name,
      code: error.code,
      message: error.message,
      meta: error.meta,
      stack: error.stack
    };
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack
    };
  }

  return {
    error: String(error)
  };
}

/**
 * Error formatter for user-facing messages
 * Removes sensitive information and stack traces
 *
 * @example
 * ```typescript
 * try {
 *   await operation();
 * } catch (error) {
 *   const userMessage = formatErrorForUser(error);
 *   ctx.output?.write(`Error: ${userMessage}\n`);
 * }
 * ```
 */
export function formatErrorForUser(error: unknown): string {
  if (isPluginError(error)) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

/**
 * Wraps async function with error handling
 *
 * @example
 * ```typescript
 * const safeOperation = wrapWithErrorHandling(
 *   async () => riskyOperation(),
 *   error => ctx.logger.error('Operation failed', formatErrorForLogging(error))
 * );
 *
 * const result = await safeOperation();
 * ```
 */
export function wrapWithErrorHandling<T>(
  fn: () => Promise<T>,
  onError: (error: unknown) => void
): () => Promise<T | undefined> {
  return async () => {
    try {
      return await fn();
    } catch (error) {
      onError(error);
      return undefined;
    }
  };
}

/**
 * Assert function that throws ValidationError
 *
 * @example
 * ```typescript
 * function processUser(user: User | null) {
 *   assertNotNull(user, 'user', 'User is required');
 *   // TypeScript knows user is not null here
 *   console.log(user.name);
 * }
 * ```
 */
export function assertNotNull<T>(
  value: T | null | undefined,
  field: string,
  message?: string
): asserts value is T {
  if (value === null || value === undefined) {
    throw new ValidationError(
      message || `${field} is required`,
      field,
      'REQUIRED_FIELD'
    );
  }
}

/**
 * Assert function that throws BusinessRuleError
 *
 * @example
 * ```typescript
 * function withdraw(account: Account, amount: number) {
 *   assertBusinessRule(
 *     account.balance >= amount,
 *     'Insufficient funds',
 *     'INSUFFICIENT_FUNDS'
 *   );
 *   // Proceed with withdrawal
 * }
 * ```
 */
export function assertBusinessRule(
  condition: boolean,
  message: string,
  code?: string
): asserts condition {
  if (!condition) {
    throw new BusinessRuleError(message, code);
  }
}
