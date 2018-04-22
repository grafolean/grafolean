import React from 'react';

import store from '../../store';
import { submitNewChart } from '../../store/actions';

import Loading from '../Loading';
import Button from '../Button';

export default class ChartForm extends React.Component {

  constructor(props) {
    super(props);
    this.state = {
      name: '',
      // it is important that we add an empty field to the bottom right away - otherwise we have
      // problems with losing focus when adding a new empty input at the bottom:
      pathFilters: [{
        id: 0,
        value: '',
      }],
      pathFiltersNextId: 1,
    };

    this.handleFormFieldChange = this.handleFormFieldChange.bind(this);
    this.handleFormFieldPathFilterChange = this.handleFormFieldPathFilterChange.bind(this);
    this.handleSubmit = this.handleSubmit.bind(this);
  }

  handleFormFieldChange(event) {
    this.setState({[event.target.name]: event.target.value});
  }

  handleFormFieldPathFilterChange(event) {
    let filterId = parseInt(event.target.name.substr(3), 10);  // we use event.target.name to pass filter id to this function ("pf-<id>")
    let value = event.target.value;

    this.setState((prevState) => {
      let pathFiltersNew = prevState.pathFilters.map((item) => {
        if (item.id === filterId)
          return {...item, value: value}
        else
          return item;
      })

      let newState = {...prevState, pathFilters: pathFiltersNew}

      if (prevState.pathFilters[prevState.pathFilters.length - 1].id === filterId) {
        // we were changing the last input, so let's add another one:
        newState.pathFilters.push({id: prevState.pathFiltersNextId, value: ""})
        newState.pathFiltersNextId++;
      }

      return newState;
    })

  }

  handleSubmit(event) {
    store.dispatch(submitNewChart(this.props.formid, this.props.dashboardSlug, this.state.name, this.state.pathFilters))
    event.preventDefault();
  }

  render() {
    return (
      <div>
        <form id={this.props.formid} onSubmit={this.handleSubmit}>
          <label>
            Chart title:
            <input type="text" name="name" value={this.state.name} onChange={this.handleFormFieldChange} />
          </label>
          <label>
            Path filters:
            <ul>
              {this.state.pathFilters.map((item) =>
                  <li key={`pf-${item.id}`}>
                    {`pf-${item.id}`}:
                    <input type="text" name={`pf-${item.id}`} value={item.value} onChange={this.handleFormFieldPathFilterChange} />
                  </li>
              )}
            </ul>
          </label>
          {(this.props.loading)?(
            <Loading />
          ):(
            <input type="submit" value="Submit" />
          )}

        </form>
      </div>
    )
  }
};

