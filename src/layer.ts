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

var layers = new Array();
import { JSONObject } from '@phosphor/coreutils';
import { Operation, SparqlOperation } from './algebra';
import { Widget, DockPanel } from '@phosphor/widgets';
import { CodeMirrorEditor } from '@jupyterlab/codemirror';
import { CodeEditor } from '@jupyterlab/codeeditor';
import { MessageLoop } from '@phosphor/messaging';
import * as $uuid from './replication/lib/uuid-v1.js';

export interface SparqlLayerContext {
    parentLayer: SparqlLayer;
    destinationLayer: SparqlLayer;
}
export interface WidgetGeometry {
    left: number;
    top: number;
    width: number;
    height: number;
}

export class Layer extends Widget {
    id: string;
    operation: Operation;
    panes: Array<LayerPane> = [];
    panel: DockPanel = null;
    /* mode is initially null in order to cause an initial resize. */
    _mode: string = null;
    modeIcon: HTMLElement = null;
    titleItem: HTMLElement = null;
    closeIcon: HTMLElement = null;
    executeIcon: HTMLElement = null;
    header: HTMLElement = null;
    body: HTMLElement = null;
    footer: HTMLElement = null;
    _expressionPane: ExpressionPane = null;
    _left: number = 0;
    _top: number = 0;
    _width: number = 0;
    _height: number = 0;
    openHeight = 200;
    openWidth = 300;
    closedHeight = 20;
    closedWidth = 172;
    downEvent : DragEvent = null;
    upEvent : DragEvent = null;
    moveEvent : MouseEvent = null;
    
    constructor(operation: Operation, options: JSONObject = {}) {
	super({ node:  document.createElement('div') });
	let host = <HTMLElement>(<unknown>options.host) ;//|| document.body;
	if (host) {
	    host.appendChild(this.node);
	    console.log("Layer.appended: ", this, host);
	}
	this.operation = operation;
	this.id = operation.id || <string>options.id || $uuid.v1();
	this.createFrame(this.node, operation, options);
	this.node.style.resize = 'both';
	this.node.style.overflow = 'auto';
	this.node.draggable = true;
	this.openWidth = <number> options.width || this.openWidth;
	this.openHeight = <number> options.height || this.openHeight;
	// setting mode will resize
	console.log("in construct", this, this.modeIcon, this.executeIcon);
	this.mode = <string>options.mode || 'open';
	//console.log("layer.node.style: ", this.node.style);
	MessageLoop.postMessage(this, Widget.ResizeMessage.UnknownSize);
	this.update();
    }

    static createElement(gi: string, attributes: JSONObject = {}) : HTMLElement {
	var element = document.createElement(gi);
	Object.keys(attributes).forEach(function(key) { element.setAttribute(key, (<string>attributes[key])); });
	return( element );
    }

