const { validatePAN, validatePINCode, validateCertificateFile, validateCIN } = require('./company.validators');

describe('validatePAN', () => {
  it('returns null when pan is not provided', () => {
    expect(validatePAN(null)).toBeNull();
    expect(validatePAN(undefined)).toBeNull();
    expect(validatePAN('')).toBeNull();
  });

  it('returns null for valid PAN formats', () => {
    expect(validatePAN('ABCDE1234F')).toBeNull();
    expect(validatePAN('1234567890')).toBeNull();
    expect(validatePAN('ABCDEFGHIJ')).toBeNull();
  });

  it('returns error for lowercase characters', () => {
    expect(validatePAN('abcde1234f')).toBe('PAN must be exactly 10 alphanumeric characters (uppercase)');
  });

  it('returns error for incorrect length', () => {
    expect(validatePAN('ABC123')).toBe('PAN must be exactly 10 alphanumeric characters (uppercase)');
    expect(validatePAN('ABCDE12345F')).toBe('PAN must be exactly 10 alphanumeric characters (uppercase)');
  });

  it('returns error for special characters', () => {
    expect(validatePAN('ABCDE-234F')).toBe('PAN must be exactly 10 alphanumeric characters (uppercase)');
  });
});

describe('validatePINCode', () => {
  it('returns null when pinCode is not provided', () => {
    expect(validatePINCode(null)).toBeNull();
    expect(validatePINCode(undefined)).toBeNull();
    expect(validatePINCode('')).toBeNull();
  });

  it('returns null for valid 6-digit PIN codes', () => {
    expect(validatePINCode('110001')).toBeNull();
    expect(validatePINCode('560034')).toBeNull();
    expect(validatePINCode('000000')).toBeNull();
  });

  it('returns error for non-digit characters', () => {
    expect(validatePINCode('11000A')).toBe('PIN code must be exactly 6 digits');
    expect(validatePINCode('abcdef')).toBe('PIN code must be exactly 6 digits');
  });

  it('returns error for incorrect length', () => {
    expect(validatePINCode('12345')).toBe('PIN code must be exactly 6 digits');
    expect(validatePINCode('1234567')).toBe('PIN code must be exactly 6 digits');
  });
});

describe('validateCertificateFile', () => {
  it('returns null when no file is provided', () => {
    expect(validateCertificateFile(null)).toBeNull();
    expect(validateCertificateFile(undefined)).toBeNull();
  });

  it('returns null for valid PDF file within size limit', () => {
    expect(validateCertificateFile({ mimetype: 'application/pdf', size: 1024 })).toBeNull();
  });

  it('returns null for valid PNG file within size limit', () => {
    expect(validateCertificateFile({ mimetype: 'image/png', size: 2 * 1024 * 1024 })).toBeNull();
  });

  it('returns null for valid JPEG file within size limit', () => {
    expect(validateCertificateFile({ mimetype: 'image/jpeg', size: 5 * 1024 * 1024 })).toBeNull();
  });

  it('returns error for unsupported mime type', () => {
    expect(validateCertificateFile({ mimetype: 'text/plain', size: 1024 })).toBe('Certificate must be PDF, PNG, or JPEG');
    expect(validateCertificateFile({ mimetype: 'application/zip', size: 1024 })).toBe('Certificate must be PDF, PNG, or JPEG');
  });

  it('returns error when file exceeds 5 MB', () => {
    expect(validateCertificateFile({ mimetype: 'application/pdf', size: 6 * 1024 * 1024 })).toBe('Certificate file must not exceed 5 MB');
  });

  it('checks mime type before size', () => {
    // Invalid mime type AND too large — should report mime type error first
    expect(validateCertificateFile({ mimetype: 'text/plain', size: 10 * 1024 * 1024 })).toBe('Certificate must be PDF, PNG, or JPEG');
  });
});

describe('validateCIN', () => {
  it('returns null when cin is not provided', () => {
    expect(validateCIN(null)).toBeNull();
    expect(validateCIN(undefined)).toBeNull();
    expect(validateCIN('')).toBeNull();
  });

  it('returns null for valid 21-character alphanumeric CIN', () => {
    expect(validateCIN('U12345MH2020PTC123456')).toBeNull();
    expect(validateCIN('ABCDEFGHIJKLMNOPQRSTU')).toBeNull();
  });

  it('returns error for incorrect length', () => {
    expect(validateCIN('U12345')).toBe('CIN must be exactly 21 alphanumeric characters');
    expect(validateCIN('U12345MH2020PTC1234567')).toBe('CIN must be exactly 21 alphanumeric characters');
  });

  it('returns error for special characters', () => {
    expect(validateCIN('U12345-H2020PTC12345!')).toBe('CIN must be exactly 21 alphanumeric characters');
  });
});
