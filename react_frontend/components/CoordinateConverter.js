// ./components/CoordinateConverter.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { raDecConverter } from '../utils/coordinateParser';
import { TopBar } from './TopBar';
import { useConverterOptions } from '../hooks/useConverterOptions';
import { getSingleError, computeMatchedPrecisions, scaleErrorString } from '../utils/precisionHandling';
import { 
  postprocessHmsDms, 
  splitByOutputDelimiter, 
  displayDelimiter,
  getPlaceholderExamples 
} from '../utils/formatHandling';

const MAX_ROWS = 5000; // Set a reasonable maximum that won't crash the browser

const CoordinateConverter = () => {
  const [inputText, setInputText] = useState('');
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [results, setResults] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredCopyType, setHoveredCopyType] = useState(null);
  const [virtualLineNumbers, setVirtualLineNumbers] = useState([]);

  const {
    inputFormat,
    outputFormat,
    precision,
    outputDelimiter,
    internalDelimiter,
    converterOptions,
    precisionExplanation,
    ...optionSetters
  } = useConverterOptions();


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
          <p> Matched to precision of first input line </p>
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
  // Update processInput to use converterOptions
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
          ...converterOptions,
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
    inputText,
    converterOptions,
    precision,
    detectedRaPrecision,
    detectedDecPrecision,
    outputFormat,
    internalDelimiter
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

      {/* Top bar where user enters desired state variables */}
      <TopBar 
          options={{
            inputFormat,
            outputFormat,
            outputDelimiter,
            internalDelimiter,
            precision,
            precisionExplanation
          }}
          onOptionsChange={optionSetters}
        />

        {/* Messages above the panels */}
        <div className="flex gap-0 items-end mb-0.5 mt-5">  
          <div className="w-[45%] text-sm pl-12 font-italic min-h-[24px]">
            <span className="text-gray-500 block">
              {!inputText ? (
                "Input RA/Dec (one per line, many formats accepted)"
              ) : (
                <>
                  <span className="text-gray-700">
                    {getInputStats().totalLines} input coordinate detected{getInputStats().totalLines !== 1 ? 's' : ''} [{inputFormat}]
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
              'Output RA/Dec (formatted based on selections above)'
            ) : (
              <>
                Requested output format: [{outputFormat}] [{precision === 'match' ? (
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
                )}]</>
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
              className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
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
              className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
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
              className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
            >
              <Copy className="w-4 h-4 mr-2" />
              Copy Dec
            </button>
            <button 
              onClick={handleDownloadCSV}
              className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              Download CSV
            </button>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-gray-500 py-4">
      Batch Astronomical Cordinate Converter v1.0
      <br />
      Source code available on {' '}
        <a 
          href="https://github.com/Dillon-Z-Dong/astro-coord-conversion" 
          className="underline hover:text-gray-700"
          target="_blank" 
          rel="noopener noreferrer"
        >
          Github
        </a>
      </div>
    </div>
  );
};

export default CoordinateConverter;
