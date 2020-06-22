import React from 'react';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import { ROOT_URL } from '../../store/actions';
import { FormError } from '../isFormikForm';
import { VERSION_INFO } from '../../VERSION';
import Button from '../Button';

import '../auth-form-page.scss';

export default class SignupConfirm extends React.Component {
  state = {
    submitted: false,
    errorMsg: '',
  };

  changeFormValue = ev => {
    const fieldName = ev.target.name;
    const value = ev.target.type === 'checkbox' ? ev.target.checked : ev.target.value;
    this.setState(
      prevState => ({
        formValues: {
          ...prevState.formValues,
          [fieldName]: value,
        },
      }),
      this.validate,
    );
  };

  validate = values => {
    const { newPassword = '', confirmPassword = '' } = values;
    if (!newPassword) {
      return { newPassword: 'New password must not be empty' };
    }
    if (newPassword !== confirmPassword) {
      return { confirmPassword: 'Confirmation password does not match new password' };
    }
    return {};
  };

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      const { newPassword } = formValues;
      const { userId, confirmPin } = this.props.match.params;
      const params = JSON.stringify({
        user_id: parseInt(userId),
        confirm_pin: confirmPin,
        password: newPassword,
      });
      const response = await fetch(`${ROOT_URL}/persons/signup/complete`, {
        headers: { 'Content-Type': 'application/json' },
        method: 'POST',
        body: params,
      });
      if (!response.ok) {
        const errorMsg = await response.text();
        this.setState({
          errorMsg: errorMsg,
        });
        return;
      }
      this.setState({
        submitted: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  render() {
    const { submitted, errorMsg } = this.state;
    if (submitted) {
      return <Redirect to="/" />;
    }

    return (
      <div className="signup-page auth-form-page">
        <Formik
          initialValues={{
            newPassword: '',
            confirmPassword: '',
          }}
          validate={this.validate}
          onSubmit={this.handleSubmit}
          isInitialValid={false}
        >
          {({
            values,
            errors,
            touched,
            handleChange,
            setFieldValue,
            handleBlur,
            handleSubmit,
            isSubmitting,
            isValid,
          }) => (
            <form className="box" onSubmit={handleSubmit}>
              <div className="grafolean">
                <img className="grafolean-logo" src="/grafolean.svg" alt="Grafolean" />
              </div>
              <div className="form">
                <h3>Choose a password</h3>

                <p>Select a password so that you will be able to log into your newly created account:</p>

                <div className="field">
                  <label>New password:</label>
                  <input
                    type="password"
                    value={values.newPassword}
                    name="newPassword"
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                </div>
                <div className="field">
                  <label>Confirm password:</label>
                  <input
                    type="password"
                    value={values.confirmPassword}
                    name="confirmPassword"
                    onChange={handleChange}
                    onBlur={handleBlur}
                  />
                </div>

                <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
                  Create account
                </Button>

                {!isValid &&
                  Object.keys(errors)
                    .filter(f => touched[f] && values[f])
                    .map(f => <FormError key={f} msg={errors[f]} />)}

                {errorMsg && (
                  <div className="error-msg">
                    <i className="fa fa-exclamation-triangle" />
                    &nbsp;{errorMsg}
                  </div>
                )}
              </div>
            </form>
          )}
        </Formik>

        <div className="version">Grafolean version: {VERSION_INFO.ciCommitTag || 'unknown'}</div>
      </div>
    );
  }
}
