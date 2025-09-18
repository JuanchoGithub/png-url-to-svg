
import React, { useRef, useCallback } from 'react';
import type { ChangeEvent, DragEvent, ClipboardEvent } from 'react';
import { UploadIcon, ResetIcon } from './icons';
import type { UploadedImage } from '../types';


interface ImageUploaderProps {
  onImageUpload: (image: UploadedImage) => void;
  onReset: () => void;
  disabled: boolean;
  uploadedImage: UploadedImage | null;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageUpload, disabled, onReset, uploadedImage }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        if (dataUrl) {
          onImageUpload({ dataUrl, mimeType: file.type });
        }
      };
      reader.readAsDataURL(file);
    } else {
      alert('Please select a valid image file.');
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled) return;
    const file = event.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handlePaste = useCallback((event: ClipboardEvent<HTMLDivElement>) => {
    if (disabled) return;
    const items = event.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          processFile(file);
          break;
        }
      }
    }
  }, [disabled]);


  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <div 
        className="flex flex-col h-full"
        onPaste={handlePaste}
        tabIndex={0}
    >
        <div 
            className={`relative flex-grow flex flex-col items-center justify-center border-2 border-dashed rounded-lg p-6 text-center transition-colors duration-300 ${disabled ? 'cursor-not-allowed bg-gray-700/20' : 'border-gray-600 hover:border-brand-blue hover:bg-gray-800/60 cursor-pointer'}`}
            onClick={!uploadedImage && !disabled ? triggerFileInput : undefined}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
        >
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept="image/png, image/jpeg, image/webp"
            disabled={disabled}
        />
        {uploadedImage ? (
            <div className="relative w-full h-full flex items-center justify-center">
                <img src={uploadedImage.dataUrl} alt="Preview" className="max-w-full max-h-full object-contain rounded-md"/>
            </div>
        ) : (
            <div className="flex flex-col items-center">
            <UploadIcon className="w-12 h-12 text-gray-500 mb-4" />
            <p className="text-gray-400">
                <span className="font-semibold text-brand-blue">Click to upload</span>, drag & drop, or paste image
            </p>
            <p className="text-xs text-gray-500 mt-2">PNG, JPG, WEBP</p>
            </div>
        )}
        </div>
        {uploadedImage && (
             <button
                onClick={onReset}
                disabled={disabled}
                className="mt-4 w-full flex items-center justify-center bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
                >
                <ResetIcon className="w-5 h-5 mr-2" />
                Reset Image
            </button>
        )}
    </div>
  );
};
