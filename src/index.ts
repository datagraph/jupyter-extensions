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

/**
 * The default mime type for the extension.
 */
const MIME_TYPE = 'd/d';

/**
 * The class name added to the extension.
 */
const CLASS_NAME = 'mimerenderer-dd';

/**
 * A widget for rendering dd.
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
  id: 'dd:plugin',
  rendererFactory,
  rank: 0,
  dataType: 'json',
  fileTypes: [
    {
      name: 'dd',
      mimeTypes: [MIME_TYPE],
      extensions: ['dd']
    }
  ],
  documentWidgetFactoryOptions: {
    name: 'dd',
    primaryFileType: 'dd',
    fileTypes: ['dd'],
    defaultFor: ['dd']
  }
};

export default extension;
