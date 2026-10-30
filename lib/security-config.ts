const PLACEHOLDERS = new Set([
  'changeme',
  'change-this-before-production',
  'development-only-change-me',
  'replace-with-a-long-random-value',
  'replace-with-a-unique-password',
]);

export function passwordIsAcceptable(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length >= 12 &&
    value.length <= 1024 &&
    !PLACEHOLDERS.has(value.trim().toLowerCase())
  );
}

export function requireSessionSecret(value: unknown): string {
  if (
    typeof value !== 'string' ||
    value.trim().length < 32 ||
    PLACEHOLDERS.has(value.trim().toLowerCase())
  )
    throw new Error(
      'Configure SESSION_SECRET with a unique random value of at least 32 characters.',
    );
  return value;
}

export function requireBootstrapPassword(value: unknown): string {
  if (!passwordIsAcceptable(value))
    throw new Error(
      'Configure ADMIN_PASSWORD with a unique password of 12 to 1024 characters before creating the administrator.',
    );
  return value;
}
