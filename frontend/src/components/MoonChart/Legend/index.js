import React from 'react';

import './index.css';

import { generateSerieColor } from '../utils';
import Filter from './Filter';

const Checkbox = (props) => (
  <div className="path-checkbox"
    style={{
      borderColor: props.color,
    }}
  >
    <div
      style={{
        backgroundColor: props.checked !== false ? props.color : '#fff',
        backgroundImage: props.checked === null ? `repeating-linear-gradient(135deg, #fff, #fff 7px, ${props.color} 7px, ${props.color} 15px)` : null,
      }}
    />
  </div>
)

export default class Legend extends React.Component {
  static defaultProps = {
    width: 200,
    maxHeight: 300,
    chartSeries: [],
    onDrawnChartSeriesChange: (selectedChartSeries) => {},
  }

  constructor(props) {
    super(props);
    this.state = {
      selectedChartSeries: null,  // this.props.chartSeries is not populated yet, so we will set selectedChartSeries once we get them
      filter: "",
    }
  }

  static getDerivedStateFromProps(props, state) {
    // initialize this.state.selectedChartSeries:
    if (state.selectedChartSeries === null && props.chartSeries.length > 0) {
      return {
        selectedChartSeries: new Set(props.chartSeries),
      }
    }
    return null;
  }

  handleDrawnPathsChange = (filter) => {
    const drawnChartSeries = Legend.getFilteredChartSeries([...this.state.selectedChartSeries], filter);
    this.props.onDrawnChartSeriesChange(drawnChartSeries);
    this.setState({
      filter: filter,
    })
  }

  toggleChartSerieSelected(cs, filter) {
    this.setState(
      oldState => {
        const newSelectedChartSeries = new Set(oldState.selectedChartSeries);
        if (newSelectedChartSeries.has(cs)) {
          newSelectedChartSeries.delete(cs);
        } else {
          newSelectedChartSeries.add(cs);
        }
        return {
          selectedChartSeries: newSelectedChartSeries,
        }
      },
      () => this.handleDrawnPathsChange(filter)
    );
  }

  toggleAll(enable, filter) {
    // remove from / add to state.selectedChartSeries all series which correspond to filter
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, filter);
    this.setState(
      oldState => {
        const newSelectedChartSeries = new Set(oldState.selectedChartSeries);
        if (enable) {
          filteredChartSeries.forEach(cs => newSelectedChartSeries.add(cs));
        } else {
          filteredChartSeries.forEach(cs => newSelectedChartSeries.delete(cs));
        };
        return {
          selectedChartSeries: newSelectedChartSeries,
        }
      },
      () => this.handleDrawnPathsChange(filter)
    );
  }

  static getFilteredChartSeries(originalChartSeries, filter) {
    if (filter === "") {
      return originalChartSeries;
    }
    const filterLowerCase = filter.toLowerCase()
    const filteredChartSeries = originalChartSeries.filter(cs => (
      cs.serieName.toLowerCase().includes(filterLowerCase) ||
      cs.unit.toLowerCase().includes(filterLowerCase)
    ));
    return filteredChartSeries;
  }

  render() {
    if (!this.props.chartSeries) {
      return null;
    }
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, this.state.filter);
    // are all filteredChartSeries in selectedChartSeries?
    const allChecked = filteredChartSeries.every(cs => this.state.selectedChartSeries.has(cs));
    const noneChecked = filteredChartSeries.every(cs => !this.state.selectedChartSeries.has(cs));
    return (
      <div
        className="legend"
        style={{
          width: this.props.width,
          maxHeight: this.props.maxHeight ? this.props.maxHeight : 'initial',
        }}
      >
        <Filter
          width={this.props.width}
          onChange={this.handleDrawnPathsChange}
        />

        <div
          className="path-checkbox-parent all"
          onClick={() => this.toggleAll(allChecked ? false : true, this.state.filter)}
        >
          <Checkbox
            color="#666"
            checked={allChecked ? true : (noneChecked ? false : null) }
          />
          <div className="checkbox-label">
            <i className="fa fa-check" />
          </div>
        </div>

        {(filteredChartSeries.length === 0) ? (
          <div className="path-filter-noresults">
            No paths match the filter "{this.state.filter}"
          </div>
        ) : (
          filteredChartSeries.map(cs => (
            <div
              key={cs.chartSeriesId}
              className="path-checkbox-parent"
              onClick={() => this.toggleChartSerieSelected(cs, this.state.filter)}
            >
              <Checkbox
                color={generateSerieColor(cs.path, cs.index)}
                checked={this.state.selectedChartSeries.has(cs)}
              />
              <div className="checkbox-label">
                <span className="legend-label">{cs.serieName} [{cs.unit}]</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
}

