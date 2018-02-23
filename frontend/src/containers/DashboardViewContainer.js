import { connect } from 'react-redux'

import DashboardView from '../components/DashboardView'

const mapStateToProps = (state, ownProps) => {
  // parameter 'slug' comes from React Router:
  let slug = ownProps.match.params.slug;
  if (!state.dashboards.details[slug])
    return {};
  return state.dashboards.details[slug];
}

const DashboardViewContainer = connect(
  mapStateToProps,
)(DashboardView)

export default DashboardViewContainer
