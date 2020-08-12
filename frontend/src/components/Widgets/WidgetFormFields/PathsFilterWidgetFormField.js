import React from 'react';

import MatchingPaths from '../GLeanChartWidget/ChartForm/MatchingPaths';

import './PathsFilterWidgetFormField.scss';

export default class PathsFilterWidgetFormField extends React.Component {
  render() {
    const {
      pathFilterName,
      pathFilterValue,
      renamingName,
      renamingValue,
      onChange,
      onBlur,
      sharedValues,
    } = this.props;
    return (
      <div className="paths-filter-widget-form-field">
        <div className="left-column">
          <div className="field">
            <label>Path filter:</label>
            <input
              type="text"
              value={pathFilterValue}
              name={pathFilterName}
              onChange={onChange}
              onBlur={onBlur}
            />
            <p className="hint markdown">
              Windcards `*` (multiple segments) and `?` (single segment) can be used.
            </p>
          </div>

          <div className="field">
            <label>Construct label:</label>
            <input
              type="text"
              value={renamingValue}
              name={renamingName}
              onChange={onChange}
              onBlur={onBlur}
            />
            <p className="hint markdown">
              Hint: Use `$1` to reference first replaced part, `$2` for the second,... Leave empty to display
              the whole path instead.
            </p>
          </div>
        </div>

        <MatchingPaths
          pathFilter={MatchingPaths.substituteSharedValues(pathFilterValue, sharedValues)}
          pathRenamer={renamingValue}
          displayPaths={true}
        />
      </div>
    );
  }
}
