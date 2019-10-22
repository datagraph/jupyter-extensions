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

export class Layer extends Widget {
    id: string;
    operation: Operation;
    panes: Array<LayerPane> = [];
    body: DockPanel = null;
    
    constructor(id: string, operation: Operation, panes: Array<LayerPane>, options: JSONObject = {}) {
	super({ node: Layer.createFrame(id) });
	this.operation = operation;
	this.panes = panes;
	this.body = Layer.createBody(panes);
	let divs = this.node.getElementsByTagName('div');
	let bodyDiv = divs.item(3);
	console.log('layer.div: ', bodyDiv);
	bodyDiv.appendChild(this.body.node);
    }
    
    static createFrame(id: string) {
	let frame = document.createElement('div');
	frame.id = id;
	frame.innerHTML =
      '<div class="head">' +
      '<div class="left">Comment</div>' +
      '<div class="right">' +
      '<a href="#" class="close"><i class="icon-exit"></i></a>' +
      '</div>' +
      '</div>' +
      '<div class="body">' +
      '</div>';
	frame.setAttribute('class', 'window');
	return frame;
    }
    static createBody(panes: Array<LayerPane>) {
	var panel = new DockPanel();
	var left = panes[0];
	panel.addWidget(left);
	panes.slice(1).forEach(function(next) {
	    panel.addWidget(next, {mode: 'split-right', ref: left});
	    left = next;
	});
	return( panel );
    }
    
    present(operation: Operation = this.operation) {
	this.panes.forEach(function(pane: LayerPane) { pane.present(operation); });
    }
}

export class SparqlLayer extends Layer {
    constructor(operation: Operation, options: JSONObject = {}) {
	super('SPARQL',
	      operation,
	      [ new SparqlQueryPane(), new SparqlResultsPane() ],
	      options);
    }
    acceptMediaType() {
	return (this.operation.acceptMediaType);
    }
}

export class LayerPane extends Widget {
    static createNode(): HTMLElement {
	let node = document.createElement('div');
	return( node );
    }
    constructor(title: string) {
	super({node: LayerPane.createNode()});
	this.title.label = title;
	this.title.closable = false;
    }
    present(operation: Operation) {} 
}

export class SparqlQueryPane extends LayerPane {
    _editor: CodeMirrorEditor;
    constructor(title: string = 'SPARQL') {
	super(title);
	this.addClass('CodeMirrorWidget');
	this._editor = new CodeMirrorEditor({ host: this.node, model: new CodeEditor.Model() });
    }
    present(operation: Operation) {
	var doc = this._editor.editor.getDoc();
	var query = operation.expression;
	doc.setValue(query);
    }
}

export class SparqlResultsPane extends LayerPane {
    constructor(title: string = 'Results') {
	super(title);
    }
    present(operation: Operation) {
	var text = operation.responseText;
	this.node.innerHTML = text;
    }
}
    
