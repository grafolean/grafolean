import React from 'react';
import { connect } from 'react-redux';

class Checkbox extends React.Component {
  handleClick = () => {
    this.props.onChange(this.props.value);
  };

  render() {
    const { color, checked, isDarkMode, children } = this.props;
    const bgColor = isDarkMode ? '#161616' : '#fff';
    return (
      <div className="checkbox-parent" onClick={this.handleClick}>
        <div className="checkbox" style={{ borderColor: color }}>
          <div
            style={{
              backgroundColor: checked !== false ? color : bgColor,
              backgroundImage:
                checked === null
                  ? `repeating-linear-gradient(135deg, ${bgColor}, ${bgColor} 7px, ${color} 7px, ${color} 15px)`
                  : null,
            }}
          />
        </div>
        <div className="checkbox-label">{children}</div>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  isDarkMode: store.preferences.colorScheme === 'dark',
});
export default connect(mapStoreToProps)(Checkbox);