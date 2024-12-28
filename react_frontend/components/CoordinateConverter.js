import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { raDecConverter } from '../utils/coordinateParser';

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
  { value: ':', label: 'Colons', example: '12:34:56.789' },
  { value: 'hms', label: 'Letters', example: '12h34m56.789s' },
  { value: ' ', label: 'Spaces', example: '12 34 56.789' }
];

const DELIMITER_OPTIONS = [
  { value: ' ', label: 'Space' },
  { value: ',', label: 'Comma' },
  { value: '\t', label: 'Tab' },
  { value: ' | ', label: 'Pipe' }
];

const detectDelimiter = (line) => {
  if (!line) return ' ';
  if (line.includes('|')) return ' | ';
  if (line.includes(',')) return ',';
  if (line.includes('\t')) return '\t';
  return ' ';
};

const getExampleForFormat = (format, internalDelimiter = ':') => {
  switch(format) {
    case 'hmsdms':
      return internalDelimiter === 'hms' 
        ? ['12h34m56.789s', '+12d34m56.789s']
        : [internalDelimiter === ' ' ? '12 34 56.789' : '12:34:56.789', 
           internalDelimiter === ' ' ? '+12 34 56.789' : '+12:34:56.789'];
    case 'degrees':
      return ['188.736621', '+12.582441'];
    case 'casa':
      return ['12:34:56.789', '+12.34.56.789'];
    default:
      return ['', ''];
  }
};

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
  const [hoveredExamplePart, setHoveredExamplePart] = useState(null);

  // Detect input delimiter from first valid line
  const detectedInputDelimiter = useMemo(() => {
    const firstValidLine = inputText.split('\n').find(line => line.trim());
    return detectDelimiter(firstValidLine);
  }, [inputText]);

  // Detect precision from first valid coordinate
  const detectedPrecision = useMemo(() => {
    const firstValidLine = inputText.split('\n').find(line => line.trim());
    if (!firstValidLine) return 6; // default
    const parts = firstValidLine.split(/[\s,|]+/).filter(Boolean);
    if (parts.length < 2) return 6;
    const precisionRA = Math.max(0, (parts[0].split('.')[1] || '').length);
    const precisionDec = Math.max(0, (parts[1].split('.')[1] || '').length);
    return Math.max(precisionRA, precisionDec);
  }, [inputText]);

  const processInput = useCallback(() => {
    const lines = inputText.split('\n');
    const newResults = lines.map(line => {
      if (!line.trim()) return { output: '', error: null };
      
      try {
        const output = raDecConverter(line, {
          inputFormat,
          outputFormat,
          internalDelimiter: outputFormat === 'hmsdms' ? internalDelimiter : ':',
          raDecDelimiter: outputDelimiter,
          raPrecision: precision === 'match' ? detectedPrecision : parseInt(precision),
          decPrecision: precision === 'match' ? detectedPrecision : parseInt(precision)
        });
        return { output, error: null };
      } catch (error) {
        return { output: '', error: error.message };
      }
    });
    setResults(newResults);
  }, [inputText, inputFormat, outputFormat, precision, detectedPrecision, internalDelimiter, outputDelimiter]);

  useEffect(() => {
    processInput();
  }, [processInput]);

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

  const handleCopyAll = () => {
    const outputText = results
      .filter((_, i) => selectedLines.has(i) || selectedLines.size === 0)
      .map(r => r.output)
      .join('\n');
    navigator.clipboard.writeText(outputText);
  };

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
        {/* Controls */}
        <div className="grid grid-cols-2 gap-4 bg-white p-4 rounded shadow">
          <div className="space-y-4">
            <h3 className="font-medium">Input Format</h3>
            <div className="space-y-2">
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

          <div className="space-y-4">
            <div className="flex justify-between items-start mb-4">
              <h3 className="font-medium">Output Format</h3>
              <div className="space-y-2 w-64">
                <h4 className="text-sm font-medium">Output Precision</h4>
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
                <div className="text-xs text-gray-600">
                  {precision === 'match' ? 
                    `Matching input (${detectedPrecision} digits)` :
                    (outputFormat === 'degrees' ? 
                      PRECISION_MAP.degrees[precision] :
                      PRECISION_MAP.hmsdms[precision])}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
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
              
              <div className="space-y-4 pt-4">
                {outputFormat === 'hmsdms' && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium">Internal Delimiter</h4>
                    <div className="flex space-x-2">
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
                
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">External Delimiter</h4>
                  <div className="flex space-x-2">
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
            </div>
          </div>
        </div>

        {/* Format Example Area */}
        <div className="mt-6 mb-4 p-4 bg-gray-50 rounded grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Input Format: </span>
              <span>Detected delimiter: {detectedInputDelimiter === ' ' ? 'Space' : 
                                     detectedInputDelimiter === '\t' ? 'Tab' : 
                                     `'${detectedInputDelimiter}'`}</span>
              <div 
                className="font-mono mt-1 cursor-default"
                onMouseLeave={() => setHoveredExamplePart(null)}
              >
                <span
                  className={hoveredExamplePart === 'ra' ? 'bg-blue-100' : ''}
                  onMouseEnter={() => setHoveredExamplePart('ra')}
                >
                  {inputText.split('\n')[0]?.split(/[\s,|]+/)[0] || getExampleForFormat(inputFormat)[0]}
                </span>
                <span
                  className={hoveredExamplePart === 'delim' ? 'bg-blue-100' : ''}
                  onMouseEnter={() => setHoveredExamplePart('delim')}
                >
                  {detectedInputDelimiter === '\t' ? '    ' : detectedInputDelimiter}
                </span>
                <span
                  className={hoveredExamplePart === 'dec' ? 'bg-blue-100' : ''}
                  onMouseEnter={() => setHoveredExamplePart('dec')}
                >
                  {inputText.split('\n')[0]?.split(/[\s,|]+/)[1] || getExampleForFormat(inputFormat)[1]}
                </span>
              </div>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className="text-sm">
              <span className="font-medium">Output Format: </span>
              <span>Selected delimiter: {outputDelimiter === ' ' ? 'Space' : 
                                     outputDelimiter === '\t' ? 'Tab' : 
                                     outputDelimiter === ' | ' ? 'Pipe' :
                                     `'${outputDelimiter}'`}</span>
              <div 
                className="font-mono mt-1 cursor-default"
                onMouseLeave={() => setHoveredExamplePart(null)}
              >
                <span
                  className={hoveredExamplePart === 'ra' ? 'bg-blue-100' : ''}
                  onMouseEnter={() => setHoveredExamplePart('ra')}
                >
                  {getExampleForFormat(outputFormat, internalDelimiter)[0]}
                </span>
                <span
                  className={hoveredExamplePart === 'delim' ? 'bg-blue-100' : ''}
                  onMouseEnter={() => setHoveredExamplePart('delim')}
                >
                  {outputDelimiter === '\t' ? '    ' : outputDelimiter}
                </span>
                <span
                  className={hoveredExamplePart === 'dec' ? 'bg-blue-100' : ''}
                  onMouseEnter={() => setHoveredExamplePart('dec')}
                >
                  {getExampleForFormat(outputFormat, internalDelimiter)[1]}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Editor Area */}
        <div className="flex gap-4 flex-grow overflow-hidden">
          {/* Input Panel - 45% width */}
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
              className="w-full h-full pl-14 pr-4 font-mono resize-none text-base [line-height:1.5rem] leading-6 whitespace-pre overflow-x-auto"
              placeholder="Enter coordinates..."
            />
          </div>

          {/* Output Panel - 45% width */}
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
                          ${result.error ? 'bg-red-50' : ''}
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

                  const [ra, dec] = result.output.split(/\s+/);
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
                        {ra}
                      </span>
                      <span className="mx-1"> </span>
                      <span className={hoveredCopyType === 'dec' || hoveredCopyType === 'all' ? 'bg-blue-100' : ''}>
                        {dec}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Action Buttons - Vertical Stack */}
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
                  .map(r => r.output.split(/\s+/)[0])
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
                  .map(r => r.output.split(/\s+/)[1])
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

      <div className="text-center text-gray-500 py-4">
        Batch Coordinate Converter (Under Development)
        <div className="text-sm">Version 0.1.0</div>
      </div>
    </div>
  );
};

export default CoordinateConverter;