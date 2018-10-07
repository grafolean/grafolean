import React from 'react';

import { onLoginSuccess, ROOT_URL, handleFetchErrors, onFailure } from '../../store/actions';
import store from '../../store';
import Button from '../Button';

class Login extends React.Component {
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
      }
    }));
    this.formValues[fieldName] = value;
  }

  changeUsername = e => {
    this.changeFormValue('username', e.target.value);
  }
  changePassword = e => {
    this.changeFormValue('password', e.target.value);
  }

  onLoginClick = () => {
    const params = {
      username: this.formValues.username,
      password: this.formValues.password,
    }
    fetch(`${ROOT_URL}/auth/login`, {
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(params),
    })
      .then(handleFetchErrors)
      .then(response => {
        response.json().then(json => {
          store.dispatch(onLoginSuccess(json, response.headers.get('X-JWT-Token')));
        })
      })
      .catch(errorMsg => store.dispatch(onFailure(errorMsg.toString())))

  }

  render() {
    const { formValues: { username, password } } = this.state;
    return (
      <div>
        <div className="login_form">
          <label>Username:</label>
          <input type="text" value={username} onChange={this.changeUsername} />
          <label>Password:</label>
          <input type="text" value={password} onChange={this.changePassword} />
        </div>
        <Button onClick={this.onLoginClick}>Login</Button>
      </div>
    );
  }
}

export default Login;
