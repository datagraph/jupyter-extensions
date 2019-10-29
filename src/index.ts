import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
// exists as style/index.css import './canvas.css';
//import {Comment} from './comment';

// import { GSP, SPARQL } from './replication/rdf-client';
//
import { GSP, SPARQL } from './replication/rdf-client';
console.log(GSP);
console.log(SPARQL);
import { JSONValue } from '@phosphor/coreutils';
import { FilterOperation } from './algebra';
import { SparqlLayer } from './layer.js';

import { JSONObject } from '@phosphor/coreutils';
import { Widget } from '@phosphor/widgets';

//import { DockPanel } from '@phosphor/widgets';
//    import '@phosphor/dragdrop/style/index.css!';
//    import '@phosphor/widgets/style/index.css!';
//    import 'phosphor-float-area/style/index.css!';
//    import { FloatArea } from 'phosphor-float-area';


/**
 * The default mime type for the extension.
 */
const MIME_TYPE = 'application/sparql-query+json';

/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-sparql-query-json';

/**
 * A widget for rendering application/sparql-query+json.
 */
export class OutputWidget extends Widget implements IRenderMime.IRenderer {
    private mimeType: string;
    private canvas: HTMLElement;
    private graph: HTMLElement;
  /**
   * Construct a new output widget.
   * modeled after the PDF mime renderer example ( https://github.com/jupyterlab/jupyterlab/blob/master/packages/pdf-extension/src/index.ts )
   */
  constructor(options: IRenderMime.IRendererOptions) {
      super();
      let thisWidget = this;
      console.log("canvas.node: ", this.node);
      this.addClass(CLASS_NAME);
      this.mimeType = options.mimeType;
      const canvas  = document.createElement('component');
      canvas.style.width = '600px';
      canvas.style.height = '400px';
      this.canvas = canvas;
      this.node.appendChild(this.canvas);
      new Promise((resolve) => {
	  const graph = document.createElement('div');
	  thisWidget.graph = graph;
	  graph.id = 'graphContainer';
	  graph.className = 'jui';
	  graph.style.overflowX = 'auto';
	  graph.style.overflowY = 'scroll';
	  graph.style.width = '100%';
	  graph.style.height = '100%';
	  canvas.appendChild(graph);
	  console.log('Canvas node: ', thisWidget.node);
	  console.log('Canvas canvas: ', thisWidget.canvas);
	  console.log('Canvas graph: ', thisWidget.graph);
	  console.log("is node attached? ", document.body.contains(thisWidget.node));
	  console.log("is canvas attached? ", document.body.contains(thisWidget.canvas));
	  console.log("is graph attached? ", document.body.contains(thisWidget.graph));
          resolve (new SparqlLayer(new FilterOperation(), {host: <JSONValue>(<unknown>thisWidget.graph)}));
      });
  }

  /**
   * Render dd into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {

      let data = model.data[this.mimeType] as JSONObject;
      console.log("renderModel.data: ", data);
      console.log("is node attached? ", document.body.contains(this.node));
      console.log("is canvas attached? ", document.body.contains(this.canvas));
      
      return Promise.resolve();
  }

}

/**
 * A mime renderer factory for dd data.
 */
export const rendererFactory: IRenderMime.IRendererFactory = {
  safe: true,
  mimeTypes: [MIME_TYPE],
  createRenderer: options => new OutputWidget(options)
};

/**
 * Extension definition.
 */
const extension: IRenderMime.IExtension = {
  id: 'sparql-query-json:plugin',
  rendererFactory,
  rank: 0,
  dataType: 'json',
  fileTypes: [
    {
      name: 'sparql-query-json',
      mimeTypes: [MIME_TYPE],
      extensions: ['rqj']
    }
  ],
  documentWidgetFactoryOptions: {
    name: 'sparql-query-json',
    primaryFileType: 'rqj',
    fileTypes: ['rqj'],
    defaultFor: ['rqj']
  }
};

export default extension;
