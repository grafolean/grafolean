import React from 'react';

import './Checkbox.scss';

export default class Checkbox extends React.PureComponent {
  render() {
    const { borderColor, color, checked, onClick, label } = this.props;
    return (
      <div className="checkbox">
        <div
          className="checkbox-inner"
          style={{
            borderColor: borderColor || color,
          }}
        >
          <div
            style={{
              backgroundColor: checked !== false ? color : '#fff',
              backgroundImage:
                checked === null
                  ? `repeating-linear-gradient(135deg, #fff, #fff 7px, ${color} 7px, ${color} 15px)`
                  : null,
            }}
            onClick={onClick}
          />
        </div>
        <label>{label}</label>
      </div>
    );
  }
}
