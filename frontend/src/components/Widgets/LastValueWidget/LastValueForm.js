import React from 'react';

export default class LastValueForm extends React.Component {
  static defaultProps = {
    initialFormData: {
      content: {
        path: '',
      },
    },
    handleFormContentChange: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      content: this.props.initialFormData.content,
    };
  }

  notifyParentOfChange = () => {
    const valid = true;
    this.props.onChange('lastvalue', this.state.content, valid);
  }

  handlePathChange = (event) => {
    this.setState({
      content: {
        path: event.target.value,
      },
    }, this.notifyParentOfChange);
  }

  render() {
    return (
      <div>
        <div>
          <label>Path:</label>
          <input
            type="text"
            name="path"
            value={this.state.content.path}
            onChange={this.handlePathChange}
            style={{
              height: 20,
              minWidth: 300,
            }}
          />
        </div>
      </div>
    )
  }
}

