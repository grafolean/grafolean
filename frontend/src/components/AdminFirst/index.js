import React from 'react';

import './AdminFirst.scss';
import Button from '../Button';
import { handleFetchErrors, ROOT_URL, onSuccess, onFailure, fetchBackendStatus } from '../../store/actions';
import store from '../../store';

class AdminFirst extends React.Component {
  formValues = {};
  state = {
    formValues: {
      username: '',
      password: '',
      name: '',
      email: '',
    },
    userCreated: false,
  };

  changeFormValue(fieldName, value) {
    this.setState(oldState => ({
      formValues: {
        ...oldState.formValues,
        [fieldName]: value,
      },
    }));
    this.formValues[fieldName] = value;
  }

  changeUsername = e => {
    this.changeFormValue('username', e.target.value);
  };
  changePassword = e => {
    this.changeFormValue('password', e.target.value);
  };
  changeName = e => {
    this.changeFormValue('name', e.target.value);
  };
  changeEmail = e => {
    this.changeFormValue('email', e.target.value);
  };

  handleSubmit = ev => {
    ev.preventDefault();
    const params = JSON.stringify({
      username: this.formValues.username,
      password: this.formValues.password,
      email: this.formValues.email,
      name: this.formValues.name,
    });
    fetch(`${ROOT_URL}/admin/first`, {
      headers: {
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: params,
    })
      .then(handleFetchErrors)
      // login temporarily, but forget jwt token: (user must login explicitly)
      .then(() => {
        const params = {
          username: this.formValues.username,
          password: this.formValues.password,
        };
        return fetch(`${ROOT_URL}/auth/login`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: 'POST',
          body: JSON.stringify(params),
        });
      })
      .then(handleFetchErrors)
      .then(response => {
        const jwtToken = response.headers.get('X-JWT-Token');
        const params = {
          name: 'First account',
        };
        fetch(`${ROOT_URL}/admin/accounts/`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: jwtToken,
          },
          method: 'POST',
          body: JSON.stringify(params),
        })
          .then(handleFetchErrors)
          .then(() => {
            store.dispatch(onSuccess('Admin user (and first account) successfully created.'));
            this.setState({
              userCreated: true,
            });
            // we are done here, trigger fetching of backend status so that Main component learns about our work:
            store.dispatch(fetchBackendStatus());
          })
          .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const {
      formValues: { username, password, name, email },
      userCreated,
    } = this.state;
    if (userCreated) {
      return null;
    }
    return (
      <div className="admin_first">
        <form>
          <h3>Add first (admin) user:</h3>
          <div className="info">
            This will insert the first user (which will have administrator privileges). It will not be
            possible to insert another user in such way, so it is important that you{' '}
            <strong>remember the credentials</strong>!
          </div>
          <div className="field">
            <label>Username:</label>
            <input type="text" value={username} onChange={this.changeUsername} />
          </div>
          <div className="field">
            <label>Password:</label>
            <input type="text" value={password} onChange={this.changePassword} />
          </div>
          <div className="field">
            <label>E-mail:</label>
            <input type="text" value={email} onChange={this.changeEmail} />
          </div>
          <div className="field">
            <label>First and last name:</label>
            <input type="text" value={name} onChange={this.changeName} />
          </div>
          <Button onClick={this.handleSubmit}>Create first user</Button>
        </form>
      </div>
    );
  }
}

export default AdminFirst;
