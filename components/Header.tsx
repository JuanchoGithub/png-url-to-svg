
import React from 'react';

export const Header: React.FC = () => {
  return (
    <header className="bg-gray-900/80 backdrop-blur-sm border-b border-gray-700/50 sticky top-0 z-10">
      <div className="container mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <svg
            className="w-8 h-8 text-brand-blue"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L2 7V17L12 22L22 17V7L12 2ZM12 4.236L19.911 8.5L12 12.764L4.089 8.5L12 4.236ZM12 14.865L20 10.04L20 16.5L12 20.135V14.865ZM4 10.04L12 14.865V20.135L4 16.5L4 10.04Z"
              fill="currentColor"
            />
          </svg>
          <h1 className="text-xl md:text-2xl font-bold text-gray-100">Image to SVG Converter <span className="text-brand-blue">AI</span></h1>
        </div>
      </div>
    </header>
  );
};
