import React from 'react';

export const Spinner: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center space-y-4">
      <div className="w-16 h-16 border-4 border-dashed rounded-full animate-spin border-brand-blue"></div>
      <p className="text-gray-400 text-lg">Processing image...</p>
    </div>
  );
};
