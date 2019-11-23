import React from 'react';

import { doLogout } from '../../store/helpers';

import Button from '../Button';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import Loading from '../Loading';

class Profile extends React.Component {
  state = {
    person: null,
  };

  handlePersonUpdate = json => {
    this.setState({
      person: json,
    });
  };

  render() {
    const { person } = this.state;
    return (
      <div>
        <PersistentFetcher resource={`profile/person`} onUpdate={this.handlePersonUpdate} />
        {person === null ? (
          <Loading />
        ) : (
          <>
            <p>User ID: {person.user_id}</p>
            <p>Name: {person.name}</p>
            <p>Username: {person.username}</p>
            <p>E-mail: {person.email}</p>
            <Button onClick={doLogout}>
              <i className="fa fa-power-off" /> Logout
            </Button>
          </>
        )}
      </div>
    );
  }
}

export default Profile;
