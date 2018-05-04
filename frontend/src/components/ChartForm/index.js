import React from 'react';
import Select, { Creatable } from 'react-select';
import 'react-select/dist/react-select.css';

import store from '../../store';
import { submitNewChart } from '../../store/actions';

import Button from '../Button';
import Loading from '../Loading';
import './index.css';

const METRIC_PREFIXES = [
  { value: 'P', label: 'P (peta - 10^15)' },
  { value: 'T', label: 'T (tera - 10^12)' },
  { value: 'G', label: 'G (giga - 10^9)' },
  { value: 'M', label: 'M (mega - 10^6)' },
  { value: 'k', label: 'k (kilo - 10^3)' },
  { value: 'm', label: 'm (milli - 10^-3)' },
  { value: 'µ', label: 'µ (micro - 10^-6)' },
  { value: 'n', label: 'n (nano - 10^-9)' },
  { value: 'p', label: 'p (pico - 10^-12)' },
];
const KNOWN_UNITS = [
  { value: '%', label: '%' },
  { value: 's', label: 's (second)' },
  { value: 'b', label: 'b (bit)' },
  { value: 'B', label: 'B (byte)' },
  { value: 'ETH', label: 'Ξ (ETH)' },
  { value: 'BTC', label: 'BTC' },
];

export default class ChartForm extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: '',
      series: [
        {
          pathFilter: '',
          metricPrefix: '',
          unit: '',
        },
      ],
      pathFiltersNextId: 1,
    };
  }

  handleNameChange = (event) => {
    this.setState({
      name: event.target.value,
    });
  }

  setMetricPrefix = (serieIndex, metricPrefix) => {
    this.setState((prevState) => {
      let newSeries = [ ...prevState.series ];
      newSeries[serieIndex].metricPrefix = metricPrefix;
      return {
        series: newSeries,
      };
    });
  }

  setUnit = (serieIndex, unit) => {
    this.setState((prevState) => {
      let newSeries = [ ...prevState.series ];
      newSeries[serieIndex].unit = unit;
      return {
        series: newSeries,
      };
    });
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

  handleAddEmptySerie = (ev) => {
    this.setState(prevState => ({
      series: [
        ...prevState.series,
        {},
      ],
    }));
    ev.preventDefault();
  }

  handleSubmit = (event) => {
    store.dispatch(submitNewChart(this.props.formid, this.props.dashboardSlug, this.state.name, this.state.pathFilters))
    event.preventDefault();
  }

  render() {
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
                  <label>Metric prefix:</label>
                  <Select
                    value={serie.metricPrefix || ''}
                    onChange={selectedOption => this.setMetricPrefix(serieIndex, selectedOption)}
                    options={METRIC_PREFIXES}
                  />
                </div>

                <div className="form-item">
                  <label>Unit:</label>
                  <Creatable
                    value={serie.unit || ''}
                    onChange={selectedOption => this.setUnit(serieIndex, selectedOption)}
                    options={KNOWN_UNITS}
                  />
                </div>

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

