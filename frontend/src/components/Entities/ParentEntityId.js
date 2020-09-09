import React from 'react';
import { withRouter, Link } from 'react-router-dom';

class ParentEntityId extends React.Component {
  render() {
    const { parent } = this.props;
    const accountId = this.props.match.params.accountId;

    if (!parent) {
      return null;
    }
    return (
      <div>
        <Link className="button green" to={`/accounts/${accountId}/entities/view/${parent}`}>
          <i className="fa fa-arrow-circle-o-up" /> parent
        </Link>
      </div>
    );
  }
}
export default withRouter(ParentEntityId);
