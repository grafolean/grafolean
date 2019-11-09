import React from 'react';
import { connect } from 'react-redux';

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
export default connect(mapDarkModeToProps)(ThemedMain);
