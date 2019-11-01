// Copyright (c) 2019 datagraph gmbh

/* Layer abstract class implementation w/ concrete variations as per pane alternatives

  Widget
  -> Layer
     -> SparqlLayer
     -> TarqlLayer
  -> LayerPane
     -> SparqlQueryPane
     -> SparqlResultsPane

  Each layer involves an Operation instance and CSS attributes.
  Each is instnatiated by its related operation, which then hands the layer back to the canvas incorporate.
  The presentation is driven by the operation.
  When its state changes, it invokes its layers present operation.
  The layer delegates that to each pane, in turn, which interogates the operation for data to display and
  performs the actual display.
  */

import { JSONObject } from '@phosphor/coreutils';
import { Operation } from './algebra';
import { Widget, DockPanel } from '@phosphor/widgets';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { MessageLoop } from '@phosphor/messaging';
import * as $uuid from './replication/lib/uuid-v1.js';

export class Layer extends Widget {
    id: string;
    operation: Operation;
    panes: Array<LayerPane> = [];
    panel: DockPanel = null;
    mode: string = 'open';
    modeIcon: HTMLElement = null;
    executeIcon: HTMLElement = null;
    _expressionPane: ExpressionPane = null;
    openHeight = "200px";
    openWidth = "300px";
    closedHeight = "20px";
    closedWidth = "155px";
    
    constructor(operation: Operation, options: JSONObject = {}) {
	super({ node:  document.createElement('div') });
	let thisLayer = this;
	let host = <HTMLElement>(<unknown>options.host) || document.body;
	this.createFrame(this.node, options);
	this.operation = operation;
	this.panes = this.createPanes(operation, options);
	this.panel = this.createPanel(this.panes);
	let divs = this.node.getElementsByTagName('div');
	let bodyDiv = divs.item(1);

	host.appendChild(this.node);
	// cannot use Widget.attach as that fails because the layer dom element is not yet in the document
	//Widget.attach(this.panel, bodyDiv);
	//Widget.attach(this.panel, document.body); // does work, but that's not where it belongs
	MessageLoop.sendMessage(this.panel, Widget.Msg.BeforeAttach);
	bodyDiv.appendChild(this.panel.node);
	MessageLoop.sendMessage(this.panel, Widget.Msg.AfterAttach);
	this.modeIcon = this.node.getElementsByTagName('span').item(0).getElementsByTagName('i').item(0);
	this.modeIcon.onclick = function(element) { thisLayer.changeMode(thisLayer.mode); };
	console.log("icon elements: ", this.node.getElementsByTagName('span').item(2).getElementsByTagName('i'));
	this.executeIcon = this.node.getElementsByTagName('span').item(2).getElementsByTagName('i').item(0);
	this.executeIcon.onclick = function(element) {
	    let op = thisLayer.operation;
	    let expression = thisLayer.expression;
	    if (op) {
		if (op.expression != expression) {
		    op.expression = expression;
		}
		op.execute();
	    }
	};
	MessageLoop.postMessage(this, Widget.ResizeMessage.UnknownSize);
	this.update();
	console.log("layer construct panel: ", this.panel);
	this.node.style.resize = 'both';
	this.node.style.overflow = 'auto';
	this.node.draggable = true;
	console.log("layer construct panel style before", this.panel.node.style);
	this.panel.node.style.height = "180px";
	let gutter = <HTMLElement>(this.node.getElementsByClassName('CodeMirror-gutter CodeMirror-linenumbers').item(0));
	gutter.style.width = '10px';
	console.log("layer construct panel style after", this.panel.node.style);
    }
    get expression() : string {
	return ( this._expressionPane.expression );
    }
    
    createFrame(frame: HTMLElement, options: JSONObject) : HTMLElement {
	frame.id =<string> options.id || $uuid.v1();
	frame.title =<string> options.id || "LAYER";
	frame.style.width =<string> options.width || this.openWidth;
	frame.style.height =<string> options.height || this.openHeight;
	frame.style.border = 'solid black 1px';
	frame.style.position = 'absolute';
	frame.style.top =<string> options.top || '10px';
	frame.style.left =<string> options.left || '10px';
	frame.style.display = 'block';
	console.log("frame.style: ", frame.style);
	frame.innerHTML =
      '<div class="head" style="border solid red 1px; height: ' + this.closedHeight + '; font: plain 9pt fixed">' +
      '<span float="left"><a href="#"><i class="dydra-mode-open"></i></a></span>' +
      '<span class="dydra-layer-title">' + frame.title + '</span>' +
      '<span float="right"><a href="#"><i class="dydra-execute-button"></i></a></span>' +
      '<span float="right"><a href="#"><i class="dydra-close-button"></i></a></span>' +
      '</div>' +
      '<div class="body" style="border: solid gray 1px; position: absolute; top: 20px; left: 0px; bottom:20px; right:0px" ></div>' +
      '<div class="foot" style="border: solid black 1px; position: absolute; height: 20px; left: 0px; bottom:0px; right:20px" >status...</div>';
	frame.setAttribute('class', 'window');
	return frame;
    }

