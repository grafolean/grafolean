import React from 'react';
import UnitWidgetFormField from '../WidgetFormFields/UnitWidgetFormField';
import Checkbox from '../../MultiSelect/Checkbox';
import PathsFilterWidgetFormField from '../WidgetFormFields/PathsFilterWidgetFormField';

export default class TopNWidgetForm extends React.Component {
  static DEFAULT_FORM_CONTENT = {
    path_filter: '',
    renaming: '',
    nentries: 5,
    expression: '$1',
    decimals: 1,
    calc_percent: true,
    unit: '',
  };

  render() {
    const { content, onChange, onBlur, setFieldValue, sharedValues } = this.props;
    if (!content || Object.keys(content).length === 0) {
      return null;
    }
    const {
      path_filter = '',
      renaming = '',
      nentries = 1,
      expression = '$1',
      decimals = 1,
      calc_percent = true,
      unit = '',
    } = content;
    return (
      <div className="topn-widget-form">
        <div className="field">
          <PathsFilterWidgetFormField
            pathFilterValue={path_filter}
            pathFilterName="content.path_filter"
            renamingValue={renaming}
            renamingName="content.renaming"
            onChange={onChange}
            onBlur={onBlur}
            sharedValues={sharedValues}
          />
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
          <label>Display percentages:</label>
          <Checkbox
            checked={calc_percent}
            onChange={() => setFieldValue('content.calc_percent', !calc_percent)}
            color="#aaa"
            isDarkMode={true}
          ></Checkbox>
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
        <UnitWidgetFormField
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
