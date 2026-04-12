const ADMIN_EMAILS = [
  "bzh1268@gmail.com",   // admin
  "test3@example.com",   // test renter
  "test2@example.com",   // test owner
  "test@example.com",    // test hub
];

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.trim().toLowerCase());
}

const FAKE_VALUES = [
  "test", "testing", "aaa", "bbb", "xxx", "yyy", "zzz",
  "123", "1234", "12345", "000", "0000", "asdf", "qwerty",
  "fake", "null", "none", "n/a", "na", "no", "nope",
  "abc", "abcd", "abcde", "name", "user", "unknown",
];

function isFakeValue(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (FAKE_VALUES.includes(v)) return true;
  // all same character e.g. "aaaa", "1111"
  if (v.length > 0 && /^(.)\1+$/.test(v)) return true;
  return false;
}

export function validateFullName(name: string): string | null {
  const v = name.trim();
  if (!v) return "Full name is required.";
  if (v.length < 2) return "Name is too short.";
  if (isFakeValue(v)) return "Please enter your real full name.";
  if (!/[a-zA-Z]/.test(v)) return "Name must contain letters.";
  return null;
}

export function validatePhone(phone: string): string | null {
  const v = phone.trim();
  if (!v) return "Phone number is required.";
  // strip spaces, dashes, parentheses
  const digits = v.replace(/[\s\-().]/g, "");
  if (isFakeValue(digits)) return "Please enter a real phone number.";
  // NZ numbers: start with 0, 8-11 digits total
  if (!/^0[0-9]{7,10}$/.test(digits)) {
    return "Please enter a valid NZ phone number (e.g. 021 234 5678).";
  }
  return null;
}

export function validateAddress(address: string): string | null {
  const v = address.trim();
  if (!v) return "Address is required.";
  if (v.length < 5) return "Please enter a complete street address.";
  if (isFakeValue(v)) return "Please enter your real address.";
  return null;
}

export function validateCity(city: string): string | null {
  const v = city.trim();
  if (!v) return "City is required.";
  if (v.length < 2) return "Please enter a valid city.";
  if (isFakeValue(v)) return "Please enter a real city name.";
  return null;
}
