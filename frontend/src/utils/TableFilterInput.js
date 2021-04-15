import React from 'react';

function TableFilterInput({ filter, setFilter }) {
  return (
    <div className="table-filter-input">
      <input
        type="text"
        value={filter}
        onChange={ev => setFilter(ev.target.value)}
        placeholder="Filter table"
      />
      <i className={`fa fa-close ${filter === '' ? 'disabled' : ''}`} onClick={() => setFilter('')} />
    </div>
  );
}

export default TableFilterInput;
