import React from 'react';

import './AdminFirst.scss';
import Button from '../Button';
import { handleFetchErrors, ROOT_URL, onSuccess, onFailure } from '../../store/actions';
import store from '../../store';

class AdminFirst extends React.Component {
  formValues = {};

  constructor(props) {
    super(props);
    this.state = {
      formValues: {
        username: '',
        password: '',
        name: '',
        email: '',
      },
    };
  }

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

  handleSubmit = () => {
    const params = {
      username: this.formValues.username,
      password: this.formValues.password,
      email: this.formValues.email,
      name: this.formValues.name,
    };
    fetch(`${ROOT_URL}/admin/first`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(params),
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
          })
          .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())));
  };

  render() {
    const {
      formValues: { username, password, name, email },
    } = this.state;
    return (
      <div className="admin_first">
        <h3>Add first (admin) user:</h3>
        <div className="form">
          <label>Username:</label>
          <input type="text" value={username} onChange={this.changeUsername} />
          <label>Password:</label>
          <input type="text" value={password} onChange={this.changePassword} />
          <label>E-mail:</label>
          <input type="text" value={email} onChange={this.changeEmail} />
          <label>First and last name:</label>
          <input type="text" value={name} onChange={this.changeName} />
        </div>
        <div className="bottom">
          <Button onClick={this.handleSubmit}>Create first user</Button>
          <div>
            <i className="fa fa-exclamation-triangle" /> Careful! This will insert the first user, which will have
            administrator privileges. It will not be possible to insert another user in this way!
          </div>
        </div>
      </div>
    );
  }
}

export default AdminFirst;
