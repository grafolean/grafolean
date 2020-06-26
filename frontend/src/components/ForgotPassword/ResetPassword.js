import React from 'react';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import Button from '../Button';
import { FormError } from '../isFormikForm';
import { VERSION_INFO } from '../../VERSION';
import { ROOT_URL } from '../../store/actions';

export default class ResetPassword extends React.Component {
  state = {
    submitted: false,
    errorMsg: null,
  };

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      this.setState({
        errorMsg: '',
      });
      const { newPassword } = formValues;
      const { userId, confirmPin } = this.props.match.params;
      const params = JSON.stringify({
        user_id: parseInt(userId),
        confirm_pin: confirmPin,
        password: newPassword,
      });
      const response = await fetch(`${ROOT_URL}/persons/forgot/reset`, {
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
                <h3>Reset password</h3>

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
                  Try to change password
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
