import React from 'react';
import { Formik } from 'formik';
import Button from '../Button';
import { FormError } from '../isFormikForm';
import { VERSION_INFO } from '../../VERSION';

export default class ForgotPassword extends React.Component {
  state = {
    submitted: false,
  };

  handleSubmit = async (formValues, { setSubmitting }) => {
    try {
      this.setState({
        submitted: true,
      });
    } finally {
      setSubmitting(false);
    }
  };

  render() {
    const { submitted, errorMsg } = this.state;
    return (
      <div className="signup-page auth-form-page">
        <Formik
          initialValues={{
            email: '',
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
                {submitted ? (
                  <>
                    <h3>Recovery e-mail sent</h3>

                    <p>
                      Check your email (<b>{values.email}</b>) for a link to reset your password. If it
                      doesn't appear within a few minutes, check your spam folder.
                    </p>
                  </>
                ) : (
                  <>
                    <h3>Reset your password</h3>

                    <p>
                      Enter an e-mail address that you used to sign up for a Grafolean user account and we
                      will send you a message with a link to reset your password.
                    </p>

                    <div className="field">
                      <label>E-mail:</label>
                      <input
                        type="email"
                        value={values.email}
                        name="email"
                        onChange={handleChange}
                        onBlur={handleBlur}
                      />
                    </div>

                    <Button type="submit" isLoading={isSubmitting} disabled={!isValid}>
                      Send password reset e-mail
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
                  </>
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
