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
    _form: SparqlQuery;
    responseText: string;
    responseObject: JSONObject;
    acceptMediaType: string = 'application/sparql-results+json';
    static defaultLocation = window.location.origin;
    
    constructor(options: JSONObject = {}) {
	this.location = (<string>options.location) || Operation.defaultLocation;
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
	return( generator.stringify(this.form) );
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

    get form() : SparqlQuery{
	if (! this._form) {
	    this._form = this.computeForm();
	}
	return( this._form );
    }
    get innerForm() : any {
	return( this.computeInnerForm() );
    }
    computeForm(): SparqlQuery {
	return( <SparqlQuery>{} );
    }
    computeInnerForm() {
	return( {} );
    }
}


export class SparqlOperation extends Operation {
    computeView() : Layer {
	let view = new SparqlLayer(this);
	return( view );
    }
}

export class Unit extends SparqlOperation {
    constructor( options: JSONObject = {}) {
	super(options);
    }
    computeInnerForm() {
	return( { type: 'group',
		  patterns: <Triple>[] } );
    }
    computeForm(): SparqlQuery {
	var form =<unknown> { type: 'query', queryType: 'SELECT', variables: [ '*'], prefixes: {},

		     where: this.computeInnerForm()
		   }
	return( <SparqlQuery>form );
    }
}

export class Extend extends SparqlOperation {
}

export class FilterOperation extends SparqlOperation {
    base: Operation;
    predicate: JSONObject = {};
    constructor(base: Operation = new Unit(), predicate: JSONObject = {}, options: JSONObject = {}) {
	super(options);
	this.base = base;
	this.predicate = predicate;
    }
    computeInnerForm() {
	return( { 'type': 'FILTER',
		  'expression': this.predicate } );
    }
    computeForm(): SparqlQuery {
	var form = { type: 'query', queryType: 'SELECT', variables: [ '*'], prefixes: {},

		     where: [ this.base.form, this.computeInnerForm() ]
		   }
	return( <SparqlQuery>form );
    }
}

/*
 The InnerJoin class manages a natural join of two constituent fields.

 The base and complement are each which yield a field.
 The combination is a JOIN object.
 The expression wraps the combination in a select-where
 */
export class InnerJoin extends SparqlOperation {
    base: Operation;
    complement: Operation;
    constructor(base: Operation, complement: Operation, options: JSONObject = {}) {
	super(options);
	this.base = base;
	this.complement = complement;
    }
    computeInnerForm() {
	return( [ this.base, this.complement ] );
    }
    computeForm(): SparqlQuery {
	var form =<unknown> {type: 'query', queryType: 'SELECT', variables: [ '*' ], prefixes: {},
		    where: this.computeInnerForm() };
	return( <SparqlQuery>form );
    }
}

/*
 The Match class comprises a sequence of statement patterns
 */
export class Match extends SparqlOperation {
    patterns: Triple[];
    constructor(patterns: Triple[], options: JSONObject = {}) {
	super(options);
	this.patterns = patterns;
    }
    
    computeInnferForm() {
	return( {type: 'bgp', triples: this.patterns} );
    }
    computeForm(): SparqlQuery {
	var form =<unknown> { type: 'query',  queryType: "SELECT", variables: [ '*' ], prefixes: {},
		     where: [ this.computeInnerForm ]
		   }
	return( <SparqlQuery>form );
    }
}

export class OptionalJoin extends SparqlOperation {
    base: Operation;
    complement: Operation;
    constructor(base: Operation, complement: Operation, options: JSONObject = {}) {
	super(options);
	this.base = base;
	this.complement = complement;
    }
    computeInnerForm() {
	return( [ this.base, {type: 'optional', patterns: [ this.complement] } ] );
    }
    computeForm(): SparqlQuery {
	var form =<unknown> {type: 'query', queryType: 'SELECT', variables: [ '*' ], prefixes: {},
		    where: this.computeInnerForm() };
	return( <SparqlQuery>form );
    }
}
export class Project extends SparqlOperation {
    base: Operation;
    variables: string[];
    constructor(base: Operation, variables: string[], options: JSONObject = {}) {
	super(options);
	this.base = base;
	this.variables = variables;
    }
    computeInnerForm() {
	return( <unknown>{type: 'query', queryType: 'SELECT',
		 variables: this.variables.forEach(function(name) { return( {termType: 'Variable', value: name} ); }),
		 where: this.base } );
    }
	computeForm(): SparqlQuery {
	return( <SparqlQuery>this.computeInnerForm() );
    }
}
export class Values extends SparqlOperation {
    base: Operation;
    values: Array<JSONObject>;
    constructor(base: Operation, values: Array<JSONObject>, options: JSONObject = {}) {
	super(options);
	this.base = base;
	this.values = values;
    }
    computeInnerForm() {
	return( <unknown>{where: [ this.base,
			  {type: 'values',
			   values: this.values.forEach(function (binding) {
			       return( { variable: binding[0],
					 value: {termType: 'Literal', value: binding[1]}} );
			   })}]} );
    }
    computeForm(): SparqlQuery {
	var form = {type: 'query', queryType: 'SELECT', variables: [ '*' ], prefixes: {},
		    where: [this.base, this.computeInnerForm()] };
	return( <SparqlQuery>form );
    }
}
