// components/TopBar.js
import { 
  FORMAT_OPTIONS, 
  DELIMITER_OPTIONS, 
  INTERNAL_DELIMITER_OPTIONS,
  PRECISION_OPTIONS,
  PRECISION_MAP 
} from '../constants/converterOptions';

export function TopBar({ options, onOptionsChange }) {
  const {
    inputFormat,
    outputFormat,
    outputDelimiter,
    internalDelimiter,
    precision,
    precisionExplanation
  } = options;

  const {
    setInputFormat,
    setOutputFormat,
    setOutputDelimiter,
    setInternalDelimiter,
    setPrecision
  } = onOptionsChange;

  // When a user clicks directly on a radio button, it's a manual change
  const handleManualInputFormatChange = (e) => {
    setInputFormat(e.target.value);
  };

  return (
    <div className="grid grid-cols-4 gap-4 bg-white p-4 rounded shadow">
      {/* Input Format */}
      <div className="space-y-2">
        <h3 className="font-medium">Input Format</h3>
        <div className="space-y-1">
          {FORMAT_OPTIONS.map(opt => (
            <label key={opt.value} className="flex items-center space-x-2">
              <input
                type="radio"
                value={opt.value}
                checked={inputFormat === opt.value}
                onChange={handleManualInputFormatChange}
                className="w-4 h-4"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Output Format */}
      <div className="space-y-2">
        <h3 className="font-medium">Output Format</h3>
        <div className="space-y-1">
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

      {/* Delimiters */}
      <div className="space-y-2">
        <h3 className="font-medium">Output Delimiters</h3>
        <div className="space-y-1">
          <span className="font-medium text-sm">Coordinate:</span>
          <div className="flex flex-wrap gap-2">
            {DELIMITER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setOutputDelimiter(opt.value)}
                className={`px-1.5 py-1 text-sm border rounded ${
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
        {outputFormat === 'hmsdms' && (
          <div className="space-y-1">
            <span className="font-medium text-sm">Component:</span>
            <div className="flex flex-wrap gap-2">
              {INTERNAL_DELIMITER_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setInternalDelimiter(opt.value)}
                  className={`px-1.5 py-1 text-sm border rounded ${
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
      </div>

      {/* Precision */}
      <div className="space-y-2">
        <h3 className="font-medium">Output Precision</h3>
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
          {precisionExplanation.type === 'match' ? (
            <p>{precisionExplanation.message}</p>
          ) : (
            <p>Fixed precision: {precisionExplanation.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}