import React from 'react';
import { connect } from 'react-redux';

import './index.scss';

import { generateSerieColor } from '../utils';
import Filter from './Filter';
import isDockable from './isDockable';

class Checkbox extends React.Component {
  render() {
    const { color, checked, isDarkMode } = this.props;
    const bgColor = isDarkMode ? '#161616' : '#fff';
    return (
      <div
        className="path-checkbox"
        style={{
          borderColor: color,
        }}
      >
        <div
          style={{
            backgroundColor: checked !== false ? color : bgColor,
            backgroundImage:
              checked === null
                ? `repeating-linear-gradient(135deg, ${bgColor}, ${bgColor} 7px, ${color} 7px, ${color} 15px)`
                : null,
          }}
        />
      </div>
    );
  }
}

class _Legend extends React.Component {
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

  setEnabledAll(enable, filter) {
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

  toggleAll(filter) {
    // remove from / add to state.selectedChartSeriesSet all series which correspond to filter
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, filter);
    this.setState(
      oldState => {
        const newSelectedChartSeriesSet = new Set(oldState.selectedChartSeriesSet);
        filteredChartSeries.forEach(cs => {
          if (newSelectedChartSeriesSet.has(cs)) {
            newSelectedChartSeriesSet.delete(cs);
          } else {
            newSelectedChartSeriesSet.add(cs);
          }
        });
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
    const { isDarkMode } = this.props;
    if (!this.props.chartSeries) {
      return null;
    }
    const filteredChartSeries = Legend.getFilteredChartSeries(this.props.chartSeries, this.state.filter);
    // are all filteredChartSeries in selectedChartSeriesSet?
    const allChecked = filteredChartSeries.every(cs => this.state.selectedChartSeriesSet.has(cs));
    const noneChecked = filteredChartSeries.every(cs => !this.state.selectedChartSeriesSet.has(cs));
    const exchangeAllowed = !allChecked && !noneChecked;
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
            onClick={() => this.setEnabledAll(allChecked ? false : true, this.state.filter)}
          >
            <Checkbox
              color={isDarkMode ? '#ddd' : '#666'}
              checked={allChecked ? true : noneChecked ? false : null}
              isDarkMode={isDarkMode}
            />
            <div className="checkbox-label">
              <i className="fa fa-check" />
            </div>
          </div>

          <div
            className="path-exchange-parent"
            onClick={() => exchangeAllowed && this.toggleAll(this.state.filter)}
          >
            <i className={`fa fa-exchange ${!exchangeAllowed ? 'disabled' : ''}`} />
          </div>
        </div>

        {filteredChartSeries.length === 0 ? (
          <div className="path-filter-noresults">No paths match the filter "{this.state.filter}"</div>
        ) : (
          filteredChartSeries.map(cs => (
            <div
              key={cs.chartSerieId}
              className="path-checkbox-parent"
              onClick={() => this.toggleChartSerieSelected(cs, this.state.filter)}
            >
              <Checkbox
                color={generateSerieColor(cs.path, cs.index)}
                checked={this.state.selectedChartSeriesSet.has(cs)}
                isDarkMode={isDarkMode}
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

const mapStoreToProps = store => ({
  isDarkMode: store.preferences.colorScheme === 'dark',
});
const Legend = connect(mapStoreToProps)(_Legend);

export default isDockable(Legend);
