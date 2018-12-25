import React from 'react';
import { connect } from 'react-redux';
import Redirect from 'react-router-dom/Redirect';

import store from '../../store';
import { handleFetchErrors, fetchDashboardsList, ROOT_URL, onFailure } from '../../store/actions';

import { fetchAuth } from '../../utils/fetch';
import Button from '../Button';

class DashboardDeleteLink extends React.Component {
  state = {
    deleting: false,
    deleted: false,
  };

  handleClick = event => {
    event.preventDefault();
    if (!window.confirm("Are you sure you want to delete this dashboard? This can't be undone!")) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/1/dashboards/${this.props.slug}`, {
      method: 'DELETE',
    })
      .then(handleFetchErrors)
      .then(() => {
        this.setState({
          deleting: false,
          deleted: true,
        });
        store.dispatch(fetchDashboardsList());
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { deleting, deleted } = this.state;

    if (deleted) {
      return <Redirect to="/" />;
    }

    return (
      <Button isLoading={deleting} className="red" onClick={this.handleClick}>
        <i className="fa fa-trash" /> delete
      </Button>
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
