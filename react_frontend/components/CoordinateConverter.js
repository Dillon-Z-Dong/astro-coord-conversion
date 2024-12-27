import React, { useState, useEffect, useCallback } from 'react';
import { Download, Copy, AlertCircle } from 'lucide-react';
import { raDecConverter } from '../utils/coordinateParser';
export { raDecConverter };

const PRECISION_OPTIONS = [
  { value: "4", label: "4 digits (~0.2 arcsec)" },
  { value: "5", label: "5 digits (~0.02 arcsec)" },
  { value: "6", label: "6 digits (~2 milliarcsec)" },
  { value: "7", label: "7 digits (~0.2 milliarcsec)" },
  { value: "8", label: "8 digits (~20 microarcsec)" },
  { value: "9", label: "9 digits (~2 microarcsec)" }
];

const FORMAT_OPTIONS = [
  { 
    value: 'hmsdms', 
    label: 'HMS/DMS', 
    example: '12:34:56.789 +12:34:56.789' 
  },
  { 
    value: 'degrees', 
    label: 'Decimal Degrees', 
    example: '188.736621 +12.582441' 
  },
  { 
    value: 'casa', 
    label: 'CASA Format', 
    example: '12:34:56.789, +12.34.56.789' 
  }
];


const CoordinateConverter = () => {
  const [inputText, setInputText] = useState('');
  const [inputFormat, setInputFormat] = useState('hmsdms');
  const [outputFormat, setOutputFormat] = useState('degrees');
  const [precision, setPrecision] = useState('6');
  const [selectedLines, setSelectedLines] = useState(new Set());
  const [results, setResults] = useState([]);
  const [hoveredLine, setHoveredLine] = useState(null);

  // Update the processInput callback to use the full options:
  const processInput = useCallback(() => {
    const lines = inputText.split('\n');
    const newResults = lines.map(line => {
      if (!line.trim()) return { output: '', error: null };
      
      try {
        const output = raDecConverter(line, {
          inputFormat,
          outputFormat,
          internalDelimiter: outputFormat === 'hmsdms' ? ':' : ' ',
          raDecDelimiter: outputFormat === 'casa' ? ', ' : ' ',
          raPrecision: parseInt(precision),
          decPrecision: parseInt(precision)
        });
        return { output, error: null };
      } catch (error) {
        return { output: '', error: error.message };
      }
    });
    setResults(newResults);
  }, [inputText, inputFormat, outputFormat, precision]);


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
                  <span className="text-sm">
                    {opt.label}
                    <span className="ml-2 text-gray-500">
                      (e.g., {opt.example})
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex justify-between items-start">
              <h3 className="font-medium">Output Format</h3>
              <select 
                value={precision} 
                onChange={e => setPrecision(e.target.value)}
                className="border rounded px-2 py-1 w-64"
              >
                {PRECISION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            
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
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-4 my-4">
          <button 
            onClick={handleCopyAll} 
            className="flex items-center px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50"
          >
            <Copy className="w-4 h-4 mr-2" />
            Copy Selected
          </button>
          <button 
            onClick={handleDownloadCSV} 
            className="flex items-center px-4 py-2 bg-white border rounded shadow-sm hover:bg-gray-50"
          >
            <Download className="w-4 h-4 mr-2" />
            Download CSV
          </button>
        </div>

        {/* Editor Area */}
        <div className="grid grid-cols-2 gap-4 flex-grow overflow-hidden">
          {/* Input Panel */}
          <div className="relative border rounded shadow-sm overflow-hidden">
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
              className="w-full h-full pl-14 pr-4 font-mono resize-none text-base [line-height:1.5rem] leading-6"
              placeholder="Enter coordinates..."
            />
          </div>

          {/* Output Panel */}
          <div className="relative border rounded shadow-sm overflow-hidden font-mono bg-white">
            <div className="h-full flex">
              <div className="w-12 bg-gray-100 border-r flex-none overflow-y-auto output-line-numbers">
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
                className="flex-grow overflow-auto output-scroll"
                onScroll={e => {
                  const lineNumbers = e.target.previousSibling;
                  const textarea = document.querySelector('textarea');
                  const inputLineNumbers = textarea?.previousSibling;
                  if (lineNumbers) lineNumbers.scrollTop = e.target.scrollTop;
                  if (textarea) textarea.scrollTop = e.target.scrollTop;
                  if (inputLineNumbers) inputLineNumbers.scrollTop = e.target.scrollTop;
                }}
              >
                {results.map((result, i) => (
                  <div
                    key={i}
                    className={`
                      h-6 flex items-center px-4 whitespace-pre
                      ${result.error ? 'bg-red-50' : ''}
                      ${selectedLines.has(i) ? 'bg-blue-100' : ''}
                      ${hoveredLine === i ? 'bg-blue-50' : ''}
                    `}
                  >
                    {result.error ? (
                      <div className="flex items-center text-red-600">
                        <AlertCircle className="w-4 h-4 mr-2" />
                        {result.error}
                      </div>
                    ) : (
                      result.output
                    )}
                  </div>
                ))}
              </div>
            </div>
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