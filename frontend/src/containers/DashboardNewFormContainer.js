import { connect } from 'react-redux'
import uniqueId from 'lodash/uniqueId';
import DashboardNewForm from '../components/DashboardNewForm'

const mapStateToProps = (state, ownProps) => {
  const formId = uniqueId("form-");
  let defaultProps = {
    formid: formId,
    loading: false,
    submitted: false,  // we use this to redirect from form after it is successfully submitted
  }
  if (!state.forms) {
    return defaultProps;
  };
  if (!state.forms[formId]) {
    return defaultProps;
  }

  return {...defaultProps, ...state.forms[formId]}
}

const DashboardNewFormContainer = connect(
  mapStateToProps,
)(DashboardNewForm)

export default DashboardNewFormContainer
