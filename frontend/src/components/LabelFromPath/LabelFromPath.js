import React from 'react';
import { connect } from 'react-redux';

import MatchingPaths from '../Widgets/GLeanChartWidget/ChartForm/MatchingPaths';

class LabelFromPath extends React.Component {
  render() {
    const { path, filter, renaming, accountEntities, sharedValues = {} } = this.props;
    const renamingSubstituted = MatchingPaths.substituteSharedValues(renaming, sharedValues);
    const label = MatchingPaths.constructChartSerieName(path, filter, renamingSubstituted, accountEntities);
    return <>{label}</>;
  }
}

const mapStoreToProps = store => ({
  accountEntities: store.accountEntities,
});
export default connect(mapStoreToProps)(LabelFromPath);
