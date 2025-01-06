import { AlertCircle } from 'lucide-react';

export function Messages({ 
  inputText, 
  inputFormat, 
  outputFormat,
  precision,
  results,
  onErrorClick,
  matchedPrecisions  // { raOut, decOut }
}) {
  // Helper function to compute input stats
  const getInputStats = () => {
    if (!inputText) return null;
    
    const totalLines = inputText.split('\n').filter(line => line.trim()).length;
    const errorCount = results.filter(r => r.error).length;
    
    return {
      totalLines,
      errorCount
    };
  };

  const stats = getInputStats();

  return (
    <div className="flex gap-0 items-end mb-0.5 mt-5">  
      {/* Input Message */}
      <div className="w-[45%] text-sm pl-12 font-italic min-h-[24px]">
        <span className="text-gray-500 block">
          {!inputText ? (
            "Input RA/Dec (one per line, many formats accepted)"
          ) : (
            <>
              <span className="text-gray-700">
                {stats.totalLines} input coordinate{stats.totalLines !== 1 ? 's' : ''} detected [{inputFormat}]
              </span>
              {stats.errorCount > 0 && (
                <button
                  onClick={onErrorClick}
                  className="text-red-500 ml-1 hover:underline focus:outline-none"
                >
                  ({stats.errorCount} error{stats.errorCount !== 1 ? 's' : ''})
                </button>
              )}
            </>
          )}
        </span>
      </div>

      {/* Output Message */}
      <div className="w-[45%] text-sm text-gray-500 pl-8 mb-0.5 font-italic min-h-[24px]">
        {!inputText ? (
          'Output RA/Dec (formatted based on selections above)'
        ) : (
          <>
            Requested output format: [{outputFormat}] [{precision === 'match' ? (
              <>RA: {matchedPrecisions.raOut} digits, Dec: {matchedPrecisions.decOut} digits</>
            ) : (
              `${precision} digits`
            )}]
          </>
        )}
      </div>
    </div>
  );
}