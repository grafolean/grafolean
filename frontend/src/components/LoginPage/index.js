import React from 'react';
import { connect } from 'react-redux';
import { Link } from 'react-router-dom';

import store from '../../store';
import { onLoginSuccess, ROOT_URL } from '../../store/actions';
import Button from '../Button';
import { VERSION_INFO } from '../../VERSION';

import '../auth-form-page.scss';
import './LoginPage.scss';

class LoginPage extends React.Component {
  state = {
    formValues: {
      username: '',
      password: '',
    },
    processingLogin: false,
    loginError: undefined,
  };

  changeFormValue = ev => {
    const fieldName = ev.target.name;
    const value = ev.target.value;
    this.setState(prevState => ({
      formValues: {
        ...prevState.formValues,
        [fieldName]: value,
      },
    }));
  };

  handleLoginSubmit = async ev => {
    ev.preventDefault();
    this.setState({
      processingLogin: true,
      loginError: undefined,
    });

    try {
      const { username, password } = this.state.formValues;
      const response = await fetch(`${ROOT_URL}/auth/login`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          username: username,
          password: password,
        }),
      });
      if (response.status === 401) {
        this.setState({
          loginError: 'Invalid credentials!',
          processingLogin: false,
        });
        return;
      }
      if (!response.ok) {
        throw new Error(`Error ${response.status} - ${response.statusText}`);
      }

      const jwtToken = response.headers.get('X-JWT-Token').substring('Bearer '.length);
      const json = await response.json();
      window.sessionStorage.setItem('grafolean_jwt_token', jwtToken);
      store.dispatch(onLoginSuccess(json, jwtToken));
    } catch (errorMsg) {
      console.error(errorMsg.toString());
      this.setState({
        loginError: errorMsg.toString(),
        processingLogin: false,
      });
    }
  };

  render() {
    const {
      formValues: { username, password },
      processingLogin,
      loginError,
    } = this.state;
    const { backendStatus } = this.props;
    return (
      <div className="login-page auth-form-page">
        <form className="box" onSubmit={this.handleLoginSubmit}>
          <div className="grafolean">
            <img className="grafolean-logo" src="/grafolean.svg" alt="Grafolean" />
          </div>

          <div className="form">
            <h3>Login</h3>

            <div className="field">
              <label>Username or e-mail:</label>
              <input type="text" value={username} name="username" onChange={this.changeFormValue} autoFocus />
            </div>
            <div className="field">
              <label>Password:</label>
              <input type="password" value={password} name="password" onChange={this.changeFormValue} />
            </div>

            <Button
              type="submit"
              isLoading={processingLogin}
              disabled={username.length === 0 || password.length === 0}
            >
              Login
            </Button>

            {loginError && (
              <div className="error-msg">
                <i className="fa fa-exclamation-triangle" />
                &nbsp;
                {loginError}
              </div>
            )}

            {backendStatus.enable_signup && (
              <div className="signup-text">
                New to Grafolean? <Link to="/signup">Create an account.</Link>
              </div>
            )}
            <div className="forgot-text">
              <Link to="/forgot">Forgot password?</Link>
            </div>
          </div>
        </form>

        <div className="version">Grafolean version: {VERSION_INFO.ciCommitTag || 'unknown'}</div>
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  backendStatus: store.backendStatus.status,
});
export default connect(mapStoreToProps)(LoginPage);
