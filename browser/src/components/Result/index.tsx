import * as React from 'react';
import { richestMimetype, transforms } from 'transformime-react';
const Immutable: any = require('immutable');
interface ResultListProps {
  result: NotebookOutput;
}

interface ResultListState {
  /* empty */
}

class ResultList extends React.Component<ResultListProps, ResultListState> {
  render() {
    // Jupyter style MIME bundle
    const bundle = new Immutable.Map(this.props.result.value);
    // Find out which mimetype is the richest
    const mimetype: string = richestMimetype(bundle);
    // Get the matching React.Component for that mimetype
    let Transform = transforms.get(mimetype);

    // If dealing with images, set the background color to white
    let style = {};
    if (mimetype.startsWith('image')) {
      style = { backgroundColor: 'white' };
    }

    // Create a React element
    return <div style={style}><Transform data={bundle.get(mimetype)} /></div>;

  }
}

export default ResultList;
