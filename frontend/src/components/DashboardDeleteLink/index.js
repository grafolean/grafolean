import React from 'react';
import { connect } from 'react-redux';

import store from '../../store';
import { submitDeleteDashboard } from '../../store/actions';

import Loading from '../Loading';

class DashboardDeleteLink extends React.Component {
  handleClick = event => {
    event.preventDefault();
    if (!window.confirm("Are you sure you want to delete this dashboard? This can't be undone!")) {
      return;
    }
    store.dispatch(submitDeleteDashboard(this.props.slug));
  };

  render() {
    if (this.props.deleting) {
      return (
        <div>
          Deleting...
          <Loading />
        </div>
      );
    }

    return (
      <button className="red" onClick={this.handleClick}>
        <i className="fa fa-trash" /> delete
      </button>
    );
  }
}

const mapStoreToProps = (store, ownProps) => {
  let slug = ownProps.slug;
  let defaultProps = {
    slug: slug,
  };

  if (!store.dashboards || !store.dashboards[slug]) {
    return defaultProps;
  }

  return { ...defaultProps, ...store.dashboards[slug] };
};
export default connect(mapStoreToProps)(DashboardDeleteLink);
