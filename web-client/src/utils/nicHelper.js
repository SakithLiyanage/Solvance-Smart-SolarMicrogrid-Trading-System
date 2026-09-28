// ============================================================================
// File: nicHelper.js
// Project: Solvance — Smart Solar Microgrid Trading System
// Description: Sri Lankan National Identity Card (NIC) parsing, digital e-KYC document generator, and trust risk assessment engine.
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
    detail: isAgeValid 
      ? `Age ${nicInfo.estimatedAge} (${nicInfo.gender}, born ${nicInfo.birthYear})` 
      : 'Applicant must be at least 18 years old',
    passed: isAgeValid
  });

  // 3. Solar Installation Capacity Check
  const capacity = user?.solarCapacityKw || 0;
  const isCapacityValid = capacity >= 0.5 && capacity <= 1000;
  checks.push({
    title: 'Solar Generation Specification',
    detail: isCapacityValid 
      ? `${capacity} kW array • Inverter: ${user?.inverterSerial || 'Default'}` 
      : 'Capacity must be between 0.5 kW and 1000 kW',
    passed: isCapacityValid
  });

  // 4. Identity Document Attachment Check
  const hasFrontDoc = Boolean(user?.nicDocumentBase64);
  const hasBackDoc = Boolean(user?.nicBackDocumentBase64);
  checks.push({
    title: 'NIC Identification Documents',
    detail: hasFrontDoc && hasBackDoc 
      ? 'Both Front and Back card copies attached' 
      : hasFrontDoc 
      ? 'Front card copy attached (Back pending)' 
      : 'Card copies pending upload',
    passed: hasFrontDoc || hasBackDoc
  });

  const passedCount = checks.filter(c => c.passed).length;
  const allPassed = isNicValid && isAgeValid && isCapacityValid;
  const verificationStatus = allPassed ? 'Verified & Eligible' : 'Requires Review';

  return {
    score: Math.round((passedCount / checks.length) * 100),
    maxScore: 100,
    status: verificationStatus,
    riskLevel: allPassed ? 'Eligible' : 'Needs Review',
    badgeColor: allPassed ? 'emerald' : 'amber',
    nicInfo,
    hasFrontDoc,
    hasBackDoc,
    checks,
    allPassed
  };
}

/**
 * Generates an SVG data URI of a Sri Lankan National Identity Card (Front Side) for preview.
 */
export function generateMockNicCardSvg(nic, fullName, birthYear, gender, address) {
  const cleanNic = (nic || '200012345678').toUpperCase();
  const cleanName = (fullName || 'SUNIL SHANTHA').toUpperCase();
  const cleanYear = birthYear || '2000';
  const cleanGender = (gender || 'MALE').toUpperCase();
  const cleanAddress = address || 'No. 45, Galle Road, Colombo 03';

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="100%" height="100%">
    <defs>
      <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>
    
    <!-- Outer Card Frame -->
    <rect x="4" y="4" width="592" height="352" rx="16" fill="url(#cardBg)" stroke="#334155" stroke-width="2" />
    
    <!-- Top Header Bar -->
    <rect x="20" y="20" width="560" height="44" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
    <text x="36" y="44" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#f8fafc" letter-spacing="1">DEMOCRATIC SOCIALIST REPUBLIC OF SRI LANKA</text>
    <text x="36" y="56" font-family="system-ui, sans-serif" font-size="9" font-weight="500" fill="#94a3b8">NATIONAL IDENTITY CARD / ජාතික හැඳුනුම්පත</text>
    
    <!-- Photo ID Area -->
    <rect x="36" y="80" width="116" height="144" rx="8" fill="#090d16" stroke="#334155" stroke-width="1.5" />
    <circle cx="94" cy="130" r="28" fill="#334155" />
    <path d="M 60 205 C 60 168, 128 168, 128 205 Z" fill="#475569" />
    <text x="94" y="218" font-family="system-ui, sans-serif" font-size="8" font-weight="600" fill="#64748b" text-anchor="middle">PHOTO ID</text>
    
    <!-- Card Data Fields -->
    <text x="176" y="96" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">IDENTITY NUMBER / හැඳුනුම්පත් අංකය</text>
    <text x="176" y="118" font-family="monospace" font-size="17" font-weight="800" fill="#f59e0b" letter-spacing="1">${cleanNic}</text>
    
    <text x="176" y="146" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">FULL NAME / සම්පූර්ණ නම</text>
    <text x="176" y="164" font-family="system-ui, sans-serif" font-size="13" font-weight="700" fill="#ffffff">${cleanName}</text>
    
    <text x="176" y="194" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">GENDER / ස්ත්‍රී-පුරුෂ භාවය</text>
    <text x="176" y="210" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#cbd5e1">${cleanGender}</text>
    
    <text x="290" y="194" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">YEAR OF BIRTH / උපන් වර්ෂය</text>
    <text x="290" y="210" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#cbd5e1">${cleanYear}</text>
    
    <text x="176" y="240" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">ADDRESS / ලිපිනය</text>
    <text x="176" y="256" font-family="system-ui, sans-serif" font-size="10" font-weight="500" fill="#94a3b8">${cleanAddress}</text>
    
    <!-- Bottom Footer Bar -->
    <rect x="20" y="280" width="560" height="52" rx="8" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    <text x="36" y="304" font-family="monospace" font-size="11" font-weight="600" fill="#475569" letter-spacing="3">IDLKA${cleanNic}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="36" y="322" font-family="monospace" font-size="11" font-weight="600" fill="#475569" letter-spacing="3">${cleanYear}01017M&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;LKA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}

