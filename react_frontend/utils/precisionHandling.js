import { PRECISION_MAP } from '../constants/converterOptions';

/**
 * Adjust RA/Dec precision for "match input" logic
 */
export function computeMatchedPrecisions(inputFmt, outputFmt, raInPrec, decInPrec) {
  let raOut = raInPrec;
  let decOut = decInPrec;

  const isInputDegrees = inputFmt === 'degrees';
  const isOutputDegrees = outputFmt === 'degrees';
  const isHmsLike = fmt => ['hmsdms', 'casa'].includes(fmt);

  if (isInputDegrees && isHmsLike(outputFmt)) {
    raOut = raInPrec - 2;
    decOut = decInPrec - 3;
  } else if (isHmsLike(inputFmt) && isOutputDegrees) {
    raOut = raInPrec + 3;
    decOut = decInPrec + 3;
  }

  raOut = Math.min(Math.max(raOut, 0), 10);
  decOut = Math.min(Math.max(decOut, 0), 10);

  return { raOut, decOut };
}


/**
 * Called for each RA/Dec precision in "degrees" or "hmsdms" to get a single-value error
 */
export function getSingleError(fmt, precision, isRa) {
    let p = Math.max(0, Math.min(10, parseInt(precision, 10) || 0));
  
    if (fmt === 'degrees') {
      const base = (PRECISION_MAP.degrees[p] || "").replace('±', '').trim();
      return scaleErrorString(base);
    } else {
      const tokens = (PRECISION_MAP.hmsdms[p] || "").split(',');
      const idx = isRa ? 0 : 1;
      const valStr = tokens[idx] || "";
      const clean = valStr.replace(/[±()]/g, '').replace('RA', '').replace('Dec', '').trim();
      return scaleErrorString(clean);
    }
  }

  /**
 * For single-value errors (e.g. "1.8 arcsec") we scale to keep the numeric
 * in the range [0.1..999], switching among arcsec <-> mas <-> μas.
 */
export function scaleErrorString(errStr) {
    const plusMinusMatch = errStr.match(/^[+\-±]/) ? errStr[0] : ''; 
    let noSign = errStr.replace(/^[+\-±]/, '').trim();
  
    const m = noSign.match(/^([\d.]+)\s*(arcsec|mas|μas)$/);
    if (!m) return errStr;
  
    let numeric = parseFloat(m[1]);
    let unit = m[2];
  
    const chain = ["arcsec", "mas", "μas"];
    let idx = chain.indexOf(unit);
    if (idx === -1) return errStr;
  
    while (numeric < 0.1 && idx < chain.length - 1) {
      numeric *= 1000;
      idx += 1;
    }
    while (numeric >= 1000 && idx > 0) {
      numeric /= 1000;
      idx -= 1;
    }
  
    const scaled = parseFloat(numeric.toFixed(3));
    const newUnit = chain[idx];
    return `${plusMinusMatch}${scaled} ${newUnit}`;
  }