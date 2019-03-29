import React from 'react';

import PersistentFetcher from '../../utils/fetch';

import Loading from '../Loading';

export default class UserPermissions extends React.PureComponent {
  static defaultProps = {
    userId: null,
  };
  state = {
    loading: true,
    user: null,
  };

  onUserUpdate = user => {
    this.setState({
      user: user,
      loading: false,
    });
  };

  renderInner() {
    const { user, loading } = this.state;
    if (loading) {
      return <Loading />;
    }
    if (!user) {
      return <p>Oops, something went wrong.</p>;
    }
    return (
      <>
        <table className="list">
          <tr>
            <th>Resource prefix</th>
            <th>Access</th>
          </tr>
          {user.permissions &&
            user.permissions.map(p => (
              <tr>
                <td>{p.resource_prefix === null ? '/' : p.resource_prefix}</td>
                <td>{p.methods === null ? '*' : p.methods.join(', ')}</td>
              </tr>
            ))}
        </table>
      </>
    );
  }

  render() {
    const { userId } = this.props.match.params;
    return (
      <div className="user-permissions frame">
        <PersistentFetcher resource={`admin/persons/${userId}`} onUpdate={this.onUserUpdate} />
        {this.renderInner()}
      </div>
    );
  }
}
