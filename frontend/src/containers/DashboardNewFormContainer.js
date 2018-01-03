import { connect } from 'react-redux'
import DashboardNewForm from '../components/DashboardNewForm'

const mapStateToProps = (state, ownProps) => {
  let defaultProps = {
    formid: ownProps.formid,
    loading: false,
    submitted: false,  // we use this to redirect from form after it is successfully submitted
  }
  if (!state.forms) {
    return defaultProps;
  };
  if (!state.forms[ownProps.formid]) {
    return defaultProps;
  }

  return {...defaultProps, ...state.forms[ownProps.formid]}
}

const DashboardNewFormContainer = connect(
  mapStateToProps,
)(DashboardNewForm)

export default DashboardNewFormContainer
