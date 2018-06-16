import React from 'react';

export default class Filter extends React.Component {
  static defaultProps = {
    onChange: () => {},
  }

  constructor(props) {
    super(props);
    this.state = {
      filter: '',
    }
  }

  handleInputChange = ev => {
    const inputValue = ev.target.value;
    this.setState(
      {
        filter: inputValue,
      },
      () => this.props.onChange(inputValue)
    );
  }

  clearInput = () => {
    this.setState(
      {
        filter: '',
      },
      () => this.props.onChange('')
    )
  }

  render() {
    return (
      <div className="path-filter">
        <input
          type="text"
          name="pathFilter"
          value={this.state.filter}
          onChange={this.handleInputChange}
        />
        <i
          className="fa fa-close"
          onClick={this.clearInput}
        />
      </div>
    )
  }
}