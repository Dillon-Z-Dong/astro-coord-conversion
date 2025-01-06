import { Copy, Download } from 'lucide-react';
import { splitByOutputDelimiter } from '../utils/formatHandling';

export function ActionButtons({ 
  results, 
  outputDelimiter, 
  onHoverChange 
}) {
  // Copy all lines
  const handleCopyAll = () => {
    const outputText = results
      .map(r => r.output)
      .join('\n');
    navigator.clipboard.writeText(outputText);
  };

  // Copy just RA values
  const handleCopyRA = () => {
    const raValues = results
      .filter(r => !r.error)
      .map(r => splitByOutputDelimiter(r.output, outputDelimiter)[0] || '')
      .join('\n');
    navigator.clipboard.writeText(raValues);
  };

  // Copy just Dec values
  const handleCopyDec = () => {
    const decValues = results
      .filter(r => !r.error)
      .map(r => splitByOutputDelimiter(r.output, outputDelimiter)[1] || '')
      .join('\n');
    navigator.clipboard.writeText(decValues);
  };

  // Download CSV
  const handleDownloadCSV = () => {
    const selectedData = results
      .map(result => {
        if (!result.output) return null;
        const [ra, dec] = splitByOutputDelimiter(result.output, outputDelimiter);
        return { ra: ra || '', dec: dec || '' };
      })
      .filter(Boolean);
  
    const csv = [
      ['RA', 'Dec'],
      ...selectedData.map(d => [d.ra, d.dec])
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
    <div className="flex flex-col space-y-2">
      <button 
        onMouseEnter={() => onHoverChange('all')}
        onMouseLeave={() => onHoverChange(null)}
        onClick={handleCopyAll}
        className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
      >
        <Copy className="w-4 h-4 mr-2" />
        Copy all
      </button>
      <button 
        onMouseEnter={() => onHoverChange('ra')}
        onMouseLeave={() => onHoverChange(null)}
        onClick={handleCopyRA}
        className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
      >
        <Copy className="w-4 h-4 mr-2" />
        Copy RA
      </button>
      <button 
        onMouseEnter={() => onHoverChange('dec')}
        onMouseLeave={() => onHoverChange(null)}
        onClick={handleCopyDec}
        className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
      >
        <Copy className="w-4 h-4 mr-2" />
        Copy Dec
      </button>
      <button 
        onClick={handleDownloadCSV}
        className="flex items-center justify-center px-1.5 py-1 bg-white border rounded shadow-sm hover:bg-gray-50"
      >
        <Download className="w-4 h-4 mr-2" />
        Download CSV
      </button>
    </div>
  );
}