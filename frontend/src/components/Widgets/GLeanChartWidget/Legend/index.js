import React from 'react';

import './index.scss';

import { generateSerieColor } from '../utils';
import Filter from './Filter';
import isDockable from './isDockable';

const Checkbox = props => (
  <div
    className="path-checkbox"
    style={{
      borderColor: props.color,
    }}
  >
    <div
      style={{
        backgroundColor: props.checked !== false ? props.color : '#fff',
        backgroundImage:
          props.checked === null
            ? `repeating-linear-gradient(135deg, #fff, #fff 7px, ${props.color} 7px, ${props.color} 15px)`
            : null,
      }}
    />
  </div>
);

class Legend extends React.Component {
  static defaultProps = {
    width: 200,
    height: 300,
    chartSeries: [],
    onDrawnChartSeriesChange: selectedChartSeriesSet => {},
  };
  state = {
    selectedChartSeriesSet: null, // this.props.chartSeries is not populated yet, so we will set selectedChartSeriesSet once we get them
    filter: '',
  };

  static getDerivedStateFromProps(props, state) {
    // initialize this.state.selectedChartSeriesSet:
    if (state.selectedChartSeriesSet === null && props.chartSeries.length > 0) {
      return {
        selectedChartSeriesSet: new Set(props.chartSeries),
      };
    }
    return null;
  }

  handleDrawnPathsChange = filter => {
    const drawnChartSeries = Legend.getFilteredChartSeries([...this.state.selectedChartSeriesSet], filter);
    this.props.onDrawnChartSeriesChange(drawnChartSeries);
    this.setState({
      filter: filter,
    });
  };

  toggleChartSerieSelected(cs, filter) {
    this.setState(
      oldState => {
        const newSelectedChartSeriesSet = new Set(oldState.selectedChartSeriesSet);
        if (newSelectedChartSeriesSet.has(cs)) {
          newSelectedChartSeriesSet.delete(cs);
        } else {
          newSelectedChartSeriesSet.add(cs);
        }
        return {
          selectedChartSeriesSet: newSelectedChartSeriesSet,
        };
      },
      () => this.handleDrawnPathsChange(filter),
    );
  }

  toggleAll(enable, filter) {
    // remove from / add to state.selectedChartSeriesSet all series which correspond to filter
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, filter);
    this.setState(
      oldState => {
        const newSelectedChartSeriesSet = new Set(oldState.selectedChartSeriesSet);
        if (enable) {
          filteredChartSeries.forEach(cs => newSelectedChartSeriesSet.add(cs));
        } else {
          filteredChartSeries.forEach(cs => newSelectedChartSeriesSet.delete(cs));
        }
        return {
          selectedChartSeriesSet: newSelectedChartSeriesSet,
        };
      },
      () => this.handleDrawnPathsChange(filter),
    );
  }

  static getFilteredChartSeries(originalChartSeries, filter) {
    if (filter === '') {
      return originalChartSeries;
    }
    const filterLowerCase = filter.toLowerCase();
    const filteredChartSeries = originalChartSeries.filter(
      cs =>
        cs.serieName.toLowerCase().includes(filterLowerCase) ||
        cs.unit.toLowerCase().includes(filterLowerCase),
    );
    return filteredChartSeries;
  }

  render() {
    if (!this.props.chartSeries) {
      return null;
    }
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, this.state.filter);
    // are all filteredChartSeries in selectedChartSeriesSet?
    const allChecked = filteredChartSeries.every(cs => this.state.selectedChartSeriesSet.has(cs));
    const noneChecked = filteredChartSeries.every(cs => !this.state.selectedChartSeriesSet.has(cs));
    return (
      <div
        className="legend"
        style={{
          width: this.props.width,
          height: this.props.height ? this.props.height : 'initial',
        }}
      >
        <Filter width={this.props.width} onChange={this.handleDrawnPathsChange} />

        <div className="header-controls">
          <div
            className="path-checkbox-parent all"
            onClick={() => this.toggleAll(allChecked ? false : true, this.state.filter)}
          >
            <Checkbox color="#666" checked={allChecked ? true : noneChecked ? false : null} />
            <div className="checkbox-label">
              <i className="fa fa-check" />
            </div>
          </div>

          <div className="path-exchange-parent">
            <i className={`fa fa-exchange ${allChecked || noneChecked ? 'disabled' : ''}`} />
          </div>
        </div>

        {filteredChartSeries.length === 0 ? (
          <div className="path-filter-noresults">No paths match the filter "{this.state.filter}"</div>
        ) : (
          filteredChartSeries.map(cs => (
            <div
              key={cs.chartSeriesId}
              className="path-checkbox-parent"
              onClick={() => this.toggleChartSerieSelected(cs, this.state.filter)}
            >
              <Checkbox
                color={generateSerieColor(cs.path, cs.index)}
                checked={this.state.selectedChartSeriesSet.has(cs)}
              />
              <div className="checkbox-label">
                <span className="legend-label">
                  {cs.serieName} [{cs.unit}]
                </span>
              </div>
            </div>
          ))
        )}
      </div>
    );
  }
}

export default isDockable(Legend);
