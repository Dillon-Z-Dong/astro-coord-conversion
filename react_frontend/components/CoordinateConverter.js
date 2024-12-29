// ./components/CoordinateConverter.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { raDecConverter } from '../utils/coordinateParser';


const MAX_ROWS = 5000; // Set a reasonable maximum that won't crash the browser

/**
 * Large-scale maps of typical rounding error for reference. We only use them
 * as a base, then we re-scale to pick arcsec/mas/μas as appropriate.
 */
const PRECISION_MAP = {
  hmsdms: {
    0: "± 7.5 arcsec (RA), ± 0.5 arcsec (Dec)",
    1: "± 0.75 arcsec (RA), ± 50 mas (Dec)",
    2: "± 75 mas (RA), ± 5 mas (Dec)",
    3: "± 7.5 mas (RA), ± 0.5 mas (Dec)",
    4: "± 0.75 mas (RA), ± 50 μas (Dec)",
    5: "± 75 μas (RA), ± 5 μas (Dec)",
    6: "± 7.5 μas (RA), ± 0.5 μas (Dec)",
    7: "± 0.75 μas (RA), ± 0.05 μas (Dec)",
    8: "± 0.075 μas (RA), ± 0.005 μas (Dec)",
    9: "± 0.0075 μas (RA), ± 0.0005 μas (Dec)",
    10: "± 0.00075 μas (RA), ± 0.00005 μas (Dec)"
  },
  degrees: {
    0: "± 0.5 deg",
    1: "± 3 arcmin",
    2: "± 18 arcsec",
    3: "± 1.8 arcsec",
    4: "± 0.18 arcsec",
    5: "± 18 mas",
    6: "± 1.8 mas",
    7: "± 180 μas",
    8: "± 18 μas",
    9: "± 1.8 μas",
    10: "± 0.18 μas "
  }
};

// For the precision dropdown
const PRECISION_OPTIONS = [
  { value: "match", label: "Automatic" },
  ...Array.from({ length: 11 }, (_, i) => ({
    value: String(i),
    label: `${i} digits`
  }))
];

const FORMAT_OPTIONS = [
  { value: 'hmsdms', label: 'HMS/DMS' },
  { value: 'degrees', label: 'Decimal Degrees' },
  { value: 'casa', label: 'CASA Format' }
];

const INTERNAL_DELIMITER_OPTIONS = [
  { value: ':', label: 'Colons' },
  { value: 'hms', label: 'Letters' },
  { value: ' ', label: 'Spaces' }
];

const DELIMITER_OPTIONS = [
  { value: ' ', label: 'Space' },
  { value: ',', label: 'Comma' },
  { value: '\t', label: 'Tab' },
  { value: ' | ', label: 'Pipe' }
];

/**
 * For single-value errors (e.g. "1.8 arcsec") we scale to keep the numeric
 * in the range [0.1..999], switching among arcsec <-> mas <-> μas.
 */
function scaleErrorString(errStr) {
  // e.g. "1.8 arcsec" or "0.075 mas"
  // We'll remove a leading "±" if present, though typically we store that outside:
  const plusMinusMatch = errStr.match(/^[+\-±]/) ? errStr[0] : ''; 
  let noSign = errStr.replace(/^[+\-±]/, '').trim(); // e.g. "1.8 arcsec"

  const m = noSign.match(/^([\d.]+)\s*(arcsec|mas|μas)$/);
  if (!m) {
    // fallback: just return original
    return errStr;
  }
  let numeric = parseFloat(m[1]);
  let unit = m[2]; // "arcsec", "mas", "μas"

  // We'll define a chain from largest to smallest: arcsec -> mas -> μas
  const chain = ["arcsec", "mas", "μas"];

  let idx = chain.indexOf(unit);
  if (idx === -1) {
    return errStr; // unknown
  }

  // While numeric < 0.1 and we can move to next smaller unit
  while (numeric < 0.1 && idx < chain.length - 1) {
    // e.g. arcsec => mas => multiply numeric by 1000
    numeric *= 1000;
    idx += 1;
  }
  // While numeric >= 1000 and we can move to next bigger unit
  while (numeric >= 1000 && idx > 0) {
    numeric /= 1000;
    idx -= 1;
  }

  // Round to 3 decimal places to avoid weird floats
  const scaled = parseFloat(numeric.toFixed(3));
  const newUnit = chain[idx];
  return `${plusMinusMatch}${scaled} ${newUnit}`;
}

