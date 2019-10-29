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
export class Layer extends Widget {
    id: string;
    operation: Operation;
    panes: Array<LayerPane> = [];
    body: DockPanel = null;
    mode: string = 'open';
    modeIcon: HTMLElement = null;
    
    constructor(id: string, operation: Operation, panes: Array<LayerPane>, options: JSONObject = {}) {
	super({ node: Layer.createFrame(id) });
	let thisLayer = this;
	console.log('options: ', options);
	let host = <HTMLElement>(<unknown>options.host) || document.body;
	this.operation = operation;
	this.panes = panes;
	this.body = Layer.createBody(panes);
	//this.body.node.style.width = "200px";
	this.body.node.style.height = "100px";
	let divs = this.node.getElementsByTagName('div');
	console.log('host: ', host);
	console.log('divs: ', divs);
	let bodyDiv = divs.item(1);
	console.log('layer.bodyDiv: ', bodyDiv);
	console.log('layer.body: ', this.body);
	console.log("is host attached? ", document.body.contains(host));
	console.log("is node attached? ", document.body.contains(this.node));
	console.log("is body attached? ", document.body.contains(this.body.node));

	// bodyDiv.appendChild(this.body.node);
	//Widget.attach(this.body, bodyDiv);
	host.appendChild(this.node);
	MessageLoop.sendMessage(this.body, Widget.Msg.BeforeAttach);
	bodyDiv.appendChild(this.body.node);
	MessageLoop.sendMessage(this.body, Widget.Msg.AfterAttach);
	//Widget.attach(this.body, document.body); // bodyDiv);
	this.modeIcon = this.node.getElementsByTagName('span').item(0).getElementsByTagName('i').item(0);
	this.modeIcon.onclick = function(element) { thisLayer.changeMode(thisLayer.mode); };
	this.body.node.onclick = function() { console.log('this: ', this, 'event: ', event); };
	this.update();
    }
    
    static createFrame(id: string) {
	let frame = document.createElement('div');
	frame.id = id;
	frame.style.width = '300px';
	frame.style.height = '200px';
	frame.style.border = 'solid black 1px';
	//frame.style.position = 'absolute';
	frame.style.top = '10px';
	frame.style.left = '10px';
	frame.style.display = 'block';
	frame.innerHTML =
      '<div class="head" style="border solid red 1px">' +
      '<span float="left"><a href="#"><i class="dydra-mode-open"></i></a></span>' +
      '<span class="dydra-layer-title">' + id + '</span>' +
      '<span float="right"><a href="#"><i class="dydra-execute-button"></i></a></span>' +
      '<span float="right"><a href="#"><i class="dydra-close-button"></i></a></span>' +
      '</div>' +
      '<div class="body" style="border: solid gray 1px" >' + // 'placeholder' +
      '</div>';
	frame.setAttribute('class', 'window');
	return frame;
    }
    static createBody(panes: Array<LayerPane>) {
	var panel = new DockPanel();
	var left = panes[0];
	panel.addWidget(left);
	panes.slice(1).forEach(function(next) {
	    panel.addWidget(next, {mode: 'tab-after', ref: left});
	    left = next;
	});
	return( panel );
    }

    changeMode(mode: string) {
	console.log('changeMode: ' + mode);
	switch ( mode ) {
	case 'open':
	    mode = 'closed';
	    this.body.node.style.display = 'none';
	    break;
	case 'closed':
	    mode = 'open';
	    this.body.node.style.display = 'block';
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
	this.node.innerHTML = "<span>" + title + "</span>";
	this.node.style.background = "gray";
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
	this._editor = new CodeMirrorEditor({ host: this.node, model: new CodeEditor.Model()});
	var doc = this._editor.editor.getDoc();
	doc.setValue("select * where {?s ?p ?o}");
	this._editor.setOption('lineNumbers', true);
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
	this.node.innerHTML = "<http://example.org/s> <http://example.org/p> <http://example.org/o> .";
    }
    present(operation: Operation) {
	var text = operation.responseText;
	this.node.innerHTML = text;
    }
}
    
