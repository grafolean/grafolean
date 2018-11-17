import React from 'react';
import { connect } from 'react-redux';

import { onLoginSuccess, ROOT_URL } from '../../store/actions';
import store from '../../store';
import Redirect from 'react-router-dom/Redirect';

import './LoginPage.scss';

export const LoginPage = props => (
  <Login {...props} />
)

class Login extends React.Component {
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
          });
          return;
        }
        if (!response.ok) {
          throw new Error(`Error ${response.status} - ${response.statusText}`);
        }
        response.json().then(json => {
          const jwtToken = response.headers.get('X-JWT-Token');
          window.sessionStorage.setItem('moonthor_jwt_token', jwtToken);
          store.dispatch(onLoginSuccess(json));
          this.setState({
            redirectToReferrer: true,
          });
        });
      })
      .catch(errorMsg => {
        console.error(errorMsg.toString());
        this.setState({
          loginError: errorMsg.toString(),
        });
      })
      .then(() =>
        this.setState({
          processingLogin: false,
        }),
      );
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
      <div className="login centered">
        <div className="login_form">
          <label>Username:</label>
          <input type="text" value={username} onChange={this.changeUsername} />
          <label>Password:</label>
          <input type="password" value={password} onChange={this.changePassword} />
          <div />
          {processingLogin ? (
            <button>
              <i className="fa fa-spinner fa-spin" />
            </button>
          ) : (
            <button onClick={this.onLoginClick} disabled={username.length === 0 || password.length === 0}>
              Login
            </button>
          )}
        </div>
        {loginError && (
          <div className="error-msg">
            <i className="fa fa-exclamation-triangle" />
            &nbsp;
            {loginError}
          </div>
        )}
      </div>
    );
  }
}

const mapLoggedInStateToProps = store => ({
  loggedIn: !!store.user,
});
export default connect(mapLoggedInStateToProps)(Login);
