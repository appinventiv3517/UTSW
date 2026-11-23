/* ---------- Admin password rules (from the Login design) ----------
   PROPOSED – pending UTSW security confirmation (length, history, expiry and lockout are open questions). */
export const PW_RULES: { key: string; label: string; test: (p: string) => boolean }[] = [
  { key: 'len', label: 'At least 8 characters long', test: p => p.length >= 8 },
  { key: 'upper', label: 'Must contain an uppercase letter', test: p => /[A-Z]/.test(p) },
  { key: 'num', label: 'Must contain a number', test: p => /\d/.test(p) },
  { key: 'special', label: 'Must contain a special character (for example: !@#$%)', test: p => /[^A-Za-z0-9\s]/.test(p) }
];
export const pwOk = (p: string): boolean => PW_RULES.every(r => r.test(p));
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
/* Every sample account starts with this password (mock data only; shown on the sign-in page) */
export const SAMPLE_PASSWORD = 'MyCare#2026';