    get expression() : string {
	var pane = this._expressionPane;
	return ( pane ? pane.expression : null);
    }
    move(left: number, top: number) {
	if (this._left != left || this._top != top) {
	    this._left = left;
	    this.node.style.left = Math.floor(left)+'px';
	    this._top = top;
	    this.node.style.top = Math.floor(top)+'px';
	    MessageLoop.sendMessage(this, Widget.ResizeMessage.UnknownSize);
	    console.log("move: ", this.operation.operator, {left: left, top: top});
	}
    }
    resize(width: number, height:number) {
	if (this._width != width || this._height != height) {
	    this._width = width;
	    this.node.style.width = Math.floor(width)+'px';
	    this._height = height;
	    this.node.style.height = Math.floor(height)+'px';
	    MessageLoop.sendMessage(this, Widget.ResizeMessage.UnknownSize);
	}
    }
    geometry() : WidgetGeometry {
	return( {left: this._left, top: this._top, width: this._width, height: this._height} );
    }
    /*
      create the layers html comprising the header, body and footer.
      delegate each to a respective function.
      the outer frame uses the node which was supplied tot he Widget constructor, while
      the constituent elements create their own elements.
    */
    createFrame(frame: HTMLElement, operation: Operation, options: JSONObject) : HTMLElement {
	let thisLayer = this;
	frame.id = this.id;
	frame.title = operation.operator;
	frame.style.border = 'solid black 1px';
	frame.style.position = 'absolute';
	frame.style.display = 'block';
	this.header = this.createHeader(operation, options);
	this.body = this.createBody(operation, options);
	this.footer = this.createFooter(operation, options);
	frame.appendChild(this.header)
	frame.appendChild(this.body);
	frame.appendChild(this.footer);
	frame.setAttribute('class', 'window');
	if( this.modeIcon ) {
	    this.modeIcon.onclick = function(element) { thisLayer.changeMode(); };
	}
	if (this.executeIcon) {
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
	}
	frame.onmousedown = function(event: DragEvent) {
	    // console.log("down:", event);
	    thisLayer.downEvent = event;
	}
	frame.onmouseup = function(event: DragEvent) {
	    // console.log("up", event);
	    thisLayer.upEvent = event;
	    // console.log('up: ', thisLayer.downEvent, thisLayer.upEvent);
	}
	frame.onmousemove = function(event) {
	    // console.log("move:", event);
	    thisLayer.moveEvent = event;
	}
	frame.ondragend = function(dragevent) {
	    // console.log('events: ', thisLayer.downEvent, thisLayer.moveEvent, dragevent);
	    let offsetX =  thisLayer.moveEvent.clientX - thisLayer.downEvent.clientX;
	    let offsetY =  thisLayer.moveEvent.clientY - thisLayer.downEvent.clientY;
	    let geometry = thisLayer.geometry();
	    let left = geometry.left;
	    let top = geometry.top;
	    left = Math.max((left + offsetX), 0);
	    top = Math.max((top + offsetY), 20);
	    thisLayer.move(left, top);
	    // console.log("offset: ", offsetX, offsetY);
	    // console.log("frame location: ", frame.style.left, frame.style.top);
	}

	// cannot use Widget.attach as that fails because the layer dom element is not yet in the document
	//Widget.attach(this.panel, bodyDiv);
	//Widget.attach(this.panel, document.body); // does work, but that's not where it belongs
	this.panes = this.createPanes(operation, options);
	this.panel = this.createPanel(this.panes);
	// console.log("layer construct panel style before", this.panel.node.style);
	this.panel.node.style.height = "180px";
	MessageLoop.sendMessage(this.panel, Widget.Msg.BeforeAttach);
	this.body.appendChild(this.panel.node);
	MessageLoop.sendMessage(this.panel, Widget.Msg.AfterAttach);
	return( frame );
    }

    createHeader (operation: Operation, options: JSONObject) : HTMLElement {
	var header = Layer.createElement('div', {class: "head",
						 style: 'border solid red 1px; height: ' + this.closedHeight + '; font: plain 9pt fixed'});
	this.modeIcon =Layer.createElement('div', {class: "dydra-mode-open dydra-mode-button",
						 style: 'position: absolute; top: 0px; left: 0px; width: 16px; height: ' + this.closedHeight + '; font: plain 9pt fixed'});
	this.titleItem = Layer.createElement('span', {class: "dydra-layer-title",
						      style: 'position: absolute; top: 1px; left: 22px;'});
	this.titleItem.innerText = operation.operator;
	
	this.executeIcon =Layer.createElement('div', {class: "dydra-execute-button",
						      style: 'position: absolute; top: 0px; padding-top: 4px; right: 16px; width: 16px; height: 16px; display: block;'});
	this.closeIcon =Layer.createElement('div', {class: "dydra-close-button",
						 style: 'position: absolute; top: 0px; right: 0px; width: 16px; height: 16px;'});
	header.appendChild(this.modeIcon);
	header.appendChild(this.titleItem);
	header.appendChild(this.executeIcon);
	header.appendChild(this.closeIcon);
	return( header );
    }
    createBody(operation: Operation, options: JSONObject) : HTMLElement {
	return( Layer.createElement('div', { class: 'body',
					     style: 'border: solid red 1px; position: absolute; top: ' + this.closedHeight + '; left: 0px; bottom:40px; right:0px'}) );
    }

