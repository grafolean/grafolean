import React from 'react';

export default class Status extends React.PureComponent {
  render() {
    if (!this.props.fetching && !this.props.errorMsg) {
      return null;
    }
    return (
      <div className="status">
        {this.props.fetching ? (
          <i className="fa fa-circle-o-notch fa-spin" />
        ) : (
          <i className="fa fa-exclamation-triangle" title={this.props.errorMsg} />
        )}
      </div>
    );
  }
}
