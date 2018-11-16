import React from 'react';
import { Redirect } from 'react-router-dom';
import { connect } from 'react-redux';
import uniqueId from 'lodash/uniqueId';

import store from '../../store';
import { submitNewDashboard } from '../../store/actions';

import Loading from '../Loading';

class DashboardNewForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      name: '',
    };
  }

  handleChange = event => {
    this.setState({[event.target.name]: event.target.value});
  }

  handleSubmit = event => {
    store.dispatch(submitNewDashboard(this.props.formid, this.state.name))
    event.preventDefault();
  }

  render() {
    return (
      (this.props.submitted)? (
        <Redirect to={`/dashboards/view/${this.props.slug}`} />
      ):(
        <form id={this.props.formid} onSubmit={this.handleSubmit}>
          <label>
            Name:
            <input type="text" name="name" value={this.state.name} onChange={this.handleChange} />
          </label>
          {(this.props.loading)?(
            <Loading />
          ):(
            <input type="submit" value="Submit" />
          )}

        </form>
      )
    );
  }
}


const mapStoreToProps = (store) => {
  const formId = uniqueId("form-");
  let defaultProps = {
    formid: formId,
    loading: false,
    submitted: false,  // we use this to redirect from form after it is successfully submitted
  }
  if (!store.forms) {
    return defaultProps;
  };
  if (!store.forms[formId]) {
    return defaultProps;
  }

  return {...defaultProps, ...store.forms[formId]}
}
export default connect(mapStoreToProps)(DashboardNewForm);