/**
 * Generates an SVG data URI of the Back Side of a Sri Lankan National Identity Card.
 */
export function generateMockNicBackSvg(nic, fullName, birthYear, address) {
  const cleanNic = (nic || '200012345678').toUpperCase();
  const cleanName = (fullName || 'SUNIL SHANTHA').toUpperCase();
  const cleanYear = birthYear || '2000';
  const cleanAddress = (address || 'No. 45, Galle Road, Colombo 03').toUpperCase();

  const svgString = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 360" width="100%" height="100%">
    <defs>
      <linearGradient id="cardBgBack" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#0f172a" />
      </linearGradient>
    </defs>

    <!-- Outer Card Frame -->
    <rect x="4" y="4" width="592" height="352" rx="16" fill="url(#cardBgBack)" stroke="#334155" stroke-width="2" />
    
    <!-- Top Header -->
    <rect x="20" y="20" width="560" height="38" rx="8" fill="#0f172a" stroke="#1e293b" stroke-width="1" />
    <text x="36" y="44" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#cbd5e1" letter-spacing="1">DEPARTMENT OF REGISTRATION OF PERSONS — REVERSE SIDE</text>

    <!-- Details Box -->
    <rect x="20" y="70" width="370" height="190" rx="8" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    
    <text x="36" y="96" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">PERMANENT RESIDENCE</text>
    <text x="36" y="114" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#f8fafc">${cleanAddress}</text>

    <text x="36" y="144" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">ADMINISTRATIVE DISTRICT</text>
    <text x="36" y="162" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#94a3b8">COLOMBO / WESTERN PROVINCE</text>

    <text x="36" y="192" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">RECORD IDENTIFIER</text>
    <text x="36" y="210" font-family="monospace" font-size="11" font-weight="600" fill="#f59e0b">REF-${cleanNic}</text>

    <text x="36" y="238" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#64748b">REGISTERED CITIZEN</text>

    <!-- Barcode Box -->
    <rect x="404" y="70" width="176" height="190" rx="8" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    <g transform="translate(420, 95)">
      <rect x="0" y="0" width="144" height="60" fill="#ffffff" rx="4" />
      <g fill="#000000">
        <rect x="8" y="6" width="3" height="48" />
        <rect x="14" y="6" width="2" height="48" />
        <rect x="18" y="6" width="5" height="48" />
        <rect x="26" y="6" width="2" height="48" />
        <rect x="31" y="6" width="4" height="48" />
        <rect x="38" y="6" width="2" height="48" />
        <rect x="43" y="6" width="6" height="48" />
        <rect x="52" y="6" width="3" height="48" />
        <rect x="58" y="6" width="2" height="48" />
        <rect x="63" y="6" width="5" height="48" />
        <rect x="71" y="6" width="3" height="48" />
        <rect x="77" y="6" width="2" height="48" />
        <rect x="82" y="6" width="5" height="48" />
        <rect x="90" y="6" width="3" height="48" />
        <rect x="96" y="6" width="4" height="48" />
        <rect x="103" y="6" width="2" height="48" />
        <rect x="108" y="6" width="5" height="48" />
        <rect x="116" y="6" width="3" height="48" />
        <rect x="122" y="6" width="6" height="48" />
        <rect x="131" y="6" width="4" height="48" />
      </g>
    </g>
    <text x="492" y="176" font-family="monospace" font-size="9" fill="#94a3b8" text-anchor="middle">*${cleanNic}*</text>
    <text x="492" y="210" font-family="system-ui, sans-serif" font-size="8" fill="#64748b" text-anchor="middle">OFFICIAL GOVERNMENT COPY</text>

    <!-- Bottom MRZ -->
    <rect x="20" y="272" width="560" height="58" rx="8" fill="#0b1120" stroke="#1e293b" stroke-width="1" />
    <text x="36" y="296" font-family="monospace" font-size="11" font-weight="600" fill="#475569" letter-spacing="3">I&lt;LKA${cleanNic}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="36" y="316" font-family="monospace" font-size="11" font-weight="600" fill="#475569" letter-spacing="3">${cleanYear}01017M3012316LKA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
