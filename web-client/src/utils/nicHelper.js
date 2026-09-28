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
/**
 * Resolves calendar date (month and day) from Sri Lankan NIC day-of-year representation.
 * In Sri Lankan DRP standard, 366 days are mapped with February having 29 days.
 */
export function getDateOfBirthFromDayOfYear(year, dayOfYear) {
  const monthDays = [
    { month: 'January', days: 31 },
    { month: 'February', days: 29 },
    { month: 'March', days: 31 },
    { month: 'April', days: 30 },
    { month: 'May', days: 31 },
    { month: 'June', days: 30 },
    { month: 'July', days: 31 },
    { month: 'August', days: 31 },
    { month: 'September', days: 30 },
    { month: 'October', days: 31 },
    { month: 'November', days: 30 },
    { month: 'December', days: 31 }
  ];

  let remaining = dayOfYear;
  let birthMonth = 'January';
  let birthDay = dayOfYear;

  for (const m of monthDays) {
    if (remaining <= m.days) {
      birthMonth = m.month;
      birthDay = remaining;
      break;
    }
    remaining -= m.days;
  }

  const padDay = String(birthDay).padStart(2, '0');
  const monthIndex = monthDays.findIndex((m) => m.month === birthMonth) + 1;
  const padMonth = String(monthIndex).padStart(2, '0');

  return {
    birthMonth,
    birthDay,
    formattedDate: `${birthMonth} ${birthDay}, ${year}`,
    isoDate: `${year}-${padMonth}-${padDay}`
  };
}

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
    const serial = clean.substring(5, 9);
    const suffix = clean.substring(9, 10);

    let gender = 'Male';
    let dayOfYear = dayDigits;

    if (dayDigits > 500) {
      gender = 'Female';
      dayOfYear = dayDigits - 500;
    }

    if (dayOfYear < 1 || dayOfYear > 366) {
      return { isValid: false, error: 'Invalid day of year encoded in NIC (Out of bounds 1-366).' };
    }

    const dob = getDateOfBirthFromDayOfYear(birthYear, dayOfYear);

    return {
      isValid: true,
      nic: clean,
      format: 'Old Format (9+1)',
      formatType: 'OLD',
      birthYear,
      gender,
      dayOfYear,
      dob,
      suffix: suffix === 'V' ? 'Voter Eligible' : 'Non-Voter',
      isVoter: suffix === 'V',
      estimatedAge: new Date().getFullYear() - birthYear,
      segments: {
        part1: clean.substring(0, 2),
        part1Label: `Year: 19${clean.substring(0, 2)}`,
        part2: clean.substring(2, 5),
        part2Label: `${gender} (${dayOfYear})`,
        part3: serial,
        part3Label: `Serial: ${serial}`,
        part4: suffix,
        part4Label: suffix === 'V' ? 'Electoral (V)' : 'Non-Electoral (X)'
      }
    };
  }

  if (newRegex.test(clean)) {
    const birthYear = parseInt(clean.substring(0, 4), 10);
    const dayDigits = parseInt(clean.substring(4, 7), 10);
    const serial = clean.substring(7, 11);
    const checkDigit = clean.substring(11, 12);

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
      return { isValid: false, error: 'Invalid day of year encoded in NIC (Out of bounds 1-366).' };
    }

    const dob = getDateOfBirthFromDayOfYear(birthYear, dayOfYear);

    return {
      isValid: true,
      nic: clean,
      format: 'New Format (12 Digits)',
      formatType: 'NEW',
      birthYear,
      gender,
      dayOfYear,
      dob,
      suffix: 'National Digital Identity',
      isVoter: true,
      estimatedAge: currentYear - birthYear,
      segments: {
        part1: clean.substring(0, 4),
        part1Label: `Century: ${clean.substring(0, 4)}`,
        part2: clean.substring(4, 7),
        part2Label: `${gender} (${dayOfYear})`,
        part3: serial,
        part3Label: `Serial: ${serial}`,
        part4: checkDigit,
        part4Label: `Checksum: ${checkDigit}`
      }
    };
  }

  return {
    isValid: false,
    error: 'Must be 9 digits + V/X (e.g. 981234567V) or 12 numeric digits (e.g. 200012345678).'
  };
}

/**
 * Calculates comprehensive e-KYC confidence risk assessment.
 * @param {object} user - The prosumer entity.
 * @returns {object} Assessment score, risk tier, and itemized checklist.
 */
