// ./components/CoordinateConverter.js

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { raDecConverter } from '../utils/coordinateParser';
import { TopBar } from './TopBar';
import { useConverterOptions } from '../hooks/useConverterOptions';
import { getSingleError, computeMatchedPrecisions, scaleErrorString } from '../utils/precisionHandling';
import { 
  postprocessHmsDms, 
  getPlaceholderExamples 
} from '../utils/formatHandling';
import { ActionButtons } from './ActionButtons';
import { Messages } from './Messages';
import { InputEditor } from './InputEditor';
import { OutputPanel } from './OutputPanel';
import { useSyncedScroll } from '../hooks/useSyncedScroll';

const MAX_ROWS = 5000; // Set a reasonable maximum that won't crash the browser

const CoordinateConverter = () => {
  const [inputText, setInputText] = useState('');
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [results, setResults] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredCopyType, setHoveredCopyType] = useState(null);
  const [virtualLineNumbers, setVirtualLineNumbers] = useState([]);
  const { handleInputScroll, handleOutputScroll } = useSyncedScroll();

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


   // Compute matched precisions once for both processInput and Messages
   const matchedPrecisions = useMemo(() => {
    if (precision !== 'match') return { raOut: precision, decOut: precision };
    return computeMatchedPrecisions(
      inputFormat, 
      outputFormat, 
      detectedRaPrecision, 
      detectedDecPrecision
    );
  }, [precision, inputFormat, outputFormat, detectedRaPrecision, detectedDecPrecision]);


  return (
    <div className="max-w-6xl mx-auto p-4 h-screen flex flex-col">
      <div className="h-[85vh] flex flex-col">
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

        <Messages 
          inputText={inputText}
          inputFormat={inputFormat}
          outputFormat={outputFormat}
          precision={precision}
          results={results}
          onErrorClick={scrollToFirstError}
          matchedPrecisions={matchedPrecisions}
        />

        <div className="flex gap-4 flex-grow overflow-hidden">
          <InputEditor 
            inputText={inputText}
            inputFormat={inputFormat}
            internalDelimiter={internalDelimiter}
            hoveredLine={hoveredLine}
            onInputChange={setInputText}
            onHover={setHoveredLine}
            onHoverEnd={() => setHoveredLine(null)}
            onScroll={handleInputScroll}
          />

          <OutputPanel 
            inputText={inputText}
            results={results}
            inputFormat={inputFormat}
            outputDelimiter={outputDelimiter}
            hoveredLine={hoveredLine}
            onHover={setHoveredLine}
            onHoverEnd={() => setHoveredLine(null)}
            onScroll={handleOutputScroll}
          />

          <ActionButtons 
            results={results}
            outputDelimiter={outputDelimiter}
            onHoverChange={setHoveredCopyType}
          />
        </div>
      </div>
    </div>
  );
};

export default CoordinateConverter;
