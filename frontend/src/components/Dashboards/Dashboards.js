import React from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { ROOT_URL } from '../../store/actions';

import Loading from '../Loading';
import Button from '../Button';

export default class Dashboards extends React.Component {
  state = {
    dashboards: null,
    fetchError: false,
  };

  onRecordsUpdate = dashboards => {
    this.setState({
      dashboards: dashboards.list,
      fetchError: false,
    });
  };

  onRecordsUpdateError = errMsg => {
    this.setState({
      dashboards: [],
      fetchError: true,
    });
  };

  performDelete = (ev, dashboardSlug) => {
    ev.preventDefault();

    const dashboard = this.state.dashboards.find(dashboard => dashboard.slug === dashboardSlug);
    if (
      !window.confirm(`Are you sure you want to delete dashboard "${dashboard.name}" ? This can't be undone!`)
    ) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${this.props.match.params.accountId}/dashboards/${dashboardSlug}`, {
      method: 'DELETE',
    });
  };

  render() {
    const { dashboards, fetchError } = this.state;
    const accountId = this.props.match.params.accountId;

    return (
      <div className="dashboards frame">
        <PersistentFetcher
          resource={`accounts/${accountId}/dashboards`}
          onUpdate={this.onRecordsUpdate}
          onError={this.onRecordsUpdateError}
        />

        {dashboards === null ? (
          <Loading />
        ) : fetchError ? (
          <>
            <i className="fa fa-exclamation-triangle" /> Error fetching dashboards
          </>
        ) : (
          <>
            {dashboards.length > 0 && (
              <table className="list">
                <tbody>
                  <tr>
                    <th>Name</th>
                    <th />
                  </tr>
                  {dashboards.map(dashboard => (
                    <tr key={dashboard.slug}>
                      <td>
                        <Link
                          className="button green"
                          to={`/accounts/${accountId}/dashboards/view/${dashboard.slug}`}
                        >
                          <i className="fa fa-bar-chart" /> {dashboard.name}
                        </Link>
                      </td>
                      <td>
                        <Button className="red" onClick={ev => this.performDelete(ev, dashboard.slug)}>
                          <i className="fa fa-trash" /> Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <Link className="button green" to={`/accounts/${accountId}/dashboards/new`}>
              <i className="fa fa-plus" /> Add dashboard
            </Link>
          </>
        )}
      </div>
    );
  }
}
