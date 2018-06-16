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
        backgroundColor: props.checked ? props.color : '#fff',
      }}
    />
  </div>
)

export default class Legend extends React.Component {
  static defaultProps = {
    chartSeries: [],
    onDrawnChartSeriesChange: (selectedChartSeries) => {},
  }

  constructor(props) {
    super(props);
    this.state = {
      selectedChartSeries: new Set(this.props.chartSeries),
      filter: "",
    }
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
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, this.state.filter);
    return (
      <div>
        <Filter
          onChange={this.handleDrawnPathsChange}
        />

        {(filteredChartSeries.length === 0) ? (
          <div className="path-filter-noresults">
            No paths match the filter "{this.state.filter}"
          </div>
        ) : (
          filteredChartSeries.map(cs => (
            <div
              key={cs.chartSeriesId}
              style={{
                position: 'relative',
              }}
              onClick={() => this.toggleChartSerieSelected(cs, this.state.filter)}
            >
              <Checkbox
                color={generateSerieColor(cs.path, cs.index)}
                checked={this.state.selectedChartSeries.has(cs)}
              />
              <div style={{
                  paddingLeft: 35,
                  marginBottom: 5,
                }}
              >
                <span className="legend-label">{cs.serieName} [{cs.unit}]</span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
}

