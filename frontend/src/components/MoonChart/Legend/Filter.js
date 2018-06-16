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

  render() {
    return (
      <div className="path-filter">
        <input
          type="text"
          name="pathFilter"
          onChange={this.handleInputChange}
        />
        <i className="fa fa-filter" />
      </div>
    )
  }
}