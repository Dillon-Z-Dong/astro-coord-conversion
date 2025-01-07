import { getPlaceholderExamples } from '../utils/formatHandling';
import { useState } from 'react';

export function InputEditor({
  inputText,
  inputFormat,
  internalDelimiter,
  hoveredLine,
  scrollPosition,
  onInputChange,
  onScroll,
  onMouseMove,
  onMouseLeave,
}) {
  const handleInputChange = (e) => {
    // For regular typing, just pass through the value
    onInputChange(e.target.value, {
      headerLines: [],
      trailingWhitespaceCount: 0
    });
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text');
    let lines = pastedText.split('\n');
    
    // Store header lines with their content
    const headerLines = lines.filter(line => {
      const trimmed = line.trim();
      return trimmed && /^[A-Za-z\s]+$/.test(trimmed);
    });
    
    // Remove header lines
    lines = lines.filter(line => {
      const trimmed = line.trim();
      if (!trimmed) return true; // Keep empty lines for now
      return !/^[A-Za-z\s]+$/.test(trimmed);
    });
    
    // Count trailing whitespace lines
    const lastNonEmptyIndex = lines.reduceRight((acc, line, index) => {
      if (acc === -1 && line.trim()) {
        return index;
      }
      return acc;
    }, -1);
    
    const trailingWhitespaceCount = lastNonEmptyIndex === -1 ? 0 : 
      lines.length - (lastNonEmptyIndex + 1);
    
    // Keep only up to the last non-empty line
    if (lastNonEmptyIndex !== -1) {
      lines = lines.slice(0, lastNonEmptyIndex + 1);
    }

    // Get the current cursor position
    const cursorPos = e.target.selectionStart;
    
    // Combine existing text with pasted text
    const newValue = inputText.slice(0, cursorPos) + 
                    lines.join('\n') + 
                    inputText.slice(e.target.selectionEnd);
    
    onInputChange(newValue, {
      headerLines,
      trailingWhitespaceCount
    });
  };

  const highlightStyle = hoveredLine === null ? {} : {
    backgroundImage: `linear-gradient(
      rgba(59, 130, 246, 0.1),
      rgba(59, 130, 246, 0.1)
    )`,
    backgroundSize: `100% 24px`,
    backgroundPosition: `0 ${(hoveredLine * 24) - scrollPosition}px`,
    backgroundRepeat: 'no-repeat'
  };

  return (
    <div className="w-[45%] relative border rounded shadow-sm overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gray-100 border-r overflow-hidden">
        {inputText ? 
          inputText.split('\n').map((_, i) => (
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
        onPaste={handlePaste}
        onScroll={(e) => onScroll(e.target.scrollTop)}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        placeholder={getPlaceholderExamples(inputFormat, internalDelimiter)}
        className="w-full h-full pl-14 pr-4 font-mono resize-none text-base leading-6 whitespace-pre overflow-x-auto"
        style={{
          ...highlightStyle,
          maxHeight: '100%',
          minHeight: '100%'
        }}
        spellCheck="false"
      />
    </div>
  );
}