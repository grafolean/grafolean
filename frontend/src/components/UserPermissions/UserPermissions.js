import React from 'react';
import { Link } from 'react-router-dom';

import { PersistentFetcher, fetchAuth } from '../../utils/fetch';
import { handleFetchErrors, onFailure, ROOT_URL } from '../../store/actions';
import store from '../../store';

import Loading from '../Loading';
import Button from '../Button';

export default class UserPermissions extends React.PureComponent {
  state = {
    loading: true,
    user: null,
  };

  onUserUpdate = user => {
    this.setState({
      user: user,
      loading: false,
    });
  };

  handleDelete = (ev, permissionId) => {
    ev.preventDefault();
    if (!window.confirm('Are you sure you want to delete this permission?')) {
      return;
    }

    fetchAuth(`${ROOT_URL}/admin/users/${this.props.match.params.userId}/permissions/${permissionId}`, {
      method: 'DELETE',
    })
      .then(handleFetchErrors)
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  renderInner() {
    const { user, loading } = this.state;
    if (loading) {
      return <Loading />;
    }
    if (!user) {
      return <p>Oops, something went wrong.</p>;
    }
    return (
      <>
        <table className="list">
          <thead>
            <tr>
              <th>Resource prefix</th>
              <th>Access</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {user.permissions &&
              user.permissions.map(p => (
                <tr key={p.id}>
                  <td>{p.resource_prefix === null ? '/' : p.resource_prefix}</td>
                  <td>{p.methods === null ? '*' : p.methods.join(', ')}</td>
                  <td>
                    <Button className="red" onClick={ev => this.handleDelete(ev, p.id)}>
                      <i className="fa fa-trash" /> Delete
                    </Button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </>
    );
  }

  render() {
    const { userId } = this.props.match.params;
    return (
      <div className="user-permissions frame">
        <PersistentFetcher resource={`admin/persons/${userId}`} onUpdate={this.onUserUpdate} />

        {this.renderInner()}

        <Link className="button green" to={`/users/${userId}/permissions/new`}>
          <i className="fa fa-plus" /> Add permission
        </Link>
      </div>
    );
  }
}
