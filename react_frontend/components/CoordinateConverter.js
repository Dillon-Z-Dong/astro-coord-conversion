// ./components/CoordinateConverter.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { raDecConverter } from '../utils/coordinateParser';

/**
 * Large-scale maps of typical rounding error for reference. We only use them
 * as a base, then we re-scale to pick arcsec/mas/μas as appropriate.
 */
const PRECISION_MAP = {
  hmsdms: {
    0: "±7.5 arcsec (RA), ±0.5 arcsec (Dec)",
    1: "±0.75 arcsec (RA), ±0.05 arcsec (Dec)",
    2: "±0.075 arcsec (RA), ±0.005 arcsec (Dec)",
    3: "±7.5 mas (RA), ±0.5 mas (Dec)",
    4: "±0.75 mas (RA), ±0.05 mas (Dec)",
    5: "±0.075 mas (RA), ±0.005 mas (Dec)",
    6: "±7.5 μas (RA), ±0.5 μas (Dec)",
    7: "±0.75 μas (RA), ±0.05 μas (Dec)",
    8: "±0.075 μas (RA), ±0.005 μas (Dec)",
    9: "±0.0075 μas (RA), ±0.0005 μas (Dec)",
    10: "±0.00075 μas (RA), ±0.00005 μas (Dec)"
  },
  degrees: {
    0: "±1800 arcsec",
    1: "±180 arcsec",
    2: "±18 arcsec",
    3: "±1.8 arcsec",
    4: "±180 mas",
    5: "±18 mas",
    6: "±1.8 mas",
    7: "±180 μas",
    8: "±18 μas",
    9: "±1.8 μas",
    10: "±0.18 μas"
  }
};

