import React from 'react';
import moment from 'moment';
import { stringify } from 'qs';

import { ROOT_URL, handleFetchErrors } from '../../../store/actions';

import isWidget from '../isWidget';
import { fetchAuth } from '../../../utils/fetch';

class LastValueWidget extends React.Component {

  fetchAbortController = null;

  constructor(props) {
    super(props);
    this.state = {
      loading: true,
      fetchingError: false,
      lastValue: null,
      lastValueTime: null,
    }
    this.fetchData();
  }

  fetchData = () => {
    if (this.fetchAbortController !== null) {
      return;  // fetch is already in progress
    }
    this.fetchAbortController = new window.AbortController();
    const query_params = {
      p: this.props.content.path,
      a: 'no',
      sort: 'desc',
      limit: 1,
    };
    fetchAuth(`${ROOT_URL}/values/?${stringify(query_params)}`, { signal: this.fetchAbortController.signal })
      .then(handleFetchErrors)
      .then(response => response.json())
      .then(json => {
        this.setState({
          lastValue: json.paths[this.props.content.path].data[0].v,
          lastValueTime: json.paths[this.props.content.path].data[0].t,
          loading: false,
        });
      })
      .catch(errorMsg => {
        this.setState({
          fetchingError: true,
          loading: false,
        });
      })
      .then(() => {
        this.fetchPathsAbortController = null;
      });
  }

  render() {
    return (
      <div className="last-value">
        {this.state.lastValue} (at {moment(this.state.lastValueTime * 1000).format('YYYY-MM-DD HH:mm:ss')})
      </div>
    )
  }
}

export default isWidget(LastValueWidget);