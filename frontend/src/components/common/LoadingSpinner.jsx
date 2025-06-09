import React from 'react';
import { FaSpinner } from 'react-icons/fa';
import PropTypes from 'prop-types';

const LoadingSpinner = ({ size = 'md', className = '' }) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
    xl: 'w-12 h-12',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <FaSpinner 
        className={`animate-spin ${sizeClasses[size] || sizeClasses.md} text-blue-500`} 
        aria-hidden="true"
      />
      <span className="sr-only">Loading...</span>
    </div>
  );
};

LoadingSpinner.propTypes = {
  size: PropTypes.oneOf(['sm', 'md', 'lg', 'xl']),
  className: PropTypes.string,
};

export default LoadingSpinner;
