/**
 * @module @kb-labs/commit-contracts/events
 * Studio event definitions for commit plugin
 */

/**
 * Event names for commit plugin widgets
 */
export const COMMIT_EVENTS = {
  /** Workspace selector changed */
  WORKSPACE_CHANGED: 'workspace:changed',
  /** Form submitted (actions widget) */
  FORM_SUBMITTED: 'form:submitted',
} as const;

export type CommitEventName = typeof COMMIT_EVENTS[keyof typeof COMMIT_EVENTS];

/**
 * Event payload types
 */

/** Payload for workspace:changed event */
export interface WorkspaceChangedPayload {
  /** Selected workspace ID */
  workspace: string;
}

/** Payload for form:submitted event */
export interface FormSubmittedPayload {
  /** Action ID that was submitted */
  action: string;
  /** Form data (if any) */
  data?: Record<string, unknown>;
}

/**
 * Union type for all commit event payloads
 */
export type CommitEventPayload =
  | WorkspaceChangedPayload
  | FormSubmittedPayload;
