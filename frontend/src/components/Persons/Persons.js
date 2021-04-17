import React, { useState } from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { ROOT_URL } from '../../store/actions';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { useTableSort } from '../../utils/useTableSort';
import { useTableFilter } from '../../utils/useTableFilter';
import TableFilterInput from '../../utils/TableFilterInput';

import Button from '../Button';
import Loading from '../Loading';

import './Persons.scss';

const DEFAULT_SORT_ORDER = [
  ['activated', false],
  ['name', true],
  ['id', true],
];
const FILTERABLE_FIELDS = ['username', 'name', 'email'];

export default function Persons(props) {
  const [persons, setPersons] = useState(null);
  const [fetchError, setFetchError] = useState(false);
  const [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc] = useTableSort(DEFAULT_SORT_ORDER);
  const [filterTableFunc, filter, setFilter] = useTableFilter(FILTERABLE_FIELDS);

  const onPersonsUpdate = responseData => {
    setPersons(responseData.list);
    setFetchError(false);
  };

  const onPersonsUpdateError = errMsg => {
    setPersons(null);
    setFetchError(true);
  };

  const performDelete = (ev, personId) => {
    ev.preventDefault();

    const person = persons.find(person => person.user_id === personId);
    if (!window.confirm(`Are you sure you want to delete user "${person.name}" ? This can't be undone!`)) {
      return;
    }

    setPersons(null);
    fetchAuth(`${ROOT_URL}/persons/${personId}`, { method: 'DELETE' });
  };

  return (
    <div className="persons frame">
      <PersistentFetcher resource={`persons`} onUpdate={onPersonsUpdate} onError={onPersonsUpdateError} />
      {fetchError ? (
        <>
          <i className="fa fa-exclamation-triangle" /> Error fetching users
        </>
      ) : persons === null ? (
        <Loading />
      ) : (
        persons.length > 0 && (
          <table className="list">
            <tbody>
              <tr>
                <th className="sortable" onClick={() => applySortFunc('username')}>
                  Username
                  {firstSortKey === 'username' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th className="sortable" onClick={() => applySortFunc('name')}>
                  Name
                  {firstSortKey === 'name' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th className="sortable" onClick={() => applySortFunc('email')}>
                  E-mail
                  {firstSortKey === 'email' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th className="sortable" onClick={() => applySortFunc('email_confirmed')}>
                  Activated
                  {firstSortKey === 'email_confirmed' && <i className={`fa fa-sort-${firstSortDirection}`} />}
                </th>
                <th colSpan="2" align="right">
                  <TableFilterInput filter={filter} setFilter={setFilter} />
                </th>
              </tr>
              {persons
                .filter(filterTableFunc)
                .sort(sortCompareFunc)
                .map(person => (
                  <tr key={person.user_id}>
                    <td>{person.username}</td>
                    <td>{person.name}</td>
                    <td>{person.email}</td>
                    <td className="email-confirmed">
                      <i className={`fa fa-${person.email_confirmed ? 'check' : 'close'}`} />
                    </td>
                    <td>
                      <Link className="button green" to={`/users/${person.user_id}/permissions`}>
                        <i className="fa fa-user-lock" /> Permissions
                      </Link>
                    </td>
                    <td>
                      <Button className="red" onClick={ev => performDelete(ev, person.user_id)}>
                        <i className="fa fa-trash" /> Delete
                      </Button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        )
      )}
      <Link className="button green" to="/users-new">
        <i className="fa fa-plus" /> Add person
      </Link>
    </div>
  );
}
