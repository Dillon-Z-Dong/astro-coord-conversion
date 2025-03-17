// ./components/CoordinateConverter.js

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { raDecConverter } from '../utils/coordinateParser';
import { TopBar } from './TopBar';
import { useConverterOptions } from '../hooks/useConverterOptions';
import { computeMatchedPrecisions} from '../utils/precisionHandling';
import { ActionButtons } from './ActionButtons';
import { Messages } from './Messages';
import { InputEditor } from './InputEditor';
import { OutputPanel } from './OutputPanel';
import { useSyncedScroll } from '../hooks/useSyncedScroll';

const CoordinateConverter = () => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredCopyType, setHoveredCopyType] = useState(null);
  const { handleInputScroll, handleOutputScroll } = useSyncedScroll();
  const [scrollPosition, setScrollPosition] = useState(0);
  const [removedLines, setRemovedLines] = useState({ headerLines: [], trailingWhitespaceCount: 0 });
  const [isFormatAutoDetected, setIsFormatAutoDetected] = useState(false);

  // Create a ref to store the last hover position to avoid unnecessary updates
  const lastHoverRef = useRef(null);

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

    // No need for format conversion - use directly
    const parserInputFormat = inputFormat;
    const parserOutputFormat = outputFormat;

    const newResults = lines.map(line => {
      const trimmed = line.trim();
      if (!trimmed) return { output: '', error: null };

      try {
        let out = raDecConverter(trimmed, {
          ...converterOptions,
          inputFormat: parserInputFormat,
          outputFormat: parserOutputFormat,
          raPrecision: raPrec,
          decPrecision: decPrec
        });
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
    inputFormat,
    internalDelimiter
  ]);

  useEffect(() => {
    processInput();
  }, [processInput]);


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

  const handleScroll = (scrollTop) => {
    setScrollPosition(scrollTop);
    
    // Synchronize scroll position
    const textarea = document.querySelector('textarea');
    const outputPanel = document.querySelector('.output-scroll');
    const inputLineNumbers = textarea?.previousSibling;
    const outputLineNumbers = outputPanel?.previousSibling;
    
    if (textarea) textarea.scrollTop = scrollTop;
    if (outputPanel) outputPanel.scrollTop = scrollTop;
    if (inputLineNumbers) inputLineNumbers.scrollTop = scrollTop;
    if (outputLineNumbers) outputLineNumbers.scrollTop = scrollTop;
  };

  const handleMouseMove = useCallback((e, containerType) => {
    const lineHeight = 24;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    
    // Calculate position relative to visible area
    const relativeY = e.clientY - rect.top;
    const visibleLineIndex = Math.floor((relativeY + container.scrollTop) / lineHeight);
    
    const maxLines = containerType === 'input' 
      ? inputText.split('\n').length 
      : results.length;
    
    // Only update if we're hovering over a valid line and it's different from the last position
    if (visibleLineIndex >= 0 && visibleLineIndex < maxLines && lastHoverRef.current !== visibleLineIndex) {
      lastHoverRef.current = visibleLineIndex;
      setHoveredLine(visibleLineIndex);
    } else if (visibleLineIndex < 0 || visibleLineIndex >= maxLines) {
      lastHoverRef.current = null;
      setHoveredLine(null);
    }
  }, [inputText, results.length]);

  const handleMouseLeave = useCallback(() => {
    lastHoverRef.current = null;
    setHoveredLine(null);
  }, []);

  const handleInputChange = (newValue, removedInfo) => {
    setInputText(newValue);
    setRemovedLines(removedInfo);
  };

  // Log state changes
  useEffect(() => {
    console.log('CoordinateConverter state:', {
      outputFormat,
      outputDelimiter,
      precision,
      matchPrecision: precision === 'match',
      internalDelimiter
    });
  }, [outputFormat, outputDelimiter, precision, internalDelimiter]);

  /**
   * Detects the best input format by testing each format and counting errors
   * @param {string} inputTextToDetect - The input text to analyze
   * @returns {string|null} - The detected format or null if detection failed
   */
  const detectBestInputFormat = useCallback((inputTextToDetect) => {
    // Only process up to 100 coordinates for detection
    const lines = inputTextToDetect.split('\n')
      .filter(line => line.trim()) // Filter out empty lines
      .slice(0, 100);
      
    if (lines.length === 0) return null;
    
    // Try each format and count errors
    const formats = ['degrees', 'casa', 'hmsdms'];
    const uiFormats = ['degrees', 'casa', 'hmsdms']; // Updated to use 'degrees' instead of 'decimal'
    const errorCounts = {};
    
    for (let i = 0; i < formats.length; i++) {
      const format = formats[i];
      const uiFormat = uiFormats[i];
      let errorCount = 0;
      
      for (const line of lines) {
        if (!line.trim()) continue; // Skip empty lines
        
        try {
          // Use the same converter but just to test if it parses without error
          raDecConverter(line, {
            inputFormat: format,
            outputFormat: 'degrees',
            raDecDelimiter: ' ',
            internalDelimiter: ' ',
            precision: 4
          });
        } catch (error) {
          errorCount++;
        }
      }
      
      errorCounts[uiFormat] = errorCount;
    }
    
    // Find the format with fewest errors
    const bestFormat = Object.entries(errorCounts)
      .sort((a, b) => a[1] - b[1])
      [0][0];
      
    console.log('Auto-detected format:', bestFormat, 'Error counts:', errorCounts);
    
    return bestFormat;
  }, []);

  /**
   * Handles auto-detection of input format when first data is entered
   * @param {string} textToDetect - The input text to analyze
   */
  const handleAutoDetectFormat = useCallback((textToDetect) => {
    const detectedFormat = detectBestInputFormat(textToDetect);
    if (detectedFormat && detectedFormat !== inputFormat) {
      console.log(`Auto-detected format: ${detectedFormat}, changing from ${inputFormat}`);
      optionSetters.setInputFormat(detectedFormat);
      setIsFormatAutoDetected(true);
    }
  }, [detectBestInputFormat, inputFormat, optionSetters]);

  // Manual format change detection
  const handleManualFormatChange = useCallback((newFormat) => {
    if (isFormatAutoDetected) {
      setIsFormatAutoDetected(false);
    }
    optionSetters.setInputFormat(newFormat);
  }, [isFormatAutoDetected, optionSetters]);

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
          onOptionsChange={{
            ...optionSetters,
            setInputFormat: handleManualFormatChange
          }}
          isFormatAutoDetected={isFormatAutoDetected}
        />

        <Messages 
          inputText={inputText}
          inputFormat={inputFormat}
          outputFormat={outputFormat}
          precision={precision}
          results={results}
          matchedPrecisions={matchedPrecisions}
          removedLines={removedLines}
          isFormatAutoDetected={isFormatAutoDetected}
        />

        <div className="flex gap-4 flex-grow overflow-hidden">
          <InputEditor 
            inputText={inputText}
            inputFormat={inputFormat}
            internalDelimiter={internalDelimiter}
            hoveredLine={hoveredLine}
            scrollPosition={scrollPosition}
            onInputChange={handleInputChange}
            onScroll={handleScroll}
            onMouseMove={(e) => handleMouseMove(e, 'input')}
            onMouseLeave={handleMouseLeave}
            onAutoDetectFormat={handleAutoDetectFormat}
          />

          <OutputPanel 
            inputText={inputText}
            results={results}
            inputFormat={inputFormat}
            outputFormat={outputFormat}
            outputDelimiter={outputDelimiter}
            precision={precision}
            matchPrecision={precision === 'match'}
            internalDelimiter={internalDelimiter}
            hoveredLine={hoveredLine}
            scrollPosition={scrollPosition}
            onScroll={handleScroll}
            onMouseMove={(e) => handleMouseMove(e, 'output')}
            onMouseLeave={handleMouseLeave}
            hoveredCopyType={hoveredCopyType}
          />

          <ActionButtons 
            results={results}
            outputDelimiter={outputDelimiter}
            onHoverChange={setHoveredCopyType}
          />
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 py-4">
          Batch Astronomical Coordinate Converter v1.0
          <br />
          Source code available on {' '}
          <a 
            href="https://github.com/Dillon-Z-Dong/astro-coord-conversion/" 
            className="underline hover:text-gray-700"
            target="_blank" 
            rel="noopener noreferrer"
          >
            Github
          </a>
        </div>
      </div>
    </div>
  );
};

export default CoordinateConverter;
