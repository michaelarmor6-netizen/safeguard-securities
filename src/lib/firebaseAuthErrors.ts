export function getAuthErrorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message?: string }).message) || 'Authentication failed';
  }
  if (error instanceof Error) return error.message;
  return 'Authentication failed';
}

export function getFirebaseAuthErrorMessage(error: unknown): string {
  return getAuthErrorMessage(error);
}

export function normalizeAuthEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class SupabaseError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
    this.name = 'SupabaseError';
  }
}
