import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
import {Comment} from './comment';

//import { JSONObject } from '@phosphor/coreutils';


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
  /**
   * Construct a new output widget.
   */
  constructor(options: IRenderMime.IRendererOptions) {
    super();

    //this._mimeType = options.mimeType;
    this._div = document.createElement('div');
    this._div.innerHTML =  '<div id="graphContainer" class="jui" style=" overflow-x: auto; overflow-y: scroll; width:4000px; height:800px;"> </div>';
   // https://cdn.jsdelivr.net/npm/jui@2.0.3/dist/ui.js
   // https://cdn.jsdelivr.net/npm/jui-core@2.0.4/dist/core.min.js

    let comment = new Comment("a");
    let comment_node = comment.node;

    this._div.appendChild(comment_node);
    this.node.appendChild(this._div);




    this.addClass(CLASS_NAME);
  }

  /**
   * Render dd into this widget's node.
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {

    //let data = model.data[this._mimeType] as JSONObject


    //   <div id="graphContainer" style=" overflow-x: auto; overflow-y: scroll; height:800px; width:4000px;"> </div>


    /*
    let node = document.createElement('div');
    node.innerHTML =  '<div id="graphContainer" style=" overflow-x: auto; overflow-y: scroll; width:4000px;"> </div>';
    */

    /*
    this.canvas  = document.createElement('div');
    this.canvas.innerHTML =  '<div id="graphContainer" style=" overflow-x: auto; overflow-y: scroll; width:4000px;"> </div>';
    this.node.appendChild(this.canvas);
    */

    //this.node.textContent = JSON.stringify(data) + "Yeah it works:"  + this.node.id
    this.node.setAttribute('xyz', 'abc');
    return Promise.resolve();
  }

  //private _mimeType: string;
  private _div: HTMLElement;
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
