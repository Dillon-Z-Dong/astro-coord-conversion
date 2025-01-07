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

const CoordinateConverter = () => {
  const [inputText, setInputText] = useState('');
  const [results, setResults] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);
  const [hoveredCopyType, setHoveredCopyType] = useState(null);
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
