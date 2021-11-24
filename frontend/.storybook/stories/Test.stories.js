import React from 'react';
import { storiesOf } from '@storybook/react';

import Button from '../../src/components/Button';

const stories = storiesOf('Button', module);

stories.add('button 1', () => {
  return (
    <div style={{ backgroundColor: '#fafafa', padding: 50, width: 600 }}>
      <div style={{ backgroundColor: '#fff' }}>
        <Button>Test</Button>
      </div>
    </div>
  );
});
