import React from 'react';
import { Creatable } from 'react-select';
import 'react-select/dist/react-select.css';
import { compile } from 'mathjs';

import MatchingPaths from './MatchingPaths';
import Button from '../../../Button';
import './index.scss';

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
  s: { name: 'second', allowedPrefixes: 'mµnp' },
  m: { name: 'meter', allowedPrefixes: 'pnµmcdk' },
  bps: { name: 'bits per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  B: { name: 'byte', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  Bps: { name: 'bytes per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  ETH: { name: 'Ether', allowedPrefixes: '' },
  BTC: { name: 'Bitcoin', allowedPrefixes: '' },
};

export default class ChartForm extends React.Component {
  // Old warning:
  // We use term "series" for chart content and "serie" as singular here, though the terms are
  // misleading. "Serie" (as used) is a group of data around a single path filter (path filter +
  // unit + metric prefix + ...) which determines multiple paths (and thus actually multiple
  // series). However "content" is too generic term and also lacks a singular form. Looking for
  // a better term.
  // Found one: SeriesGroup and SeriesGroups. I have replaced the names in this file, but left
  // this comment as a warning if there is some other place where the terms are misused. Note
  // that the correct terms are now "SeriesGroup(s)" and "ChartSerie(s)". Term "Serie(s)" should
  // be avoided.

  static defaultProps = {
    initialFormContent: [],
    onChange: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      seriesGroups: this.props.initialFormContent
        ? this.props.initialFormContent.map(c => ({
            pathFilter: c.path_filter,
            pathRenamer: c.renaming,
            expression: c.expression,
            unit: c.unit,
          }))
        : [],
    };
  }

  notifyParentOfChange = () => {
    const content = this.state.seriesGroups.map(sg => ({
      path_filter: sg.pathFilter,
      renaming: sg.pathRenamer,
      expression: sg.expression,
      unit: sg.unit,
    }));
    const valid = this.isValid(content);
    this.props.onChange('chart', content, valid);
  };

  isValid = content => {
    if (content.length === 0) {
      return false;
    }
    for (let sg of content) {
      try {
        compile(sg.expression);
      } catch (err) {
        return false;
      }
    }
    return true;
  };

  setSeriesGroupProperty = (seriesGroupIndex, whichProperty, newValue) => {
    this.setState(prevState => {
      let newSeriesGroups = [...prevState.seriesGroups];
      newSeriesGroups[seriesGroupIndex][whichProperty] = newValue;
      return {
        seriesGroups: newSeriesGroups,
      };
    }, this.notifyParentOfChange);
  };

  userUnitCreator = option => {
    return {
      value: option.label,
      label: option.label,
    };
  };

  handleAddEmptySerie = ev => {
    this.setState(prevState => ({
      seriesGroups: [
        ...prevState.seriesGroups,
        {
          pathFilter: '',
          pathRenamer: '',
          expression: '$1',
          unit: '',
        },
      ],
    }));
    ev.preventDefault();
  };

  render() {
    let allUnits = Object.keys(KNOWN_UNITS).map(unit => ({
      value: unit,
      label: `${unit} (${KNOWN_UNITS[unit].name})`,
      allowedPrefixes: KNOWN_UNITS[unit].allowedPrefixes,
    }));
    // we need to list all possible units, otherwise they won't be visible as selected options:
    for (let sg of this.state.seriesGroups) {
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

    return (
      <div className="chart-form">
        <div className="field">
          <label>Series definitions:</label>
          {this.state.seriesGroups.map((sg, sgIndex) => (
            <div className="serie" key={sgIndex}>
              <div className="form-item">
                <div style={{ display: 'flex', flexDirection: 'row' }}>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      marginRight: 10,
                    }}
                  >
                    <div className="field">
                      <label>Path filter:</label>
                      <input
                        type="text"
                        value={sg.pathFilter}
                        onChange={ev => this.setSeriesGroupProperty(sgIndex, 'pathFilter', ev.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>Series label:</label>
                      <input
                        type="text"
                        value={sg.pathRenamer}
                        onChange={ev => this.setSeriesGroupProperty(sgIndex, 'pathRenamer', ev.target.value)}
                      />
                      <p className="hint markdown">
                        Hint: Use `$1` to reference first replaced part, `$2` for the second,... Leave empty
                        to display the whole path instead.
                      </p>
                    </div>
                    <div className="field">
                      <label>Expression for modifying values:</label>
                      <input
                        type="text"
                        value={sg.expression}
                        onChange={ev => this.setSeriesGroupProperty(sgIndex, 'expression', ev.target.value)}
                      />
                      <p className="hint markdown">Hint: Use `$1` to reference the original value.</p>
                    </div>
                  </div>

                  <MatchingPaths
                    pathFilter={sg.pathFilter}
                    pathRenamer={sg.pathRenamer}
                    displayPaths={true}
                  />
                </div>
              </div>

              <div className="form-item field">
                <label>Base unit:</label>
                <Creatable
                  value={sg.unit || ''}
                  onChange={selectedOption =>
                    this.setSeriesGroupProperty(
                      sgIndex,
                      'unit',
                      selectedOption === null ? '' : selectedOption.value,
                    )
                  }
                  options={allUnits}
                  promptTextCreator={label => `Use custom unit (${label})`}
                  newOptionCreator={this.userUnitCreator}
                />
              </div>
            </div>
          ))}
          <Button onClick={this.handleAddEmptySerie}>+</Button>
        </div>
      </div>
    );
  }
}
