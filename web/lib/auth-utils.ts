export function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 6) return { valid: false, error: 'Password must be at least 6 characters' };
  if (!/^[a-zA-Z0-9]+$/.test(password)) return { valid: false, error: 'Password must contain only letters and numbers' };
  return { valid: true };
}

export function validatePhone(phone: string): { valid: boolean; error?: string } {
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  if (!phoneRegex.test(phone.replace(/\D/g, ''))) {
    return { valid: false, error: 'Invalid phone number' };
  }
  return { valid: true };
}
