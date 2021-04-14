import { useState } from 'react';

// defaultSortOrder: array of 2-element arrays (first element key, second direction [boolean - true = asc])
export const useTableSort = (defaultSortOrder = []) => {
  const [sortOrder, setSortOrder] = useState([]);

  const applySortFunc = key => {
    if (sortOrder.length === 0) {
      setSortOrder([[key, true]]);
      return;
    }
    const [firstKey, firstDirection] = sortOrder.shift();
    if (key === firstKey) {
      setSortOrder([[key, !firstDirection], ...sortOrder]);
    } else {
      setSortOrder([[key, true], [firstKey, firstDirection], ...sortOrder.filter(so => so[0] !== key)]);
    }
  };

  const sortCompareFunc = (row1, row2) => {
    const sortOrderWithDefaults = [...sortOrder, ...defaultSortOrder];
    for (let [sortKey, sortDirection] of sortOrderWithDefaults) {
      if (row1[sortKey] < row2[sortKey]) {
        return sortDirection ? -1 : 1;
      } else if (row1[sortKey] > row2[sortKey]) {
        return sortDirection ? 1 : -1;
      } else {
        continue;
      }
    }
    return 0;
  };

  const firstSortKey = sortOrder.length === 0 ? null : sortOrder[0][0];
  const firstSortDirection = sortOrder.length === 0 ? null : sortOrder[0][1] ? 'asc' : 'desc';

  return [firstSortKey, firstSortDirection, applySortFunc, sortCompareFunc];
};
