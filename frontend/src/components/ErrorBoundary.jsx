import { Component } from 'react';
import { Result, Button } from 'antd';

// Without this, an uncaught render error anywhere in a page unmounts the entire
// React tree, leaving a blank white screen with no way to recover except a hard reload.
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Unhandled error in page render', error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <Result
          status="error"
          title="Something went wrong"
          subTitle={this.state.error.message || 'This page hit an unexpected error.'}
          extra={[
            <Button key="retry" type="primary" onClick={() => this.setState({ error: null })}>Try Again</Button>,
            <Button key="home" onClick={() => { this.setState({ error: null }); window.location.href = '/'; }}>Go to Dashboard</Button>,
          ]}
        />
      );
    }
    return this.props.children;
  }
}