    /* collect given panes into a DockPanel */
    createPanel(panes: Array<LayerPane>) : DockPanel {
	var panel = new DockPanel();
	var node = panel.node;
	var left: LayerPane = null;
	var thisLayer = this;
	panes.forEach(function(next) {
	    if (next instanceof ExpressionPane) {
		thisLayer._expressionPane = next;
	    }
	    panel.addWidget(next, {mode: 'tab-after', ref: left});
	    left = next;
	});
	node.style.position = "absolute";
	node.style.top = "0px";
	node.style.left = "0px";
	node.style.bottom = "0px";
	node.style.right = "0px";
	return( panel );
    }

    /* define a default method which create an empty array */
    createPanes(operation: Operation, options: JSONObject) : Array<LayerPane> {
	return ( [ ] );
    }

    changeMode(mode: string) {
	console.log('changeMode: ' + mode);
	switch ( mode ) {
	case 'open':
	    mode = 'closed';
	    this.panel.node.style.display = 'none';
	    this.openHeight = this.node.style.height;
	    this.openWidth = this.node.style.width;
	    this.node.style.height = this.closedHeight;
	    this.node.style.width = this.closedWidth;
	    this.node.style.resize = 'none';
	    this.node.style.overflow = 'hidden';
	    break;
	case 'closed':
	    mode = 'open';
	    this.panel.node.style.display = 'block';
	    this.node.style.height = this.openHeight;
	    this.node.style.width = this.openWidth;
	    this.node.style.resize = 'both';
	    this.node.style.overflow = 'auto';
	    break;
	default:
	    break;
	}
	this.modeIcon.className = 'dydra-mode-' + mode;
	this.mode = mode;
	console.log('changedMode: ' + mode);
	console.log('iconMode: ' + this.modeIcon.className);
    }

    present(operation: Operation = this.operation) {
	this.panes.forEach(function(pane: LayerPane) { pane.present(operation); });
    }
}

export class SparqlLayer extends Layer {
    constructor(operation: Operation, options: JSONObject = {}) {
	super(operation,
	      Object.assign({}, {title: "SPARQL"}, options));
    }
    createPanes(operation: Operation, options: JSONObject) : Array<LayerPane> {
	return ( [ new SparqlQueryPane(operation, options),
		   new SparqlResultsPane(operation, options) ] );
    }
    acceptMediaType() {
	return (this.operation.acceptMediaType);
    }
}

export class LayerPane extends Widget {
    constructor(operation: Operation, options: JSONObject = {}) {
	super({node: document.createElement('div')});
	console.log("LaxerPane.options: ", options);
	this.createNode(this.node, options);
	this.title.label =<string> options.title;
	this.title.closable = false;
    }
    createNode(node: HTMLElement, options: JSONObject): HTMLElement {
//	node.innerHTML = "<span>" + (options.title || "Pane") + "</span>";
	node.style.background = "#a0a0a0";
	return( node );
    }
    present(operation: Operation) {} 
}

/**
 An ExpressionPane indicates that it is the pane which presents the operation's expression.
 It is intended that the layer contain just one Expression pane.
 @extends LayerPane
*/
class ExpressionPane extends LayerPane {
    get expression(): string { return( "" ); }
}

/**
 A SparqlQueryPane presents a SPARQL expression in a CodeMirror editor
 @extends ExpressionPane
*/
export class SparqlQueryPane extends ExpressionPane {
    _editor: CodeMirrorEditor;
    constructor(operation: Operation, options: JSONObject = {}) {
	super(operation, Object.assign({}, {title: 'query'}, options['query']));
    }
    createNode(node: HTMLElement, options: JSONObject) : HTMLElement {
	super.createNode(node, options);
	this.addClass('CodeMirrorWidget');
	this._editor = new CodeMirrorEditor({ host: this.node, model: new CodeEditor.Model()});
	var doc = this._editor.editor.getDoc();
	doc.setValue(<string>options.expression || "select * where {?s ?p ?o} limit 10");
	this._editor.setOption('lineNumbers', true);
	console.log("query pane: ", this);
	return( node );
    }
    present(operation: Operation) {
	var doc = this._editor.editor.getDoc();
	var query = operation.expression;
	doc.setValue(query);
    }
    get expression() {
	return ( this._editor.editor.getDoc().getValue() );
    }
}

export class SparqlResultsPane extends LayerPane {
    constructor(operation: Operation, options: JSONObject = {}) {
	super(operation, Object.assign({}, {title: 'results'}, options['results']));
    }
    createNode(node: HTMLElement, options: JSONObject) : HTMLElement {
	super.createNode(node, options);
	node.innerText =<string> options.text || "";
	console.log("results pane: ", this);
	return( node );
    }
    present(operation: Operation) {
	var text = operation.responseText;
	this.node.innerText = text;
    }
}
    
