import React from 'react';

import InputWithClear from './InputWithClear';
import Checkbox from './Checkbox';

import './MultiSelect.scss';

export default class MultiSelect extends React.Component {
  static defaultProps = {
    options: [], // { id: '...', label: '...', color: '' }
    initialSelectedOptionsIds: [],
    onChangeSelected: null, // function: selectedOptionsIds => {}
    onChangeFilteredSelected: null, // function: filteredSelectedOptionsIds => {}
  };
  state = {
    filterValue: '',
    selectedOptionsIdsSet: new Set(this.props.initialSelectedOptionsIds),
  };

  handleFilterChange = filterValue => {
    this.setState(
      {
        filterValue: filterValue,
      },
      this.callOnChange,
    );
  };

  callOnChange = () => {};

  getFilteredOptionsIdsSet() {
    const { options } = this.props;
    const { filterValue } = this.state;
    if (filterValue === '') {
      const optionsIds = options.map(o => o.id);
      return new Set(optionsIds);
    }

    const filterLowerCase = filterValue.toLowerCase();
    const filteredOptionsIds = options
      .filter(o => o.label.toLowerCase().includes(filterLowerCase))
      .map(o => o.id);
    return new Set(filteredOptionsIds);
  }

  // click on a separate option:
  toggleOptionSelected = optionId => {
    this.setState(oldState => {
      const newSelectedOptionsIdsSet = new Set(oldState.selectedOptionsIdsSet);
      if (oldState.selectedOptionsIdsSet.has(optionId)) {
        newSelectedOptionsIdsSet.delete(optionId);
      } else {
        newSelectedOptionsIdsSet.add(optionId);
      }
      return {
        selectedOptionsIdsSet: newSelectedOptionsIdsSet,
      };
    });
  };

  // select / unselect all:
  selectUnselectAll = () => {
    this.setState(oldState => {
      const { selectedOptionsIdsSet } = oldState;
      const filteredOptionsIdsSet = this.getFilteredOptionsIdsSet();
      const unselectedFilteredOptionsIds = [...filteredOptionsIdsSet].filter(
        optionId => !selectedOptionsIdsSet.has(optionId),
      );
      const allChecked = unselectedFilteredOptionsIds.length === 0;
      const selectAll = !allChecked;

      const newSelectedOptionsIdsSet = new Set(selectedOptionsIdsSet);
      if (selectAll) {
        filteredOptionsIdsSet.forEach(optionId => newSelectedOptionsIdsSet.add(optionId));
      } else {
        filteredOptionsIdsSet.forEach(optionId => newSelectedOptionsIdsSet.delete(optionId));
      }
      return {
        selectedOptionsIdsSet: newSelectedOptionsIdsSet,
      };
    });
  };

  // exchange filtered selected:
  exchange = () => {
    this.setState(oldState => {
      const { selectedOptionsIdsSet } = oldState;
      const filteredOptionsIdsSet = this.getFilteredOptionsIdsSet();

      const newSelectedOptionsIdsSet = new Set(selectedOptionsIdsSet);
      filteredOptionsIdsSet.forEach(optionId => {
        if (selectedOptionsIdsSet.has(optionId)) {
          newSelectedOptionsIdsSet.delete(optionId);
        } else {
          newSelectedOptionsIdsSet.add(optionId);
        }
      });
      return {
        selectedOptionsIdsSet: newSelectedOptionsIdsSet,
      };
    });
  };

  render() {
    const { options, isDarkMode } = this.props;
    const { selectedOptionsIdsSet, filterValue } = this.state;

    const filteredOptionsIdsSet = this.getFilteredOptionsIdsSet();
    const unselectedFilteredOptionsIds = [...filteredOptionsIdsSet].filter(
      optionId => !selectedOptionsIdsSet.has(optionId),
    );
    const allChecked = unselectedFilteredOptionsIds.length === 0;
    const noneChecked = unselectedFilteredOptionsIds.length === filteredOptionsIdsSet.size;
    const someChecked = !allChecked && !noneChecked;

    const filteredOptions = options.filter(o => filteredOptionsIdsSet.has(o.id));
    return (
      <div className="multiselect">
        <div className="filter">
          <InputWithClear value={filterValue} onChange={this.handleFilterChange} />
        </div>

        <div className="header-controls">
          <div className="checkbox-all">
            <Checkbox
              color={isDarkMode ? '#ddd' : '#666'}
              checked={allChecked ? true : noneChecked ? false : null}
              isDarkMode={isDarkMode}
              onChange={this.selectUnselectAll}
            >
              <i className="fa fa-check" />
            </Checkbox>
          </div>

          <div className="exchange" onClick={() => someChecked && this.exchange()}>
            <i className={`fa fa-exchange ${!someChecked ? 'disabled' : ''}`} />
          </div>
        </div>

        {filteredOptions.length === 0 ? (
          <div className="path-filter-noresults">No paths match the filter "{this.state.filter}"</div>
        ) : (
          <div className="options">
            {filteredOptions.map(option => (
              <Checkbox
                key={option.id}
                checked={selectedOptionsIdsSet.has(option.id)}
                value={option.id}
                onChange={this.toggleOptionSelected}
                color={option.color || '#ff6600'}
                isDarkMode={isDarkMode}
              >
                <span className="legend-label">{option.label}</span>
              </Checkbox>
            ))}
          </div>
        )}
      </div>
    );
  }
}
