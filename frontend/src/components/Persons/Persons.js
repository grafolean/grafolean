import React from 'react';
import { Link } from 'react-router-dom';

import { fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, onFailure, ROOT_URL } from '../../store/actions';
import store from '../../store';

import Button from '../Button';
import Loading from '../Loading';

import './Persons.scss';

export default class Persons extends React.PureComponent {
  state = {
    persons: null,
  };

  componentDidMount() {
    this.fetchPersons();
  }

  fetchPersons = () => {
    fetchAuth(`${ROOT_URL}/persons/`)
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json =>
        this.setState({
          persons: json.list,
        }),
      )
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  handleDelete = (ev, personId) => {
    ev.preventDefault();
    const person = this.state.persons.find(person => person.user_id === personId);
    if (!window.confirm(`Are you sure you want to delete user "${person.name}" ? This can't be undone!`)) {
      return;
    }

    fetchAuth(`${ROOT_URL}/persons/${personId}`, { method: 'DELETE' })
      .then(handleFetchErrors)
      .then(() =>
        this.setState(
          {
            persons: null,
          },
          this.fetchPersons,
        ),
      )
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const { persons } = this.state;
    return (
      <div className="persons frame">
        {persons === null ? (
          <Loading />
        ) : (
          persons.length > 0 && (
            <table className="list">
              <tbody>
                <tr>
                  <th>Username</th>
                  <th>Name</th>
                  <th>E-mail</th>
                  <th>Activated</th>
                  <th />
                  <th />
                </tr>
                {persons.map(person => (
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
                      <Button className="red" onClick={ev => this.handleDelete(ev, person.user_id)}>
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
}
