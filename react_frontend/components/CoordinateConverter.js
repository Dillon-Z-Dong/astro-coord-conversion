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
          matchedPrecisions={matchedPrecisions}
          removedLines={removedLines}
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
