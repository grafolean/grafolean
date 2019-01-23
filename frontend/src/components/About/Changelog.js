import changelogJson from '../../CHANGELOG.json';
import moment from 'moment';

import React from 'react';

export default class Changelog extends React.PureComponent {
  render() {
    return (
      <div className="changelog">
        {changelogJson.map(entry => (
          <div className="entry" key={entry.version}>
            <h3>
              {entry.version}{' '}
              <span className="created-at">({moment(entry.created_at).format('YYYY-MM-DD')})</span>
            </h3>
            <pre>{entry.changelog}</pre>
          </div>
        ))}
      </div>
    );
  }
}
