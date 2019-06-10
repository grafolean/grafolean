import React from 'react';

export default class LastValueForm extends React.Component {
  DEFAULT_FORM_CONTENT = {
    path: '',
    decimals: 1,
    unit: '',
    expression: '$1',
  };
  static defaultProps = {
    initialFormContent: {},
    onChange: () => {},
  };
  state = {
    content: {
      ...this.DEFAULT_FORM_CONTENT,
      ...this.props.initialFormContent,
    },
  };

  notifyParentOfChange = () => {
    const valid = true;
    this.props.onChange('lastvalue', this.state.content, valid);
  };

  handleInputChange = event => {
    event.preventDefault();
    const targetVar = event.target.name;
    const value = event.target.value;
    this.setState(
      prevState => ({
        content: {
          ...prevState.content,
          [targetVar]: value,
        },
      }),
      this.notifyParentOfChange,
    );
  };

  render() {
    const { content } = this.state;
    if (!content || Object.keys(content).length === 0) {
      return null;
    }
    const { path = '', decimals = 1, unit = '', expression = '$1' } = content;
    return (
      <div className="last-value-form">
        <div className="field">
          <label>Path:</label>
          <input type="text" name="path" value={path} onChange={this.handleInputChange} />
        </div>
        <div className="field">
          <label>Number of decimals:</label>
          <input
            type="number"
            name="decimals"
            min={0}
            max={20}
            value={decimals}
            onChange={this.handleInputChange}
          />
        </div>
        <div className="field">
          <label>Expression for modifying values:</label>
          <input type="text" name="expression" value={expression} onChange={this.handleInputChange} />
          <p className="hint markdown">Hint: Use `$1` to reference the original value.</p>
        </div>
        <div className="field">
          <label>Unit:</label>
          <input type="text" name="unit" value={unit} onChange={this.handleInputChange} />
        </div>
      </div>
    );
  }
}
