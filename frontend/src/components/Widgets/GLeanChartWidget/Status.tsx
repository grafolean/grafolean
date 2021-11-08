import React from 'react';

interface StatusProps {
  fetching: boolean;
  errorMsg: string | null;
}

export default class Status extends React.PureComponent<StatusProps> {
  render(): React.ReactNode {
    const { fetching, errorMsg } = this.props;
    if (!fetching && !errorMsg) {
      return null;
    }
    return (
      <div className="status">
        {fetching ? (
          <i className="fa fa-circle-o-notch fa-spin" />
        ) : (
          <i className="fa fa-exclamation-triangle" title={errorMsg || ''} />
        )}
      </div>
    );
  }
}
