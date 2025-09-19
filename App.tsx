import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { UrlFetcher } from './components/UrlFetcher';
import { SvgDisplay } from './components/SvgDisplay';
import { Spinner } from './components/Spinner';
import { traceImage, generateSvg } from './services/vectorizerService';
import type { TracedData, GenerateSvgOptions } from './services/vectorizerService';
import { Header } from './components/Header';
import { UploadIcon, LinkIcon, ResetIcon } from './components/icons';
import type { UploadedImage } from './types';
import { fetchImagesFromUrl, imageUrlToDataUrl } from './services/imageFetcherService';
import { ImageCropper } from './components/ImageCropper';
import type { CropData } from './components/ImageCropper';


type SourceTab = 'upload' | 'url';
type Stage = 'upload' | 'crop' | 'result';

const App: React.FC = () => {
  const [sourceTab, setSourceTab] = useState<SourceTab>('upload');
  const [stage, setStage] = useState<Stage>('upload');

  const [originalImage, setOriginalImage] = useState<UploadedImage | null>(null);
  const [processedImage, setProcessedImage] = useState<UploadedImage | null>(null);
  
  const [svgCode, setSvgCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  
  const [url, setUrl] = useState('');
  const [fetchedImages, setFetchedImages] = useState<string[]>([]);
  const [isFetchingUrlImages, setIsFetchingUrlImages] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);

  const [tracedData, setTracedData] = useState<TracedData | null>(null);
  const [simplificationLevel, setSimplificationLevel] = useState<number>(2);
  const [tracingTolerance, setTracingTolerance] = useState<number>(2);
  
  const [strokeEnabled, setStrokeEnabled] = useState<boolean>(false);
  const [strokeColor, setStrokeColor] = useState<string>('#000000');
  const [strokeWidth, setStrokeWidth] = useState<number>(1);
  
  const isInitialMount = useRef(true);

  // Generate SVG from traced data (fast, real-time updates)
  useEffect(() => {
    if (tracedData) {
      const options: GenerateSvgOptions = {
        simplification: simplificationLevel,
        strokeEnabled,
        strokeColor,
        strokeWidth,
      };
      const newSvgCode = generateSvg(tracedData, options);
      setSvgCode(newSvgCode);
    }
  }, [tracedData, simplificationLevel, strokeEnabled, strokeColor, strokeWidth]);

  // Central function for running the vectorization process (slow)
  const runConversion = useCallback(async (image: UploadedImage, tolerance: number) => {
    setIsLoading(true);
    setError(null);
    setSvgCode(null);
    setTracedData(null);
    setStage('result');

    try {
      const newTracedData = await traceImage(image.dataUrl, { tracingTolerance: tolerance });
      setTracedData(newTracedData);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to convert image. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  // Debounced effect to re-run conversion when tolerance changes (slow)
  useEffect(() => {
    if (isInitialMount.current) {
        isInitialMount.current = false;
        return;
    }

    if (!processedImage) {
        return;
    }
    
    setIsLoading(true);
    setSvgCode(null);

    const handler = setTimeout(() => {
        runConversion(processedImage, tracingTolerance);
    }, 500);

    return () => clearTimeout(handler);
  }, [tracingTolerance, runConversion, processedImage]);

  const handleImageSelected = useCallback((image: UploadedImage) => {
      setOriginalImage(image);
      setStage('crop');
  }, []);

  const handleUrlImageSelect = useCallback(async (imageUrl: string) => {
    setError(null);
    try {
      const image = await imageUrlToDataUrl(imageUrl);
      handleImageSelected(image);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to load image. ${errorMessage}`);
    }
  }, [handleImageSelected]);
  
  const handleReset = () => {
    setOriginalImage(null);
    setProcessedImage(null);
    setSvgCode(null);
    setError(null);
    setIsLoading(false);
    setTracedData(null);
    setSimplificationLevel(2);
    setTracingTolerance(2);
    setStrokeEnabled(false);
    setStrokeColor('#000000');
    setStrokeWidth(1);
    setStage('upload');
    isInitialMount.current = true; 
  };
  
  const handleConvertFull = useCallback(() => {
      if (!originalImage) return;
      setProcessedImage(originalImage);
      runConversion(originalImage, tracingTolerance);
  }, [originalImage, runConversion, tracingTolerance]);

  const handleCropAndConvert = useCallback((crop: CropData) => {
    if (!originalImage) return;

    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = crop.width;
      canvas.height = crop.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setError('Could not create canvas context for cropping.');
        return;
      }
      ctx.drawImage(
        image,
        crop.x,
        crop.y,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      );
      const croppedDataUrl = canvas.toDataURL(originalImage.mimeType);
      const croppedImage = { dataUrl: croppedDataUrl, mimeType: originalImage.mimeType };
      setProcessedImage(croppedImage);
      runConversion(croppedImage, tracingTolerance);
    };
    image.onerror = () => {
        setError('Failed to load image for cropping.');
    }
    image.src = originalImage.dataUrl;
  }, [originalImage, runConversion, tracingTolerance]);


  const handleFetchUrlImages = async () => {
    if (!url.trim()) {
      setUrlError("Please enter a URL.");
      return;
    }

    try {
        new URL(url);
    } catch (_) {
        setUrlError("Please enter a valid URL (e.g., https://example.com)");
        return;
    }

    setIsFetchingUrlImages(true);
    setUrlError(null);
    setFetchedImages([]);
    
    try {
      const images = await fetchImagesFromUrl(url);
      if (images.length === 0) {
        setUrlError("No images found at this URL.");
      } else {
        setFetchedImages(images);
      }
    } catch (err: any) {
      setUrlError(err.message || 'An unknown error occurred.');
    } finally {
      setIsFetchingUrlImages(false);
    }
  };

  const handleSetSourceTab = (tab: SourceTab) => {
    if (tab === sourceTab) return;
    setOriginalImage(null);
    setUrl('');
    setFetchedImages([]);
    setUrlError(null);
    setSourceTab(tab);
  }


  const renderLeftPanel = () => {
    switch(stage) {
      case 'upload':
        return (
          <div className="flex flex-col h-full">
            <div className="flex border-b border-gray-700 mb-4">
                <button 
                    onClick={() => handleSetSourceTab('upload')} 
                    disabled={isLoading}
                    className={`flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${sourceTab === 'upload' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-400 hover:text-white'}`}
                >
                    <UploadIcon className="w-5 h-5 mr-2" />
                    Upload File
                </button>
                <button 
                    onClick={() => handleSetSourceTab('url')}
                    disabled={isLoading}
                    className={`flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${sourceTab === 'url' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-400 hover:text-white'}`}
                >
                    <LinkIcon className="w-5 h-5 mr-2" />
                    From URL
                </button>
            </div>
            <div className="flex-grow min-h-0">
                {sourceTab === 'upload' && <ImageUploader onImageUpload={handleImageSelected} disabled={isLoading} />}
                {sourceTab === 'url' && <UrlFetcher 
                  onImageSelect={handleUrlImageSelect} 
                  disabled={isLoading}
                  url={url}
                  setUrl={setUrl}
                  onFetch={handleFetchUrlImages}
                  fetchedImages={fetchedImages}
                  isFetching={isFetchingUrlImages}
                  error={urlError}
                />}
            </div>
        </div>
        );
      case 'crop':
        if (!originalImage) return null; // Should not happen
        return (
            <ImageCropper 
                image={originalImage}
                onCrop={handleCropAndConvert}
                onConvertFull={handleConvertFull}
                onReset={handleReset}
            />
        );
      case 'result':
        if (!processedImage) return null; // Should not happen
        return (
          <div className="flex flex-col h-full items-center justify-center">
            <div className="relative w-full h-full flex items-center justify-center p-6 border-2 border-dashed rounded-lg border-gray-600">
                <img src={processedImage.dataUrl} alt="Preview of converted image" className="max-w-full max-h-full object-contain rounded-md"/>
            </div>
            <button
                onClick={handleReset}
                disabled={isLoading}
                className="mt-4 w-full flex items-center justify-center bg-gray-600 hover:bg-gray-700 disabled:bg-gray-500 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                <ResetIcon className="w-5 h-5 mr-2" />
                Start Over
            </button>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow">
          <div className="bg-gray-800/50 rounded-2xl p-6 flex flex-col border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-100">{stage === 'result' ? '1. Converted Source' : '1. Select Image'}</h2>
            {renderLeftPanel()}
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 flex flex-col border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-100">2. Get SVG Result</h2>
            <div className="flex-grow bg-gray-900/70 rounded-lg p-4 flex items-center justify-center">
              {isLoading && <Spinner />}
              {error && <p className="text-red-400">{error}</p>}
              {!isLoading && !error && svgCode && (
                <SvgDisplay 
                  svgCode={svgCode} 
                  simplificationLevel={simplificationLevel} 
                  onSimplificationChange={setSimplificationLevel}
                  tracingTolerance={tracingTolerance}
                  onTracingToleranceChange={setTracingTolerance}
                  strokeEnabled={strokeEnabled}
                  onStrokeEnabledChange={setStrokeEnabled}
                  strokeColor={strokeColor}
                  onStrokeColorChange={setStrokeColor}
                  strokeWidth={strokeWidth}
                  onStrokeWidthChange={setStrokeWidth}
                />
              )}
              {!isLoading && !error && !svgCode && (
                <div className="text-center text-gray-500">
                  <div className="flex justify-center mb-4">
                    <div className="w-16 h-16 bg-gray-700/50 rounded-full flex items-center justify-center">
                       <UploadIcon className="w-8 h-8 text-gray-600" />
                    </div>
                  </div>
                  <p>Your generated SVG will appear here.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;