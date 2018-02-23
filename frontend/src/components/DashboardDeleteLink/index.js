import React from 'react';

import store from '../../store';
import { submitDeleteDashboard } from '../../store/actions';

import Loading from '../Loading';

export default class DashboardDeleteLink extends React.Component {
  constructor(props) {
    super(props);
    this.handleClick = this.handleClick.bind(this);
  }

  handleClick(event) {
    store.dispatch(submitDeleteDashboard(this.props.slug))
    event.preventDefault();
  }

  render() {
    if (this.props.deleting) {
      return (
        <div>
          Deleting...
          <Loading />
        </div>
      )
    }

    return (
      <a href="#" onClick={this.handleClick}>delete</a>
    )
  }
}
