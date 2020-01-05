import React from 'react';
import { connect } from 'react-redux';

import './index.scss';

class CORSWarningPage extends React.Component {
  render() {
    const { corsDomains } = this.props;
    return (
      <div className="warning_page">
        <div>
          <i className="fa fa-exclamation-triangle" />
          <b>WARNING:</b> backend is not configured to be accessed from this web page. Our origin is{' '}
          <b>{window.location.origin}</b>, while backend only allows:{' '}
          {corsDomains.length === 0 ? (
            <i>no domains allowed!</i>
          ) : (
            <ul>
              {corsDomains.map(domain => (
                <li key={domain}>{domain}</li>
              ))}
            </ul>
          )}
        </div>
        <div>
          Make sure that <b>GRAFOLEAN_CORS_DOMAINS</b> environment variable for backend includes{' '}
          <b>{window.location.origin}</b>.
        </div>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  corsDomains: store.backendStatus.cors_domains,
});
export default connect(mapStoreToProps)(CORSWarningPage);
