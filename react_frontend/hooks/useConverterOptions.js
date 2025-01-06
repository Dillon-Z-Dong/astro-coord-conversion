// hooks/useConverterOptions.js
import { useState, useMemo } from 'react';
import { PRECISION_MAP } from '../constants/converterOptions';

export function useConverterOptions() {
  const [inputFormat, setInputFormat] = useState('hmsdms');
  const [outputFormat, setOutputFormat] = useState('degrees');
  const [precision, setPrecision] = useState('match');
  const [outputDelimiter, setOutputDelimiter] = useState(' ');
  const [internalDelimiter, setInternalDelimiter] = useState(':');

  const precisionExplanation = useMemo(() => {
    if (precision === 'match') {
      return {
        type: 'match',
        message: 'Matched to precision of first input line'
      };
    }
    return {
      type: 'fixed',
      message: PRECISION_MAP[outputFormat]?.[precision] || ''
    };
  }, [precision, outputFormat]);

  const converterOptions = useMemo(() => ({
    inputFormat,
    outputFormat,
    internalDelimiter: outputFormat === 'hmsdms' ? internalDelimiter : ' ',
    raDecDelimiter: outputDelimiter,
  }), [inputFormat, outputFormat, internalDelimiter, outputDelimiter]);

  return {
    // Format options
    inputFormat,
    setInputFormat,
    outputFormat,
    setOutputFormat,

    // Precision options
    precision,
    setPrecision,
    precisionExplanation,

    // Delimiter options
    outputDelimiter,
    setOutputDelimiter,
    internalDelimiter,
    setInternalDelimiter,

    // Combined options
    converterOptions
  };
}