    createFooter(operation: Operation, options: JSONObject) : HTMLElement {
	var footer = Layer.createElement('div', { class: "foot",
						  style: "border: solid black 1px; position: absolute; height: 20px; left: 0px; bottom:0px; right:20px"});
	footer.innerText = JSON.stringify(operation.form);
	return( footer );
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

    changeMode() {
	switch (this._mode) {
	case 'open':
	    this.mode = 'closed';
	    break;
	case null:  // default result mode is open
	case 'closed':
	    this.mode = 'open';
	    break;
	}
    }
    get mode() : string {
	return( this._mode );
    }
    set mode(newMode: string) {
	if (this._mode != newMode) {
	    switch (newMode) {
	    case null: // reiterate open
	    case 'open':
		this.body.style.display = 'block';
		this.footer.style.display = 'block';
		this.node.style.resize = 'both';
		this.node.style.overflow = 'auto';
		if (this.executeIcon) { this.executeIcon.style.display = 'block'; }
		this.resize(this.openWidth, this.openHeight);
		break;
	    case 'closed':
		if (this._mode == 'open') {
		    this.openHeight = parseInt(this.node.style.height) || this.openHeight;
		    this.openWidth = parseInt(this.node.style.width) || this.openWidth;
		}
		this.body.style.display = 'none';
		this.footer.style.display = 'none';
		this.node.style.resize = 'none';
		this.node.style.overflow = 'hidden';
		if (this.executeIcon) { this.executeIcon.style.display = 'none'; }
		this.resize(this.closedWidth, this.closedHeight);
		break;
	    default:
		break;
	    }
	    this._mode = newMode;
	    if (this.modeIcon) { this.modeIcon.className = 'dydra-mode-' + newMode;}
	    // console.log('set mde: ', mode);
	    // MessageLoop.postMessage(this, Widget.ResizeMessage.UnknownSize);
	}
    }

    present(operation: Operation = this.operation) {
	this.panes.forEach(function(pane: LayerPane) { pane.present(operation); });
    }
}

export class MetadataLayer extends Layer {
    /* ensure it is visible, edit the model, save it when closed */
    _editor: CodeMirrorEditor;

    createFrame(node: HTMLElement, operation: Operation, options: JSONObject) : HTMLElement {
	super.createFrame(node, operation, options);
	node.style.display= "block";
	node.style.position = "absolute";
	node.style.top = "0px";
	node.style.left = null;
	node.style.right = "0px";
	node.style.width = "200px";
	node.style.height = "100px";
	node.style.border = "solid blue 1px";
	// console.log("metadata layer: ", this);
	return( node );
    }
    createHeader (operation: Operation, options: JSONObject) : HTMLElement {
	var header = Layer.createElement('div', {class: "head",
					     style: 'border: solid black 1px; position: absolute; top: 0px; left: 0px; width: 100%; height: ' + this.closedHeight + '; font: plain 9pt fixed'});
	header.innerHTML =
	    '<span style="position: absolute; top: 0px; padding-top: 2px; right: 22px; width: 16px; height: 16px;"><a href="#"><i class="dydra-execute-button"></i></a></span>' +
	    '<span style="position: absolute; top: 0px; right: 4px; width: 16px; height: 16px;"><a href="#"><i class="dydra-close-button"></i></a></span>';
	return( header );
    }
    createBody(operation: Operation, options: JSONObject) : HTMLElement {
	var body = Layer.createElement('div', {class: 'body',
					       style: 'position: absolute; top: ' + this.closedHeight + '; left: 0px; bottom: 0px; width: 100%;'});
	this.addClass('CodeMirrorWidget');
	this._editor = new CodeMirrorEditor({ host: body,
					      model: new CodeEditor.Model() });
	this._editor.setOption('lineNumbers', false);
	this._editor.setOption('mode', 'application/json');
	var doc = this._editor.editor.getDoc();
	doc.setValue(JSON.stringify(operation.model(), null, 2));
	return( body );
    }

    createFooter(operation: Operation, options: JSONObject) : HTMLElement {
	return( Layer.createElement('div', { class: "foot",
					     style: "display: none"}) );
    }

