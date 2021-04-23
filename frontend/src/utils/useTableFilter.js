import { useState } from 'react';

export const useTableFilter = filterableFields => {
  const [tableFilter, setTableFilter] = useState('');

  const filterTableFunc = row => {
    const tableFilterLowercase = tableFilter.toLowerCase();
    for (let key of filterableFields) {
      if (row[key].toLowerCase().includes(tableFilterLowercase)) {
        return true;
      }
    }
    return false;
  };

  return [filterTableFunc, tableFilter, setTableFilter];
};
