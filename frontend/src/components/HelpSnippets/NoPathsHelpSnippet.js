import React from 'react';
import { withRouter } from 'react-router-dom';
import { PersistentFetcher } from '../../utils/fetch/PersistentFetcher';
import HelpSnippet from './HelpSnippet';

class NoPathsHelpSnippet extends React.Component {
  state = {
    pathsExist: null,
  };

  handlePathsUpdate = json => {
    this.setState({
      pathsExist:
        json.paths_with_trailing && json.paths_with_trailing[''] && json.paths_with_trailing[''].length > 0,
    });
  };

  render() {
    const { pathsExist } = this.state;
    const { accountId } = this.props.match.params;
    return (
      <>
        <PersistentFetcher
          resource={`accounts/${accountId}/paths`}
          queryParams={{
            limit: 10,
            filter: '',
            failover_trailing: 'true',
          }}
          onUpdate={this.handlePathsUpdate}
        />
        {pathsExist !== null && !pathsExist && (
          <HelpSnippet title="No data received yet" className="first-steps">
            <p>There was no data sent to this account by any of the bots yet.</p>
            <p>
              If you are confident that you know the paths, you can still proceed with adding the widget, but
              Grafolean will be unable to guide you through the process. It is recommended that you configure
              bots, entities and sensors first, and come back here later.
            </p>
          </HelpSnippet>
        )}
      </>
    );
  }
}
export default withRouter(NoPathsHelpSnippet);
