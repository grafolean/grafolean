import React, { Component } from 'react';

import store from '../../store';
import { submitNewDashboard } from '../../store/actions';

import Loading from '../Loading';

export default class DashboardNewForm extends React.Component {
  constructor(props) {
    super(props);
    this.state = {name: ''};

    this.handleChange = this.handleChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleChange(event) {
    this.setState({[event.target.name]: event.target.value});
  }

  handleSubmit(event) {
    store.dispatch(submitNewDashboard(this.props.formid, this.state.name))
    event.preventDefault();
  }

  render() {
    return (
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
    );
  }
}
