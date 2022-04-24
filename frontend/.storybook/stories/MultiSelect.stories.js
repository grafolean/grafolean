import React from 'react';
import { storiesOf } from '@storybook/react';

import MultiSelect from '../../src/components/MultiSelect/MultiSelect';

const options = [
  { id: '1', label: 'Option 1 aa', color: '#ff0000' },
  { id: '2', label: 'Option 2 aaa', color: '#00ff00' },
  { id: '3', label: 'Option 3 aaaa', color: '#0000ff' },
  { id: '4', label: 'Option 4 aaaa bb', color: '#fff000' },
  { id: '5', label: 'Option 5 aaaa bbb ', color: '#ff00f0' },
  { id: '6', label: 'Option 6 aaaa bbbb', color: '#0f00ff' },
];

const stories = storiesOf('MultiSelect', module);

stories.add('multiselect', () => {
  return (
    <div style={{ backgroundColor: '#fafafa', padding: 50, width: 600 }}>
      <div style={{ backgroundColor: '#fff' }}>
        <MultiSelect
          options={options}
          initialSelectedOptionsIds={['2', '4', '6']}
          onChangeSelected={selectedOptionsIds => console.log({ selectedOptionsIds })}
          onChangeFilteredSelected={selectedFilteredOptionsIds => console.log({ selectedFilteredOptionsIds })}
        />
      </div>
    </div>
  );
});

stories.add('multiselect dark mode', () => {
  return (
    <div style={{ backgroundColor: '#777', padding: 50, width: 600 }} className="dark-mode">
      <div style={{ backgroundColor: '#333' }}>
        <MultiSelect
          options={options}
          initialSelectedOptionsIds={['2', '4', '6']}
          onChangeSelected={selectedOptionsIds => console.log({ selectedOptionsIds })}
          onChangeFilteredSelected={selectedFilteredOptionsIds => console.log({ selectedFilteredOptionsIds })}
          isDarkMode={true}
        />
      </div>
    </div>
  );
});
