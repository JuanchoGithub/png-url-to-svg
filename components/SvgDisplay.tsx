
import React, { useState, useMemo, useEffect } from 'react';
import { CopyIcon, CheckIcon, DownloadIcon } from './icons';

interface SvgDisplayProps {
  svgCode: string;
}

export const SvgDisplay: React.FC<SvgDisplayProps> = ({ svgCode }) => {
  const [copied, setCopied] = useState(false);

  const svgDataUrl = useMemo(() => {
    try {
      const encoded = btoa(unescape(encodeURIComponent(svgCode)));
      return `data:image/svg+xml;base64,${encoded}`;
    } catch (e) {
      console.error("Failed to encode SVG", e);
      return '';
    }
  }, [svgCode]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  const handleCopy = () => {
    navigator.clipboard.writeText(svgCode).then(() => {
      setCopied(true);
    });
  };
  
  const handleDownload = () => {
    const blob = new Blob([svgCode], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'converted.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex-1 flex flex-col bg-gray-900 rounded-lg p-4 border border-gray-700">
        <h3 className="text-lg font-semibold mb-2 text-gray-300">Rendered SVG</h3>
        <div className="flex-grow w-full h-full flex items-center justify-center bg-white/10 rounded p-2" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h10v10H0z\' fill=\'%234a5568\'/%3E%3Cpath d=\'M10 10h10v10H10z\' fill=\'%234a5568\'/%3E%3C/svg%3E")' }}>
          {svgDataUrl ? (
            <img src={svgDataUrl} alt="Generated SVG" className="max-w-full max-h-full object-contain" />
          ) : (
            <p className="text-red-400">Invalid SVG code</p>
          )}
        </div>
      </div>
      <div className="flex-1 flex flex-col bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex justify-between items-center p-2 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-gray-300 pl-2">SVG Code</h3>
          <div className="flex space-x-2">
            <button
                onClick={handleDownload}
                className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors duration-200"
                title="Download SVG"
            >
                <DownloadIcon className="w-5 h-5" />
            </button>
            <button
                onClick={handleCopy}
                className="p-2 rounded-md bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors duration-200"
                title="Copy Code"
            >
                {copied ? <CheckIcon className="w-5 h-5 text-green-400" /> : <CopyIcon className="w-5 h-5" />}
            </button>
          </div>
        </div>
        <pre className="flex-grow p-4 text-sm text-gray-300 overflow-auto bg-transparent">
          <code className="language-svg">{svgCode}</code>
        </pre>
      </div>
    </div>
  );
};
