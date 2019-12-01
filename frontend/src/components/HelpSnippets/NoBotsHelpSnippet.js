import React from 'react';
import { Link, withRouter } from 'react-router-dom';

import HelpSnippet from './HelpSnippet';

class NoBotsHelpSnippet extends React.PureComponent {
  render() {
    const accountId = this.props.match.params.accountId;
    return (
      <HelpSnippet title="This account doesn't have any bots configured yet">
        <p>
          <b>Bots</b> are external scripts and applications that send values to Grafolean.
        </p>
        <Link className="button green" to={`/accounts/${accountId}/bots-new`}>
          <i className="fa fa-plus" /> Add a bot
        </Link>
      </HelpSnippet>
    );
  }
}

export default withRouter(NoBotsHelpSnippet);
