import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log error details
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md">
            <div className="text-red-500 text-6xl mb-4">⚠️</div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">
              Something went wrong
            </h2>
            <p className="text-gray-600 mb-4">
              We're sorry, but something unexpected happened. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md transition-colors"
            >
              Refresh Page
            </button>
            {process.env.NODE_ENV === 'development' && this.state.error && (
              <details className="mt-4 text-left">
                <summary className="cursor-pointer text-gray-500 text-sm">
                  Error Details (Development Only)
                </summary>
                <pre className="mt-2 text-xs text-gray-600 bg-gray-100 p-2 rounded overflow-auto">
                  {this.state.error.toString()}
                  {this.state.errorInfo.componentStack}
                </pre>
              </details>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
