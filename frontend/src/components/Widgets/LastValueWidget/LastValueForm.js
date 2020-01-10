import React from 'react';

export default class LastValueForm extends React.Component {
  static DEFAULT_FORM_CONTENT = {
    path: '',
    decimals: 1,
    unit: '',
    expression: '$1',
  };

  render() {
    const { content, onChange, onBlur } = this.props;
    if (!content || Object.keys(content).length === 0) {
      return null;
    }
    const { path = '', decimals = 1, unit = '', expression = '$1' } = content;
    return (
      <div className="last-value-form">
        <div className="field">
          <label>Path:</label>
          <input type="text" name="content.path" value={path} onChange={onChange} onBlur={onBlur} />
        </div>
        <div className="field">
          <label>Number of decimals:</label>
          <input
            type="number"
            name="content.decimals"
            min={0}
            max={20}
            value={decimals}
            onChange={onChange}
            onBlur={onBlur}
          />
        </div>
        <div className="field">
          <label>Expression for modifying values:</label>
          <input
            type="text"
            name="content.expression"
            value={expression}
            onChange={onChange}
            onBlur={onBlur}
          />
          <p className="hint markdown">Hint: Use `$1` to reference the original value.</p>
        </div>
        <div className="field">
          <label>Unit:</label>
          <input type="text" name="content.unit" value={unit} onChange={onChange} onBlur={onBlur} />
        </div>
      </div>
    );
  }
}
