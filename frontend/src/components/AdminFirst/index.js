import React from 'react';

import './AdminFirst.scss';
import Button from '../Button';
import { ROOT_URL, onSuccess, fetchBackendStatus } from '../../store/actions';
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
    errorMsg: null,
    posting: false,
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

  handleSubmit = async ev => {
    ev.preventDefault();
    this.setState({
      errorMsg: null,
      posting: true,
    });
    try {
      // create first admin:
      const paramsFirst = JSON.stringify({
        username: this.formValues.username,
        password: this.formValues.password,
        email: this.formValues.email,
        name: this.formValues.name,
      });
      const responseFirst = await fetch(`${ROOT_URL}/admin/first`, {
        headers: {
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: paramsFirst,
      });
      if (!responseFirst.ok) {
        throw await responseFirst.text();
      }

      // login temporarily, but forget jwt token: (user must login explicitly)
      const paramsLogin = {
        username: this.formValues.username,
        password: this.formValues.password,
      };
      const responseLogin = await fetch(`${ROOT_URL}/auth/login`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify(paramsLogin),
      });
      if (!responseLogin.ok) {
        throw await responseLogin.text();
      }

      // create a first account:
      const jwtToken = responseLogin.headers.get('X-JWT-Token');
      const paramsAccount = {
        name: 'First account',
      };
      const responseAccount = await fetch(`${ROOT_URL}/admin/accounts/`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: jwtToken,
        },
        method: 'POST',
        body: JSON.stringify(paramsAccount),
      });
      if (!responseAccount.ok) {
        throw await responseAccount.text();
      }

      store.dispatch(onSuccess('Admin user (and first account) successfully created.'));
      this.setState({
        userCreated: true,
      });
      // we are done here, trigger fetching of backend status so that Main component learns about our work:
      store.dispatch(fetchBackendStatus());
    } catch (errorMsg) {
      this.setState({
        errorMsg: errorMsg.toString(),
      });
    } finally {
      this.setState({
        posting: false,
      });
    }
  };

  render() {
    const {
      formValues: { username, password, name, email },
      userCreated,
      errorMsg,
      posting,
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
            <input type="text" value={username} onChange={this.changeUsername} autoFocus />
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
          {errorMsg && (
            <div className="error info">
              <i className="fa fa-exclamation-triangle" /> {errorMsg}
            </div>
          )}
          <Button isLoading={posting} onClick={this.handleSubmit}>
            Create first user
          </Button>
        </form>
      </div>
    );
  }
}

export default AdminFirst;
