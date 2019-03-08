import React from 'react';

const InputWithClear = props => (
  <div className="input-with-clear">
    <input type="text" name="pathFilter" value={props.value} onChange={props.onChange} />
    <i className="fas fa-backspace" onClick={props.onClear} />
  </div>
);

export default class Filter extends React.Component {
  static defaultProps = {
    onChange: () => {},
  };
  state = {
    filter: '',
  };

  handleInputChange = ev => {
    const inputValue = ev.target.value;
    this.setState(
      {
        filter: inputValue,
      },
      () => this.props.onChange(inputValue),
    );
  };

  clearInput = () => {
    this.setState(
      {
        filter: '',
      },
      () => this.props.onChange(''),
    );
  };

  render() {
    return (
      <div className="path-filter">
        <InputWithClear
          width={this.props.width - 50}
          value={this.state.filter}
          onChange={this.handleInputChange}
          onClear={this.clearInput}
        />
      </div>
    );
  }
}
