import React from 'react';

export default class InputWithClear extends React.Component {
  handleInputChange = ev => {
    this.props.onChange(ev.target.value);
  };

  handleClear = () => {
    this.props.onChange('');
  };

  render() {
    const { value } = this.props;
    return (
      <div className="input-with-clear">
        <input type="text" value={value} onChange={this.handleInputChange} />
        <i className="fas fa-backspace" onClick={this.handleClear} />
      </div>
    );
  }
}
