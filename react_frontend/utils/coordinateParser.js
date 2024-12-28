// ./utils/coordinateParser.js

/**
 * Utility function: determines how many decimal places are in a numeric string.
 * E.g., "12.345" -> 3. If there's no decimal point, returns 0.
 */
export function determinePrecision(valueStr) {
  if (!valueStr.includes('.')) {
    return 0;
  }
  return valueStr.split('.').pop().length;
}

/**
 * Public function: Convert RA/Dec from one format to another.
 * 
 * @param {string} inputString         The input RA and Dec string.
 * @param {object} options             Named options to replicate python kwargs.
 * @param {string} options.inputFormat  Possible values: 'hmsdms', 'degrees', 'casa'.
 * @param {string} options.outputFormat Possible values: 'degrees', 'hmsdms', 'casa'.
 * @param {string} options.internalDelimiter   Delimiter between H:M:S or D:M:S in output (e.g. ':' or ' ').
 * @param {string} options.raDecDelimiter      Delimiter between RA and Dec in the final output (e.g. '\t', ', ', etc).
 * @param {boolean} options.raOnly             If true, only return RA portion.
 * @param {boolean} options.decOnly            If true, only return Dec portion.
 * @param {number} options.raPrecision         Desired decimal precision for RA part (override).
 * @param {number} options.decPrecision        Desired decimal precision for Dec part (override).
 * 
 * @returns {string} The converted coordinate (RA, Dec).
 */
export function raDecConverter(
  inputString,
  {
    inputFormat = 'hmsdms',
    outputFormat = 'degrees',
    internalDelimiter = null,
    raDecDelimiter = '\t',
    raOnly = false,
    decOnly = false,
    raPrecision = null,
    decPrecision = null
  } = {}
) {
  // Decide default internal delimiter if none provided
  if (internalDelimiter === null) {
    if (outputFormat === 'hmsdms') {
      internalDelimiter = ':';
    } else {
      // For 'degrees' or 'casa'
      internalDelimiter = ' ';
    }
  }

  // Clean input: remove leading/trailing whitespace
  let inp = inputString.trim();

  // Remove epoch markers like J2000, j2000.0, etc.
  // This regex matches 'J2000', 'j2000', 'J 2000.0', etc. and removes them.
  inp = inp.replace(/\b[Jj]\s*2000\.?0?\b\s*/g, '').trim();

  // 1) Split RA and Dec from the input
  const [raPart, decPart] = splitRaDec(inp, inputFormat);

  // 2) Convert RA to degrees
  const { value: raVal, inprec: raInPrec } = parseToDegrees(raPart, true, inputFormat);

  // 3) Convert Dec to degrees
  const { value: decVal, inprec: decInPrec } = parseToDegrees(decPart, false, inputFormat);

  // Validate RA range
  if (raVal < 0 || raVal >= 360) {
    throw new Error(`RA must be [0..360): ${raVal}`);
  }
  // Validate Dec range
  if (decVal < -90 || decVal > 90) {
    throw new Error(`Dec must be [-90..+90]: ${decVal}`);
  }

  // 4) Decide final precision
  const finalRaPrecision = (raPrecision !== null) ? raPrecision : raInPrec;
  const finalDecPrecision = (decPrecision !== null) ? decPrecision : decInPrec;

  // 5) Format output based on desired output_format
  let raStr, decStr;
  if (outputFormat === 'degrees') {
    raStr = formatDegrees(raVal, finalRaPrecision, false);
    decStr = formatDegrees(decVal, finalDecPrecision, true);
  } else if (outputFormat === 'hmsdms') {
    raStr = degreesToHms(raVal, finalRaPrecision, internalDelimiter);
    decStr = degreesToDms(decVal, finalDecPrecision, internalDelimiter);
  } else {
    // 'casa'
    raStr = degreesToHms(raVal, finalRaPrecision, ':');
    decStr = degreesToCasaDec(decVal, finalDecPrecision);
  }

  if (raOnly) return raStr;
  if (decOnly) return decStr;

  return `${raStr}${raDecDelimiter}${decStr}`;
}

/**
 * Split an input string into RA and Dec parts, given the input format.
 */
function splitRaDec(inputStr, inFmt) {
  const s = inputStr.trim();

  if (inFmt === 'casa') {
    // e.g. "09:54:56.82, +17.43.31.22"
    // We assume comma or whitespace separation
    const parts = s.split(/[,\s]+/);
    if (parts.length !== 2) {
      throw new Error(`Expected 2 tokens for CASA input: got ${parts}`);
    }
    return [parts[0], parts[1]];
  } else if (inFmt === 'hmsdms') {
    // Attempt to match RA up to first sign of DEC
    // e.g. "12:34:56.78 +12:34:56.78" or "12h34m56.78s +12d34m56.78s"
    // We'll try a capturing group for sign:
    const m = s.replace(',', ' ').match(/^(.*?)([+\-]\d.*)$/);
    if (m) {
      return [m[1].trim(), m[2].trim()];
    }
    // fallback: split by whitespace
    const parts = s.split(/\s+/);
    if (parts.length === 2) {
      return [parts[0], parts[1]];
    }
    throw new Error(`Cannot split hmsdms input: '${s}'`);
  } else {
    // 'degrees'
    const parts = s.split(/[,\s]+/);
    if (parts.length === 2) {
      return [parts[0], parts[1]];
    }
    // fallback sign-based
    const pat = /^(.*?)([+\-]\d.*)$/;
    const m2 = s.match(pat);
    if (m2) {
      return [m2[1].trim(), m2[2].trim()];
    }
    throw new Error(`Cannot split degrees input: '${s}'`);
  }
}