// For the precision dropdown
const PRECISION_OPTIONS = [
  { value: "match", label: "Match input" },
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
 * - If converting from decimal degrees → hms/dms:
 *   RA => (inPrec - 2), Dec => (inPrec - 3)
 * - If from hms/dms → decimal degrees:
 *   RA => (inPrec + 3), Dec => (inPrec + 3)
 * - Otherwise, keep them as-is. Then clamp to [0..10].
 */
function computeMatchedPrecisions(inputFmt, outputFmt, raInPrec, decInPrec) {
  let raOut = raInPrec;
  let decOut = decInPrec;

  if (inputFmt === 'degrees' && outputFmt === 'hmsdms') {
    raOut = raInPrec - 2;
    decOut = decInPrec - 3;
  } else if (inputFmt === 'hmsdms' && outputFmt === 'degrees') {
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

/** Provide a fallback example for a given inputFormat or outputFormat. */
function getExampleForFormat(format, internalDelimiter = ':') {
  switch (format) {
    case 'hmsdms':
      if (internalDelimiter === 'hms') {
        return ['12h34m56.78s', '+12d34m56.78s'];
      } else if (internalDelimiter === ' ') {
        return ['12 34 56.78', '+12 34 56.78'];
      } else {
        return ['12:34:56.78', '+12:34:56.78'];
      }
    case 'degrees':
      return ['188.7366', '+12.5824'];
    case 'casa':
      return ['12:34:56.78', '+12.34.56.78'];
    default:
      return ['', ''];
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

  /**
   * We'll also build an example input (based on inputFormat) and example output
   * (based on outputFormat). These are purely illustrative.
   */
  const inputExample = useMemo(() => {
    // We ignore user input for now; show a standard example
    return getExampleForFormat(inputFormat, internalDelimiter);
  }, [inputFormat, internalDelimiter]);

  const outputExample = useMemo(() => {
    // We'll attempt to convert the inputExample to the output format for realism
    const mockLine = inputExample.join(' ');
    try {
      let out = raDecConverter(mockLine, {
        inputFormat,
        outputFormat,
        internalDelimiter: (outputFormat === 'hmsdms') ? ':' : ' ',
        raDecDelimiter: ' ',
        raPrecision: 2,
        decPrecision: 2
      });
      if (outputFormat === 'hmsdms' && internalDelimiter === 'hms') {
        out = postprocessHmsDms(out, 'hms');
      }
      return out.trim().split(/\s+/);
    } catch {
      return getExampleForFormat(outputFormat, outputFormat === 'hmsdms' ? ':' : ' ');
    }
  }, [inputExample, inputFormat, outputFormat, internalDelimiter]);

  /**
   * Explanation for "match input" – includes separate RA/Dec rounding error
   * for both input and output. E.g.:
   *   Digits in first line: RA = 6, Dec = 6
   *   Input rounding error (approx): RA: ±1.8 mas, Dec: ±1.8 mas
   *   Output rounding error (approx): RA: ±0.75 mas, Dec: ±0.5 mas
   */
  const matchPrecisionExplanation = useMemo(() => {
    if (precision !== 'match') return null;
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
        <p>Digits in first line: RA = {detectedRaPrecision}, Dec = {detectedDecPrecision}</p>
        <p>Input rounding error (approx):</p>
        <ul className="list-none pl-4">
          <li>RA: ±{inputErrRA}</li>
          <li>Dec: ±{inputErrDec}</li>
        </ul>
        <p>Output rounding error (approx):</p>
        <ul className="list-none pl-4">
          <li>RA: ±{outErrRA}</li>
          <li>Dec: ±{outErrDec}</li>
        </ul>
      </div>
    );
  }, [
    precision, inputFormat, outputFormat,
    detectedRaPrecision, detectedDecPrecision
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

  // Download CSV
  const handleDownloadCSV = () => {
    const selectedData = inputText.split('\n').map((input, i) => {
      if (!selectedLines.has(i) && selectedLines.size > 0) return null;
      const result = results[i];
      if (!input.trim()) return null;
      return {
        input: input.trim(),
        output: result.output,
        error: result.error
      };
    }).filter(Boolean);

    const csv = [
      ['Input', 'Output', 'Error'],
      ...selectedData.map(d => [d.input, d.output, d.error || ''])
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
            {outputFormat === 'hmsdms' && (
              <div className="space-y-1">
                <span className="font-medium text-sm">Internal:</span>
                <div className="flex flex-wrap gap-2">
                  {INTERNAL_DELIMITER_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setInternalDelimiter(opt.value)}
                      className={`px-3 py-1 text-sm border rounded ${
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

            <div className="space-y-1">
              <span className="font-medium text-sm">External:</span>
              <div className="flex flex-wrap gap-2">
                {DELIMITER_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => setOutputDelimiter(opt.value)}
                    className={`px-3 py-1 text-sm border rounded ${
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
          </div>

          {/* Column 4: Output Digits */}
          <div className="space-y-2">
            <h3 className="font-medium">Output Digits</h3>
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
                {outputFormat === 'degrees' 
                  ? PRECISION_MAP.degrees[precision] 
                  : PRECISION_MAP.hmsdms[precision]}
              </div>
            )}
          </div>
        </div>

        {/* Examples Box (replaces old Format Example Area) */}
        <div className="mt-3 mb-3 p-3 bg-gray-50 rounded text-sm text-gray-600">
          <div className="flex flex-col sm:flex-row sm:justify-between gap-2">
            <div>
              <strong>Input Example:</strong>{' '}
              <span className="font-mono">
                {inputExample[0]} {inputExample[1]}
              </span>
            </div>
            <div>
              <strong>Output Example:</strong>{' '}
              <span className="font-mono">
                {outputExample[0]} {outputExample[1]}
              </span>
            </div>
          </div>
        </div>

        {/* Main Editor Area */}
        <div className="flex gap-4 flex-grow overflow-hidden">
          {/* Input Panel */}
          <div className="w-[45%] relative border rounded shadow-sm overflow-hidden">
            <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r overflow-hidden">
              {inputText.split('\n').map((_, i) => (
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
              ))}
            </div>
            <textarea
              value={inputText}
              onChange={e => setInputText(e.target.value)}
              onScroll={e => {
                const outputPanel = document.querySelector('.output-scroll');
                if (outputPanel) {
                  outputPanel.scrollTop = e.target.scrollTop;
                }
              }}
              className="w-full h-full pl-14 pr-4 font-mono resize-none text-base leading-6 whitespace-pre overflow-x-auto"
              placeholder="Enter coordinates..."
            />
          </div>

          {/* Output Panel */}
          <div className="w-[45%] relative border rounded shadow-sm overflow-hidden font-mono bg-white">
            <div className="h-full flex">
              <div className="w-12 bg-gray-100 border-r flex-none">
                {results.map((_, i) => (
                  <div
                    key={i}
                    className={`
                      px-2 text-right text-gray-500 h-6 flex items-center justify-end
                      ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                      ${hoveredLine === i ? 'bg-blue-50' : ''}
                    `}
                  >
                    {i + 1}
                  </div>
                ))}
              </div>
              <div
                className="flex-grow overflow-y-auto overflow-x-auto output-scroll"
                onScroll={e => {
                  // keep input line-number panel in sync
                  const textarea = document.querySelector('textarea');
                  const inputLineNumbers = textarea?.previousSibling;
                  if (textarea) textarea.scrollTop = e.target.scrollTop;
                  if (inputLineNumbers) inputLineNumbers.scrollTop = e.target.scrollTop;
                }}
              >
                {results.map((result, i) => {
                  if (result.error) {
                    return (
                      <div
                        key={i}
                        className={`
                          h-6 flex items-center px-4 whitespace-pre
                          bg-red-50
                          ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                          ${hoveredLine === i ? 'bg-blue-50' : ''}
                        `}
                      >
                        <div className="flex items-center text-red-600">
                          <AlertCircle className="w-4 h-4 mr-2" />
                          {result.error}
                        </div>
                      </div>
                    );
                  }
                  const tokens = splitByOutputDelimiter(result.output, outputDelimiter);
                  const raVal = tokens[0] || '';
                  const decVal = tokens[1] || '';

                  return (
                    <div
                      key={i}
                      className={`
                        h-6 flex items-center px-4 whitespace-pre
                        ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                        ${hoveredLine === i ? 'bg-blue-50' : ''}
                      `}
                    >
                      <span className={hoveredCopyType === 'ra' || hoveredCopyType === 'all' ? 'bg-blue-100' : ''}>
                        {raVal}
                      </span>
                      <span>{displayDelimiter(outputDelimiter)}</span>
                      <span className={hoveredCopyType === 'dec' || hoveredCopyType === 'all' ? 'bg-blue-100' : ''}>
                        {decVal}
                      </span>
                    </div>
                  );
                })}
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
              Copy All
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
        Batch Coordinate Converter (Under Development)
        <div className="text-sm">Version 0.1.0</div>
      </div>
    </div>
  );
};

export default CoordinateConverter;
