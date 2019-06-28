import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import { setColorScheme } from '../../store/actions';

class ColorSchemeSwitch extends React.Component {
  handleClick = colorScheme => {
    store.dispatch(setColorScheme());
  };

  render() {
    const { colorScheme } = this.props;
    return (
      <div className="color-scheme-switch">
        {colorScheme === 'dark' ? (
          <i className="fa fa-sun" onClick={() => store.dispatch(setColorScheme('light'))} />
        ) : (
          <i className="fa fa-moon" onClick={() => store.dispatch(setColorScheme('dark'))} />
        )}
      </div>
    );
  }
}
const mapColorSchemeToProps = store => ({
  colorScheme: store.preferences.colorScheme || 'light',
});
export default connect(mapColorSchemeToProps)(ColorSchemeSwitch);