/**
 * Called for each RA/Dec precision in "degrees" or "hmsdms" to get a single-value error:
 * e.g. "±1.8 arcsec", "±0.075 mas", etc. Then re-scale if needed.
 */
function getSingleError(fmt, precision, isRa) {
  let p = Math.max(0, Math.min(10, parseInt(precision, 10) || 0));

  if (fmt === 'degrees') {
    // degrees uses PRECISION_MAP.degrees
    const base = (PRECISION_MAP.degrees[p] || "").replace('±', '').trim();
    // e.g. "180 arcsec"
    return scaleErrorString(base);
  } else {
    // hmsdms => pick RA or Dec portion
    const tokens = (PRECISION_MAP.hmsdms[p] || "").split(',');
    // tokens e.g. ["±7.5 arcsec (RA)", " ±0.5 arcsec (Dec)"]
    const idx = isRa ? 0 : 1;
    const valStr = tokens[idx] || "";
    // strip the "±" and the paren text
    // e.g. "±7.5 arcsec (RA)" => "7.5 arcsec"
    const clean = valStr.replace(/[±()]/g, '').replace('RA', '').replace('Dec', '').trim();
    return scaleErrorString(clean);
  }
}

/**
 * Adjust RA/Dec precision for "match input" logic:
 * - If converting from decimal degrees → hms/dms or casa:
 *   RA => (inPrec - 2), Dec => (inPrec - 3)
 * - If from hms/dms or casa → decimal degrees:
 *   RA => (inPrec + 3), Dec => (inPrec + 3)
 * - Otherwise, keep them as-is. Then clamp to [0..10].
 */
function computeMatchedPrecisions(inputFmt, outputFmt, raInPrec, decInPrec) {
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
  // clamp
  raOut = Math.min(Math.max(raOut, 0), 10);
  decOut = Math.min(Math.max(decOut, 0), 10);

  return { raOut, decOut };
}

