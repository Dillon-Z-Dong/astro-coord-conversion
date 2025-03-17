## Application Structure

### Core Components

- `CoordinateConverter.js` - Main component that orchestrates the application
  - Manages core state (input text, results, hover states)
  - Coordinates conversion process
  - Composes layout of all sub-components

- `TopBar.js` - Controls for converter options
  - Input/Output format selection
  - Delimiter options
  - Precision settings

- `Messages.js` - Status and error display
  - Shows input statistics
  - Displays error counts
  - Handles scrolling to errors
  - Shows current format and precision information

- `InputEditor.js` - Text input panel
  - Handles text input with line numbers
  - Input validation
  - Hover highlighting
  - Scroll synchronization

- `OutputPanel.js` - Results display
  - Shows converted coordinates
  - Error display
  - Line numbers
  - Hover highlighting
  - Scroll synchronization

- `ActionButtons.js` - Copy and download functionality
  - Copy all results
  - Copy RA/Dec separately
  - Download as CSV

### Utility Functions

- `utils/coordinateParser.js` - Core coordinate conversion logic
- `utils/formatHandling.js` - Text formatting utilities
  - HMS/DMS formatting
  - Delimiter handling
  - Placeholder examples
- `utils/precisionHandling.js` - Precision calculation utilities
  - Error scaling
  - Precision matching between formats

### Hooks

- `hooks/useConverterOptions.js` - Manages converter settings state
  - Format options
  - Delimiter options
  - Precision settings
- `hooks/useSyncedScroll.js` - Synchronizes scrolling between panels

### Constants

- `constants/converterOptions.js` - Configuration constants
  - Format options
  - Delimiter options
  - Precision options
  - Precision mapping

## Key Features

- Real-time coordinate conversion
- Multiple format support (degrees, HMS/DMS)
- Configurable delimiters
- Precision control
- Error handling
- Synchronized scrolling
- Line highlighting
- Bulk copy/download options

## Component Interactions

CoordinateConverter  
├── TopBar (format & precision controls)  
├── Messages (status & errors)  
└── Main Editor Area  
    ├── InputEditor (text input)  
    ├── OutputPanel (results display)  
    └── ActionButtons (copy/download)  


## State Management

- Format and precision options managed by `useConverterOptions` hook
- Input text and conversion results managed by main component
- Scroll synchronization handled by `useSyncedScroll` hook
- Each component maintains its own UI state (hover effects, etc.)