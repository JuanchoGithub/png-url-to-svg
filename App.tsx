import React, { useState, useCallback } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { UrlFetcher } from './components/UrlFetcher';
import { SvgDisplay } from './components/SvgDisplay';
import { Spinner } from './components/Spinner';
import { convertImageToSvgProgrammatically } from './services/vectorizerService';
import { Header } from './components/Header';
import { UploadIcon, LinkIcon } from './components/icons';
import type { UploadedImage } from './types';

type SourceTab = 'upload' | 'url';

const App: React.FC = () => {
  const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
  const [svgCode, setSvgCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [sourceTab, setSourceTab] = useState<SourceTab>('upload');

  const handleImageUpload = useCallback(async (image: UploadedImage) => {
    setUploadedImage(image);
    setIsLoading(true);
    setError(null);
    setSvgCode(null);

    try {
      // Use the new programmatic vectorizer service
      const generatedSvg = await convertImageToSvgProgrammatically(image.dataUrl);
      setSvgCode(generatedSvg);
    } catch (err) {
      console.error(err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(`Failed to convert image. ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);
  
  const handleReset = () => {
    setUploadedImage(null);
    setSvgCode(null);
    setError(null);
    setIsLoading(false);
    setSourceTab('upload');
  };

  const renderSourceSelector = () => {
    if (uploadedImage) {
        // If an image is selected (from any source), show it with the reset button.
        return <ImageUploader onImageUpload={handleImageUpload} disabled={isLoading} onReset={handleReset} uploadedImage={uploadedImage}/>;
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex border-b border-gray-700 mb-4">
                <button 
                    onClick={() => setSourceTab('upload')} 
                    disabled={isLoading}
                    className={`flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${sourceTab === 'upload' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-400 hover:text-white'}`}
                >
                    <UploadIcon className="w-5 h-5 mr-2" />
                    Upload File
                </button>
                <button 
                    onClick={() => setSourceTab('url')}
                    disabled={isLoading}
                    className={`flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${sourceTab === 'url' ? 'text-brand-blue border-b-2 border-brand-blue' : 'text-gray-400 hover:text-white'}`}
                >
                    <LinkIcon className="w-5 h-5 mr-2" />
                    From URL
                </button>
            </div>
            <div className="flex-grow min-h-0">
                {sourceTab === 'upload' && <ImageUploader onImageUpload={handleImageUpload} disabled={isLoading} onReset={handleReset} uploadedImage={null}/>}
                {sourceTab === 'url' && <UrlFetcher onImageSelect={handleImageUpload} disabled={isLoading} />}
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans flex flex-col">
      <Header />
      <main className="flex-grow container mx-auto p-4 md:p-8 flex flex-col">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-grow">
          <div className="bg-gray-800/50 rounded-2xl p-6 flex flex-col border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-100">1. Select Image Source</h2>
            {renderSourceSelector()}
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-6 flex flex-col border border-gray-700 shadow-2xl">
            <h2 className="text-2xl font-bold mb-4 text-gray-100">2. Get SVG Result</h2>
            <div className="flex-grow bg-gray-900/70 rounded-lg p-4 flex items-center justify-center">
              {isLoading && <Spinner />}
              {error && <p className="text-red-400">{error}</p>}
              {!isLoading && !error && svgCode && <SvgDisplay svgCode={svgCode} />}
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
