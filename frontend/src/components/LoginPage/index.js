import React from 'react';
import { connect } from 'react-redux';

import { onLoginSuccess, ROOT_URL } from '../../store/actions';
import store from '../../store';
import Redirect from 'react-router-dom/Redirect';

import './LoginPage.scss';

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

  onLoginClick = () => {
    const params = {
      username: this.formValues.username,
      password: this.formValues.password,
    };
    this.setState({
      processingLogin: true,
      loginError: undefined,
    });
    fetch(`${ROOT_URL}/auth/login`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'POST',
      body: JSON.stringify(params),
    })
      .then(response => {
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
        const jwtToken = response.headers.get('X-JWT-Token');
        response
          .json()
          .then(json => {
            window.sessionStorage.setItem('grafolean_jwt_token', jwtToken);
            store.dispatch(onLoginSuccess(json));
            this.setState({
              redirectToReferrer: true,
            });
          })
          .catch(errorMsg => {
            console.error(errorMsg.toString());
            this.setState({
              loginError: errorMsg.toString(),
              processingLogin: false,
            });
          });
      })
      .catch(errorMsg => {
        console.error(errorMsg.toString());
        this.setState({
          loginError: errorMsg.toString(),
          processingLogin: false,
        });
      });
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
        <div className="login-box">
          <div className="grafolean">
            <img className="grafolean-logo" src="/grafolean.svg" alt="Grafolean" />
          </div>

          <div className="login form">
            <div className="field">
              <label>Username:</label>
              <input type="text" value={username} onChange={this.changeUsername} />
            </div>
            <div className="field">
              <label>Password:</label>
              <input type="password" value={password} onChange={this.changePassword} />
            </div>

            {processingLogin ? (
              <button>
                <i className="fa fa-circle-o-notch fa-spin" />
              </button>
            ) : (
              <button onClick={this.onLoginClick} disabled={username.length === 0 || password.length === 0}>
                Login
              </button>
            )}

            {loginError && (
              <div className="error-msg">
                <i className="fa fa-exclamation-triangle" />
                &nbsp;
                {loginError}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
}

const mapLoggedInStateToProps = store => ({
  loggedIn: !!store.user,
});
export default connect(mapLoggedInStateToProps)(LoginPage);
