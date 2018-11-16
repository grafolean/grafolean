import React from 'react';

export default class LastValueForm extends React.Component {
  static defaultProps = {
    initialFormContent: {
      path: '',
    },
    handleFormContentChange: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      content: this.props.initialFormContent,
    };
  }

  notifyParentOfChange = () => {
    const valid = true;
    this.props.onChange('lastvalue', this.state.content, valid);
  };

  handlePathChange = event => {
    this.setState(
      {
        content: {
          path: event.target.value,
        },
      },
      this.notifyParentOfChange,
    );
  };

  render() {
    const currentValue = this.state.content ? this.state.content.path : '';
    return (
      <div>
        <div>
          <label>Path:</label>
          <input
            type="text"
            name="path"
            value={currentValue}
            onChange={this.handlePathChange}
            style={{
              height: 20,
              minWidth: 300,
            }}
          />
        </div>
      </div>
    );
  }
}
