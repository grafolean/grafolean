import React from 'react';
import UnitFormField from '../UnitFormField';

export default class TopNWidgetForm extends React.Component {
  static DEFAULT_FORM_CONTENT = {
    path_filter: '',
    renaming: '',
    nentries: 5,
    expression: '$1',
    decimals: 1,
    unit: '',
  };

  render() {
    const { content, onChange, onBlur, setFieldValue } = this.props;
    if (!content || Object.keys(content).length === 0) {
      return null;
    }
    const {
      path_filter = '',
      renaming = '',
      nentries = 1,
      unit = '',
      expression = '$1',
      decimals = 1,
    } = content;
    return (
      <div className="last-value-form">
        <div className="field">
          <label>Paths filter:</label>
          <input
            type="text"
            name="content.path_filter"
            value={path_filter}
            onChange={onChange}
            onBlur={onBlur}
          />
        </div>
        <div className="field">
          <label>Construct label:</label>
          <input type="text" value={renaming} name={`content.renaming`} onChange={onChange} onBlur={onBlur} />
          <p className="hint markdown">
            Hint: Use `$1` to reference first replaced part, `$2` for the second,... Leave empty to display
            the whole path instead.
          </p>
        </div>
        <div className="field">
          <label>Number of entries: (max 10)</label>
          <input
            type="number"
            name="content.nentries"
            min={0}
            max={10}
            value={nentries}
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
        <UnitFormField
          value={unit}
          name={`content.unit`}
          onChange={onChange}
          onBlur={onBlur}
          setFieldValue={setFieldValue}
        />
      </div>
    );
  }
}
