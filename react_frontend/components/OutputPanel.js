import { useMemo } from 'react';
import { AlertCircle } from 'lucide-react';
import { displayDelimiter, getPlaceholderExamples, splitByOutputDelimiter } from '../utils/formatHandling';
import { raDecConverter } from '../utils/coordinateParser';

export function OutputPanel({
  inputText,
  results,
  inputFormat = 'decimal',
  outputFormat = 'degrees',
  outputDelimiter = ' ',
  precision = 2,
  matchPrecision = false,
  internalDelimiter = ' ',
  hoveredLine,
  scrollPosition,
  onScroll,
  onMouseMove,
  onMouseLeave,
  hoveredCopyType,
}) {
  // Add debug logging for incoming props
  console.log('OutputPanel props:', {
    precision,
    matchPrecision,
    typeof_precision: typeof precision
  });

  // Memoize placeholder outputs
  const placeholderOutputs = useMemo(() => {
    const examples = getPlaceholderExamples(inputFormat).split('\n');
    return examples.map(example => {
      // Use parser format names directly - no conversion needed
      const parserInputFormat = inputFormat;
      const parserOutputFormat = outputFormat;
      
      const converterOptions = {
        inputFormat: parserInputFormat,
        outputFormat: parserOutputFormat,
        raDecDelimiter: outputDelimiter,
        internalDelimiter,
        precision,
        matchPrecision
      };

      // Add detailed debug logging
      console.log('Converter options before call:', {
        ...converterOptions,
        typeof_precision: typeof converterOptions.precision,
        precision_value: converterOptions.precision
      });
      
      try {
        if (!example.trim()) return ''; // Skip empty lines
        
        let output;
        if (outputFormat === 'hmsdms') {
          output = raDecConverter(example.trim(), converterOptions);
        } else if (outputFormat === 'degrees') {
          output = raDecConverter(example.trim(), converterOptions);
        } else if (outputFormat === 'casa') {
          output = raDecConverter(example.trim(), converterOptions);
        }

        return output || '';
      } catch (e) {
        console.error('Error parsing placeholder:', e);
        console.error('Converter options at error:', converterOptions);
        console.error(e.stack);
        return '';
      }
    });
  }, [
    inputFormat,
    outputFormat,
    outputDelimiter,
    internalDelimiter,
    precision,
    matchPrecision
  ]);

  const renderOutput = (result, index) => {
    if (result.error) {
      return (
        <div className="flex items-center">
          <AlertCircle className="w-4 h-4 mr-2" />
          {result.error}
        </div>
      );
    }

    // Split the output into RA and Dec parts
    const [ra, dec] = splitByOutputDelimiter(result.output, outputDelimiter);
    const delimiter = displayDelimiter(outputDelimiter);

    return (
      <>
        <span className={hoveredCopyType === 'all' || hoveredCopyType === 'ra' ? 'bg-purple-100' : ''}>
          {ra}
        </span>
        <span className="mx-0">{delimiter}</span>
        <span className={hoveredCopyType === 'all' || hoveredCopyType === 'dec' ? 'bg-purple-100' : ''}>
          {dec}
        </span>
      </>
    );
  };

  return (
    <div className="w-[45%] relative border rounded shadow-sm overflow-hidden font-mono bg-white">
      <div className="h-full flex">
        <div className="w-12 bg-gray-100 border-r flex-none overflow-hidden">
          {inputText ? 
            results.map((_, i) => (
              <div
                key={i}
                className={`
                  px-2 text-right text-gray-500 leading-6 text-base
                  ${hoveredLine === i ? 'bg-blue-50' : ''}
                `}
              >
                {i + 1}
              </div>
            ))
            :
            getPlaceholderExamples(inputFormat).split('\n').map((_, i) => (
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
          className="flex-grow overflow-y-auto overflow-x-auto output-scroll relative"
          onScroll={(e) => onScroll(e.target.scrollTop)}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        >
          <div className="relative">
            {hoveredLine !== null && (
              <div 
                className="absolute left-0 right-0 pointer-events-none"
                style={{
                  height: '24px',
                  top: `${hoveredLine * 24}px`,
                  backgroundColor: 'rgba(59, 130, 246, 0.1)'
                }}
              />
            )}
            
            {inputText ? (
              results.map((result, i) => (
                <div
                  key={i}
                  className={`
                    h-6 flex items-center px-4 whitespace-pre relative
                    ${result.error ? 'text-red-500' : ''}
                  `}
                >
                  {renderOutput(result, i)}
                </div>
              ))
            ) : (
              placeholderOutputs.map((output, i) => (
                <div
                  key={i}
                  className="h-6 flex items-center px-4 whitespace-pre text-gray-300"
                >
                  {output}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}