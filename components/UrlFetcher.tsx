import React from 'react';
import type { UploadedImage } from '../types';
import { SearchIcon } from './icons';

interface UrlFetcherProps {
  onImageSelect: (imageUrl: string) => void;
  disabled: boolean;
  url: string;
  setUrl: (url: string) => void;
  onFetch: () => void;
  fetchedImages: string[];
  isFetching: boolean;
  error: string | null;
}

export const UrlFetcher: React.FC<UrlFetcherProps> = ({ 
  onImageSelect, 
  disabled,
  url,
  setUrl,
  onFetch,
  fetchedImages,
  isFetching,
  error
}) => {

  const handleFetch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || disabled || isFetching) return;
    onFetch();
  };

  const handleImageClick = (imageUrl: string) => {
    if (disabled) return;
    onImageSelect(imageUrl);
  };

  return (
    <div className="flex flex-col h-full space-y-4">
      <form onSubmit={handleFetch} className="flex space-x-2">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          required
          disabled={disabled || isFetching}
          className="flex-grow bg-gray-900 border border-gray-600 rounded-md px-3 py-2 focus:ring-2 focus:ring-brand-blue focus:border-brand-blue transition w-full"
        />
        <button
          type="submit"
          disabled={disabled || isFetching || !url}
          className="bg-brand-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-md transition flex items-center justify-center"
        >
          {isFetching ? (
             <div className="w-5 h-5 border-2 border-dashed rounded-full animate-spin border-white"></div>
          ) : (
            <>
              <SearchIcon className="w-5 h-5 md:mr-2" />
              <span className="hidden md:inline">Fetch</span>
            </>
          )}
        </button>
      </form>
      {error && <p className="text-red-400 text-sm text-center">{error}</p>}
      
      <div className="flex-grow overflow-y-auto bg-gray-900/50 rounded-lg p-2 min-h-0">
        {fetchedImages.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-2">
            {fetchedImages.map((imgSrc, index) => (
              <button
                key={index}
                onClick={() => handleImageClick(imgSrc)}
                disabled={disabled}
                className="aspect-square bg-gray-800 rounded-md overflow-hidden group relative disabled:cursor-not-allowed focus:ring-2 focus:ring-brand-blue focus:outline-none"
                aria-label={`Select image ${index + 1}`}
              >
                <img src={imgSrc} alt={`Fetched image ${index + 1}`} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-110" />
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                    <p className="text-white text-sm font-bold text-center">Select & Convert</p>
                </div>
              </button>
            ))}
          </div>
        )}
        {!isFetching && fetchedImages.length === 0 && !error && (
             <div className="flex items-center justify-center h-full text-gray-500 text-center p-4">
                <p>Images from the URL will appear here.</p>
             </div>
        )}
      </div>
    </div>
  );
};
