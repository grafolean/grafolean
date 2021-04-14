import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { ROOT_URL } from '../../store/actions';
import { useTableSort } from '../../utils/useTableSort';

import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';
import Button from '../Button';

const DEFAULT_SORT_ORDER = [
  ['name', true],
  ['id', true],
];

export default function Credentials(props) {
  const accountId = props.match.params.accountId;
  const [credentials, setCredentials] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  const [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc] = useTableSort(DEFAULT_SORT_ORDER);

  const onCredentialsUpdate = credentials => {
    setCredentials(credentials.list);
    setFetchError(false);
  };

  const onCredentialsUpdateError = errMsg => {
    setCredentials([]);
    setFetchError(true);
  };

  const performDelete = (ev, credId) => {
    ev.preventDefault();

    const cred = credentials.find(cred => cred.id === credId);
    if (
      !window.confirm(`Are you sure you want to delete credentials "${cred.name}" ? This can't be undone!`)
    ) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${accountId}/credentials/${credId}`, {
      method: 'DELETE',
    });
  };

  return (
    <div className="credentials frame">
      <PersistentFetcher
        resource={`accounts/${accountId}/credentials`}
        onUpdate={onCredentialsUpdate}
        onError={onCredentialsUpdateError}
      />

      {credentials === null ? (
        <Loading />
      ) : fetchError ? (
        <>
          <i className="fa fa-exclamation-triangle" /> Error fetching credentials
        </>
      ) : (
        <>
          {credentials.length > 0 && (
            <table className="list">
              <tbody>
                <tr>
                  <th className="sortable" onClick={() => applySortFunc('protocol')}>
                    Protocol
                    {firstSortKey === 'protocol' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                  </th>
                  <th className="sortable" onClick={() => applySortFunc('name')}>
                    Name
                    {firstSortKey === 'name' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                  </th>
                  <th>Details</th>
                  <th />
                  <th />
                </tr>
                {credentials.sort(sortCompareFunc).map(cred => (
                  <tr key={cred.id}>
                    <td>{cred.protocol}</td>
                    <td>{cred.name}</td>
                    <td>/</td>
                    <td>
                      <LinkButton title="Edit" to={`/accounts/${accountId}/credentials/edit/${cred.id}`}>
                        <i className="fa fa-pencil" /> Edit
                      </LinkButton>
                    </td>
                    <td>
                      <Button className="red" onClick={ev => performDelete(ev, cred.id)}>
                        <i className="fa fa-trash" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Link className="button green" to={`/accounts/${accountId}/credentials/new`}>
            <i className="fa fa-plus" /> Add credentials
          </Link>
        </>
      )}
    </div>
  );
}
