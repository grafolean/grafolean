import React from 'react';
import { connect } from 'react-redux';
import Redirect from 'react-router-dom/Redirect';

import store from '../../store';
import { onLoginSuccess, ROOT_URL } from '../../store/actions';

import './LoginPage.scss';
import Button from '../Button';
import { VERSION_INFO } from '../../VERSION';

export class LoginPage extends React.Component {
  formValues = {};

  constructor(props) {
    super(props);
    this.state = {
      formValues: {
        username: '',
        password: '',
      },
      processingLogin: false,
      loginError: undefined,
      redirectToReferrer: this.props.loggedIn ? true : false,
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

  handleLoginSubmit = async ev => {
    ev.preventDefault();
    this.setState({
      processingLogin: true,
      loginError: undefined,
    });

    try {
      const response = await fetch(`${ROOT_URL}/auth/login`, {
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        method: 'POST',
        body: JSON.stringify({
          username: this.formValues.username,
          password: this.formValues.password,
        }),
      });
      if (response.status === 401) {
        this.setState({
          loginError: 'Invalid credentials!',
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
      this.setState({
        redirectToReferrer: true,
      });
    } catch (errorMsg) {
      console.error(errorMsg.toString());
      this.setState({
        loginError: errorMsg.toString(),
      });
    } finally {
      this.setState({
        processingLogin: false,
      });
    }
  };

  render() {
    const {
      formValues: { username, password },
      processingLogin,
      loginError,
      redirectToReferrer,
    } = this.state;
    if (redirectToReferrer === true) {
      const { fromLocation } = this.props.location.state || {
        fromLocation: '/',
      };
      return <Redirect to={fromLocation} />;
    }
    return (
      <div className="login-page">
        <form className="login-box" onSubmit={this.handleLoginSubmit}>
          <div className="grafolean">
            <img className="grafolean-logo" src="/grafolean.svg" alt="Grafolean" />
          </div>

          <div className="login form">
            <div className="field">
              <label>Username:</label>
              <input type="text" value={username} onChange={this.changeUsername} autoFocus />
            </div>
            <div className="field">
              <label>Password:</label>
              <input type="password" value={password} onChange={this.changePassword} />
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
          </div>
        </form>

        <div className="version">Grafolean version: {VERSION_INFO.ciCommitTag || 'unknown'}</div>
      </div>
    );
  }
}

const mapLoggedInStateToProps = store => ({
  loggedIn: !!store.user,
});
export default connect(mapLoggedInStateToProps)(LoginPage);
