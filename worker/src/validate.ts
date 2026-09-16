/**
 * Input validation utilities for Agora Token Service
 */

export interface TokenRequest {
  channel: string;
  userAccount: string;
  role: 'publisher' | 'subscriber';
  expireSeconds: number;
}

export interface ValidationResult {
  valid: boolean;
  data?: TokenRequest;
  error?: string;
}

// Validation regex patterns
const CHANNEL_REGEX = /^[a-zA-Z0-9_-]+$/;
const USER_ACCOUNT_REGEX = /^[a-zA-Z0-9@._-]+$/;

// Validation limits
const CHANNEL_MIN_LENGTH = 1;
const CHANNEL_MAX_LENGTH = 64;
const USER_ACCOUNT_MIN_LENGTH = 1;
const USER_ACCOUNT_MAX_LENGTH = 128;
const EXPIRE_MIN_SECONDS = 60;
const EXPIRE_MAX_SECONDS = 86400;
const DEFAULT_EXPIRE_SECONDS = 3600;

/**
 * Validate channel name
 */
function validateChannel(channel: unknown): string | null {
  if (channel === undefined || channel === null) {
    return 'channel is required';
  }
  
  if (typeof channel !== 'string') {
    return 'channel must be a string';
  }

  const trimmed = channel.trim();
  
  if (trimmed.length < CHANNEL_MIN_LENGTH) {
    return `channel must be at least ${CHANNEL_MIN_LENGTH} character`;
  }
  
  if (trimmed.length > CHANNEL_MAX_LENGTH) {
    return `channel must be at most ${CHANNEL_MAX_LENGTH} characters`;
  }

  if (!CHANNEL_REGEX.test(trimmed)) {
    return 'channel must contain only alphanumeric characters, underscores, and hyphens';
  }

  return null;
}

/**
 * Validate user account (string UID)
 */
function validateUserAccount(userAccount: unknown): string | null {
  if (userAccount === undefined || userAccount === null) {
    return 'userAccount is required';
  }
  
  if (typeof userAccount !== 'string') {
    return 'userAccount must be a string';
  }

  const trimmed = userAccount.trim();
  
  if (trimmed.length < USER_ACCOUNT_MIN_LENGTH) {
    return `userAccount must be at least ${USER_ACCOUNT_MIN_LENGTH} character`;
  }
  
  if (trimmed.length > USER_ACCOUNT_MAX_LENGTH) {
    return `userAccount must be at most ${USER_ACCOUNT_MAX_LENGTH} characters`;
  }

  if (!USER_ACCOUNT_REGEX.test(trimmed)) {
    return 'userAccount must contain only alphanumeric characters, @, ., _, and -';
  }

  return null;
}

/**
 * Validate role
 */
function validateRole(role: unknown): 'publisher' | 'subscriber' {
  if (role === undefined || role === null) {
    return 'publisher'; // Default role
  }
  
  if (role === 'publisher' || role === 'subscriber') {
    return role;
  }
  
  return 'publisher'; // Default for invalid values
}

/**
 * Validate expire seconds
 */
function validateExpireSeconds(expireSeconds: unknown, defaultTtl: number): number {
  if (expireSeconds === undefined || expireSeconds === null) {
    return defaultTtl;
  }
  
  const num = typeof expireSeconds === 'number' 
    ? expireSeconds 
    : parseInt(String(expireSeconds), 10);
  
  if (isNaN(num)) {
    return defaultTtl;
  }

  // Clamp to valid range
  if (num < EXPIRE_MIN_SECONDS) {
    return EXPIRE_MIN_SECONDS;
  }
  
  if (num > EXPIRE_MAX_SECONDS) {
    return EXPIRE_MAX_SECONDS;
  }

  return Math.floor(num);
}

/**
 * Validate the complete token request body
 */
export function validateTokenRequest(
  body: unknown, 
  defaultTtl: number = DEFAULT_EXPIRE_SECONDS
): ValidationResult {
  // Check if body is an object
  if (!body || typeof body !== 'object') {
    return {
      valid: false,
      error: 'Request body must be a JSON object',
    };
  }

  const data = body as Record<string, unknown>;

  // Validate channel
  const channelError = validateChannel(data.channel);
  if (channelError) {
    return {
      valid: false,
      error: channelError,
    };
  }

  // Validate userAccount
  const userAccountError = validateUserAccount(data.userAccount);
  if (userAccountError) {
    return {
      valid: false,
      error: userAccountError,
    };
  }

  // Validate and normalize role and expireSeconds
  const role = validateRole(data.role);
  const expireSeconds = validateExpireSeconds(data.expireSeconds, defaultTtl);

  return {
    valid: true,
    data: {
      channel: (data.channel as string).trim(),
      userAccount: (data.userAccount as string).trim(),
      role,
      expireSeconds,
    },
  };
}
