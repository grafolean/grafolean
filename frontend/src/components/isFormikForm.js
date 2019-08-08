import React from 'react';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import { fetchAuth, PersistentFetcher } from '../utils/fetch';
import { ROOT_URL, handleFetchErrors } from '../store/actions';
import Loading from './Loading';
import Button from './Button';

import './form.scss';

export const FormError = ({ msg }) => {
  if (typeof msg === 'object' && Object.keys(msg).length === 0) {
    return null;
  }
  // if we get the object, we dive into it and use the first string (non-object actually) value we find:
  let firstStringInMsg = msg;
  while (typeof firstStringInMsg === 'object') {
    firstStringInMsg = firstStringInMsg[Object.keys(firstStringInMsg)[0]];
  }
  return (
    <p>
      <i className="fa fa-exclamation-triangle" /> {firstStringInMsg}
    </p>
  );
};

const isFormikForm = WrappedComponent => {
  const wrappedComponent = class FormikForm extends React.Component {
    static defaultProps = {
      initialFormValues: {},
      resource: null, // if editing an existing resource, set this to address of the resource, otherwise to address where resources can be created
      editing: false,
      afterSubmitRedirectTo: '',
    };
    state = {
      fetchedFormValues: null,
      loading: this.props.editing ? true : false,
      submitted: false,
      warnChangedOnServer: false,
      errorMsg: null,
      afterSubmitUrl: null,
    };

    handleValuesBackendChange = fetchedFormValues => {
      if (!this.state.loading) {
        // oops - someone has changed the record while we are editing it! Let's warn user:
        this.setState({
          warnChangedOnServer: true,
        });
        return;
      }

      delete fetchedFormValues['id']; // server might return an id too, which we don't need
      delete fetchedFormValues['insert_time'];
      delete fetchedFormValues['token'];
      this.setState({
        fetchedFormValues: fetchedFormValues,
        loading: false,
      });
    };

    handleSubmit = async (formValues, { setSubmitting }) => {
      try {
        this.setState({
          errorMsg: null,
        });
        // create new record:
        const responseCreate = await fetchAuth(`${ROOT_URL}/${this.props.resource}`, {
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          method: this.props.editing ? 'PUT' : 'POST',
          body: JSON.stringify(formValues),
        });
        if (!responseCreate.ok) {
          throw await responseCreate.text();
        }
        await handleFetchErrors(responseCreate);
        if (this.props.afterSubmit) {
          const afterSubmitUrl = await this.props.afterSubmit(responseCreate);
          this.setState({ afterSubmitUrl: afterSubmitUrl });
        }
        this.setState({ submitted: true });
      } catch (errorMsg) {
        this.setState({
          errorMsg: errorMsg.toString(),
        });
      } finally {
        setSubmitting(false);
      }
    };

    render() {
      const { editing, resource, afterSubmitRedirectTo, ...passThroughProps } = this.props;
      const {
        fetchedFormValues,
        loading,
        warnChangedOnServer,
        afterSubmitUrl,
        submitted,
        errorMsg,
      } = this.state;

      return (
        <>
          {editing && <PersistentFetcher resource={resource} onUpdate={this.handleValuesBackendChange} />}
          {editing && loading ? (
            <Loading />
          ) : (
            <Formik
              initialValues={editing ? fetchedFormValues : WrappedComponent.DEFAULT_VALUES}
              validate={WrappedComponent.validate}
              onSubmit={this.handleSubmit}
              isInitialValid={editing ? true : false} // we assume that default values are not enough to make form values valid
            >
              {({
                values,
                errors,
                handleChange,
                setFieldValue,
                handleBlur,
                handleSubmit,
                isSubmitting,
                isValid,
              }) =>
                submitted ? (
                  <Redirect to={afterSubmitUrl || afterSubmitRedirectTo || '/'} />
                ) : (
                  <form onSubmit={handleSubmit}>
                    <WrappedComponent
                      {...passThroughProps}
                      values={values}
                      errors={errors}
                      onChange={handleChange}
                      setFieldValue={setFieldValue}
                      onBlur={handleBlur}
                    />
                    {editing && warnChangedOnServer && (
                      <FormError msg="Warning: record has changed on server!" />
                    )}
                    {errorMsg && <FormError msg={errorMsg} />}
                    {!isValid && <FormError msg={errors} />}
                    <Button
                      className={isValid ? 'green' : 'red'}
                      type="submit"
                      isLoading={isSubmitting}
                      disabled={!isValid}
                    >
                      Submit
                    </Button>
                  </form>
                )
              }
            </Formik>
          )}
        </>
      );
    }
  };
  return wrappedComponent;
};

export default isFormikForm;
