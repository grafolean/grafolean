import React from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import { ROOT_URL } from '../../store/actions';

import LinkButton from '../LinkButton/LinkButton';
import Loading from '../Loading';
import Button from '../Button';
import EntityDetails from './EntityDetails';

export default class Entities extends React.Component {
  state = {
    entities: null,
    fetchError: false,
  };

  onEntitiesUpdate = entities => {
    this.setState({
      entities: entities.list.sort((a, b) => {
        if (a.entity_type < b.entity_type) {
          return -1;
        }
        if (a.entity_type > b.entity_type) {
          return 1;
        }
        return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
      }),
      fetchError: false,
    });
  };

  onEntitiesUpdateError = errMsg => {
    this.setState({
      entities: [],
      fetchError: true,
    });
  };

  performDelete = (ev, entityId) => {
    ev.preventDefault();

    const entity = this.state.entities.find(entity => entity.id === entityId);
    if (!window.confirm(`Are you sure you want to delete entity "${entity.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/accounts/${this.props.match.params.accountId}/entities/${entityId}`, {
      method: 'DELETE',
    });
  };

  render() {
    const { entities, fetchError } = this.state;
    const accountId = this.props.match.params.accountId;

    return (
      <div className="entities frame">
        <PersistentFetcher
          resource={`accounts/${accountId}/entities`}
          onUpdate={this.onEntitiesUpdate}
          onError={this.onEntitiesUpdateError}
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
                    <th>Type</th>
                    <th>Name</th>
                    <th>Details</th>
                    <th />
                    <th />
                  </tr>
                  {entities.map(entity => (
                    <tr key={entity.id}>
                      <td>{entity.entity_type}</td>
                      <td>
                        <Link
                          className="button green"
                          to={`/accounts/${accountId}/entities/view/${entity.id}`}
                        >
                          <i className="fa fa-cube" /> {entity.name}
                        </Link>
                      </td>
                      <td>
                        <EntityDetails details={entity.details} />
                      </td>
                      <td>
                        <LinkButton title="Edit" to={`/accounts/${accountId}/entities/edit/${entity.id}`}>
                          <i className="fa fa-pencil" /> Edit
                        </LinkButton>
                      </td>
                      <td>
                        <Button className="red" onClick={ev => this.performDelete(ev, entity.id)}>
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
}
