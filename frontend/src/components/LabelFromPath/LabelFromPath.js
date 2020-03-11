import React from 'react';
import { connect } from 'react-redux';

import MatchingPaths from '../Widgets/GLeanChartWidget/ChartForm/MatchingPaths';

class LabelFromPath extends React.Component {
  render() {
    const { path, filter, renaming, accountEntities } = this.props;
    const label = MatchingPaths.constructChartSerieName(path, filter, renaming, accountEntities);
    return <>{label}</>;
  }
}
const mapStoreToProps = store => ({
  accountEntities: store.accountEntities,
});
export default connect(mapStoreToProps)(LabelFromPath);
