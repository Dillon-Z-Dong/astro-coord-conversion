import { AlertCircle } from 'lucide-react';
import { displayDelimiter, getPlaceholderExamples } from '../utils/formatHandling';

export function OutputPanel({
  inputText,
  results,
  inputFormat,
  outputDelimiter,
  hoveredLine,
  onHover,
  onHoverEnd,
  onScroll,
}) {
  // Generate virtual line numbers based on results length
  const virtualLineNumbers = Array.from(
    { length: results.length }, 
    (_, i) => i + 1
  );

  return (
    <div className="w-[45%] relative border rounded shadow-sm overflow-hidden font-mono bg-white">
      <div className="h-full flex">
        {/* Line Numbers */}
        <div className="w-12 bg-gray-100 border-r flex-none overflow-hidden">
          {inputText ? 
            virtualLineNumbers.map((num, i) => (
              <div
                key={i}
                className={`
                  px-2 text-right text-gray-500 leading-6 text-base
                  ${hoveredLine === i ? 'bg-blue-50' : ''}
                `}
              >
                {num}
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

        {/* Output Content */}
        <div
          className="flex-grow overflow-y-auto overflow-x-auto output-scroll"
          onScroll={onScroll}
        >
          {inputText ? (
            results.map((result, i) => (
              <div
                key={i}
                className={`
                  h-6 flex items-center px-4 whitespace-pre
                  ${hoveredLine === i ? 'bg-blue-50' : ''}
                  ${result.error ? 'text-red-500' : ''}
                `}
                onMouseEnter={() => onHover(i)}
                onMouseLeave={onHoverEnd}
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
            getPlaceholderExamples(inputFormat).split('\n').map((example, i) => {
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
  );
}