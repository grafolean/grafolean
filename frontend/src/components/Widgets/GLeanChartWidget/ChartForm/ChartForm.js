import React from 'react';
import { compile } from 'mathjs';

import Button from '../../../Button';
import UnitWidgetFormField from '../../WidgetFormFields/UnitWidgetFormField';
import PathsFilterWidgetFormField from '../../WidgetFormFields/PathsFilterWidgetFormField';
import { KNOWN_CHART_TYPES, KNOWN_CHART_TYPES_NAMES, CHART_TYPE_LINE } from '../LineChartSingleCanvas';

import './ChartForm.scss';

export default class ChartForm extends React.Component {
  static DEFAULT_SERIE_GROUP_CONTENT = {
    path_filter: '',
    renaming: '',
    expression: '$1',
    unit: '',
  };
  static DEFAULT_FORM_CONTENT = {
    chart_type: CHART_TYPE_LINE,
    series_groups: [ChartForm.DEFAULT_SERIE_GROUP_CONTENT],
  };

  static validate = ({ chart_type, series_groups }) => {
    if (!KNOWN_CHART_TYPES.includes(chart_type)) {
      return {
        chart_type: 'Chart type not valid',
      };
    }
    if (series_groups.length === 0) {
      return 'At least one chart series group must be defined';
    }
    for (let i = 0; i < series_groups.length; i++) {
      try {
        compile(series_groups[i].expression);
      } catch (err) {
        return {
          series_groups: {
            [i]: {
              expression: 'Error compiling an expression',
            },
          },
        };
      }
    }
    // all is ok:
    return {};
  };

  userUnitCreator = option => {
    return {
      value: option.label,
      label: option.label,
    };
  };

  handleAddEmptySerie = ev => {
    this.props.setFieldValue('content.series_groups', [
      ...this.props.content.series_groups,
      ChartForm.DEFAULT_SERIE_GROUP_CONTENT,
    ]);
    ev.preventDefault();
  };

  getOtherKnownUnits() {
    let otherUnits = [];
    // we need to list all possible units, otherwise they won't be visible as selected options:
    for (let sg of this.props.content.series_groups) {
      if (sg.unit === '') {
        continue;
      }
      if (otherUnits.find(u => u.value === sg.unit)) {
        // we already know this unit, skip it
        continue;
      }
      otherUnits.push({
        value: sg.unit,
        label: sg.unit,
        allowedPrefixes: null,
      });
    }
    return otherUnits;
  }

  render() {
    const {
      content: { chart_type, series_groups: seriesGroups },
      onChange,
      onBlur,
      setFieldValue,
      sharedValues,
    } = this.props;
    const otherKnownUnits = this.getOtherKnownUnits();
    return (
      <div className="chart-form">
        <div className="field">
          <label>Type of chart:</label>
          {KNOWN_CHART_TYPES.map((chart_type_id, i) => (
            <div className="radio_option_container" key={chart_type_id}>
              <label>
                <input
                  type="radio"
                  name={`content.chart_type`}
                  value={chart_type_id}
                  checked={chart_type === chart_type_id}
                  onChange={onChange}
                  onBlur={onBlur}
                />
                <span>{KNOWN_CHART_TYPES_NAMES[i]}</span>
              </label>
            </div>
          ))}
        </div>

        <div className="field">
          <label>Chart series:</label>
          {seriesGroups.map((sg, sgIndex) => (
            <div className="serie" key={sgIndex}>
              <div className="form-item">
                <PathsFilterWidgetFormField
                  pathFilterValue={sg.path_filter}
                  pathFilterName={`content.series_groups[${sgIndex}].path_filter`}
                  renamingValue={sg.renaming}
                  renamingName={`content.series_groups[${sgIndex}].renaming`}
                  onChange={onChange}
                  onBlur={onBlur}
                  sharedValues={sharedValues}
                />

                <div className="field">
                  <label>Expression for modifying values:</label>
                  <input
                    type="text"
                    value={sg.expression}
                    name={`content.series_groups[${sgIndex}].expression`}
                    onChange={onChange}
                    onBlur={onBlur}
                  />
                  <p className="hint markdown">Hint: Use `$1` to reference the original value.</p>
                </div>
              </div>

              <UnitWidgetFormField
                value={sg.unit || ''}
                name={`content.series_groups[${sgIndex}].unit`}
                otherKnownUnits={otherKnownUnits}
                onChange={onChange}
                onBlur={onBlur}
                setFieldValue={setFieldValue}
              />
            </div>
          ))}
          <Button onClick={this.handleAddEmptySerie}>+</Button>
        </div>
      </div>
    );
  }
}
