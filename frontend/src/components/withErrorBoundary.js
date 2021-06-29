import React from 'react';

import ExternalLink from './ExternalLink/ExternalLink';

const withErrorBoundary = WrappedComponent => {
  const wrappedComponent = class ErrorBoundary extends React.Component {
    state = {
      errorStr: null,
      errorInfo: null,
    };

    componentDidCatch(error, errorInfo) {
      this.setState({
        errorStr: error.toString(),
        errorInfo: errorInfo,
      });
    }

    renderError() {
      const { errorStr, errorInfo } = this.state;
      return (
        <div className="error-boundary">
          <h3>Something went wrong, sorry about that!</h3>
          <p>
            Please consider{' '}
            <ExternalLink to="https://github.com/grafolean/grafolean/issues">opening an issue</ExternalLink>{' '}
            and describing what happened.
          </p>
          <details>
            <summary>{errorStr}</summary>
            <pre>{this.state.errorInfo.componentStack}</pre>
          </details>
        </div>
      );
    }

    render() {
      if (this.state.errorStr) {
        return this.renderError();
      }
      return <WrappedComponent {...this.props} />;
    }
  };
  return wrappedComponent;
};

export default withErrorBoundary;