function postprocessHmsDms(output, delimiter) {
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
 * Strictly split output by the chosen delimiter so that comma, pipe, etc.
 * do not become whitespace-based.
 */
function splitByOutputDelimiter(str, delimiter) {
  if (delimiter === ' | ') {
    return str.split(' | ');
  } else if (delimiter === '\t') {
    return str.split('\t');
  } else if (delimiter === ',') {
    return str.split(',');
  } else {
    // default is space
    return str.trim().split(/\s+/);
  }
}

/** Return the exact character to show between RA and Dec in the results panel. */
function displayDelimiter(delim) {
  if (delim === '\t') return '\t';
  if (delim === ',') return ',';
  if (delim === ' | ') return '|'; 
  return ' ';
}

/** Get placeholder examples for a given format */
function getPlaceholderExamples(format) {
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


const CoordinateConverter = () => {
  const [inputText, setInputText] = useState('');
  const [inputFormat, setInputFormat] = useState('hmsdms');
  const [outputFormat, setOutputFormat] = useState('degrees');
  const [precision, setPrecision] = useState('match');

  const [selectedLines, setSelectedLines] = useState(new Set());
  const [results, setResults] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredCopyType, setHoveredCopyType] = useState(null);

  const [outputDelimiter, setOutputDelimiter] = useState(' ');
  const [internalDelimiter, setInternalDelimiter] = useState(':');
  const [virtualLineNumbers, setVirtualLineNumbers] = useState([]);


  // From the first valid input line, detect RA/Dec decimal digits
  const [detectedRaPrecision, detectedDecPrecision] = useMemo(() => {
    const firstLine = inputText.split('\n').find(line => line.trim());
    if (!firstLine) return [0, 0];
    const parts = firstLine.split(/[\s,|]+/).filter(Boolean);
    if (parts.length < 2) return [0, 0];

    // e.g. "123.4567" => 4 digits
    const raDecs = (parts[0].split('.')[1] || '').length;
    const decDecs = (parts[1].split('.')[1] || '').length;
    return [raDecs, decDecs];
  }, [inputText]);

  // Highlight style for hovering over lines
  const highlightStyle = useMemo(() => {
    if (hoveredLine === null || hoveredCopyType !== null) return {};
    const lineHeight = 24; // 1.5rem = 24px to match the h-6 class used in output
    return {
      backgroundImage: `linear-gradient(
        rgba(59, 130, 246, 0.1),
        rgba(59, 130, 246, 0.1)
      )`,
      backgroundSize: `100% ${lineHeight}px`,
      backgroundPosition: `0 ${hoveredLine * lineHeight}px`,
      backgroundRepeat: 'no-repeat'
    };
  }, [hoveredLine, hoveredCopyType]);

  // Modify the input handler to strip trailing empty lines
  const handleInputChange = (e) => {
    let newValue = e.target.value;
    
    // Strip trailing empty lines while preserving empty lines in the middle
    newValue = newValue.replace(/[\n\r]+([\n\r]|\s)*$/, '');
    
    // Count number of lines
    const lineCount = (newValue.match(/\n/g) || []).length + 1;
    
    if (lineCount > MAX_ROWS) {
      // Optional: Show a warning to the user
      alert(`Maximum input is ${MAX_ROWS} lines. Current input: ${lineCount} lines`);
      return;
    }
    
    setInputText(newValue);
  };

  // Helper function to compute input stats
  const getInputStats = useCallback(() => {
    if (!inputText) return null;
    
    const totalLines = inputText.split('\n').filter(line => line.trim()).length;
    const errorCount = results.filter(r => r.error).length;
    
    return {
      totalLines,
      errorCount
    };
  }, [inputText, results]);


  // mouseHandler for the textarea
  const handleTextareaHover = useCallback((e) => {
    const lineHeight = 24; // 1.5rem = 24px
    const rect = e.target.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const lineIndex = Math.floor(relativeY / lineHeight);
    
    // Only set hover if within valid line range
    if (lineIndex >= 0 && lineIndex < inputText.split('\n').length) {
      setHoveredLine(lineIndex);
    } else {
      setHoveredLine(null);
    }
  }, [inputText]);

  
  const handleTextareaLeave = () => {
    setHoveredLine(null);
  };

  // handler to make error message clickable (scrolling to first error)
  const scrollToFirstError = useCallback(() => {
    const firstErrorIndex = results.findIndex(r => r.error);
    if (firstErrorIndex === -1) return;

    // Get the line height (matches the existing 24px line height)
    const lineHeight = 24;
    const scrollTop = firstErrorIndex * lineHeight;

    // Scroll both panels
    const textarea = document.querySelector('textarea');
    const outputPanel = document.querySelector('.output-scroll');
    
    if (textarea) textarea.scrollTop = scrollTop;
    if (outputPanel) outputPanel.scrollTop = scrollTop;

    // Also highlight the error line briefly
    setHoveredLine(firstErrorIndex);
    setTimeout(() => setHoveredLine(null), 2000);
  }, [results]);


  /**
   * Explanation for "match input" – includes separate RA/Dec rounding error
   * for both input and output. E.g.:
   *   Digits in first line: RA = 6, Dec = 6
   *   Input rounding error (approx): RA: ±1.8 mas, Dec: ±1.8 mas
   *   Output rounding error (approx): RA: ±0.75 mas, Dec: ±0.5 mas
   */
  const matchPrecisionExplanation = useMemo(() => {
    // Return empty div if no precision selected OR no valid first line
    if (precision !== 'match' || !inputText.split('\n').find(line => line.trim())) {
      return (
        <div className="text-xs text-gray-600">
          <p> Output precision matched to input precision </p>
        </div>
      );
    }
    
    // final RA/Dec out precision
    const { raOut, decOut } = computeMatchedPrecisions(
      inputFormat, outputFormat, detectedRaPrecision, detectedDecPrecision
    );
    const inputErrRA = getSingleError(inputFormat, detectedRaPrecision, true);
    const inputErrDec = getSingleError(inputFormat, detectedDecPrecision, false);
    const outErrRA = getSingleError(outputFormat, raOut, true);
    const outErrDec = getSingleError(outputFormat, decOut, false);
    
    return (
      <div className="text-xs text-gray-600">
        <p>Detected input precision [{inputFormat}]:</p> 
        <p className="pl-4">RA: {detectedRaPrecision} digits (± {inputErrRA}) </p>
        <p className="pl-4 mb-1"> Dec: {detectedDecPrecision} digits (± {inputErrDec})</p>
        <p> Automatic output precision [{outputFormat}]: </p>
        <p className="pl-4"> RA: {raOut} digits (± {outErrRA})</p> 
        <p className="pl-4"> Dec: {decOut} digits (± {outErrDec}) </p>
      </div>
    );
  }, [
    precision, inputFormat, outputFormat,
    detectedRaPrecision, detectedDecPrecision,
    inputText  // Added inputText as a dependency
  ]);

  /**
   * Convert all lines in the input whenever relevant settings change.
   */
  const processInput = useCallback(() => {
    const lines = inputText.split('\n');

    // Determine final RA/Dec precision
    let raPrec, decPrec;
    if (precision === 'match') {
      const { raOut, decOut } = computeMatchedPrecisions(
        inputFormat, outputFormat, detectedRaPrecision, detectedDecPrecision
      );
      raPrec = raOut;
      decPrec = decOut;
    } else {
      const p = parseInt(precision, 10) || 0;
      raPrec = p;
      decPrec = p;
    }

    const newResults = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return { output: '', error: null };

      try {
        let out = raDecConverter(trimmed, {
          inputFormat,
          outputFormat,
          internalDelimiter: (outputFormat === 'hmsdms') ? ':' : ' ',
          raDecDelimiter: outputDelimiter,
          raPrecision: raPrec,
          decPrecision: decPrec
        });
        // postprocess for letters
        if (outputFormat === 'hmsdms' && internalDelimiter === 'hms') {
          out = postprocessHmsDms(out, 'hms');
        }
        return { output: out, error: null };
      } catch (err) {
        return { output: '', error: err.message };
      }
    });
    setResults(newResults);
  }, [
    inputText, inputFormat, outputFormat,
    precision, detectedRaPrecision, detectedDecPrecision,
    internalDelimiter, outputDelimiter
  ]);

  useEffect(() => {
    processInput();
  }, [processInput]);

  // Add this effect to update virtual line numbers when results change
  useEffect(() => {
    setVirtualLineNumbers(Array.from({ length: results.length }, (_, i) => i + 1));
  }, [results.length]);


  // Toggling line selection
  const handleLineClick = (index) => {
    setSelectedLines(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  // Copy all selected lines, or all lines if none selected
  const handleCopyAll = () => {
    const outputText = results
      .filter((_, i) => selectedLines.has(i) || selectedLines.size === 0)
      .map(r => r.output)
      .join('\n');
    navigator.clipboard.writeText(outputText);
  };

  // Convert placeholder examples using the current settings
  const processedExamples = useMemo(() => {
    const examples = getPlaceholderExamples(inputFormat, ':').split('\n');
    let raPrec, decPrec;
    
    if (precision === 'match') {
      // For placeholders, use reasonable defaults
      if (outputFormat === 'hmsdms') {
        raPrec = 2;  // ~75 mas precision
        decPrec = 2;
      } else {
        raPrec = 4;  // ~0.18 arcsec precision
        decPrec = 4;
      }
    } else {
      const p = parseInt(precision, 10) || 0;
      raPrec = p;
      decPrec = p;
    }

    return examples.map(example => {
      try {
        let out = raDecConverter(example, {
          inputFormat,
          outputFormat,
          internalDelimiter: (outputFormat === 'hmsdms') ? ':' : ' ',
          raDecDelimiter: outputDelimiter,
          raPrecision: raPrec,
          decPrecision: decPrec
        });
        // postprocess for letters if needed
        if (outputFormat === 'hmsdms' && internalDelimiter === 'hms') {
          out = postprocessHmsDms(out, 'hms');
        }
        return out;
      } catch (err) {
        return '';
      }
    });
  }, [inputFormat, outputFormat, precision, internalDelimiter, outputDelimiter]);


  // Download CSV
  const handleDownloadCSV = () => {
    const selectedData = results
      .filter((_, i) => selectedLines.has(i) || selectedLines.size === 0)
      .map(result => {
        if (!result.output) return null;
        const [ra, dec] = splitByOutputDelimiter(result.output, outputDelimiter);
        return { ra: ra || '', dec: dec || '' };
      })
      .filter(Boolean);
  
    const csv = [
      ['RA', 'Dec'],
      ...selectedData.map(d => [d.ra, d.dec])
    ].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
  
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'coordinates.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 h-screen flex flex-col">
      <div className="h-[85vh] flex flex-col">

        {/* Top Bar: 4 columns */}
        <div className="grid grid-cols-4 gap-4 bg-white p-4 rounded shadow">
          {/* Column 1: Input Format */}
          <div className="space-y-2">
            <h3 className="font-medium">Input Format</h3>
            <div className="space-y-1">
              {FORMAT_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value={opt.value}
                    checked={inputFormat === opt.value}
                    onChange={e => setInputFormat(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Column 2: Output Format */}
          <div className="space-y-2">
            <h3 className="font-medium">Output Format</h3>
            <div className="space-y-1">
              {FORMAT_OPTIONS.map(opt => (
                <label key={opt.value} className="flex items-center space-x-2">
                  <input
                    type="radio"
                    value={opt.value}
                    checked={outputFormat === opt.value}
                    onChange={e => setOutputFormat(e.target.value)}
                    className="w-4 h-4"
                  />
                  <span className="text-sm">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Column 3: Output Delimiters */}
          <div className="space-y-2">
            <h3 className="font-medium">Output Delimiters</h3>
            <div className="space-y-1">
              <span className="font-medium text-sm">External:</span>
              <div className="flex flex-wrap gap-2">
                {DELIMITER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setOutputDelimiter(opt.value)}
                    className={`px-1.5 py-1 text-sm border rounded ${
                      outputDelimiter === opt.value 
                        ? 'bg-blue-100 border-blue-300' 
                        : 'bg-white hover:bg-gray-50'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
            {outputFormat === 'hmsdms' && (
              <div className="space-y-1">
                <span className="font-medium text-sm">Internal:</span>
                <div className="flex flex-wrap gap-2">
                  {INTERNAL_DELIMITER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setInternalDelimiter(opt.value)}
                      className={`px-1.5 py-1 text-sm border rounded ${
                        internalDelimiter === opt.value 
                          ? 'bg-blue-100 border-blue-300' 
                          : 'bg-white hover:bg-gray-50'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Column 4: Output Digits */}
          <div className="space-y-2">
            <h3 className="font-medium">Output Precision</h3>
            <select 
              value={precision} 
              onChange={e => setPrecision(e.target.value)}
              className="w-full border rounded px-2 py-1"
            >
              {PRECISION_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            
            {precision === 'match' ? (
              matchPrecisionExplanation
            ) : (
              <div className="text-xs text-gray-600">
                <p>Fixed {precision} digit precision [{outputFormat}]:</p>
                <p className="pl-4">
                  {outputFormat === 'degrees' 
                    ? PRECISION_MAP.degrees[precision] 
                    : PRECISION_MAP.hmsdms[precision]}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Messages above the panels */}
        <div className="flex gap-0 items-end mb-0.5 mt-5">  
          <div className="w-[45%] text-sm pl-12 font-italic min-h-[24px]">
            <span className="text-gray-500 block">
              {!inputText ? (
                "Paste input coordinates below (one RA + Dec per line)"
              ) : (
                <>
                  <span className="text-gray-700">
                    {getInputStats().totalLines} input coordinate{getInputStats().totalLines !== 1 ? 's' : ''} [{inputFormat}]
                  </span>
                  {getInputStats().errorCount > 0 && (
                    <button
                      onClick={scrollToFirstError}
                      className="text-red-500 ml-1 hover:underline focus:outline-none"
                    >
                      ({getInputStats().errorCount} error{getInputStats().errorCount !== 1 ? 's' : ''})
                    </button>
                  )}
                </>
              )}
            </span>
          </div>
          <div className="w-[45%] text-sm text-gray-500 pl-8 mb-0.5 font-italic min-h-[24px]">
          {!inputText ? (
              'Output coordinates will appear here (based on selections above)'
            ) : (
              <>
                Output format: {precision === 'match' ? (
                  <>RA: {computeMatchedPrecisions(
                    inputFormat, 
                    outputFormat, 
                    detectedRaPrecision, 
                    detectedDecPrecision
                  ).raOut} digits, Dec: {computeMatchedPrecisions(
                    inputFormat, 
                    outputFormat, 
                    detectedRaPrecision, 
                    detectedDecPrecision
                  ).decOut} digits</>
                ) : (
                  `${precision} digits`
                )} [{outputFormat}]</>
            )}
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex gap-4 flex-grow overflow-hidden">
          {/* Input Panel */}
          <div className="w-[45%] relative border rounded shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r overflow-hidden">
              {/* Line numbers for actual input */}
              {inputText ? 
                inputText.split('\n').map((_, i) => (
                  <div
                    key={i}
                    className={`
                      px-2 cursor-pointer text-right text-gray-500 leading-6 text-base
                      ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                      ${hoveredLine === i ? 'bg-blue-50' : ''}
                    `}
                    onClick={() => handleLineClick(i)}
                    onMouseEnter={() => setHoveredLine(i)}
                    onMouseLeave={() => setHoveredLine(null)}
                  >
                    {i + 1}
                  </div>
                ))
                : 
                /* Line numbers for placeholder */
                getPlaceholderExamples(inputFormat, internalDelimiter).split('\n').map((_, i) => (
                  <div
                    key={i}
                    className="px-2 text-right text-gray-300 leading-6 text-base"
                  >
                    {i + 1}
                  </div>
                ))
              }
            </div>
            <textarea
              value={inputText}
              onChange={handleInputChange}
              onMouseMove={handleTextareaHover}
              onMouseLeave={handleTextareaLeave}
              onScroll={e => {
                const outputPanel = document.querySelector('.output-scroll');
                if (outputPanel) {
                  outputPanel.scrollTop = e.target.scrollTop;
                }
              }}
              placeholder={getPlaceholderExamples(inputFormat, internalDelimiter)}
              className="w-full h-full pl-14 pr-4 font-mono resize-none text-base leading-6 whitespace-pre overflow-x-auto"
              style={{
                ...highlightStyle,
                maxHeight: '100%',
                minHeight: '100%'
              }}
              spellCheck="false"
              data-gramm="false"
              data-gramm_editor="false"
              data-enable-grammarly="false"
            />
          </div>

                    {/* Output Panel */}
                    <div className="w-[45%] relative border rounded shadow-sm overflow-hidden font-mono bg-white">
            <div className="h-full flex">
              <div className="w-12 bg-gray-100 border-r flex-none overflow-hidden">
                {/* Line numbers for actual output or placeholder */}
                {inputText ? 
                  virtualLineNumbers.map((num, i) => (
                    <div
                      key={i}
                      className={`
                        px-2 text-right text-gray-500 leading-6 text-base
                        ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                        ${hoveredLine === i ? 'bg-blue-50' : ''}
                      `}
                    >
                      {num}
                    </div>
                  ))
                  :
                  getPlaceholderExamples(inputFormat, internalDelimiter).split('\n').map((_, i) => (
                    <div
                      key={i}
                      className="px-2 text-right text-gray-300 leading-6 text-base"
                    >
                      {i + 1}
                    </div>
                  ))
                }
              </div>
              <div
                className="flex-grow overflow-y-auto overflow-x-auto output-scroll"
                onScroll={e => {
                  const textarea = document.querySelector('textarea');
                  const inputLineNumbers = textarea?.previousSibling;
                  const outputLineNumbers = e.target.previousSibling;
                  
                  if (textarea) textarea.scrollTop = e.target.scrollTop;
                  if (inputLineNumbers) inputLineNumbers.scrollTop = e.target.scrollTop;
                  if (outputLineNumbers) outputLineNumbers.scrollTop = e.target.scrollTop;
                }}
              >
                {inputText ? (
                  results.map((result, i) => (
                    <div
                      key={i}
                      className={`
                        h-6 flex items-center px-4 whitespace-pre
                        ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                        ${hoveredLine === i ? 'bg-blue-50' : ''}
                        ${result.error ? 'text-red-500' : ''}
                      `}
                      onClick={() => handleLineClick(i)}
                      onMouseEnter={() => setHoveredLine(i)}
                      onMouseLeave={() => setHoveredLine(null)}
                    >
                      {result.error ? (
                        <div className="flex items-center">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {result.error}
                        </div>
                      ) : (
                        result.output
                      )}
                    </div>
                  ))
                ) : (
                  // Show processed placeholder examples when there's no input
                  processedExamples.map((example, i) => {
                    const tokens = example.split(/[\s,|]+/).filter(Boolean);
                    const raVal = tokens[0] || '';
                    const decVal = tokens[1] || '';
                    const delim = displayDelimiter(outputDelimiter);

                    return (
                      <div
                        key={i}
                        className="h-6 flex items-center px-4 whitespace-pre text-gray-300"
                      >
                        {raVal}{delim}{decVal}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col space-y-2">
            <button 
              onMouseEnter={() => setHoveredCopyType('all')}
              onMouseLeave={() => setHoveredCopyType(null)}
              onClick={handleCopyAll}
              className="flex items-center px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy all
            </button>
            <button 
              onMouseEnter={() => setHoveredCopyType('ra')}
              onMouseLeave={() => setHoveredCopyType(null)}
              onClick={() => {
                const raValues = results
                  .filter((_, i) => selectedLines.has(i) || selectedLines.size === 0)
                  .filter(r => !r.error)
                  .map(r => splitByOutputDelimiter(r.output, outputDelimiter)[0] || '')
                  .join('\n');
                navigator.clipboard.writeText(raValues);
              }}
              className="flex items-center px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy RA
            </button>
            <button 
              onMouseEnter={() => setHoveredCopyType('dec')}
              onMouseLeave={() => setHoveredCopyType(null)}
              onClick={() => {
                const decValues = results
                  .filter((_, i) => selectedLines.has(i) || selectedLines.size === 0)
                  .filter(r => !r.error)
                  .map(r => splitByOutputDelimiter(r.output, outputDelimiter)[1] || '')
                  .join('\n');
                navigator.clipboard.writeText(decValues);
              }}
              className="flex items-center px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Dec
            </button>
            <button 
              onClick={handleDownloadCSV}
              className="flex items-center px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-500 py-4">
        Batch Coordinate Converter version 0.1.0 (under development)
        <div className="text-sm">Email Dillon if you have questions, comments, or suggestions</div>
      </div>
    </div>
  );
};

export default CoordinateConverter;
