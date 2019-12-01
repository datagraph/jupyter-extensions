// Copyright (c) 2019 datagraph gmbh

/* View class implementation

  DockPanel
  -> View

  Each view displays layers arranged in a DockPanel according to their source and argument relations.
  SPARQL involves a bottom-up evaluation process in which the lexical relation is converted in a reduction graph.
  Each form combines the form above it with its expression proper.
  For example, in
      SELECT * where { ?s ?p ?o FILTER(?o != 0) }
  the FILTER form combines the preceding bgp with the predicate expression.
  Each operation represent this pattern with a source fied, which binds the reltation to any precedeing form
  and some field for its immediate form - for FILTER, the predicate field and for OPTIONAL or JOIN the group.
  This pattern is depicted in the view with source layers arranged vertically and constituent layers arrayed
  horizontally.
  */

import { MessageLoop } from '@phosphor/messaging';
import { JSONObject } from '@phosphor/coreutils';
import { ConnectionOperation, Operation, SparqlOperation } from './algebra';
import { Layer, SparqlLayer } from './layer';
import { Widget } from '@phosphor/widgets';
import * as $uuid from './replication/lib/uuid-v1.js';
import  ulog from "ulog";
ulog.level = ulog.DEBUG;
const log = ulog('view');


export class View extends Widget {
}
export class OperationView extends View {
    id: string;
    name: string;
    operation: Operation;
    connection: ConnectionOperation;
    constructor(operation: Operation, options: JSONObject = {}) {
	super();
	var host =<HTMLElement>(<unknown>options.host) || document.body;
	this.id = operation.id || <string>options.id || $uuid.v1();
	this.name = <string>options.name || "?";
	this.operation = operation;
	this.connection = <ConnectionOperation> (<unknown>options.connection);
	this.node.style.position = 'absolute';
	this.node.style.display = 'block';
	this.node.style.top = '110px';
	this.node.style.left = '10px';
	this.node.style.width = '1000px';
	this.node.style.height = '500px';
	this.node.style.border = "inset 2px";
	this.node.style.resize = "both";
	this.node.appendChild(Layer.createElement('div', {style: 'position: absolute; display: block; top: 0px; right: 0px'})).
	    innerText = this.name;
	MessageLoop.sendMessage(this, Widget.Msg.BeforeAttach);
	host.appendChild(this.node);
	MessageLoop.sendMessage(this, Widget.Msg.AfterAttach);
    }
}

declare global {
    interface Window {
	layers: SparqlLayer[];
    }
}

export class SparqlOperationView extends OperationView {
    
    constructor(operation: SparqlOperation, options: JSONObject = {}) {
	super(operation, options);
	var thisNode = this.node;
	var layers : SparqlLayer[] = new Array();
	var createLayer = function(operation : SparqlOperation) {
	    var layer : SparqlLayer =<SparqlLayer>(<unknown> operation.computeView({host: null, mode: 'closed'}));
	    log.debug('createLayer: operation+layer:', operation, layer);
	    layers.push(layer);
	    return( layer );
	};

	operation.mapOperations(createLayer);
	log.debug('layers: ', layers)
	layers[0].linkLayer({destinationLayer: null, parentLayer: null});
	// var positionRootLayer = function(layer : SparqlLayer) {
	//     console.log("pRL: layer: ", layer);
	//     var top = 0;
	//     if (layer.destinationLayer == null && layer.parentLayer == null) {
	// 	var operation = layer.operation;
	// 	console.log("positionRootLayer", layer, operation, top);
	// 	var extent = layer.arrangeLayer(0, top);
	// 	console.log("positionRootLayer.extent", layer, operation, extent);
	// 	top = top + extent.height;
	//     }
	// }
	var addLayer = function(layer: SparqlLayer) {
	    log.debug('addLayer: ', layer);
	    thisNode.appendChild(layer.node);
	}
	layers.forEach(addLayer);
	new Promise((resolve) => {
	    // console.log("promised arrange");
	    layers[0].arrangeLayer(0,0); resolve(layers);
	    window.layers = layers;
	});
    }
}
