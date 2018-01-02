import { connect } from 'react-redux'
import DashboardNewForm from '../components/DashboardNewForm'

const mapStateToProps = (state, ownProps) => {
  let defaultProps = {
    formid: ownProps.formid,
    loading: false,
  }
  if (!state.forms) {
    return defaultProps;
  };
  if (!state.forms[ownProps.formid]) {
    return defaultProps;
  }

  return {...defaultProps, loading: state.forms[ownProps.formid].loading }
}

const DashboardNewFormContainer = connect(
  mapStateToProps,
)(DashboardNewForm)

export default DashboardNewFormContainer
