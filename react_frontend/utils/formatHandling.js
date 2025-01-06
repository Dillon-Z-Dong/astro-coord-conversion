/**
 * Post-process HMS/DMS format with letters
 */
export function postprocessHmsDms(output, delimiter) {
  if (delimiter !== 'hms') {
    return output;
  }
  
  // RA pattern: (\d+):(\d+):(\d+(\.\d+)?)
  let str = output.replace(
    /\b(\d+):(\d+):(\d+(\.\d+)?)(?![.\d])\b/g,
    (m, p1, p2, p3) => `${p1}h${p2}m${p3}s`
  );
  
  // Dec pattern: ([+\-]\d+):(\d+):(\d+(\.\d+)?)
  str = str.replace(
    /([+\-]\d+):(\d+):(\d+(\.\d+)?)/g,
    (m, p1, p2, p3) => {
      const sign = p1.charAt(0);
      const dd = p1.slice(1);
      return `${sign}${dd}d${p2}m${p3}s`;
    }
  );
  return str;
}

/**
 * Split output by the chosen delimiter
 */
export function splitByOutputDelimiter(str, delimiter) {
  if (delimiter === ' | ') return str.split(' | ');
  if (delimiter === '\t') return str.split('\t');
  if (delimiter === ',') return str.split(',');
  return str.trim().split(/\s+/);
}

/**
 * Return the exact character to show between RA and Dec in the results panel
 */
export function displayDelimiter(delim) {
  if (delim === '\t') return '\t';
  if (delim === ',') return ',';
  if (delim === ' | ') return '|'; 
  return ' ';
}

/**
 * Get placeholder examples for a given format
 */
export function getPlaceholderExamples(format) {
  switch (format) {
    case 'hmsdms':
      return [
        'J2000 12:34:56.78, +12:34:56.78',
        '12h34m56.78s -12d34m56',
        '12 34 56 +12°34\'56\'\'',
        '1 2 3 +1 2 3'
      ].join('\n');
    case 'degrees':
      return [
        '188.7366, +12.5824',
        '188.736600 12.582400',
        '10.5 -45.6'
      ].join('\n');
    case 'casa':
      return [
        '12:34:56.78 +12.34.56.78',
        '12:34:56 12.34.56',
        '1:2:3 -1.2.3'
      ].join('\n');
    default:
      return '';
  }
}