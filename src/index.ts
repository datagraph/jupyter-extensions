import { IRenderMime } from '@jupyterlab/rendermime-interfaces';
// exists as style/index.css import './canvas.css';
//import {Comment} from './comment';

// import { GSP, SPARQL } from './replication/rdf-client';
//
import { SPARQL } from './replication/rdf-client';
import { JSONValue } from '@phosphor/coreutils';
import { SparqlOperation, ConnectionOperation } from './algebra';
import { SparqlOperationView } from './view.js';
import { MetadataLayer } from './layer.js';
import { MessageLoop } from '@phosphor/messaging';
import { JSONObject } from '@phosphor/coreutils';
import { CommandRegistry } from '@phosphor/commands';
import { Menu, MenuBar, Widget } from '@phosphor/widgets';
//import * as $uuid from './replication/lib/uuid-v1.js';
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
    canvas: HTMLElement;
    menuBar: MenuBar;
    private graph: HTMLElement;
    connectionOperation : ConnectionOperation = null;
  /**
   * Construct a new output widget.
   * modeled after the PDF mime renderer example ( https://github.com/jupyterlab/jupyterlab/blob/master/packages/pdf-extension/src/index.ts )
   */
    constructor(options: IRenderMime.IRendererOptions) {
	super();
	let thisWidget = this;
	
	console.log("canvas.node: ", this.node, options);
	this.addClass(CLASS_NAME);
	this.mimeType = options.mimeType;
	this.node.style.resize = 'both';
	const canvas  = this.node;
	this.canvas = canvas;
	canvas.style.width = '600px';
	canvas.style.height = '400px';
	canvas.style.border = 'solid black 3px';
	new Promise((resolve) => {
	    const graph = document.createElement('div');
	    const menuBar = thisWidget.createMenuBar();
	    thisWidget.menuBar = menuBar;
	    thisWidget.graph = graph;

	    MessageLoop.sendMessage(menuBar, Widget.Msg.BeforeAttach);
	    canvas.appendChild(menuBar.node);
	    MessageLoop.sendMessage(menuBar, Widget.Msg.AfterAttach);

	    graph.id = 'graphContainer';
	    graph.className = 'jui';
	    graph.style.position = 'absolute';
	    graph.style.overflowX = 'auto';
	    graph.style.overflowY = 'scroll';
	    graph.style.top = "border: solid blie 1px";
	    graph.style.left = "0px";
	    graph.style.top = "30px";
	    graph.style.width = '100%';
	    graph.style.bottom = '0px';
	    // console.log("graph style: ", graph.style);
	    canvas.appendChild(graph);
	    resolve(thisWidget);
	});
    }

    private createMenuBar(): MenuBar {
	let fileCommands = new CommandRegistry();
	fileCommands.addCommand('connect', {
	    label: 'Connect', execute: function() { console.log('connect...'); } });
	let fileMenu = new Menu({ commands: fileCommands });
	fileMenu.title.label = 'File';
	fileMenu.addItem({command: 'connect'});

	let createMenu = new Menu({ commands: new CommandRegistry() });
	createMenu.title.label = 'Create';

	let addMenu = new Menu({ commands: new CommandRegistry() });
	addMenu.title.label = 'Add';

	let operateCommands =  new CommandRegistry();
	fileCommands.addCommand('filter', {
	    label: 'Filter', execute: function() { console.log('filter...'); } });
	let operateMenu = new Menu({ commands: operateCommands });
	operateMenu.title.label = 'Operate';
	fileMenu.addItem({command: 'filter'});

	let viewCommands =  new CommandRegistry();
	viewCommands.addCommand('test-it', {
	    label: 'Test It', execute: function () { console.log('testing'); } });
	let viewMenu = new Menu({commands: viewCommands});
	viewMenu.title.label = 'View';

	viewMenu.addItem({command: 'test-it'});

	let shareMenu = new Menu({ commands: new CommandRegistry() });
	shareMenu.title.label = 'Share';

	let menubar = new MenuBar();
	menubar.addMenu(fileMenu);
	menubar.addMenu(createMenu);
	menubar.addMenu(addMenu);
	menubar.addMenu(operateMenu);
	menubar.addMenu(viewMenu);
	menubar.addMenu(shareMenu);

	return menubar;
    }

  /**
   * Render sparql-query into this widget's node.
   * - retrieve the text from the given location
   * - delegate to the Operation method to deconstruct it into a sequence of related operions
   * - construct and display the linked layers
   */
  renderModel(model: IRenderMime.IMimeModel): Promise<void> {
      console.log("renderModel this: ", this);
      console.log("renderModel.model: ", model);
      // console.log("renderModel.model.data: ", model.data);
      let data = model.data[this.mimeType] as JSONObject;
      console.log("renderModel.data: ", data);
      let location : string =<string> data.location;
      let authentication : string =<string> data.authentication;
      let view = data.view;
      this.connectionOperation = new ConnectionOperation({location: location});
      
      var thisCanvas = this;
      let handleQueryResponse = function(response: Response) : Response {
	  // console.log("Canvas query response: ", response);
	  response.text().then(handleResponseText);
	  return( response );
      }
      let handleResponseText = function(text: string) : SparqlOperationView {
	  var operation : SparqlOperation = SparqlOperation.translateSparqlExpression(text)
	  if (operation) {
	      return ( new SparqlOperationView(operation, {host: <JSONValue>(<unknown>thisCanvas.graph)}) );

	      /*operation.mapSourceTree(function(operation: SparqlOperation, location: JSONObject) {
		  var position = (100 + (count * 20)) + "px";
		  count ++;
		  return( new SparqlLayer(operation,
					  {host: <JSONValue>(<unknown>thisWidget.graph),
					   id: $uuid.v1(),
					   top: position, left: position,
					   //!!! this is backwards
					   mode: 'open'}) );
	      });*/
	  }
	  return( null );
      };
      new MetadataLayer(new ConnectionOperation({location: "https://nl4.dydra.com/james/test"}),
			{host: <JSONValue>(<unknown>this.graph)});
      var requestString = location + '/' + view;
      SPARQL.get(requestString, "", {authentication: authentication, Accept: 'application/sparql-query'}).
	  then(handleQueryResponse);
      console.log("renderModel: retrieving text: ");
      return Promise.resolve();
  }

}


/**
 * A mime renderer factory for sparql-query+json data.
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