/**
 * Parse a single RA or Dec string into decimal degrees, depending on input format.
 * isRa=true => interpret as hours/min/sec => multiply final by 15 for RA in degrees.
 */
function parseToDegrees(coordStr, isRa, inputFormat) {
  const c = coordStr.trim();

  // Check for CASA decimal format (DD.MM.SS) when input_format is 'degrees'
  if (inputFormat === 'degrees') {
    const dotCount = (c.match(/\./g) || []).length;
    if (dotCount >= 2) {
      throw new Error(`Check input format (deg): ${c}`);
    }
    // Check for any HMS/DMS format indicators
    if (c.includes(':') || /[hHdD°mM'sS"]/.test(c)) {
      throw new Error(`Check input format (deg): ${c}`);
    }
  }

  if (inputFormat === 'casa') {
    if (isRa) {
      // E.g. RA "09:54:56.82"
      const { h, m, s } = parseRaColonStrict(c);
      const prec = determinePrecision(s);
      const valHrs = hmsToDecimalHours(parseFloat(h), parseFloat(m), parseFloat(s));
      return { value: valHrs * 15.0, inprec: prec };
    } else {
      // Dec is "±DD.MM.SS(.sss)"
      const { decVal, prec } = parseCasaDottedDec(c);
      return { value: decVal, inprec: prec };
    }
  } else if (inputFormat === 'hmsdms') {
    const { h, m, s } = parseHmsOrDms(c);
    const inprec = determinePrecision(s);
    if (isRa) {
      const valHrs = hmsToDecimalHours(parseFloat(h), parseFloat(m), parseFloat(s));
      return { value: valHrs * 15.0, inprec };
    } else {
      const degVal = dmsToDegrees(h, m, s);
      return { value: degVal, inprec };
    }
  } else {
    // 'degrees'
    if (c.includes(':')) {
      // parse as d:m:s
      const { h, m, s } = parseHmsOrDms(c);
      const inprec = determinePrecision(s);
      const degVal = dmsToDegrees(h, m, s);
      return { value: degVal, inprec };
    } else {
      // parse as a float
      const val = parseFloat(c);
      if (Number.isNaN(val)) {
        throw new Error(`Cannot parse '${c}' as decimal degrees.`);
      }
      const prec = determinePrecision(c);
      return { value: val, inprec: prec };
    }
  }
}

/**
 * Strictly parse CASA RA string "HH:MM:SS(.sss)" => [h, m, s].
 */
function parseRaColonStrict(raStr) {
  const parts = raStr.split(':');
  if (parts.length !== 3) {
    throw new Error(`CASA RA must have exactly 3 colon fields, got '${raStr}'`);
  }
  return { h: parts[0], m: parts[1], s: parts[2] };
}

/**
 * Parse CASA dotted dec: "±DD.MM.SS(.ss)" => sign, dd, mm, ss => decimal deg.
 */
function parseCasaDottedDec(decStr) {
  // Modified pattern to make sign optional
  const pattern = /^([+\-])?(\d{1,3})\.(\d{1,2})\.(\d{1,2}(\.\d+)?)$/;
  const m = decStr.match(pattern);
  if (!m) {
    throw new Error(`Invalid CASA dec: '${decStr}' (should be [±]DD.MM.SS(.ss))`);
  }
  const signChar = m[1] || '+';  // Default to '+' if no sign present
  const d = parseFloat(m[2]);
  const mm = parseFloat(m[3]);
  const ssStr = m[4]; // includes decimals
  const sign = (signChar === '-') ? -1 : 1;
  
  const ssf = parseFloat(ssStr);
  const prec = determinePrecision(ssStr);
  const decVal = sign * (d + mm / 60 + ssf / 3600);
  return { decVal, prec };
}

/**
 * Parse strings like "12h34m56.7s" or "351:14:45.00" => { h, m, s }
 */
function parseHmsOrDms(coordStr) {
  // Remove h/m/s/d/°/'/"
  const cleaned = coordStr.replace(/[hHdD°mM'sS"]/g, ' ');
  // Split by colon or whitespace
  const tokens = cleaned.trim().split(/[:\s]+/).filter(Boolean);

  if (tokens.length === 0) {
    return { h: '0', m: '0', s: '0' };
  } else if (tokens.length === 1) {
    return { h: tokens[0], m: '0', s: '0' };
  } else if (tokens.length === 2) {
    return { h: tokens[0], m: tokens[1], s: '0' };
  } else {
    return { h: tokens[0], m: tokens[1], s: tokens[2] };
  }
}

/**
 * Convert H:M:S (in hours) to decimal hours. 
 * E.g. h=12, m=30, s=0 => 12.5 hours
 */
function hmsToDecimalHours(h, m, s) {
  if (h < 0 || h >= 24) {
    throw new Error(`Hours out of range [0..24): ${h}`);
  }
  if (m < 0 || m >= 60) {
    throw new Error(`Minutes out of range [0..60): ${m}`);
  }
  if (s < 0 || s >= 60) {
    throw new Error(`Seconds out of range [0..60): ${s}`);
  }
  return h + m / 60.0 + s / 3600.0;
}

/**
 * Convert D:M:S to decimal degrees (with sign).
 */
function dmsToDegrees(d, m, s) {
  let sign = 1;
  let dStr = String(d).trim();
  if (dStr.startsWith('-')) {
    sign = -1;
    dStr = dStr.slice(1);
  } else if (dStr.startsWith('+')) {
    dStr = dStr.slice(1);
  }
  const dd = parseFloat(dStr) || 0.0;
  const mm = parseFloat(m) || 0.0;
  const ss = parseFloat(s) || 0.0;

  if (mm < 0 || mm >= 60) {
    throw new Error(`Minutes out of range [0..60): ${mm}`);
  }
  if (ss < 0 || ss >= 60) {
    throw new Error(`Seconds out of range [0..60): ${ss}`);
  }
  const degVal = dd + mm / 60.0 + ss / 3600.0;
  return sign * degVal;
}

/**
 * Format a decimal degree value with the given precision.
 * If forceSign is true, then we produce e.g. "+12.345" or "-12.345".
 */
function formatDegrees(value, precision, forceSign = false) {
  const signStr = forceSign ? (value >= 0 ? '+' : '-') : '';
  const absVal = forceSign ? Math.abs(value) : value;
  // toFixed can handle the rounding
  return `${signStr}${absVal.toFixed(precision)}`;
}

/**
 * Convert degrees => "HH:MM:SS" with given precision in the seconds.
 */
function degreesToHms(degVal, precision = 2, delimiter = ':') {
  const hours = (degVal / 15.0) % 24;
  const hh = Math.floor(hours);
  let remainder = hours - hh;
  const mm = Math.floor(remainder * 60);
  remainder = remainder * 60 - mm;
  let ss = remainder * 60;

  // Round ss to `precision`
  ss = parseFloat(ss.toFixed(Math.max(precision, 0)));

  const sStr = twoDigitLeft(ss, precision);
  const hhStr = hh.toString().padStart(2, '0');
  const mmStr = mm.toString().padStart(2, '0');

  return `${hhStr}${delimiter}${mmStr}${delimiter}${sStr}`;
}

/**
 * Convert degrees => "±DD:MM:SS" with given precision in the seconds.
 */
function degreesToDms(degVal, precision = 2, delimiter = ':') {
  const sign = degVal < 0 ? '-' : '+';
  const v = Math.abs(degVal);
  const dd = Math.floor(v);
  let remainder = v - dd;
  const mm = Math.floor(remainder * 60);
  remainder = remainder * 60 - mm;
  let ss = remainder * 60;

  ss = parseFloat(ss.toFixed(Math.max(precision, 0)));

  const ddStr = dd.toString().padStart(2, '0');
  const mmStr = mm.toString().padStart(2, '0');
  const sStr = twoDigitLeft(ss, precision);

  return `${sign}${ddStr}${delimiter}${mmStr}${delimiter}${sStr}`;
}

/**
 * Convert degrees => CASA dec => "±DD.MM.SS(.sss)"
 */
function degreesToCasaDec(degVal, precision = 2) {
  const sign = degVal < 0 ? '-' : '+';
  const v = Math.abs(degVal);
  const dd = Math.floor(v);
  let remainder = v - dd;
  const mm = Math.floor(remainder * 60);
  remainder = remainder * 60 - mm;
  let ss = parseFloat((remainder * 60).toFixed(precision));

  const ddStr = dd.toString().padStart(2, '0');
  const mmStr = mm.toString().padStart(2, '0');

  let sStr;
  if (precision > 0) {
    // e.g. "12.34"
    sStr = ss.toFixed(precision).padStart(2 + 1 + precision, '0');
  } else {
    // integer
    sStr = String(ss.toFixed(0)).padStart(2, '0');
  }

  return `${sign}${ddStr}.${mmStr}.${sStr}`;
}

/**
 * Helper: produce string with 2 digits left of decimal point (min),
 * plus 'precision' decimal digits if needed. E.g. 8.9 => "08.90".
 */
function twoDigitLeft(value, precision) {
  const valRounded = parseFloat(value.toFixed(precision));
  let baseStr = valRounded.toFixed(precision); // e.g. "8.90"

  // If there's a decimal point
  if (baseStr.includes('.')) {
    const [intPart, fracPart] = baseStr.split('.');
    if (intPart.length === 1) {
      return `0${intPart}.${fracPart}`;
    }
    return baseStr;
  } else {
    // No decimal => purely an integer
    if (baseStr.length === 1) {
      return `0${baseStr}`;
    }
    return baseStr;
  }
}
