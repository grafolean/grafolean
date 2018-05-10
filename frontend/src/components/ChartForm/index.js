import React from 'react';
import Select, { Creatable } from 'react-select';
import 'react-select/dist/react-select.css';

import store from '../../store';
import { ROOT_URL, handleFetchErrors, onSuccess, onFailure } from '../../store/actions';

import Button from '../Button';
import Loading from '../Loading';
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
  s:   { name: 'second', allowedPrefixes: 'mµnp' },
  m:   { name: 'meter', allowedPrefixes: 'pnµmcdk' },
  bps: { name: 'bits per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  B:   { name: 'byte', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  Bps: { name: 'bytes per second', allowedPrefixes: 'kMGTP', kiloBase: 1024 },
  ETH: { name: 'Ether', allowedPrefixes: '' },
  BTC: { name: 'Bitcoin', allowedPrefixes: '' },
};

export default class ChartForm extends React.Component {
  static defaultProps = {
    dashboardSlug: null,
    chartId: null,
    chartName: null,
    chartContent: [],
  }

  constructor(props) {
    super(props);
    this.state = {
      name: this.props.chartName,
      series: this.props.chartContent.map(c => ({
        pathFilter: c.path_filter,
        unit: c.unit,
        metricPrefix: c.metric_prefix,
      })),
    };
  }

  handleNameChange = (event) => {
    this.setState({
      name: event.target.value,
    });
  }

  setMetricPrefix = (serieIndex, selectedOption) => {
    const metricPrefix = selectedOption.value;
    this.setState((prevState) => {
      let newSeries = [ ...prevState.series ];
      newSeries[serieIndex].metricPrefix = metricPrefix;
      return {
        series: newSeries,
      };
    });
  }

  setUnit = (serieIndex, selectedOption) => {
    const unit = selectedOption === null ? '' : selectedOption.value;
    this.setState((prevState) => {
      let newSeries = [ ...prevState.series ];
      newSeries[serieIndex].unit = unit;
      return {
        series: newSeries,
      };
    });
  }

  userUnitCreator = (option) => {
    return {
      value: option.label,
      label: option.label,
    };
  }

  setPathFilter = (serieIndex, newValue) => {
    this.setState((prevState) => {
      let newSeries = [ ...prevState.series ];
      newSeries[serieIndex].pathFilter = newValue;
      return {
        series: newSeries,
      };
    });
  }

  metricPrefixOptionRenderer = (pOption, unit) => (
    <span>
      {pOption.prefix}{unit} [{pOption.name} - 10<sup>{pOption.power}</sup> {unit}]
    </span>
  )

  handleAddEmptySerie = (ev) => {
    this.setState(prevState => ({
      series: [
        ...prevState.series,
        {},
      ],
    }));
    ev.preventDefault();
  }


  handleSubmit = (ev) => {
    ev.preventDefault();

    const params = {
      name: this.state.name,
      content: this.state.series.map(serie => ({
        path_filter: serie.pathFilter,
        unit: serie.unit,
        metric_prefix: serie.metricPrefix,
      })),
    }
    fetch(`${ROOT_URL}/dashboards/${this.props.dashboardSlug}/charts/${this.props.chartId || ''}`, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        method: this.props.chartId ? 'PUT' : 'POST',
        body: JSON.stringify(params),
      })
      .then(handleFetchErrors)
      .then(() => {
        store.dispatch(onSuccess(this.props.chartId ? 'Chart successfully updated.' : 'New chart successfully created.'));
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())))
  }

  render() {
    let allUnits = Object.keys(KNOWN_UNITS).map(unit => ({
      value: unit,
      label: `${unit} (${KNOWN_UNITS[unit].name})`,
      allowedPrefixes: KNOWN_UNITS[unit].allowedPrefixes,
    }));
    // we need to list all possible units, otherwise they won't be visible as selected options:
    for (let serie of this.state.series) {
      if (allUnits.find(u => u.value === serie.unit)) {
        // we already know this unit, skip it
        continue;
      }
      allUnits.push({
        value: serie.unit,
        label: serie.unit,
        allowedPrefixes: null,
      })
    }

    return (
      <div>
        <form id={this.props.formid} onSubmit={this.handleSubmit}>
          <div>
            <label>Chart title:</label>
            <input type="text" name="name" value={this.state.name} onChange={this.handleNameChange} />
          </div>
          <div>
            <label>Series:</label>
            {this.state.series.map((serie, serieIndex) =>
              <div className="serie" key={serieIndex}>

                <div className="form-item">
                  <label>Path filter:</label>
                  <input type="text" name={`pf-${serie.id}`} value={serie.pathFilter || ''} onChange={(ev) => this.setPathFilter(serieIndex, ev.target.value)} />
                </div>

                <div className="form-item">
                  <label>Base unit:</label>
                  <Creatable
                    value={serie.unit || ''}
                    onChange={selectedOption => this.setUnit(serieIndex, selectedOption)}
                    options={allUnits}
                    promptTextCreator={label => `Use custom unit (${label})`}
                    newOptionCreator={this.userUnitCreator}
                  />
                </div>

                {(serie.unit && (!KNOWN_UNITS[serie.unit] || KNOWN_UNITS[serie.unit].allowedPrefixes !== '')) && (
                  <div className="form-item">
                    <label>Metric prefix: (optional)</label>
                    <Select
                      value={serie.metricPrefix || ''}
                      placeholder={`-- none [1${serie.unit}] --`}
                      onChange={selectedOption => this.setMetricPrefix(serieIndex, selectedOption)}
                      options={METRIC_PREFIXES
                        .filter(p => (!(serie.unit in KNOWN_UNITS)) || KNOWN_UNITS[serie.unit].allowedPrefixes.includes(p.prefix))
                        .map(p => ({
                          value: p.prefix,
                          // no need for label because we specify optionRenderer; but we must supply additional info to it:
                          ...p,
                        }))
                      }
                      optionRenderer={pOption => this.metricPrefixOptionRenderer(pOption, serie.unit)}
                      valueRenderer={pOption => this.metricPrefixOptionRenderer(pOption, serie.unit)}
                      />
                  </div>
                )}

              </div>
            )}
            <Button onClick={this.handleAddEmptySerie}>+</Button>
          </div>
          {(this.props.loading)?(
            <Loading />
          ):(
            <input type="submit" value="Submit" />
          )}

        </form>
      </div>
    )
  }
};