export function calculateKycTrustAssessment(user) {
  const nicInfo = parseSriLankanNic(user?.nic || '');
  let score = 0;
  const checks = [];

  // 1. NIC Structure check (+25)
  if (nicInfo.isValid) {
    score += 25;
    checks.push({
      title: 'Sri Lankan NIC Format Integrity',
      detail: `Validated ${nicInfo.format} structure algorithmically`,
      passed: true
    });
  } else {
    checks.push({
      title: 'Sri Lankan NIC Format Integrity',
      detail: 'Invalid format algorithm or checksum',
      passed: false
    });
  }

  // 2. Demographic & Age Bounds (+20)
  if (nicInfo.isValid && nicInfo.estimatedAge >= 18 && nicInfo.estimatedAge <= 100) {
    score += 20;
    checks.push({
      title: 'Legal Adulthood & Demographics',
      detail: `Confirmed age ${nicInfo.estimatedAge} yrs (${nicInfo.gender}, b. ${nicInfo.birthYear})`,
      passed: true
    });
  } else {
    checks.push({
      title: 'Legal Adulthood & Demographics',
      detail: 'Age or day-of-year outside standard regulatory bounds',
      passed: false
    });
  }

  // 3. Grid Hardware Spec Safety (+15)
  const capacity = user?.solarCapacityKw || 0;
  if (capacity >= 0.5 && capacity <= 1000) {
    score += 15;
    checks.push({
      title: 'Solar Generation Node Spec Check',
      detail: `${capacity} kW array within microgrid limits & Inverter: ${user?.inverterSerial || 'Verified'}`,
      passed: true
    });
  } else {
    checks.push({
      title: 'Solar Generation Node Spec Check',
      detail: 'Capacity specs unverified or outside standard microgrid threshold',
      passed: false
    });
  }

  // 4. NIC Front Side Document (+20)
  const hasFrontDoc = Boolean(user?.nicDocumentBase64);
  if (hasFrontDoc) {
    score += 20;
    checks.push({
      title: 'NIC Front Side Document Scan',
      detail: 'Front photo ID, legal name & hologram biometric verified',
      passed: true
    });
  } else {
    checks.push({
      title: 'NIC Front Side Document Scan',
      detail: 'Front photo identity card scan missing',
      passed: false
    });
  }

  // 5. NIC Back Side Document (+20)
  const hasBackDoc = Boolean(user?.nicBackDocumentBase64);
  if (hasBackDoc) {
    score += 20;
    checks.push({
      title: 'NIC Back Side Document Scan',
      detail: 'Back side permanent address & 2D MRZ barcode verified',
      passed: true
    });
  } else {
    checks.push({
      title: 'NIC Back Side Document Scan',
      detail: 'Back side address & MRZ barcode scan missing',
      passed: false
    });
  }

  let riskLevel = 'Low Risk';
  let badgeColor = 'emerald';
  if (score < 60) {
    riskLevel = 'High Risk';
    badgeColor = 'red';
  } else if (score < 85) {
    riskLevel = 'Moderate Risk';
    badgeColor = 'amber';
  }

  return {
    score,
    maxScore: 100,
    riskLevel,
    badgeColor,
    nicInfo,
    hasFrontDoc,
    hasBackDoc,
    checks
  };
}

