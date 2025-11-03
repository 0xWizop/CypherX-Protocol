import React from 'react';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'default' | 'dots' | 'pulse';
  text?: string;
  className?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({
  size = 'md',
  variant = 'default',
  text,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
    xl: 'text-lg'
  };

  if (variant === 'dots') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className="flex space-x-1">
          <div className={`w-2 h-2 bg-blue-600 rounded-full animate-pulse`}></div>
          <div className={`w-2 h-2 bg-blue-600 rounded-full animate-pulse`} style={{ animationDelay: '0.2s' }}></div>
          <div className={`w-2 h-2 bg-blue-600 rounded-full animate-pulse`} style={{ animationDelay: '0.4s' }}></div>
        </div>
        {text && <span className={`text-gray-400 ${textSizeClasses[size]} ml-2`}>{text}</span>}
      </div>
    );
  }

  if (variant === 'pulse') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <div className={`${sizeClasses[size]} bg-blue-600 rounded-full animate-pulse`}></div>
        {text && <span className={`text-gray-400 ${textSizeClasses[size]}`}>{text}</span>}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className={`${sizeClasses[size]} border-2 border-blue-600 border-t-transparent rounded-full animate-spin`}></div>
      {text && <span className={`text-gray-400 ${textSizeClasses[size]}`}>{text}</span>}
    </div>
  );
};

export default LoadingSpinner;
