import React from 'react';
import Select, { Creatable } from 'react-select';
import 'react-select/dist/react-select.css';

import MatchingPaths from './MatchingPaths';
import Button from '../Button';
import './index.css';

const METRIC_PREFIXES = [
  { prefix: 'P', name: 'peta', power: 15 },
  { prefix: 'T', name: 'tera', power: 12 },
  { prefix: 'G', name: 'giga', power: 9 },
  { prefix: 'M', name: 'mega', power: 6 },
  { prefix: 'k', name: 'kilo', power: 3 },
  { prefix: 'h', name: 'hecto', power: 2 },
  { prefix: 'd', name: 'deci', power: 1 },
  { prefix: 'c', name: 'centi', power: -2 },
  { prefix: 'm', name: 'milli', power: -3 },
  { prefix: 'µ', name: 'micro', power: -6 },
  { prefix: 'n', name: 'nano', power: -9 },
  { prefix: 'p', name: 'pico', power: -12 },
];
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
    handleFormContentChange: () => {},
  };

  constructor(props) {
    super(props);
    this.state = {
      seriesGroups: this.props.initialFormContent
        ? this.props.initialFormContent.map(c => ({
            pathFilter: c.path_filter,
            pathRenamer: c.renaming,
            unit: c.unit,
            metricPrefix: c.metric_prefix,
          }))
        : [],
    };
  }

  notifyParentOfChange = () => {
    const content = this.state.seriesGroups.map(sg => ({
      path_filter: sg.pathFilter,
      renaming: sg.pathRenamer,
      unit: sg.unit,
      metric_prefix: sg.metricPrefix,
    }));
    const valid = true;
    this.props.onChange('chart', content, valid);
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

  metricPrefixOptionRenderer = (pOption, unit) => (
    <span>
      {pOption.prefix}
      {unit} [{pOption.name} - 10
      <sup>{pOption.power}</sup> {unit}]
    </span>
  );

  handleAddEmptySerie = ev => {
    this.setState(prevState => ({
      seriesGroups: [
        ...prevState.seriesGroups,
        {
          pathFilter: '',
          pathRenamer: '',
          unit: '',
          metricPrefix: '',
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
      <div>
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
                        name={`pf-${sgIndex}`}
                        value={sg.pathFilter}
                        onChange={ev => this.setSeriesGroupProperty(sgIndex, 'pathFilter', ev.target.value)}
                        style={{
                          height: 20,
                          minWidth: 300,
                        }}
                      />
                    </div>
                    <div className="field">
                      <label>Path renamer:</label>
                      <input
                        type="text"
                        name={`pr-${sgIndex}`}
                        value={sg.pathRenamer}
                        onChange={ev => this.setSeriesGroupProperty(sgIndex, 'pathRenamer', ev.target.value)}
                        style={{
                          height: 20,
                          minWidth: 300,
                        }}
                      />
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

              {sg.unit &&
                (!KNOWN_UNITS[sg.unit] || KNOWN_UNITS[sg.unit].allowedPrefixes !== '') && (
                  <div className="form-item">
                    <label>Metric prefix: (optional)</label>
                    <Select
                      value={sg.metricPrefix || ''}
                      placeholder={`-- none [1${sg.unit}] --`}
                      onChange={selectedOption =>
                        this.setSeriesGroupProperty(sgIndex, 'metricPrefix', selectedOption.value)
                      }
                      options={METRIC_PREFIXES.filter(
                        p =>
                          !(sg.unit in KNOWN_UNITS) ||
                          KNOWN_UNITS[sg.unit].allowedPrefixes.includes(p.prefix),
                      ).map(p => ({
                        value: p.prefix,
                        // no need for label because we specify optionRenderer; but we must supply additional info to it:
                        ...p,
                      }))}
                      optionRenderer={pOption => this.metricPrefixOptionRenderer(pOption, sg.unit)}
                      valueRenderer={pOption => this.metricPrefixOptionRenderer(pOption, sg.unit)}
                    />
                  </div>
                )}
            </div>
          ))}
          <Button onClick={this.handleAddEmptySerie}>+</Button>
        </div>
      </div>
    );
  }
}
