import React from 'react';
import { connect } from 'react-redux';

import { doLogout } from '../../store/helpers';

import Button from '../Button';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Loading from '../Loading';
import EditableLabel from '../EditableLabel';
import { fetchAuth, havePermission } from '../../utils/fetch';
import { handleFetchErrors, ROOT_URL } from '../../store/actions';
import LinkButton from '../LinkButton/LinkButton';

class Profile extends React.Component {
  state = {
    person: null,
  };

  handlePersonUpdate = json => {
    this.setState({
      person: json,
    });
  };

  changeName = newValue => {
    this.updatePerson({ name: newValue });
  };
  changeUsername = newValue => {
    this.updatePerson({ username: newValue });
  };
  changeEmail = newValue => {
    this.updatePerson({ email: newValue });
  };

  updatePerson = changes => {
    const { person } = this.state;
    const { user } = this.props;
    const personData = {
      name: person.name,
      username: person.username,
      email: person.email,
      ...changes,
    };
    fetchAuth(`${ROOT_URL}/persons/${user.user_id}`, {
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      method: 'PUT',
      body: JSON.stringify(personData),
    })
      .then(handleFetchErrors)
      .catch(err => console.error(err));
  };

  render() {
    const { person } = this.state;
    const { user } = this.props;
    const canChangePassword = havePermission(`persons/${user.user_id}/password`, 'POST', user.permissions);
    const canChangePerson = havePermission(`persons/${user.user_id}`, 'PUT', user.permissions);
    return (
      <div>
        <PersistentFetcher resource={`persons/${user.user_id}`} onUpdate={this.handlePersonUpdate} />
        {person === null ? (
          <Loading />
        ) : (
          <>
            <p>User ID: {person.user_id}</p>
            <p>
              Name:{' '}
              <EditableLabel label={person.name} onChange={this.changeName} isEditable={canChangePerson} />
            </p>
            <p>
              Username:{' '}
              <EditableLabel
                label={person.username}
                onChange={this.changeUsername}
                isEditable={canChangePerson}
              />
            </p>
            <p>
              E-mail:{' '}
              <EditableLabel label={person.email} onChange={this.changeEmail} isEditable={canChangePerson} />
            </p>
            <hr />
            <LinkButton to="/profile/change-password" disabled={!canChangePassword}>
              <i className="fa fa-fw fa-key" /> Change password
            </LinkButton>
            <hr />
            <Button onClick={doLogout}>
              <i className="fa fa-fw fa-power-off" /> Logout
            </Button>
          </>
        )}
      </div>
    );
  }
}

const mapStoreToProps = store => ({
  user: store.user,
});
export default connect(mapStoreToProps)(Profile);
