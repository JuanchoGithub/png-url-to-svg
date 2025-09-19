import React, { useState, useRef, useCallback, MouseEvent, useEffect } from 'react';
import type { UploadedImage } from '../types';
import { ResetIcon } from './icons';

export interface CropData {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface ImageCropperProps {
  image: UploadedImage;
  onCrop: (crop: CropData) => void;
  onConvertFull: () => void;
  onReset: () => void;
}

type DragHandle = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | 'move';

export const ImageCropper: React.FC<ImageCropperProps> = ({ image, onCrop, onConvertFull, onReset }) => {
  const [crop, setCrop] = useState<CropData | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [activeHandle, setActiveHandle] = useState<DragHandle | null>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const getRelativeCoords = (e: MouseEvent) => {
    if (!containerRef.current) return { x: 0, y: 0 };
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handleMouseDown = (e: MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const coords = getRelativeCoords(e);
    
    // Check if a resize handle was clicked
    const target = e.target as HTMLElement;
    const handle = target.dataset.handle as DragHandle;
    
    if (handle) {
      setActiveHandle(handle);
    } else if (crop && coords.x >= crop.x && coords.x <= crop.x + crop.width && coords.y >= crop.y && coords.y <= crop.y + crop.height) {
        setActiveHandle('move');
    } else {
        setActiveHandle(null);
        setCrop({ x: coords.x, y: coords.y, width: 0, height: 0 });
    }
    
    setDragStart(coords);
    setIsDragging(true);
  };
  
  const handleMouseMove = useCallback((e: globalThis.MouseEvent) => {
    if (!isDragging || !dragStart || !containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - containerRect.left;
    const y = e.clientY - containerRect.top;

    const dx = x - dragStart.x;
    const dy = y - dragStart.y;

    setCrop(prevCrop => {
        if (!prevCrop) return null;
        let newCrop = { ...prevCrop };

        switch (activeHandle) {
            case 'n': newCrop = { ...newCrop, y: prevCrop.y + dy, height: prevCrop.height - dy }; break;
            case 's': newCrop = { ...newCrop, height: prevCrop.height + dy }; break;
            case 'w': newCrop = { ...newCrop, x: prevCrop.x + dx, width: prevCrop.width - dx }; break;
            case 'e': newCrop = { ...newCrop, width: prevCrop.width + dx }; break;
            case 'nw': newCrop = { y: prevCrop.y + dy, height: prevCrop.height - dy, x: prevCrop.x + dx, width: prevCrop.width - dx }; break;
            // FIX: Spread newCrop to include all required properties for CropData type.
            case 'ne': newCrop = { ...newCrop, y: prevCrop.y + dy, height: prevCrop.height - dy, width: prevCrop.width + dx }; break;
            // FIX: Spread newCrop to include all required properties for CropData type.
            case 'sw': newCrop = { ...newCrop, height: prevCrop.height + dy, x: prevCrop.x + dx, width: prevCrop.width - dx }; break;
            // FIX: Spread newCrop to include all required properties for CropData type.
            case 'se': newCrop = { ...newCrop, height: prevCrop.height + dy, width: prevCrop.width + dx }; break;
            case 'move': newCrop = { ...newCrop, x: prevCrop.x + dx, y: prevCrop.y + dy }; break;
            default: // New selection
                newCrop = {
                    x: Math.min(x, dragStart.x),
                    y: Math.min(y, dragStart.y),
                    width: Math.abs(x - dragStart.x),
                    height: Math.abs(y - dragStart.y),
                };
                break;
        }
        
        // Normalize crop if width/height becomes negative
        if (newCrop.width < 0) {
            newCrop.x = newCrop.x + newCrop.width;
            newCrop.width = Math.abs(newCrop.width);
        }
        if (newCrop.height < 0) {
            newCrop.y = newCrop.y + newCrop.height;
            newCrop.height = Math.abs(newCrop.height);
        }

        // Constrain to container boundaries
        newCrop.x = Math.max(0, newCrop.x);
        newCrop.y = Math.max(0, newCrop.y);
        if (newCrop.x + newCrop.width > containerRect.width) newCrop.width = containerRect.width - newCrop.x;
        if (newCrop.y + newCrop.height > containerRect.height) newCrop.height = containerRect.height - newCrop.y;

        return newCrop;
    });

    if (activeHandle) {
      setDragStart({ x, y });
    }
  }, [isDragging, dragStart, activeHandle]);


  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragStart(null);
    setActiveHandle(null);
  }, []);

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);


  const handleConvertCrop = () => {
    if (!crop || !imageRef.current || !containerRef.current) return;

    const img = imageRef.current;
    const { naturalWidth, naturalHeight } = img;
    const { width: displayWidth, height: displayHeight } = containerRef.current.getBoundingClientRect();
    
    const scaleX = naturalWidth / displayWidth;
    const scaleY = naturalHeight / displayHeight;

    const nativeCrop: CropData = {
      x: Math.round(crop.x * scaleX),
      y: Math.round(crop.y * scaleY),
      width: Math.round(crop.width * scaleX),
      height: Math.round(crop.height * scaleY),
    };
    onCrop(nativeCrop);
  };
  
  const handles: DragHandle[] = ['n', 's', 'e', 'w', 'nw', 'ne', 'sw', 'se'];

  return (
    <div className="flex flex-col h-full space-y-4">
      <p className="text-sm text-gray-400 text-center">Click and drag on the image to select a region to convert.</p>
      <div 
        ref={containerRef}
        className="relative flex-grow flex items-center justify-center select-none overflow-hidden cursor-crosshair"
        onMouseDown={handleMouseDown}
      >
        <img
          ref={imageRef}
          src={image.dataUrl}
          alt="Selection preview"
          className="max-w-full max-h-full object-contain pointer-events-none"
        />
        {crop && (
            <div
              className="absolute border-2 border-dashed border-brand-blue bg-brand-blue/20"
              style={{
                left: crop.x,
                top: crop.y,
                width: crop.width,
                height: crop.height,
                cursor: 'move',
              }}
            >
              {handles.map(handle => (
                <div 
                    key={handle}
                    data-handle={handle}
                    className={`absolute w-3 h-3 bg-brand-blue border border-white rounded-full 
                    ${handle.includes('n') ? '-top-1.5' : ''} ${handle.includes('s') ? '-bottom-1.5' : ''} 
                    ${handle.includes('e') ? '-right-1.5' : ''} ${handle.includes('w') ? '-left-1.5' : ''}
                    ${(handle === 'n' || handle === 's') ? 'left-1/2 -translate-x-1/2' : ''}
                    ${(handle === 'e' || handle === 'w') ? 'top-1/2 -translate-y-1/2' : ''}
                    cursor-${handle}-resize`}
                />
              ))}
            </div>
        )}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <button
            onClick={handleConvertCrop}
            disabled={!crop || crop.width < 5 || crop.height < 5}
            className="w-full bg-brand-blue hover:bg-blue-600 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
            Convert Selected Area
        </button>
         <button
            onClick={onConvertFull}
            className="w-full bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
        >
            Convert Full Image
        </button>
      </div>
       <button
            onClick={onReset}
            className="w-full flex items-center justify-center bg-red-600/80 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition-colors duration-300"
            >
            <ResetIcon className="w-5 h-5 mr-2" />
            Start Over
        </button>
    </div>
  );
};