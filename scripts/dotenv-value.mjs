// Wrangler expands $VARIABLE even inside single quotes. Preserve literal dollars
// and backslashes, and choose a delimiter that does not occur in the value.
export function dotenvValue(value) {
  if (/[\r\n]/.test(value))
    throw new Error('Configuration values must be single-line.');
  const quote = ["'", '`', '"'].find(
    (candidate) =>
      !value.includes(candidate) &&
      (candidate !== '"' || !/\\[nr]/.test(value)),
  );
  if (!quote)
    throw new Error(
      'Configuration cannot be represented safely in dotenv. Omit at least one kind of quote character.',
    );
  return quote + value.replaceAll('$', '\\$') + quote;
}
