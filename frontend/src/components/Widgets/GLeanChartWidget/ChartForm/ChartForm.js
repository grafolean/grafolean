import React from 'react';
// import { compile } from 'mathjs';

import MatchingPaths from './MatchingPaths';
import Button from '../../../Button';

import './ChartForm.scss';

// const METRIC_PREFIXES = [
//   { prefix: 'P', name: 'peta', power: 15 },
//   { prefix: 'T', name: 'tera', power: 12 },
//   { prefix: 'G', name: 'giga', power: 9 },
//   { prefix: 'M', name: 'mega', power: 6 },
//   { prefix: 'k', name: 'kilo', power: 3 },
//   { prefix: 'h', name: 'hecto', power: 2 },
//   { prefix: 'd', name: 'deci', power: 1 },
//   { prefix: 'c', name: 'centi', power: -2 },
//   { prefix: 'm', name: 'milli', power: -3 },
//   { prefix: 'µ', name: 'micro', power: -6 },
//   { prefix: 'n', name: 'nano', power: -9 },
//   { prefix: 'p', name: 'pico', power: -12 },
// ];
const KNOWN_UNITS = {
  '%': { name: 'percent', allowedPrefixes: '' },
  '°C': { name: 'degrees Celcius', allowedPrefixes: '' },
  s: { name: 'second', allowedPrefixes: 'mµnp' },
  m: { name: 'meter', allowedPrefixes: 'pnµmcdk' },
  bps: { name: 'bits per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  B: { name: 'byte', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  Bps: { name: 'bytes per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
};

export default class ChartForm extends React.Component {
  static DEFAULT_FORM_CONTENT = [];

  DEFAULT_SERIE_GROUP_CONTENT = {
    path_filter: '',
    renaming: '',
    expression: '$1',
    unit: '',
  };

  // static isValid = content => {
  //   if (content.length === 0) {
  //     return false;
  //   }
  //   for (let sg of content) {
  //     try {
  //       compile(sg.expression);
  //     } catch (err) {
  //       return false;
  //     }
  //   }
  //   return true;
  // };

  userUnitCreator = option => {
    return {
      value: option.label,
      label: option.label,
    };
  };

  handleAddEmptySerie = ev => {
    this.props.setFieldValue('content', [...this.props.content, this.DEFAULT_SERIE_GROUP_CONTENT]);
    ev.preventDefault();
  };

  getAllKnownUnits() {
    let allUnits = Object.keys(KNOWN_UNITS).map(unit => ({
      value: unit,
      label: `${unit} (${KNOWN_UNITS[unit].name})`,
      allowedPrefixes: KNOWN_UNITS[unit].allowedPrefixes,
    }));
    // we need to list all possible units, otherwise they won't be visible as selected options:
    for (let sg of this.props.content) {
      if (sg.unit === '') {
        continue;
      }
      if (allUnits.find(u => u.value === sg.unit)) {
        // we already know this unit, skip it
        continue;
      }
      allUnits.push({
        value: sg.unit,
        label: sg.unit,
        allowedPrefixes: null,
      });
    }
    return allUnits;
  }

  render() {
    const allUnits = this.getAllKnownUnits();
    const { content: seriesGroups, onChange, onBlur, setFieldValue } = this.props;
    return (
      <div className="chart-form">
        <div className="field">
          <label>Chart series:</label>
          {seriesGroups.map((sg, sgIndex) => (
            <div className="serie" key={sgIndex}>
              <div className="form-item">
                <div className="top-part">
                  <div className="left-column">
                    <div className="field">
                      <label>Path filter:</label>
                      <input
                        type="text"
                        value={sg.path_filter}
                        name={`content[${sgIndex}].path_filter`}
                        onChange={onChange}
                        onBlur={onBlur}
                      />
                      <p className="hint markdown">
                        `*` (multiple segments) and `?` (single segment) wildcards can be used.
                      </p>
                    </div>
                    <div className="field">
                      <label>Series label:</label>
                      <input
                        type="text"
                        value={sg.renaming}
                        name={`content[${sgIndex}].renaming`}
                        onChange={onChange}
                        onBlur={onBlur}
                      />
                      <p className="hint markdown">
                        Hint: Use `$1` to reference first replaced part, `$2` for the second,... Leave empty
                        to display the whole path instead.
                      </p>
                    </div>
                  </div>

                  <MatchingPaths pathFilter={sg.path_filter} pathRenamer={sg.renaming} displayPaths={true} />
                </div>

                <div className="field">
                  <label>Expression for modifying values:</label>
                  <input
                    type="text"
                    value={sg.expression}
                    name={`content[${sgIndex}].expression`}
                    onChange={onChange}
                    onBlur={onBlur}
                  />
                  <p className="hint markdown">Hint: Use `$1` to reference the original value.</p>
                </div>
              </div>

              <div className="form-item field">
                <label>Unit:</label>
                <input
                  type="text"
                  value={sg.unit || ''}
                  name={`content[${sgIndex}].unit`}
                  onChange={onChange}
                  onBlur={onBlur}
                />
                <p className="hint markdown">
                  Commonly used units:
                  {allUnits.map(u => (
                    <span
                      key={u.label}
                      className="set-unit"
                      onClick={() => setFieldValue(`content[${sgIndex}].unit`, u.value)}
                      title={u.label}
                    >
                      {u.value}
                    </span>
                  ))}
                </p>
              </div>
            </div>
          ))}
          <Button onClick={this.handleAddEmptySerie}>+</Button>
        </div>
      </div>
    );
  }
}
