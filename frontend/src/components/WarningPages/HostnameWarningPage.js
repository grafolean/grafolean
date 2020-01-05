import React from 'react';
import { connect } from 'react-redux';

import './index.scss';

class HostnameWarningPage extends React.Component {
  render() {
    const { externalHostname } = this.props;
    return (
      <div className="warning_page">
        <div>
          <i className="fa fa-exclamation-triangle" />
          <b>WARNING:</b> You are accessing Grafolean via <b>"{window.location.hostname}"</b>, while{' '}
          <b>EXTERNAL_HOSTNAME</b> was set to <b>"{externalHostname}"</b>. This will not work.
        </div>
        <div>
          If you wish to use this URL address, change the configuration:
          <ul>
            <li>
              change first line in <i>.env</i> file to:
              <br />
              <b>EXTERNAL_HOSTNAME={window.location.hostname}</b>
            </li>
            <li>restart Grafolean</li>
          </ul>
        </div>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  externalHostname: store.backendStatus.mqtt_ws_hostname,
});
export default connect(mapStoreToProps)(HostnameWarningPage);
