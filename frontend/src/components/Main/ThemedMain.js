import React from 'react';
import { connect } from 'react-redux';
import { withRouter } from 'react-router-dom';

import Main from './Main';

class ThemedMain extends React.Component {
  render() {
    const { isDarkMode, ...rest } = this.props;
    return (
      <div id="theme" className={isDarkMode ? 'dark-mode' : ''}>
        <Main {...rest} />
      </div>
    );
  }
}

const mapDarkModeToProps = store => ({
  isDarkMode: store.preferences.colorScheme === 'dark',
});
// withRouter is needed to force re-rendering of this component when URL changes:
export default withRouter(connect(mapDarkModeToProps)(ThemedMain));
