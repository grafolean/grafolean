import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { ROOT_URL } from '../../store/actions';
import { useTableSort } from '../../utils/useTableSort';

import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';
import Button from '../Button';
import EntityDetails from './EntityDetails';
import ParentEntityId from './ParentEntityId';

const DEFAULT_SORT_ORDER = [
  ['type', true],
  ['name', true],
  ['id', true],
];

export default function Entities(props) {
  const accountId = props.match.params.accountId;
  const [entities, setEntities] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  const [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc] = useTableSort(DEFAULT_SORT_ORDER);

  const onEntitiesUpdate = entities => {
    setEntities(entities.list);
    setFetchError(false);
  };

  const onEntitiesUpdateError = errMsg => {
    setEntities([]);
    setFetchError(true);
  };

  const performDelete = (ev, entityId) => {
    ev.preventDefault();

    const entity = entities.find(entity => entity.id === entityId);
    if (!window.confirm(`Are you sure you want to delete entity "${entity.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${accountId}/entities/${entityId}`, {
      method: 'DELETE',
    });
  };

  return (
    <div className="entities frame">
      <PersistentFetcher
        resource={`accounts/${accountId}/entities`}
        onUpdate={onEntitiesUpdate}
        onError={onEntitiesUpdateError}
      />

      {entities === null ? (
        <Loading />
      ) : fetchError ? (
        <>
          <i className="fa fa-exclamation-triangle" /> Error fetching entities
        </>
      ) : (
        <>
          {entities.length > 0 && (
            <table className="list">
              <tbody>
                <tr>
                  <th className="sortable" onClick={() => applySortFunc('type')}>
                    Type
                    {firstSortKey === 'type' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                  </th>
                  <th className="sortable" onClick={() => applySortFunc('name')}>
                    Name
                    {firstSortKey === 'name' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                  </th>
                  <th>Details</th>
                  <th />
                  <th />
                </tr>
                {entities.sort(sortCompareFunc).map(entity => (
                  <tr key={entity.id}>
                    <td>{entity.entity_type}</td>
                    <td>
                      <Link className="button green" to={`/accounts/${accountId}/entities/view/${entity.id}`}>
                        <i className="fa fa-cube" /> {entity.name}
                      </Link>
                    </td>
                    <td>
                      <EntityDetails details={entity.details} />
                      <ParentEntityId parent={entity.parent} />
                    </td>
                    <td>
                      <LinkButton title="Edit" to={`/accounts/${accountId}/entities/edit/${entity.id}`}>
                        <i className="fa fa-pencil" /> Edit
                      </LinkButton>
                    </td>
                    <td>
                      <Button className="red" onClick={ev => performDelete(ev, entity.id)}>
                        <i className="fa fa-trash" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Link className="button green" to={`/accounts/${accountId}/entities/new`}>
            <i className="fa fa-plus" /> Add monitored entity
          </Link>
        </>
      )}
    </div>
  );
}
