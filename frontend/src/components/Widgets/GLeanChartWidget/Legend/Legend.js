import React from 'react';
import { connect } from 'react-redux';

import { generateSerieColor } from '../utils';
import isDockable from './isDockable';
import MultiSelect from '../../../MultiSelect/MultiSelect';
import MatchingPaths from '../ChartForm/MatchingPaths';

import './index.scss';

class _Legend extends React.Component {
  static defaultProps = {
    width: 200,
    height: 300,
    chartSeries: [],
    onDrawnChartSeriesChange: selectedChartSeries => {},
  };

  handleFilteredSelectedChange = filteredSelectedOptionIds => {
    const selectedChartSeries = this.props.chartSeries.filter(cs =>
      filteredSelectedOptionIds.includes(cs.chartSerieId),
    );
    this.props.onDrawnChartSeriesChange(selectedChartSeries);
  };

  render() {
    const { isDarkMode, chartSeries, accountEntities } = this.props;
    if (chartSeries.length === 0) {
      return null;
    }

    const options = chartSeries.map(cs => ({
      id: cs.chartSerieId,
      label: `${MatchingPaths.constructChartSerieName(
        cs.serieNameParts.path,
        cs.serieNameParts.filter,
        cs.serieNameParts.renaming,
        accountEntities,
      )} [${cs.unit}]`,
      color: generateSerieColor(cs.path, cs.index),
    }));
    const initialSelectedOptionsIds = chartSeries.map(cs => cs.chartSerieId);
    return (
      <div
        className="legend"
        style={{
          width: this.props.width,
          height: this.props.height ? this.props.height : 'initial',
        }}
      >
        <MultiSelect
          options={options}
          initialSelectedOptionsIds={initialSelectedOptionsIds}
          isDarkMode={isDarkMode}
          onChangeFilteredSelected={this.handleFilteredSelectedChange}
        />
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  isDarkMode: store.preferences.colorScheme === 'dark',
  accountEntities: store.accountEntities,
});
const Legend = connect(mapStoreToProps)(_Legend);

export default isDockable(Legend);
