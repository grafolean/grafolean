import React from 'react';

export default class LastValueForm extends React.Component {
  static defaultProps = {
    initialFormData: {
      name: '',
      content: {
        path: '',
      },
    },
    handleFormContentChange: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      name: this.props.initialFormData.name,
      content: this.props.initialFormData.content,
    };
  }

  notifyParentOfChange = () => {
    const valid = true;
    this.props.onChange('lastvalue', this.state.name, this.state.content, valid);
  }

  handleNameChange = (event) => {
    this.setState({
      name: event.target.value,
    }, this.notifyParentOfChange);
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
          <label>Widget title:</label>
          <input type="text" name="name" value={this.state.name} onChange={this.handleNameChange} />
        </div>

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

