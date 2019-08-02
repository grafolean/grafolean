import React from 'react';
import { Redirect } from 'react-router-dom';
import { Formik } from 'formik';

import { fetchAuth, PersistentFetcher } from '../utils/fetch';
import { ROOT_URL, handleFetchErrors } from '../store/actions';
import Loading from './Loading';
import Button from './Button';

import './form.scss';

export const FormErrorWarning = ({ msg }) => (
  <p>
    <i className="fa fa-exclamation-triangle" /> {msg}
  </p>
);

const isFormikForm = WrappedComponent => {
  const wrappedComponent = class FormikForm extends React.Component {
    static defaultProps = {
      initialFormValues: {},
      resource: null, // if editing an existing resource, set this to address of the resource, otherwise to address where resources can be created
      editing: false,
      afterSubmitRedirectTo: '',
    };
    state = {
      formValues: this.props.initialFormValues,
      loading: this.props.editing ? true : false,
      submitted: false,
      warnChangedOnServer: false,
      errorMsg: null,
      afterSubmitUrl: null,
    };

    handleValuesBackendChange = formValues => {
      if (!this.state.loading) {
        // oops - someone has changed the record while we are editing it! Let's warn user:
        this.setState({
          warnChangedOnServer: true,
        });
        return;
      }

      delete formValues['id']; // server might return an id too, which we don't need
      delete formValues['insert_time'];
      delete formValues['token'];
      this.setState({
        formValues: formValues,
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
      const { formValues, loading, warnChangedOnServer, afterSubmitUrl, submitted, errorMsg } = this.state;

      return (
        <>
          {editing && <PersistentFetcher resource={resource} onUpdate={this.handleValuesBackendChange} />}
          {editing && loading ? (
            <Loading />
          ) : (
            <Formik
              initialValues={WrappedComponent.DEFAULT_VALUES}
              validate={WrappedComponent.validate}
              onSubmit={this.handleSubmit}
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
                      onChange={handleChange}
                      setFieldValue={setFieldValue}
                      onBlur={handleBlur}
                    />
                    {editing && warnChangedOnServer && (
                      <FormErrorWarning msg="Warning: record has changed on server!" />
                    )}
                    {errorMsg && <FormErrorWarning msg={errorMsg} />}
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
