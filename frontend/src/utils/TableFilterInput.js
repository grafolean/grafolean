import React from 'react';

import './TableFilterInput.scss';

function TableFilterInput({ filter, setFilter }) {
  return (
    <div className="table-filter-input">
      <input
        type="text"
        value={filter}
        onChange={ev => setFilter(ev.target.value)}
        placeholder="Filter table"
        size="7" // allows <input> to have smaller width
      />
      <i className={`fa fa-close ${filter === '' ? 'disabled' : ''}`} onClick={() => setFilter('')} />
    </div>
  );
}

export default TableFilterInput;
