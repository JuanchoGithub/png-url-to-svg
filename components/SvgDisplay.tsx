import React, { useState, useMemo, useEffect } from 'react';
import { CopyIcon, CheckIcon, DownloadIcon } from './icons';

interface SvgDisplayProps {
  svgCode: string;
  simplificationLevel: number;
  onSimplificationChange: (level: number) => void;
  tracingTolerance: number;
  onTracingToleranceChange: (level: number) => void;
  strokeEnabled: boolean;
  onStrokeEnabledChange: (enabled: boolean) => void;
  strokeColor: string;
  onStrokeColorChange: (color: string) => void;
  strokeWidth: number;
  onStrokeWidthChange: (width: number) => void;
}

const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};


export const SvgDisplay: React.FC<SvgDisplayProps> = ({ 
    svgCode, 
    simplificationLevel, 
    onSimplificationChange,
    tracingTolerance,
    onTracingToleranceChange,
    strokeEnabled,
    onStrokeEnabledChange,
    strokeColor,
    onStrokeColorChange,
    strokeWidth,
    onStrokeWidthChange
}) => {
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'rendered' | 'wireframe'>('rendered');
  const [svgSize, setSvgSize] = useState(0);

  const createDataUrl = (svg: string) => {
    try {
      return `data:image/svg+xml;base64,${btoa(svg)}`;
    } catch (e) {
      console.error("Failed to encode SVG", e);
      return '';
    }
  };

  const wireframeSvgCode = useMemo(() => {
    if (!svgCode) return '';
    const style = `<style>path, rect, circle, polygon, polyline, line, ellipse { fill: none !important; stroke: #007aff; stroke-width: 1; vector-effect: non-scaling-stroke; }</style>`;
    const closingSvgTagIndex = svgCode.lastIndexOf('</svg>');
    if (closingSvgTagIndex !== -1) {
      return `${svgCode.slice(0, closingSvgTagIndex)}${style}${svgCode.slice(closingSvgTagIndex)}`;
    }
    return svgCode.replace(/(<svg[^>]*>)/, `$1${style}`);
  }, [svgCode]);

  const codeToDisplay = view === 'wireframe' ? wireframeSvgCode : svgCode;
  const dataUrlToDisplay = useMemo(() => createDataUrl(codeToDisplay), [codeToDisplay]);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => setCopied(false), 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  useEffect(() => {
    const sizeInBytes = new Blob([codeToDisplay]).size;
    setSvgSize(sizeInBytes);
  }, [codeToDisplay]);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeToDisplay).then(() => {
      setCopied(true);
    });
  };
  
  const handleDownload = () => {
    const filename = view === 'wireframe' ? 'converted-wireframe.svg' : 'converted.svg';
    const blob = new Blob([codeToDisplay], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full h-full flex flex-col space-y-4">
      <div className="flex-1 flex flex-col bg-gray-900 rounded-lg p-4 border border-gray-700 min-h-0">
        <h3 className="text-lg font-semibold text-gray-300 mb-2">Controls & Preview</h3>
        
        <div className="flex flex-col gap-y-4 mb-4 px-1">
          <div>
            <label htmlFor="tracing-tolerance-slider" className="flex justify-between text-sm font-medium text-gray-400 mb-1">
              <span>Tracing Tolerance</span>
              <span>{tracingTolerance.toFixed(1)}</span>
            </label>
            <input
              id="tracing-tolerance-slider"
              type="range"
              min="0"
              max="5"
              step="0.2"
              value={tracingTolerance}
              onChange={(e) => onTracingToleranceChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
              aria-label="Tracing Tolerance Slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Precise</span>
              <span>Smooth</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Smoothes shapes before tracing. Re-processes image.</p>
          </div>
          <div>
            <label htmlFor="simplification-slider" className="flex justify-between text-sm font-medium text-gray-400 mb-1">
              <span>SVG Complexity</span>
              <span>{simplificationLevel.toFixed(1)}</span>
            </label>
            <input
              id="simplification-slider"
              type="range"
              min="0.1"
              max="10"
              step="0.1"
              value={simplificationLevel}
              onChange={(e) => onSimplificationChange(parseFloat(e.target.value))}
              className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-blue"
              aria-label="SVG Complexity Slider"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>More Detail</span>
              <span>Less Detail</span>
            </div>
            <p className="text-xs text-gray-500 mt-1">Reduces points on traced paths. Updates in real-time.</p>
          </div>
        </div>

        <div className="border-t border-gray-700 pt-4 mt-2 px-1">
            <h4 className="text-sm font-medium text-gray-400 mb-3">Stroke Options</h4>
            <div className="flex items-center space-x-4">
                <div className="flex items-center">
                    <input
                        type="checkbox"
                        id="stroke-enable"
                        checked={strokeEnabled}
                        onChange={(e) => onStrokeEnabledChange(e.target.checked)}
                        className="w-4 h-4 text-brand-blue bg-gray-700 border-gray-600 rounded focus:ring-brand-blue"
                    />
                    <label htmlFor="stroke-enable" className="ml-2 text-sm text-gray-300">Enable</label>
                </div>
                <div className="flex items-center space-x-2">
                    <input
                        type="color"
                        id="stroke-color"
                        value={strokeColor}
                        onChange={(e) => onStrokeColorChange(e.target.value)}
                        disabled={!strokeEnabled}
                        className="p-1 h-8 w-8 block bg-gray-800 border border-gray-600 cursor-pointer rounded-lg disabled:cursor-not-allowed disabled:opacity-50"
                        title="Stroke Color"
                    />
                </div>
                <div className="flex items-center space-x-2 flex-grow">
                    <input
                        type="range"
                        id="stroke-width-slider"
                        min="0.1"
                        max="10"
                        step="0.1"
                        value={strokeWidth}
                        onChange={(e) => onStrokeWidthChange(parseFloat(e.target.value))}
                        disabled={!strokeEnabled}
                        className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
                        aria-label="Stroke Width Slider"
                    />
                    <span className="text-sm text-gray-400 font-mono w-12 text-right">{strokeWidth.toFixed(1)}px</span>
                </div>
            </div>
        </div>
        
        <div className="flex justify-end items-center my-4">
            <div className="flex items-center bg-gray-800 p-1 rounded-lg text-sm">
                <button
                    onClick={() => setView('rendered')}
                    className={`px-3 py-1 rounded-md transition-colors ${view === 'rendered' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}
                    aria-pressed={view === 'rendered'}
                >
                    Rendered
                </button>
                <button
                    onClick={() => setView('wireframe')}
                    className={`px-3 py-1 rounded-md transition-colors ${view === 'wireframe' ? 'bg-brand-blue text-white' : 'text-gray-400 hover:text-white'}`}
                    aria-pressed={view === 'wireframe'}
                >
                    Wireframe
                </button>
            </div>
        </div>
        <div className="flex-grow w-full h-full flex items-center justify-center bg-white/10 rounded p-2" style={{backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' viewBox=\'0 0 20 20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h10v10H0z\' fill=\'%234a5568\'/%3E%3Cpath d=\'M10 10h10v10H10z\' fill=\'%234a5568\'/%3E%3C/svg%3E")' }}>
          {dataUrlToDisplay ? (
            <img src={dataUrlToDisplay} alt={`Generated SVG - ${view} view`} className="max-w-full max-h-full object-contain" />
          ) : (
            <p className="text-red-400">Invalid SVG code</p>
          )}
        </div>
      </div>
      <div className="h-48 flex flex-col bg-gray-900 rounded-lg border border-gray-700">
        <div className="flex justify-between items-center p-2 border-b border-gray-700">
          <h3 className="text-lg font-semibold text-gray-300 pl-2">{view === 'rendered' ? 'Rendered' : 'Wireframe'} SVG Code</h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-400 font-mono bg-gray-800 px-2 py-1 rounded-md">{formatBytes(svgSize)}</span>
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
        <pre className="flex-grow p-4 text-sm text-gray-300 overflow-auto bg-transparent min-h-0">
          <code className="language-svg">{codeToDisplay}</code>
        </pre>
      </div>
    </div>
  );
};