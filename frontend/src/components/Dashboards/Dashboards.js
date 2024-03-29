import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { ROOT_URL } from '../../store/actions';
import { useTableSort } from '../../utils/useTableSort';
import { useTableFilter } from '../../utils/useTableFilter';
import TableFilterInput from '../../utils/TableFilterInput';

import Loading from '../Loading';
import Button from '../Button';

const DEFAULT_SORT_ORDER = [
  ['name', true],
  ['id', true],
];
const FILTERABLE_FIELDS = ['name'];

function Dashboards(props) {
  const accountId = props.match.params.accountId;
  const [dashboards, setDashboards] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  const [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc] = useTableSort(DEFAULT_SORT_ORDER);
  const [filterTableFunc, filter, setFilter] = useTableFilter(FILTERABLE_FIELDS);

  const onRecordsUpdate = dashboards => {
    setDashboards(dashboards.list);
    setFetchError(false);
  };

  const onRecordsUpdateError = errMsg => {
    setDashboards([]);
    setFetchError(true);
  };

  const performDelete = (ev, dashboardSlug) => {
    ev.preventDefault();

    const dashboard = dashboards.find(dashboard => dashboard.slug === dashboardSlug);
    if (
      !window.confirm(`Are you sure you want to delete dashboard "${dashboard.name}" ? This can't be undone!`)
    ) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${accountId}/dashboards/${dashboardSlug}`, {
      method: 'DELETE',
    });
  };

  return (
    <div className="dashboards frame">
      <PersistentFetcher
        resource={`accounts/${accountId}/dashboards`}
        onUpdate={onRecordsUpdate}
        onError={onRecordsUpdateError}
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
                  <th className="sortable" onClick={() => applySortFunc('name')}>
                    Name
                    {firstSortKey === 'name' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                  </th>
                  <th align="right">
                    <TableFilterInput filter={filter} setFilter={setFilter} />
                  </th>
                </tr>
                {dashboards
                  .filter(filterTableFunc)
                  .sort(sortCompareFunc)
                  .map(dashboard => (
                    <tr key={dashboard.slug}>
                      <td>
                        <Link
                          className="button green"
                          to={`/accounts/${accountId}/dashboards/view/${dashboard.slug}`}
                        >
                          <i className="fa fa-bar-chart" /> {dashboard.name}
                        </Link>
                      </td>
                      <td align="right">
                        <Button className="red" onClick={ev => performDelete(ev, dashboard.slug)}>
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

export default Dashboards;
