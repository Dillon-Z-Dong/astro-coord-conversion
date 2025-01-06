import { getPlaceholderExamples } from '../utils/formatHandling';

export function InputEditor({
  inputText,
  inputFormat,
  internalDelimiter,
  hoveredLine,
  onInputChange,
  onHover,
  onHoverEnd,
  onScroll,
}) {
  // Modify the input handler to strip trailing empty lines
  const handleInputChange = (e) => {
    let newValue = e.target.value;
    
    // Strip trailing empty lines while preserving empty lines in the middle
    newValue = newValue.replace(/[\n\r]+([\n\r]|\s)*$/, '');
    
    // Count number of lines
    const lineCount = (newValue.match(/\n/g) || []).length + 1;
    
    if (lineCount > 5000) { // MAX_ROWS constant could be passed as prop
      alert(`Maximum input is 5000 lines. Current input: ${lineCount} lines`);
      return;
    }
    
    onInputChange(newValue);
  };

  // Highlight style for hovering over lines
  const highlightStyle = hoveredLine === null ? {} : {
    backgroundImage: `linear-gradient(
      rgba(59, 130, 246, 0.1),
      rgba(59, 130, 246, 0.1)
    )`,
    backgroundSize: `100% 24px`,
    backgroundPosition: `0 ${hoveredLine * 24}px`,
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="w-[45%] relative border rounded shadow-sm overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r overflow-hidden">
        {/* Line numbers */}
        {inputText ? 
          inputText.split('\n').map((_, i) => (
            <div
              key={i}
              className={`
                px-2 text-right text-gray-500 leading-6 text-base
                ${hoveredLine === i ? 'bg-blue-50' : ''}
              `}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={onHoverEnd}
            >
              {i + 1}
            </div>
          ))
          : 
          getPlaceholderExamples(inputFormat, internalDelimiter).split('\n').map((_, i) => (
            <div
              key={i}
              className="px-2 text-right text-gray-300 leading-6 text-base"
            >
              {i + 1}
            </div>
          ))
        }
      </div>
      <textarea
        value={inputText}
        onChange={handleInputChange}
        onMouseMove={e => {
          const lineHeight = 24;
          const rect = e.target.getBoundingClientRect();
          const relativeY = e.clientY - rect.top;
          const lineIndex = Math.floor(relativeY / lineHeight);
          
          if (lineIndex >= 0 && lineIndex < inputText.split('\n').length) {
            onHover(lineIndex);
          } else {
            onHoverEnd();
          }
        }}
        onMouseLeave={onHoverEnd}
        onScroll={onScroll}
        placeholder={getPlaceholderExamples(inputFormat, internalDelimiter)}
        className="w-full h-full pl-14 pr-4 font-mono resize-none text-base leading-6 whitespace-pre overflow-x-auto"
        style={{
          ...highlightStyle,
          maxHeight: '100%',
          minHeight: '100%'
        }}
        spellCheck="false"
        data-gramm="false"
        data-gramm_editor="false"
        data-enable-grammarly="false"
      />
    </div>
  );
}