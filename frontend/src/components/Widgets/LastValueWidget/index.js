import React from 'react';

import isWidget from '../isWidget';

class LastValueWidget extends React.Component {
  render() {
    return (
      <div style={{ backgroundColor: '#ff0000' }}>
        test 123
      </div>
    )
  }
}

export default isWidget(LastValueWidget);