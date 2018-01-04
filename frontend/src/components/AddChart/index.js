import React, { Component } from 'react';

import store from '../../store';
import { submitNewChart } from '../../store/actions';

import Loading from '../Loading';

export default class AddChart extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      formOpened: false,
      name: '',
    };
    this.handleShowHideForm = this.handleShowHideForm.bind(this);
    this.handleFormFieldChange = this.handleFormFieldChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleShowHideForm(event, show) {
    this.setState({
      formOpened: show,
    })
    event.preventDefault();
  }

  handleFormFieldChange(event) {
    this.setState({[event.target.name]: event.target.value});
  }

  handleSubmit(event) {
    store.dispatch(submitNewChart(this.props.formid, this.props.dashboardSlug, this.state.name))
    event.preventDefault();
  }

  render() {
    if (!this.state.formOpened) {
      return (
        <div>
            <a href="#" onClick={(event) => this.handleShowHideForm(event, true)}>+ add chart</a>

        </div>
      )
    }

    return (
      <div>
        <a href="#" onClick={(event) => this.handleShowHideForm(event, false)}>- cancel</a>
        <form id={this.props.formid} onSubmit={this.handleSubmit}>
          <label>
            Chart title:
            <input type="text" name="name" value={this.state.name} onChange={this.handleFormFieldChange} />
          </label>
          {(this.props.loading)?(
            <Loading />
          ):(
            <input type="submit" value="Submit" />
          )}

        </form>
    </div>
    )
  }
};

