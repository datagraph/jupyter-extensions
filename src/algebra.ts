// Copyright (c) 2019 datagraph gmbh

/**
 Implement SPARQL algebra operations as a collection of operator-specific classes.

 The root class implements the inter-operator communication and execution.
 Each communicates with its argument operations to compose its expression from those of its arguments.
 Execution proceeds asynchronously with each operator formulating and executing its own requests to the data service.
 Expression, results and parameters are presented with a paired widget.

 The intermediate abstract classes implement nullary, unary, and binary operator arities.
 Concrete specializations are defined for
   Extend (base)
   Filter (base)
   InnerJoin (base complement)
   Match ()
   OptionalJoin (base complement)
   Project (base)
   Values ()


 !!! instnatiation should follow three distinct phaese
 1. the algebra operation as an instance
 2. connect its arguments
 3. show it- create the widget, connect them and asser the css properties
 */

import { JSONObject } from '@phosphor/coreutils';
import { Layer, SparqlLayer } from './layer';
// import { Message, MessageLoop } from '@phosphor/messaging';
import { Parser, Generator, SparqlQuery } from 'sparqljs';
var parser = new Parser();
var generator = new Generator({});
import { SPARQL } from './replication/rdf-client';

class Dataset {}
class Triple {}

export class Operation {
    source: Dataset;
    mode: string;
    location: string;
    _view: Layer;
    _expression: string;
    _form: any;
    responseText: string;
    responseObject: JSONObject;
    layerConstructor: Function;
    acceptMediaType: string = 'application/sparql-results+json';
    
    constructor(options: JSONObject = {}) {
	this.mode = 'DORMANT';
    }

    isActive() {
	return ( 'ACTIVE' == this.mode );
    }
    isDormant() {
	return ( 'DORMANT' == this.mode );
    }
    setArguments(args: JSONObject = {}) {
	Object.assign(this, args);
	if (this.isActive()) {
	    this.execute();
	}
    }
    execute() {
	SPARQL.get(this.location, this.expression).then(this.acceptResponse);
    }
    acceptResponse(response: any) {
	response.text().then(function(text: string) {
	    this.responseText = text;
	    this.responseObject = this.parseResponse(text);
	    if (this.view) { this.present(); }
	});
    }
    present(view: Layer = this.view) {
	view.present(this);
    }
    model() {
	return ({'expression': this.expression, 'response': this.responseText,
		 'data': this.responseObject});
    }
    parseResponse(text: string) {
	return ( {} );
    }
    computeExpression() : string {
	return( "" );
    }
    get expression() {
	if (! this._expression ) {
	    this._expression = this.computeExpression();
	}
	return ( this._expression );
    }
    set expression(expression: string) {
    	this._form = parser.parse(expression);
	this._expression = expression;
    }		 
    set view(view: Layer) {
	this._view = view;
	this.present();
    }
    get view() : Layer {
	if (! this._view ) {
	    this._view = this.computeView();
	}
	return ( this._view );
    }
    computeView() : Layer {
	return( null );
    }

    get form() : any {
	return( this._form );
    }
}

class NullaryOperation extends Operation {
}

class UnaryOperation extends Operation {
    base: Operation;
}

class BinaryOperation extends Operation {
    base: Operation;
    complement: Operation;
}

export class Extend extends UnaryOperation {
    computeView() : Layer {
	let view = new SparqlLayer(this);
	return( view );
    }
}

export class FilterOperation extends UnaryOperation {
    predicateForm: JSONObject = {};
    computeForm() {
	return( { 'type': 'FILTER',
		  'expression': this.predicateForm } );
    }
    computeExpression() {
	var form = { type: 'query',
		     queryType: 'SELECT',
		     where: [ this.base.form, this.computeForm() 
		     ],
		     variables: [
			 {
			     termType: "Wildcard",
			     value: "*"
			 }
		     ],
		     prefixes: {}
		   }
	return( generator.stringify(<SparqlQuery>form) );
    }
}

/*
 The InnerJoin class manages a natural join of two constituent fields.

 The base and complement are each which yield a field.
 The combination is a JOIN object.
 The expression wraps the combination in a select-where
 */
export class InnerJoin extends BinaryOperation {
    constructExpression() {
	return ( {'type': 'join', 'arguments': [ this.base, this.complement ] } );
    }
}

export class Match extends NullaryOperation {
    pattern: Triple;
    computeExpression() {
	var form = { type: 'query',
		     queryType: "SELECT",
		     where: [ { type: 'FILTER', expression: this.pattern }
		     ],
		     variables: [ '*' ],
		     prefixes: {}
		   }
	return( generator.stringify(<SparqlQuery>form) );
    }
}
export class OptionalJoin extends BinaryOperation {
}
export class Project extends UnaryOperation {
}
export class Values extends NullaryOperation {
}
