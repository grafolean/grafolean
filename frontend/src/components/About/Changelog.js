import changelogJson from '../../CHANGELOG.json';

import React from 'react';

export default class Changelog extends React.PureComponent {
  render() {
    return (
      <div>
        {changelogJson.map(entry => (
          <div className="entry">
            <h3>{entry.version}</h3>
            <pre>{entry.changelog}</pre>
          </div>
        ))}
      </div>
    );
  }
}
