/**
 * Company field validators for statutory and document fields.
 */

function validatePAN(pan) {
  if (!pan) return null;
  const regex = /^[A-Z0-9]{10}$/;
  if (!regex.test(pan)) return 'PAN must be exactly 10 alphanumeric characters (uppercase)';
  return null;
}

function validatePINCode(pinCode) {
  if (!pinCode) return null;
  const regex = /^[0-9]{6}$/;
  if (!regex.test(pinCode)) return 'PIN code must be exactly 6 digits';
  return null;
}

function validateCertificateFile(file) {
  if (!file) return null;
  const allowedMimeTypes = ['application/pdf', 'image/png', 'image/jpeg'];
  const maxSize = 5 * 1024 * 1024; // 5 MB
  if (!allowedMimeTypes.includes(file.mimetype))
    return 'Certificate must be PDF, PNG, or JPEG';
  if (file.size > maxSize)
    return 'Certificate file must not exceed 5 MB';
  return null;
}

function validateCIN(cin) {
  if (!cin) return null;
  const regex = /^[A-Z0-9]{21}$/;
  if (!regex.test(cin)) return 'CIN must be exactly 21 alphanumeric characters';
  return null;
}

module.exports = { validatePAN, validatePINCode, validateCertificateFile, validateCIN };
