export const MIN_PASSWORD_LENGTH = 12;

export function evaluatePasswordStrength(password) {
  if (!password) return { score: 0, level: 'none' };

  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= MIN_PASSWORD_LENGTH) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^A-Za-z0-9]/.test(password)) score += 1;

  // A password rejected by the submit rule can never be described as strong.
  if (password.length < MIN_PASSWORD_LENGTH) {
    return score <= 2 ? { score: 1, level: 'weak' } : { score: 2, level: 'fair' };
  }
  return score <= 3 ? { score: 2, level: 'fair' } : { score: 3, level: 'strong' };
}
