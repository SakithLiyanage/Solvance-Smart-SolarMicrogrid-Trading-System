// ============================================================================
// File: nicHelper.js
// Project: Solvance — Smart Solar Microgrid Trading System
// Description: Sri Lankan National Identity Card (NIC) parsing and prosumer eligibility verification.
// References:
//   - Sri Lanka Department of Registration of Persons NIC Specifications:
//     Old (9 digits + V/X) and New (12 numeric digits) formats.
// ============================================================================

/**
 * Parses and validates a Sri Lankan NIC string.
 * @param {string} nicStr - The NIC string to validate.
 * @returns {object} Analysis result with isValid, format, birthYear, gender, dayOfYear, error.
 */
export function parseSriLankanNic(nicStr) {
  if (!nicStr || typeof nicStr !== 'string') {
    return { isValid: false, error: 'NIC cannot be empty' };
  }

  const clean = nicStr.trim().toUpperCase();

  // Pattern 1: Old NIC (9 digits + V or X)
  const oldRegex = /^([0-9]{9})([VX])$/;
  // Pattern 2: New NIC (12 digits)
  const newRegex = /^([0-9]{12})$/;

  if (oldRegex.test(clean)) {
    const yearDigits = parseInt(clean.substring(0, 2), 10);
    const birthYear = 1900 + yearDigits;
    const dayDigits = parseInt(clean.substring(2, 5), 10);
    const suffix = clean.substring(9, 10);

    let gender = 'Male';
    let dayOfYear = dayDigits;

    if (dayDigits > 500) {
      gender = 'Female';
      dayOfYear = dayDigits - 500;
    }

    if (dayOfYear < 1 || dayOfYear > 366) {
      return { isValid: false, error: 'Invalid day of year encoded in NIC (Out of bounds).' };
    }

    return {
      isValid: true,
      nic: clean,
      format: 'Old Format (9+1)',
      birthYear,
      gender,
      dayOfYear,
      suffix: suffix === 'V' ? 'Voter Eligible' : 'Non-Voter',
      estimatedAge: new Date().getFullYear() - birthYear
    };
  }

  if (newRegex.test(clean)) {
    const birthYear = parseInt(clean.substring(0, 4), 10);
    const dayDigits = parseInt(clean.substring(4, 7), 10);

    const currentYear = new Date().getFullYear();
    if (birthYear < 1900 || birthYear > currentYear) {
      return { isValid: false, error: `Invalid birth year '${birthYear}' encoded in NIC.` };
    }

    let gender = 'Male';
    let dayOfYear = dayDigits;

    if (dayDigits > 500) {
      gender = 'Female';
      dayOfYear = dayDigits - 500;
    }

    if (dayOfYear < 1 || dayOfYear > 366) {
      return { isValid: false, error: 'Invalid day of year encoded in NIC (Out of bounds).' };
    }

    return {
      isValid: true,
      nic: clean,
      format: 'New Format (12 Digits)',
      birthYear,
      gender,
      dayOfYear,
      suffix: 'National Digital Identity',
      estimatedAge: currentYear - birthYear
    };
  }

  return {
    isValid: false,
    error: 'Must be 9 digits with V/X (e.g. 981234567V) or 12 numeric digits (e.g. 200012345678).'
  };
}

/**
 * Evaluates prosumer registration requirements and algorithmic NIC validation.
 * @param {object} user - The prosumer entity.
 * @returns {object} Validation result, checks, and parsed NIC metadata.
 */
export function calculateKycTrustAssessment(user) {
  const nicInfo = parseSriLankanNic(user?.nic || '');
  const checks = [];

  // 1. NIC Structure check
  const isNicValid = Boolean(nicInfo.isValid);
  checks.push({
    title: 'Sri Lankan NIC Format',
    detail: isNicValid ? `${nicInfo.format} verified (${nicInfo.nic})` : (nicInfo.error || 'Invalid NIC format'),
    passed: isNicValid
  });

  // 2. Demographic & Age Check (18+ requirement)
  const isAgeValid = isNicValid && nicInfo.estimatedAge >= 18;
  checks.push({
    title: 'Minimum Age Requirement (18+)',
    detail: isNicValid
      ? (isAgeValid ? `Age ${nicInfo.estimatedAge} (${nicInfo.gender}, born ${nicInfo.birthYear})` : `Applicant under legal age (Age ${nicInfo.estimatedAge})`)
      : 'Requires valid NIC to calculate age',
    passed: isAgeValid
  });

  // 3. Solar Installation Capacity Check
  const capacity = Number(user?.solarCapacityKw) || 0;
  const isCapacityValid = capacity >= 0.5 && capacity <= 1000;
  checks.push({
    title: 'Solar Generation Specification',
    detail: isCapacityValid 
      ? `${capacity} kW array • Inverter: ${user?.inverterSerial || 'Standard'}` 
      : (capacity <= 0 ? 'Solar capacity not configured (0 kW)' : 'Capacity out of allowed range (0.5 - 1000 kW)'),
    passed: isCapacityValid
  });

  // 4. Identity Document Attachment Check (Front card copy is mandatory for visual verification)
  const hasFrontDoc = Boolean(user?.nicDocumentBase64 && String(user.nicDocumentBase64).trim().length > 0);
  const hasBackDoc = Boolean(user?.nicBackDocumentBase64 && String(user.nicBackDocumentBase64).trim().length > 0);
  const isDocumentsValid = hasFrontDoc;

  checks.push({
    title: 'NIC Identification Documents',
    detail: hasFrontDoc && hasBackDoc 
      ? 'Both Front and Reverse card copies uploaded' 
      : hasFrontDoc 
      ? 'Front card copy uploaded (Reverse pending)' 
      : 'Identity document not uploaded by applicant',
    passed: isDocumentsValid
  });

  const passedCount = checks.filter(c => c.passed).length;
  // allPassed requires: Valid NIC + 18+ Age + Valid Capacity + Uploaded Identity Document
  const allPassed = isNicValid && isAgeValid && isCapacityValid && isDocumentsValid;

  let statusLabel = 'NIC Verified';
  if (!isNicValid) {
    statusLabel = 'Invalid NIC';
  } else if (!hasFrontDoc) {
    statusLabel = 'Document Missing';
  } else if (!isAgeValid) {
    statusLabel = 'Underage';
  } else if (!isCapacityValid) {
    statusLabel = 'Capacity Error';
  }

  return {
    score: Math.round((passedCount / checks.length) * 100),
    maxScore: 100,
    status: allPassed ? 'Verified & Eligible' : 'Requires Review',
    statusLabel,
    badgeColor: allPassed ? 'emerald' : 'amber',
    nicInfo,
    hasFrontDoc,
    hasBackDoc,
    checks,
    allPassed
  };
}
