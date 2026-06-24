const crypto = require('crypto');

// VAPT: use a CSPRNG (crypto.randomInt) rather than Math.random() — Math.random()
// is not cryptographically secure and its output can be predicted, which matters
// for anything generating credentials.
function randomChar(chars) {
  return chars[crypto.randomInt(chars.length)];
}

/**
 * Generate a random 10-character password with at least one uppercase,
 * one lowercase, one digit, and one special character.
 */
function generatePassword() {
  const upper = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const lower = 'abcdefghijklmnopqrstuvwxyz';
  const digits = '0123456789';
  const special = '!@#$%^&*';
  const all = upper + lower + digits + special;

  // Ensure at least one from each category
  let password = randomChar(upper) + randomChar(lower) + randomChar(digits) + randomChar(special);

  // Fill remaining 6 characters
  for (let i = 0; i < 6; i++) {
    password += randomChar(all);
  }

  // Shuffle (Fisher-Yates, using the CSPRNG)
  const chars = password.split('');
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

module.exports = { generatePassword };
