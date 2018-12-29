import React from 'react';
import { connect } from 'react-redux';

import './corsWarning.scss';

class CORSWarningPage extends React.Component {
  render() {
    const { corsDomains } = this.props;
    return (
      <div className="cors_warning">
        <div>
          WARNING: backend is not configured to be accessed from this web page. Our origin is <b>{window.location.origin}</b>, while
          backend only allows: [{corsDomains.join(", ")}].
        </div>
        <div>
          Make sure that <b>GRAFOLEAN_CORS_DOMAINS</b> environment variable for backend includes <b>{window.location.origin}</b>.
        </div>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  corsDomains: store.backendStatus.cors_domains,
});
export default connect(mapStoreToProps)(CORSWarningPage);