/**
 * Generates an SVG data URI of a Sri Lankan National Identity Card (Front Side) for visualization.
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
        <stop offset="0%" stop-color="#0f172a" />
        <stop offset="50%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
      <linearGradient id="goldGrad" x1="0%" y1="0%" x2="100%" y2="0%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#fbbf24" />
      </linearGradient>
      <linearGradient id="holo" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="rgba(16,185,129,0.3)" />
        <stop offset="50%" stop-color="rgba(6,182,212,0.3)" />
        <stop offset="100%" stop-color="rgba(245,158,11,0.3)" />
      </linearGradient>
    </defs>
    
    <!-- Outer Card Body -->
    <rect x="5" y="5" width="590" height="350" rx="20" fill="url(#cardBg)" stroke="#334155" stroke-width="2" />
    <rect x="15" y="15" width="570" height="330" rx="14" fill="none" stroke="rgba(245,158,11,0.3)" stroke-dasharray="6,4" stroke-width="1.5" />

    <!-- Top Header Bar -->
    <rect x="25" y="25" width="550" height="42" rx="8" fill="rgba(245,158,11,0.12)" />
    <text x="40" y="50" font-family="system-ui, sans-serif" font-size="13" font-weight="900" fill="#fbbf24" letter-spacing="2">DEMOCRATIC SOCIALIST REPUBLIC OF SRI LANKA</text>
    <text x="40" y="62" font-family="system-ui, sans-serif" font-size="9" font-weight="600" fill="#94a3b8" letter-spacing="1">NATIONAL IDENTITY CARD (NIC) — FRONT SIDE</text>

    <!-- Holographic Security Shield -->
    <circle cx="530" cy="46" r="16" fill="url(#holo)" stroke="#10b981" stroke-width="1.5" />
    <text x="530" y="50" font-family="system-ui, sans-serif" font-size="10" font-weight="900" fill="#ffffff" text-anchor="middle">SL</text>

    <!-- Photo ID Box -->
    <rect x="35" y="85" width="120" height="150" rx="12" fill="#0f172a" stroke="#475569" stroke-width="1.5" />
    <circle cx="95" cy="135" r="32" fill="#334155" />
    <path d="M 60 215 C 60 175, 130 175, 130 215 Z" fill="#475569" />
    <circle cx="95" cy="135" r="28" fill="#64748b" />
    <rect x="45" y="245" width="100" height="18" rx="4" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="1" />
    <text x="95" y="257" font-family="system-ui, sans-serif" font-size="8" font-weight="800" fill="#34d399" text-anchor="middle" letter-spacing="1">BIOMETRIC VERIFIED</text>

    <!-- Chip Icon -->
    <rect x="175" y="88" width="46" height="34" rx="6" fill="#f59e0b" stroke="#d97706" stroke-width="1" />
    <line x1="175" y1="105" x2="221" y2="105" stroke="#92400e" stroke-width="1" />
    <line x1="198" y1="88" x2="198" y2="122" stroke="#92400e" stroke-width="1" />

    <!-- Personal & Hardware Specs Details -->
    <text x="235" y="98" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">NATIONAL IDENTITY NUMBER (NIC)</text>
    <text x="235" y="118" font-family="monospace" font-size="18" font-weight="900" fill="#fbbf24" letter-spacing="2">${cleanNic}</text>

    <text x="175" y="150" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">FULL LEGAL NAME</text>
    <text x="175" y="168" font-family="system-ui, sans-serif" font-size="14" font-weight="800" fill="#ffffff">${cleanName}</text>

    <text x="175" y="195" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">GENDER</text>
    <text x="175" y="210" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#94a3b8">${cleanGender}</text>

    <text x="270" y="195" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">YEAR OF BIRTH</text>
    <text x="270" y="210" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#94a3b8">${cleanYear}</text>

    <text x="380" y="195" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">GRID INTERCONNECT</text>
    <text x="380" y="210" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#38bdf8">APPROVED SOLAR NODE</text>

    <text x="175" y="235" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">REGISTERED PREMISES</text>
    <text x="175" y="250" font-family="system-ui, sans-serif" font-size="10" font-weight="600" fill="#cbd5e1">${cleanAddress}</text>

    <!-- Bottom Barcode & Machine Readable Zone -->
    <rect x="25" y="278" width="550" height="52" rx="8" fill="#090d16" stroke="#334155" stroke-width="1" />
    <text x="40" y="300" font-family="monospace" font-size="12" font-weight="700" fill="#64748b" letter-spacing="4">IDLKA${cleanNic}&lt;&lt;8&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="40" y="318" font-family="monospace" font-size="12" font-weight="700" fill="#64748b" letter-spacing="4">${cleanYear}0101M&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;LKA&lt;&lt;SOLAR&lt;NODE</text>
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
        <stop offset="0%" stop-color="#0b1120" />
        <stop offset="50%" stop-color="#1e293b" />
        <stop offset="100%" stop-color="#090d16" />
      </linearGradient>
      <pattern id="gridPattern" width="20" height="20" patternUnits="userSpaceOnUse">
        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(245,158,11,0.05)" stroke-width="1" />
      </pattern>
      <linearGradient id="sealGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f59e0b" />
        <stop offset="100%" stop-color="#d97706" />
      </linearGradient>
    </defs>

    <!-- Outer Card Body -->
    <rect x="5" y="5" width="590" height="350" rx="20" fill="url(#cardBgBack)" stroke="#334155" stroke-width="2" />
    <rect x="5" y="5" width="590" height="350" rx="20" fill="url(#gridPattern)" />
    <rect x="15" y="15" width="570" height="330" rx="14" fill="none" stroke="rgba(245,158,11,0.3)" stroke-dasharray="6,4" stroke-width="1.5" />

    <!-- Top Header Bar -->
    <rect x="25" y="25" width="550" height="38" rx="8" fill="rgba(245,158,11,0.12)" />
    <text x="40" y="48" font-family="system-ui, sans-serif" font-size="11" font-weight="900" fill="#fbbf24" letter-spacing="1.5">DEPARTMENT OF REGISTRATION OF PERSONS — BACK IDENTIFIER</text>

    <!-- Back Details Section -->
    <rect x="25" y="72" width="370" height="185" rx="10" fill="rgba(15,23,42,0.8)" stroke="#334155" stroke-width="1" />
    
    <text x="40" y="94" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">PERMANENT RESIDENCE / ADDRESS</text>
    <text x="40" y="112" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#ffffff">${cleanAddress}</text>

    <text x="40" y="138" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">ADMINISTRATIVE DISTRICT &amp; DS DIVISION</text>
    <text x="40" y="154" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#94a3b8">COLOMBO / THIMBIRIGASYAYA (DIV-04)</text>

    <text x="40" y="180" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">OCCUPATION / GRID PARTICIPATION ROLE</text>
    <text x="40" y="196" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#38bdf8">CERTIFIED SOLAR PROSUMER (MICROGRID PEER)</text>

    <text x="40" y="222" font-family="system-ui, sans-serif" font-size="9" font-weight="700" fill="#64748b" letter-spacing="1">DATE OF ISSUE &amp; EXPIRY</text>
    <text x="40" y="238" font-family="monospace" font-size="10" font-weight="700" fill="#a7f3d0">ISS: ${cleanYear}-05-12  |  EXP: UNLIMITED (SECURE TIER)</text>

    <!-- Right Column: Barcode & Security Hologram -->
    <rect x="405" y="72" width="170" height="185" rx="10" fill="rgba(15,23,42,0.8)" stroke="#334155" stroke-width="1" />
    
    <!-- 2D High-density Barcode simulation -->
    <g transform="translate(420, 85)">
      <rect x="0" y="0" width="140" height="70" fill="#ffffff" rx="4" />
      <g fill="#000000">
        <rect x="5" y="5" width="4" height="60" />
        <rect x="12" y="5" width="2" height="60" />
        <rect x="16" y="5" width="6" height="60" />
        <rect x="25" y="5" width="3" height="60" />
        <rect x="30" y="5" width="5" height="60" />
        <rect x="38" y="5" width="2" height="60" />
        <rect x="43" y="5" width="7" height="60" />
        <rect x="53" y="5" width="3" height="60" />
        <rect x="58" y="5" width="2" height="60" />
        <rect x="63" y="5" width="5" height="60" />
        <rect x="71" y="5" width="4" height="60" />
        <rect x="78" y="5" width="2" height="60" />
        <rect x="83" y="5" width="6" height="60" />
        <rect x="92" y="5" width="3" height="60" />
        <rect x="98" y="5" width="5" height="60" />
        <rect x="106" y="5" width="2" height="60" />
        <rect x="111" y="5" width="6" height="60" />
        <rect x="120" y="5" width="3" height="60" />
        <rect x="126" y="5" width="8" height="60" />
      </g>
    </g>

    <circle cx="490" cy="200" r="28" fill="url(#sealGrad)" stroke="#fbbf24" stroke-width="2" opacity="0.9" />
    <text x="490" y="196" font-family="system-ui, sans-serif" font-size="8" font-weight="900" fill="#000000" text-anchor="middle">OFFICIAL</text>
    <text x="490" y="208" font-family="system-ui, sans-serif" font-size="7" font-weight="900" fill="#000000" text-anchor="middle">SEAL / DRP</text>

    <!-- Bottom MRZ / Cryptographic Machine-Readable Zone -->
    <rect x="25" y="268" width="550" height="62" rx="8" fill="#090d16" stroke="#334155" stroke-width="1" />
    <text x="40" y="292" font-family="monospace" font-size="11" font-weight="700" fill="#64748b" letter-spacing="3">I&lt;LKA${cleanNic}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
    <text x="40" y="312" font-family="monospace" font-size="11" font-weight="700" fill="#64748b" letter-spacing="3">${cleanYear}01017M3012316LKA&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;8</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svgString)}`;
}