    present(operation: Operation) {
	this.node.style.display = 'block';
	this._editor.editor.getDoc().setValue(JSON.stringify(operation.model()));
    }
}

export class SparqlLayer extends Layer {
    /* bind the source/destination operations' layers reciprocally */
    sourceLayer : SparqlLayer = null;
    destinationLayer : SparqlLayer = null;
    /* bind the group/pattern/expression operation's layer */
    childLayer : SparqlLayer = null;
    parentLayer : SparqlLayer = null;
    constructor(operation: SparqlOperation, options: JSONObject = {}) {
	super(operation,
	      Object.assign({}, {title: "SPARQL"}, options));
    }
    createPanes(operation: SparqlOperation, options: JSONObject) : Array<LayerPane> {
	return ( [ new SparqlQueryPane(operation, options),
		   new SparqlResultsPane(operation, options) ] );
    }
    acceptMediaType() {
	return (this.operation.acceptMediaType);
    }

    // window.layers[1].arrangeLayer(30, 30);
    arrangeLayer(left: number, top: number) {
	var geometry = this.geometry();
	var width = geometry.width;
	var height = geometry.height;
	//this.left = left;
	console.log("arrangeLayer: ", this.operation.operator, {left: left, top: top});
	// console.log('arrange: ', left, top, width, height, this, this.operation);
	// this.printLinks('arrangeLayer');
	if (this.childLayer) {
	    var childSize = this.childLayer.arrangeLayer(left+width, top);
	    width = width + childSize.width;
	    if (childSize.height > height) { height = childSize.height; }
	}
	if (this.sourceLayer) {
	    var sourceSize = this.sourceLayer.arrangeLayer(left, top+height);
	    height + height + sourceSize.height;
	    if (sourceSize.width > width) { width = sourceSize.width; }
	}
	//console.log('arranged before text: ', this, this.operation.operator, this.node.innerText);
	//this.node.innerText = 'for operator ' + this.operation.operator;
	//console.log('arranged text: ', this, this.operation.operator, this.node.innerText);
	this.move(left, top);
	var arrangement = {left: left, top: top, width: width, height: height};
	console.log("arrangeLayer: ", this.operation.operator, arrangement);
	// console.log('arrange after: ', this.operation.operator, arrangement);
	layers.push(this);
	return( arrangement );
    }
    changeMode() {
	super.changeMode();
	var geometry = this.geometry();
	this.arrangeLayer(geometry.left, geometry.top);
    }
    /* link a layer to its parent or destination layer
       recurse to respective source or child via the layer's operation
    */
    linkLayer(context: SparqlLayerContext) {
	var operation : SparqlOperation =<SparqlOperation> this.operation;
	var source : SparqlOperation = operation.source;
	var child : SparqlOperation = operation.child;
	// console.log('linkLayer: ', this, operation, context, source, child);
	this.parentLayer = context.parentLayer;
	this.destinationLayer = context.destinationLayer;

	if (source) {
	    this.sourceLayer =<SparqlLayer> source.view;
	    this.sourceLayer.linkLayer({destinationLayer: this, parentLayer: null});
	}
	if (child) {
	    this.childLayer =<SparqlLayer> child.view;
	    this.childLayer.linkLayer({destinationLayer: null, parentLayer: this});
	}
	this.printLinks('linkLayer.complete: ');
    }
    printLinks(message: string) {
	console.log(message, this, this.operation, this.sourceLayer, this.destinationLayer, this.childLayer, this.parentLayer);
    }
}

export class LayerPane extends Widget {
    constructor(operation: Operation, options: JSONObject = {}) {
	super({node: document.createElement('div')});
	// console.log("LayerPane.options: ", options);
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
	this._editor = new CodeMirrorEditor({ host: node, model: new CodeEditor.Model()});
	var doc = this._editor.editor.getDoc();
	doc.setValue(<string>options.expression || "select * where {?s ?p ?o} limit 10");
	this._editor.setOption('lineNumbers', true);
	let gutter = <HTMLElement>(node.getElementsByClassName('CodeMirror-gutter CodeMirror-linenumbers').item(0));
	if( gutter ) {
	    gutter.style.width = '10px';
	}
	// console.log("query pane: ", this);
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
	// console.log("results pane: ", this);
	return( node );
    }
    present(operation: Operation) {
	var text = operation.responseText;
	this.node.innerText = text;
    }
}

