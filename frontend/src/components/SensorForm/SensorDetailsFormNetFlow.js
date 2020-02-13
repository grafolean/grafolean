import React from 'react';

export default class SensorDetailsFormNetFlow extends React.Component {
  static DEFAULT_VALUES = {
    aggregation_interval_s: '3600',
    interval_label: '',
  };
  static AGGREGATION_INTERVAL_S_REGEX = '^[1-9][0-9]*$';
  static INTERVAL_LABEL_REGEX = '^[0-9a-zA-Z_-]+$';

  static validate = values => {
    const { aggregation_interval_s, interval_label } = values;

    let errors = {};

    // interval_label should not be empty and should match regex pattern:
    if (interval_label.length === 0) {
      errors['interval_label'] = 'Interval label should not be empty';
    } else if (!interval_label.match(SensorDetailsFormNetFlow.INTERVAL_LABEL_REGEX)) {
      errors['interval_label'] =
        'Interval label should containt only digits, ASCII letters, dashes and underscores.';
    }

    if (!aggregation_interval_s.match(SensorDetailsFormNetFlow.AGGREGATION_INTERVAL_S_REGEX)) {
      errors['aggregation_interval_s'] = 'Aggregation interval should be a positive integer number';
    }
    return errors;
  };

  render() {
    if (Object.keys(this.props.values).length === 0) {
      return null;
    }

    const {
      values: { aggregation_interval_s, interval_label },
      namePrefix,
      onChange,
    } = this.props;
    return (
      <div className="nested-field">
        <div className="field">
          <label>Aggregation interval in seconds:</label>
          <input
            type="text"
            value={aggregation_interval_s}
            name={`${namePrefix}.aggregation_interval_s`}
            onChange={onChange}
            pattern={SensorDetailsFormNetFlow.AGGREGATION_INTERVAL_S_REGEX}
          />
        </div>

        <div className="field">
          <label>Interval label:</label>
          <input
            type="text"
            value={interval_label}
            name={`${namePrefix}.interval_label`}
            onChange={onChange}
            pattern={SensorDetailsFormNetFlow.INTERVAL_LABEL_REGEX}
          />
          <p className="hint">
            This will be used as part of output path at which the values will be saved. Examples: "1min",
            "1h", "24h",...
          </p>
        </div>
      </div>
    );
  }
}
