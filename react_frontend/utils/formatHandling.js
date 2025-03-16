/**
 * Split output by the chosen delimiter
 */
export function splitByOutputDelimiter(str, delimiter) {
  if (!str) return ['', ''];
  
  if (delimiter === ' | ') return str.split(' | ');
  if (delimiter === '\t') return str.split('\t');
  if (delimiter === ',') return str.split(',');
  
  // Special handling for space delimiter
  if (delimiter === ' ') {
    // Look for the sign character (+/-) that typically starts Dec values
    const match = str.match(/^(.*?)\s+([+\-].*)$/);
    if (match) {
      return [match[1], match[2]];
    }
  }
  
  // Default fallback
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
        '188.736615 12.582432',
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