import React from 'react';
import { withRouter } from 'react-router-dom';
import isWidget from '../isWidget';

class NetFlowNavigationWidget extends React.Component {
  render() {
    return (
      <div className="netflow-navigation-widget">
        <button onClick={() => this.props.setPage('default')}>DEFAULT</button>
        <button onClick={() => this.props.setPage('second')}>second</button>
      </div>
    );
  }
}

export default withRouter(isWidget(NetFlowNavigationWidget));
