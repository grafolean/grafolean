import { connect } from 'react-redux'
import DashboardDeleteLink from '../components/DashboardDeleteLink'

const mapStateToProps = (state, ownProps) => {
  let slug = ownProps.slug;
  let defaultProps = {
    slug: slug,
  }

  if ((!state.dashboards) || (!state.dashboards[slug])) {
    return defaultProps;
  }

  return {...defaultProps, ...state.dashboards[slug]}
}

const DashboardDeleteLinkContainer = connect(
  mapStateToProps,
)(DashboardDeleteLink)

export default DashboardDeleteLinkContainer
