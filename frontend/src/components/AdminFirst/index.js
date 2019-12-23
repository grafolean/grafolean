import React from 'react';

import { ROOT_URL, onSuccess, fetchBackendStatus } from '../../store/actions';
import store from '../../store';
import Button from '../Button';

import './AdminFirst.scss';

class AdminFirst extends React.Component {
  state = {
    formValues: {
      username: '',
      password: '',
      confirmPassword: '',
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
  }

  changeUsername = e => {
    this.changeFormValue('username', e.target.value);
  };
  changePassword = e => {
    this.changeFormValue('password', e.target.value);
  };
  changeConfirmPassword = e => {
    this.changeFormValue('confirmPassword', e.target.value);
  };
  changeName = e => {
    this.changeFormValue('name', e.target.value);
  };
  changeEmail = e => {
    this.changeFormValue('email', e.target.value);
  };

  handleSubmit = async ev => {
    ev.preventDefault();

    const {
      formValues: { username, password, confirmPassword, email, name },
    } = this.state;

    if (password !== confirmPassword) {
      this.setState(prevState => ({
        errorMsg: 'Passwords do not match!',
        formValues: {
          ...prevState.formValues,
          password: '',
          confirmPassword: '',
        },
      }));
      return;
    }

    this.setState({
      errorMsg: null,
      posting: true,
    });
    try {
      // create first admin:
      const paramsFirst = JSON.stringify({
        username: username,
        password: password,
        email: email,
        name: name,
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
        username: username,
        password: password,
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

      store.dispatch(onSuccess('Congratulations! Admin user and first account were successfully created.'));
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
      formValues: { username, password, confirmPassword, name, email },
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
            <input type="password" value={password} onChange={this.changePassword} />
          </div>
          <div className="field">
            <label>Confirm password:</label>
            <input type="password" value={confirmPassword} onChange={this.changeConfirmPassword} />
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
