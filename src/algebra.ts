// Copyright (c) 2019 datagraph gmbh

/**
 Implement operations as a collection of operator-specific classes.
 Each relates an operator with its arguments and a presentation view.

 SPARQL algebra operators extend this with
 - a source with which to describe the reduction chain
 - the respective operator-specific forms
 - a static method to translate from the parsed expression object
 - methods to construct the immediate form, compose the effective query
   and generate expressions for the immediate form and for the composite
   query.

 Other method, such as connection configuration, have their own constitution

 The algebra operators are intended to serve and the process data- flow
 description. The source and view relations are used to lay out the views.
 The source relation contributes to the composite query.
 The view presents results of an executed operator.
 Execution proceeds asynchronously with each operator formulating and executing
 its own requests to the data service.

 The intermediate abstract classes implement nullary, unary, and binary operator arities.
 Concrete specializations are defined for
   Extend (base)
   Filter (base)
   Join (base complement)
   Match ()
   Optional (base complement)
   Project (base)
   Union
   Values ()
 */

import { JSONObject } from '@phosphor/coreutils';
// import { JSONValue } from '@phosphor/coreutils';
import { Layer, SparqlLayer, SparqlBgpLayer, SparqlFilterLayer, SparqlJoinLayer, SparqlOptionalLayer,
	 SparqlServiceLayer, SparqlUnionLayer } from './layer';
import { Parser, Generator,
	 SparqlQuery, BaseQuery, Query, // Update,
	 AskQuery, ConstructQuery, DescribeQuery, SelectQuery,
	 Pattern, BgpPattern, BindPattern, BlockPattern, FilterPattern, GraphPattern, GroupPattern, ServicePattern, ValuesPattern,
	 ValuePatternRow, Variable, Term, PropertyPath, Expression,
	 Triple} from 'sparqljs';
var parser = new Parser();
var generator = new Generator({});
import { SPARQL } from './replication/rdf-client';
import * as $uuid from './replication/lib/uuid-v1.js';

interface VariableForm {
    type: string,
    variables:  Variable[] | ['*'];
}
export type SparqlForm = BaseQuery | Pattern | VariableForm;
export type PredicateTerm = PropertyPath | Term;
export interface OperationRelation {
    operation: Operation;
    source?: Operation;
    child?: Operation;
}
export interface SparqlOperationRelation extends OperationRelation {
    operation: SparqlOperation;
    source?: SparqlOperation;
    group?: SparqlOperation;
}
export interface ConnectionModel {
    location: string;
    authentication?: string;
}

// alternative to the sparqljs definitions, there correspond more directly to the parsed results
interface TypedTerm {termType: string, value: string};
//type TypedVariable = Variable | TypedTerm;
type VariableList = Variable[] | ['*'];
type TypedTermList = TypedTerm[];
type PatternList = Pattern[];
type SparqlOperationList = SparqlOperation[];
type SparqlFormList = SparqlForm[];
export type StringList = string[];

//interface Variable {termType: 'Variable'|'Wildcard', value: string}
interface SparqlOptions extends OperationOptions {
    dimensions?: string[];
    variables?: TypedTermList;
    expression?: string;
    form?: SparqlForm;
};
interface SparqlBGPOptions extends SparqlOptions {
    subjectVariable? : string;
}

interface OperationOptions {
    id?: string;
    connection? : ConnectionModel;
    mode?: string;
}
interface SparqlResultJson {
    head: JSONObject;
    results: { bindings: Array<JSONObject> };
}
interface TriplePattern {
    subject?: TypedTerm;
    predicate?: TypedTerm;
    object?: TypedTerm;
}

function TypedTerm(object : any) : TypedTerm {
    return(<TypedTerm> (<unknown> object) );
}
function Term(object : TypedTerm) : Term {
    return(<Term> (<unknown> object) );
}

export function tripleSubject(triple: Triple) : TypedTerm {
    return( <TypedTerm> (<unknown>triple.subject) );
}
export function triplePredicate(triple: Triple) : TypedTerm {
    return( <TypedTerm> (<unknown>triple.predicate) );
}
export function tripleObject(triple: Triple) : TypedTerm {
    return( <TypedTerm> (<unknown>triple.object) );
}
export function setTripleObject(triple: Triple, object: TypedTerm) : TypedTerm{
    triple.object =<Term>(<unknown>object);
    return( object );
}
export function termEqual(term1: TypedTerm, term2: TypedTerm) {
    return( term1 && term2
	    && (term1.termType == term2.termType)
	    && (term1.value == term2.value) );
}
export function findTriplePattern(triples: Triple[], triplePattern: TriplePattern) {
    var found : Triple = null;
    triples.forEach(function(triple: Triple) {
	if ( (triplePattern.subject ? termEqual(triplePattern.subject, tripleSubject(triple)) : true)
	     && (triplePattern.predicate ? termEqual(triplePattern.predicate, triplePredicate(triple)) : true)
	     && (triplePattern.object ? termEqual(triplePattern.object, tripleObject(triple)) : true) ) {
	    found = triple;
	} });
    return( found );
}

export class Operation {
    id: string;
    operator: string = undefined;
    mode: string;
    connection: ConnectionModel = null;
    _view: Layer;
    _expression : string;
    responseText: string;
    responseObject: JSONObject;
    acceptMediaType: string = 'application/sparql-results+json';
    static defaultLocation = window.location.origin;
    
    constructor(options: OperationOptions = {}) {
	this.id = <string> options.id || $uuid.v1();
	this.connection = (<ConnectionModel>options.connection) || {location: Operation.defaultLocation};
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

    /* the operation's _expression and any form model are synchronized.
     * the expression is computed and (re-)cached, for each reference
     * the setting it should (re-)convert it to any related model/state.
     */

    /** Upon reference (re-)compute and cache the operation's expression.
     */
    get expression() : string {
	this._expression = this.computeExpression();
	return ( this._expression );
    }
    /** set the expression string and synchronize the form/model state
     */
    set expression(expression: string) {
	this._expression = expression;
	this.deconstructExpression(expression);
    }		 
    /** the base expression is whatever has been set or an empty string
     */
    computeExpression() : string {
	return( this._expression || "" );
    }
    /** the base expression deconstruction does nothing and just returns the expression.
     */
    deconstructExpression(expression : string) : string {
	return (expression);
    }
    get form() {
	return( {} );
    }
    
    /** Execute the operation ans accept any response result.
     * The default model does nothing.
     */
    execute(connection : ConnectionModel = this.connection) {
    }
    /**
     * The default to accept a response result is to receive and cache the content string,
     * parse it to produce a responseObject, and present the modified operation in its respective view
     */
    acceptResponse(response: Response) {
	var thisOperation = this;
	console.log('ar: ', response);
	response.text().then(function(text: string) {
	    console.log('ar.text: ', thisOperation, response, text);
	    thisOperation.responseText = text;
	    thisOperation.responseObject = thisOperation.parseResponse(text);
	    if (thisOperation.view) { thisOperation.view.present(thisOperation, 'results'); }
	});
    }

    /**
     * Present the operation, by default, in its respetive layer view.
     */
    present(view: Layer = this.view) {
	view.present(this);
    }
    model() {
	return ({});
    }

    /**
     * The default expression parser just returns the expression string
     */
    parseResponse(text: string) {
	return ( {text: text} );
    }

    /**
     * compute the view respective the operation.
     * bind the result to use to synchronize the rpesentation
     */
    get view() : Layer {
	if (! this._view ) {
	    this._view = this.computeView();
	}
	return ( this._view );
    }
    computeView() : Layer {
	return( null );
    }
    set view(view: Layer) {
	this._view = view;
	// this.present();
    }
}

export class MetadataOperation extends Operation {
    present(view: Layer = this.view) {
	view.present(this);
    }
}
export class ConnectionOperation extends MetadataOperation {
    authentication: string = null;
    location: string = null;
    constructor(options : OperationOptions) {
	super(options);
	var connection = options.connection;
	if (connection) {
	    this.authentication = connection.authentication;
	    this.location = connection.location;
	}
    }
    model() : ConnectionModel {
	return( {location: this.location, authentication: this.authentication} );
    }
}

class SparqlTranslatorMap extends Map {
    get(type : string) : ((form:SparqlForm) => SparqlOperation) {
	var translator = <(form:SparqlForm) => SparqlOperation> super.get(type.toLowerCase())
	// console.log("translator map:", type, translator);
	return( translator ||
		function(sparqlObject: SparqlForm) {
		    console.log(`translation unknown: ${sparqlObject.type}: ${JSON.stringify(sparqlObject)}`);
		    return( new Unit({form: sparqlObject}) );
		} );
    };
}

export class SparqlOperation extends Operation {
    // the query form object and expression are always generated on-the-fly
    /** the operation's immediate sparql form */
    _form: SparqlForm; // the immediate sparql form object
    /** the minimal complete query which incorporates the operation's form */
    _query: SparqlQuery;
    /* represent the expression dependencies in both parent and child directions.
     * source/destination v/s child/parent distinguisn the lexical relation between
     * operation constituents and serves to arrange presentation layers
     */
    source: SparqlOperation = null;
    child: SparqlOperation = null;
    destination: SparqlOperation = null;
    parent: SparqlOperation = null;
    /** enumerate the variable names present in the composite query expression
     */
    dimensions : Array<string> = null;
    /** relate variable name to the predicate in the respective statement pattern */
    dimensionToProperty = new Map();
    /** relate statement pattern predicate to the respective variable name */
    propertyToDimension = new Map();
    /** enumerate predicates present in the composite query expression.
     * this agggregates the values from constituent bgp operations.
     */
    predicates: string[] = null;

    /** Record the functions which translate SPARQL forms into operations
     */
    static formTranslators = new SparqlTranslatorMap();

    constructor(options: SparqlOptions = {}) {
	super(options);
	this.operator = this.constructor.name;
	this.dimensions = options.dimensions
	    || SparqlOperation.translateVariables(options.variables)
	    || this.dimensions;
	// assert any provided expression or form
	var expression : string =<string> options.expression;
	if (expression) {
	    this.expression = expression;
	} else {
	    var form =<SparqlForm> (<unknown> options.form);
	    if (form) {
		this._form = form;
	    }
	}
    }

    get variableForms() : TypedTermList {
	var forms : TypedTermList = new Array();
	if (this.dimensions) {
	    this.dimensions.forEach(function(name : string) {
		if (name == '*') {
		    forms.push({termType: "Wildcard", value: "*"});
		} else {
		    forms.push({termType: "Variable", value: name});
		}
	    });
	} else {
	    var wildcard : TypedTerm = {termType: "Wildcard", value: "*" };
	    forms.push(wildcard);
	}
	return( forms );
    }
    static wildcardVariableList : VariableList =<VariableList> (<unknown>[{termType: "Wildcard", value: "*"}]);
    static translateVariables(terms : TypedTermList) : Array<string> {
	var dimensions = new Array();
	if (terms) {
	    terms.forEach(function(term : TypedTerm) {
		if (isVariable(term)) {
		    dimensions.push(term.value);
		}});
	}
	return( dimensions );
    }
    static translateNamedNodes(terms : TypedTermList) : Array<string> {
	var namedNodes = new Array();
	if (terms) {
	    terms.forEach(function(term : TypedTerm) {
		if (isNamedNode(term)) {
		    namedNodes.push(term.value);
		}});
	}
	return( namedNodes );
    }

    /* withPredicates expects a continution, which will be invoked with the predicates
       which are available in the operator's view. These are retrieved asynchronously
       on demand and cached, whereby the retrieval is delegated to the root operation.
    */
    withPredicates(continuation : (predicates: StringList) => any) : void{
	var thisOperation = this;
	var acceptPredicates = function(predicates: string[]) {
	    thisOperation.predicates = predicates;
	    continuation(predicates);
	}
	if (this.predicates ) {
	    return( continuation(this.predicates) );
	} else if (this.parent || this.destination) { // delegate the retrieval to parent
	    (this.parent || this.destination).withPredicates(acceptPredicates);
	} else { // retrieve here
	    this.fetchPredicates(acceptPredicates);
	}
    }
		  
    fetchPredicates(continuation : (predicates: StringList) => any, connection : ConnectionModel = this.connection) {
	SPARQL.get(connection.location, "SELECT distinct ?p WHERE { {?s ?p ?o} UNION {GRAPH ?g {?s ?p ?o}} } ORDER BY ?p",
		   { authentication: connection.authentication, Accept: 'application/sparql-results+json' }).
	    then(function(response : Response) {
		console.log("fp: response: ", response);
		return(response.json());
	    }).
	    then(function(result : SparqlResultJson) {
		console.log("fp: json: ", result);
		var predicates : StringList = result.results.bindings.map(function(binding:JSONObject) {
		    return( (<TypedTerm>(<unknown>binding.p)).value );
		});
		console.log("fp: predicates: ", predicates);
		continuation(predicates);
	    });
    }
    
    model() {
	return( {'expression': this.expression, 'response': this.responseText,
		 'data': this.responseObject} );
    }
    execute(connection : ConnectionModel = this.connection) {
	var thisOperation = this;
	SPARQL.get(connection.location, this.queryExpression).
	    then(function(response : Response) { thisOperation.acceptResponse(response); });
    }
    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }

    // computeExpression() is specialuzed by each operation

    /* synchronize the _expression, _form, and _query state
     */
    /**
     * translate the expression string into the respective model form
     */
    deconstructExpression(expression: string) : string {
	console.log('de.expression: ', expression);
	this._form =<SparqlForm> parser.parse(expression);
	console.log('de._form: ', this._form);
	return (expression);
    }
    get form() : SparqlForm {
	this._form = this.computeForm();
	return( this._form );
    }
    computeForm() : SparqlForm {
	return( <BaseQuery>{} );
    }
    get query(): SparqlQuery {
	this._query = this.computeQuery();
	return( this._query );
    }
    /* the base computeQuery returns a null select */
    computeQuery() : SparqlQuery {
	return( <SelectQuery>{queryType: "SELECT",
			      variables: SparqlOperation.wildcardVariableList,
			      where: [],
			      type: "query",
			      prefixes: {}} );
    }

    get queryExpression() : string {
	var query = this.computeQuery();
	console.log("qe: ", this, query);
	var expression = generator.stringify(query);
	console.log("qe: ", this, expression);
	return( expression );
    }


    /*
     * deconstruct a SPARQL text into the corresponding linked operation tree
     * - parse into a json object
     * - walt the object creating an operation for each recognized node
     */
    static translateSparqlExpression(text: string) {
	var queryObject =<SparqlForm> parser.parse(text);
	if (queryObject) {
	    return( SparqlOperation.translateSparqlForm(queryObject) );
	} else {
	    alert(`failed to parse: '${text}'`);
	    return( null );
	}
    }

    static translateSparqlForm(sparqlObject: SparqlForm, type:string = sparqlObject.type) : SparqlOperation {
	// console.log('tSF: form: ', type, sparqlObject);
	var translator = SparqlOperation.formTranslators.get(type);
	var operation : SparqlOperation = translator(sparqlObject);
	operation._form = sparqlObject;
	// console.log('tSF: operation: ', type, operation);
	return( operation );
    }
    /* in order to handle the variant element, either the successive element
       id combined with the predecessors with a join or predecessor feeds the element
       operation as the source */
    static translateSparqlWhere(forms: SparqlForm[]) : SparqlOperation {
	var source : SparqlOperation = null;
	// console.log('tW: ', forms);
	forms.forEach(function(form) {
	    var operation = SparqlOperation.translateSparqlForm(form);
	    if (form.type == 'group') {
		source = new Join(source, operation);
	    } else {
		if (source) {
	      	    operation.source = source
		}
		source = operation;
	    };
	});
	return( source );
    }
    /* apply the function to the operator and its successive source until that is null.
     * collect the result in a new array.
     * nb. static in order to be able to apply it to a null operation argument
     */
    static mapSources(operation : SparqlOperation, op : (operation:SparqlOperation) => any, results: Array<any> = new Array()) : Array<any>{
	if (operation) {
	    var result = op(operation);
	    results.push(result);
	    SparqlOperation.mapSources(operation.source, op, results);
	}
	return( results )
    }
    mapSourceTree(op : (operation:SparqlOperation, location: JSONObject) => any, results: Array<any> = new Array(), state: JSONObject = {}) : Array<any>{
	var result = op(this, state);
	var source = this.source;
	results.push(result);
	if (source) {
	    source.mapSourceTree(op, results, state);
	}
	return( results );
    }
    mapOperations(op : (operation:SparqlOperation) => any) {
	op(this);
	if (this.source) { this.source.mapOperations(op); }
	if (this.child) { this.child.mapOperations(op); }
    }
    connect(connection : ConnectionOperation) {
	var thisOperation = this;
	this.mapOperations(function(op: SparqlOperation) {
	    op.connection = connection.model();
	    if (thisOperation.child) { thisOperation.child.parent = thisOperation; }
	    if (thisOperation.source) { thisOperation.source.destination = thisOperation; }
	});
    }
}

/* concreate sparql classes - one for each operator
 */

function translationErrorUnit(message: string, form: SparqlForm) : SparqlOperation {
    var unit = new Unit({form: form});
    // console.log(`translation failed: ${message}: ${JSON.stringify(form)}`);
    return( unit );
}

/*
 * the Ask operator is just a wrapper around the respective where
 */
export class Ask extends SparqlOperation {
    constructor(options: SparqlOptions = {}) {
	super(options);
    }
    computeForm() : AskQuery {
	return( {queryType: 'ASK',
		 type: 'query',
		 prefixes: {}} );
    }
    computeQuery(): AskQuery {
	var where = SparqlOperation.mapSources(this.source, function(operation: SparqlOperation) { return( operation.form ); });
	var form = Object.assign({}, this.form, {where: where.reverse()});
	return( <AskQuery>form );
    }
}

/*
 The BGP class comprises a sequence of statement patterns
 It also catalogs the available prdicates to be included in statement patterns
 */
export class BGP extends SparqlOperation {
    _triples: Triple[];
    subjectVariable : string;
    constructor(triples: Triple[], options: SparqlBGPOptions = {}) {
	super(options);
	var findSubjectVariable = function (triples: Triple[]) {
	    var found : Triple = triples.find(function(triple) {
		var term : TypedTerm = tripleSubject(triple);
		return( isVariable(term) );
	    });
	    return ( found ? tripleSubject(found).value : null );
	}
	this.triples = triples;
	this.subjectVariable = <string>options.subjectVariable
	    || findSubjectVariable(triples)
	    || 'subject';
    }
    
    computeExpression() : string {
	var form : GroupPattern = this.computeForm()
	var expression = generator.createGenerator().group(form, false);
    	console.log("BGP.ce: ", this, form, expression);
	return( expression );
    }

    computeForm() : GroupPattern {
	return( {type: "group",
		 patterns: [{type: 'bgp',
			     triples: this.triples}]} );
    }
    computeQuery(): SelectQuery {
	var query =<unknown> {queryType: "SELECT",
			      variables: [{termType: 'Wildcard', value: '*'}],
			      where: [ this.form ],
			      type: 'query',
			      prefixes: {}};
	return( <SelectQuery>query );
    }
    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlBgpLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }
    set triples(triples: Triple[]) {
	var thisBGP = this;
	this._triples = triples;
	this.propertyToDimension.clear();
	this.dimensionToProperty.clear();
	triples.forEach(function(triple: Triple) {
	    var predicate : TypedTerm = triplePredicate(triple);
	    var object : TypedTerm = tripleObject(triple);
	    if (isNamedNode(predicate) && isVariable(object)) {
		thisBGP.dimensionToProperty.set(object.value, predicate.value);
		thisBGP.propertyToDimension.set(predicate.value, object.value);
	    };
	});
    }
    get triples() : Triple[] {
	return( this._triples )
    }
    getPredicateDimension(predicate: string) {
	var variable = this.propertyToDimension.get(predicate);
	if (! variable) {
	    variable = new URL(predicate).pathname.split('/').pop();
	    this.setPredicateDimension(predicate, variable);
	}
	return( variable );
    }
    setPredicateDimension(predicate: string, variable: string) {
	this.propertyToDimension.set(predicate, variable);
	this.dimensionToProperty.set(variable, predicate);
	var triple: Triple = findTriplePattern(this.triples, {predicate: makeNamedNode(predicate)})
	if (triple) {
	    setTripleObject(triple, {termType: 'Variable', value: variable});
	}
    }
    getPredicateState(predicate: string) : boolean {
	return( findTriplePattern(this.triples, {predicate: makeNamedNode(predicate)}) ? true : false );
    }
    setPredicateState(predicate: string, state: boolean) {
	var subject = this.subjectVariable;
	var thisOperation = this;
	var modified = false;
	console.log('sps: ', this, predicate, state)
	if (state) { // add triple
	    if (! this._triples.some(function(triple) { return( triplePredicate(triple).value == predicate ); }) ) {
		// add the triple
		this._triples.push(<Triple><unknown>{subject: makeVariable(subject),
						     predicate: makeNamedNode(predicate),
						     object: makeVariable(thisOperation.getPredicateDimension(predicate))});
		modified = true;
	    }
	} else {
	    if (this._triples.some(function(triple) { return( triplePredicate(triple).value == predicate ); }) ) {
		// remove triple
		var triple: Triple = findTriplePattern(this.triples, {predicate: makeNamedNode(predicate)});
		if (triple) {
		    this.triples = this.triples.filter(function(test) { return( test !== triple ); });
		    modified = true;
		}
	    }
	}
	console.log('sps: ', this, this.view, modified);
	if (modified) { this.view.present(this, "query") };
    }
}

export function makeNamedNode (predicate: string) : TypedTerm {
    return( {termType: 'NamedNode', value: predicate} );
}
export function makeVariable (name: string) : TypedTerm {
    return( {termType: 'Variable', value: name} );
}

function isNamedNode(object: TypedTerm) {
    return( object.termType == 'NamedNode' );
}
function isVariable(object: TypedTerm) {
    return( object.termType == 'Variable' );
}

/*
 * the Construct operator combines its pattern with the respective where
 */
export class Construct extends SparqlOperation {
    template: Triple[];
    constructor(template: Triple[], options: SparqlOptions = {}) {
	super(options);
	this.template = template;
    }
    computeForm() : ConstructQuery {
	return( {queryType: 'CONSTRUCT',
		 template: this.template,
		 type: 'query',
		 prefixes: {}} );
    }
    computeQuery(): ConstructQuery {
	var where = SparqlOperation.mapSources(this.source, function(operation: SparqlOperation) { return( operation.form ); });
	var query = Object.assign({}, this.form, {where: where.reverse()});
	return( <ConstructQuery>query );
    }
}

export class Describe extends SparqlOperation {
    constants : string[] = [];
    constructor(variables: TypedTermList, options: SparqlOptions = {}) {
	super(Object.assign({}, {dimensions: SparqlOperation.translateVariables(variables)}, options));
	this.constants = SparqlOperation.translateNamedNodes(variables);
    }
    computeForm() : DescribeQuery {
	var describeTerms : TypedTermList = new Array();
	this.variableForms.forEach(function(term: TypedTerm) { describeTerms.push(term); });
	this.constantForms.forEach(function(term: TypedTerm) { describeTerms.push(term); });
	return( {queryType: 'DESCRIBE',
		 variables: <VariableList>(<unknown>describeTerms),
		 type: 'query',
		 prefixes: {}} );
    }
    computeQuery(): DescribeQuery {
	var where = SparqlOperation.mapSources(this.source, function(source) { return( source.form )});
	var query = Object.assign(this.form, {where: where.reverse()});
	return( <DescribeQuery>query );
    }

    get constantForms() : TypedTermList {
	var constants : TypedTermList = new Array();
	this.constants.forEach(function(value) {
	    constants.push({termType: "NamedNode", value: value});
	});
	return( constants );		       
    }
}


export class Extend extends SparqlOperation {
    valueExpression : Expression = null;
    constructor(variable : Variable, expression : Expression, options : JSONObject = {}) {
	super(Object.assign({variables: [variable]}, options));
	this.valueExpression = expression;
    }
    computeForm() : BindPattern {
	return( {variable: <Term>(<unknown>this.variableForms[0]),
		 expression: this.valueExpression,
		 type: 'bind'} );
    }
    computeQuery(): SelectQuery {
	var where = SparqlOperation.mapSources(this.source, function(operation: SparqlOperation) { return( operation.form ); });
	var query = {queryType: "SELECT",
		     variables: SparqlOperation.wildcardVariableList,
		     where: where.reverse(),
		     prefixes: {}};
	return( <SelectQuery>query );
    }
}

/*
 * a FIlter combines a predicate expression with a source field.
 */

export class Filter extends SparqlOperation {
    predicate : Expression = null;
    constructor(predicate: Expression, options: SparqlOptions = {}) {
	super(options);
	this.predicate = predicate;
    }

    computeExpression() : string {
	var form : FilterPattern = this.computeForm();
	var expression : string = generator.createGenerator().filter(form);
    	console.log("Filter.ce: ", this, form, expression);
	return( expression );
    }

    computeForm() : FilterPattern {
	return( { 'type': 'filter',
		  'expression': this.predicate } );
    }
    computeQuery(): SelectQuery {
	var where = SparqlOperation.mapSources(this, function(operation: SparqlOperation) { return( operation.computeForm() ); });
	var query = {queryType: 'SELECT',
		     variables: SparqlOperation.wildcardVariableList,
		     where: where.reverse(),
		     type: 'query',
		     prefixes: {},
		    }
	return( <SelectQuery>query );
    }

    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlFilterLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }
    deconstructExpression(expression: string) : string {
	expression = super.deconstructExpression(expression);
	this.predicate = (<FilterPattern>(this._form)).expression;
	return( expression );
    }
}

/*
 * a FIlter combines a predicate expression with a source field.
 */

export class Graph extends SparqlOperation {
    name : TypedTerm;
    constructor(name : TypedTerm, patterns: SparqlOperation, options: SparqlOptions = {}) {
	super(options);
	this.name = name;
	this.child = patterns;
    }
    computeExpression() : string {
	var form : GraphPattern = this.computeForm();
	var expression : string = generator.createGenerator().graph(form);
	return( expression );
    }

    computeForm() : GraphPattern {
	var patterns : PatternList =<PatternList> SparqlOperation.mapSources(this.child, function(operation: SparqlOperation) {
	    return( operation.form ); });
	return( { type: 'graph',
		  patterns: patterns.reverse(),
		  name: <Term>(<unknown>this.name)} );
    }
    computeQuery(): SelectQuery {
	var where = this.form;
	var query = {queryType: 'SELECT',
		     variables: SparqlOperation.wildcardVariableList,
		     where: where,
		     type: 'query',
		     prefixes: {},
		    }
	return( <SelectQuery> (<unknown>query) );
    }
    mapSourceTree(op : (operation:SparqlOperation, location: JSONObject) => any, results: Array<any> = new Array(), state: JSONObject = {}) : Array<any>{
	super.mapSourceTree(op, results, state);
	if (this.child) {
	    this.child.mapSourceTree(op, results, state);
	}
	return( results );
    }
}

/*
 The Join class represents a natural join of two constituent fields.
 It is a concrete algebra component, but does not appear in the parsed query forms.
 They represent joins implicitly, either as the sequence of patterns in a BGP or
 as the sequence of groups in a where clause.
 It is included here to provide API support to construct the join given groups.
 The standard use in connection with a parsed sparql form connects a chain of
 operations - one for each group in a where clause.
 The InnerJoin constructor expects just the complement group and binds it,
 while expecting the source to be set subsequently as for the other operators.
 */
export class Join extends SparqlOperation {
    constructor(source: SparqlOperation, group: SparqlOperation, options: SparqlOptions = {}) {
	super(options);
	this.source = source;
	this.child = group;
    }
    computeForm() : SparqlForm {
	return( this.child.form );
    }
    computeQuery(): SelectQuery {
	var where = SparqlOperation.mapSources(this, function(operation: SparqlOperation) { return( operation.form ); });
	var query =<unknown> {queryType: 'SELECT',
			      variables: SparqlOperation.wildcardVariableList,
			      where: where.reverse(),
			      type: 'query', 
			      prefixes: {}}
	return( <SelectQuery>query );
    }

    mapSourceTree(op : (operation:SparqlOperation, location: JSONObject) => any, results: Array<any> = new Array(), state: JSONObject = {}) : Array<any>{
	super.mapSourceTree(op, results, state);
	if (this.child) {
	    this.child.mapSourceTree(op, results, state);
	}
	return( results );
    }

    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlJoinLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }
}

/*
 The Optional class represents an Oouter join
 */
export class Optional extends SparqlOperation {
    constructor(group: SparqlOperation, options: SparqlOptions = {}) {
	super(options);
	this.child = group;
    }

    computeExpression() : string {
	var source = this.source;
	var sourceExpression = (source ? (source.expression + "") : "");
	var form : BlockPattern = this.computeForm();
	var expression : string = sourceExpression + generator.createGenerator().optional(form);
	return( expression );
    }
    computeForm() : BlockPattern {
	var where =<PatternList> SparqlOperation.mapSources(this.child, function(operation: SparqlOperation) { return( operation.form ); });
	return( {type: 'optional', patterns: where.reverse()} );
    }
    computeQuery(): SelectQuery {
	var query =<unknown> {queryType: 'SELECT',
			      variables: SparqlOperation.wildcardVariableList,
			      where: this.form,
			      type: 'query',
			      prefixes: {}}
	return( <SelectQuery>query );
    }

    mapSourceTree(op : (operation:SparqlOperation, location: JSONObject) => any, results: Array<any> = new Array(), state: JSONObject = {}) : Array<any>{
	super.mapSourceTree(op, results, state);
	if (this.child) {
	    this.child.mapSourceTree(op, results, state);
	}
	return( results );
    }

    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlOptionalLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }
}

export class Select extends SparqlOperation {
    constructor(options: SparqlOptions = {}) {
	super(options);
    }
    computeForm() : SelectQuery {
	var where =<PatternList> SparqlOperation.mapSources(this.source, function(operation: SparqlOperation) { return( operation.form ); });
	var form =<unknown>
	    {type: 'query', queryType: 'SELECT',
	     variables: this.dimensions.map(function(name) { return( {termType: 'Variable', value: name} ); }),
	     where: where.reverse(),
	     prefixes: {}};
	return( <SelectQuery> form );
    }
    computeQuery(): SelectQuery {
	return( <SelectQuery> (this.form) );
    }
}

/* a UNION is represented as a typed pattern sequence. */
export class Union extends SparqlOperation {
    constructor(source: SparqlOperation, group: SparqlOperation, options: SparqlOptions = {}) {
	super(options);
	this.source = source;
	this.child = group;
    }
    computeExpression() : string {
	var form : BlockPattern = this.computeForm();
	var expression : string = generator.createGenerator().union(form);
	return( expression );
    }
    computeForm() : BlockPattern {
	var where =<PatternList> [<Pattern>this.source.form, <Pattern>this.child.form];
	return( {type: 'group', patterns: [{type: 'union', patterns: where}]} );
    }
    computeQuery(): SelectQuery {
	// var where =<SparqlForm[]> SparqlOperation.mapSources(this, function(operation: SparqlOperation) { return( operation.form ); });
	var query =<unknown> {queryType: 'SELECT',
			      variables: SparqlOperation.wildcardVariableList,
			      where: this.computeForm(),
			      type: 'query',
			      prefixes: {}}
	return( <SelectQuery>query );
    }

    mapSourceTree(op : (operation:SparqlOperation, location: JSONObject) => any, results: Array<any> = new Array(), state: JSONObject = {}) : Array<any>{
	super.mapSourceTree(op, results, state);
	if (this.child) {
	    this.child.mapSourceTree(op, results, state);
	}
	return( results );
    }

    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlUnionLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }
}


/**
 * a Service represent a request to a remote SPARQL endpoint
 */

export class Service extends SparqlOperation {
    silent : boolean;
    location : TypedTerm;
    constructor(location: TypedTerm, child: SparqlOperation, silent: boolean = false, options: SparqlOptions = {}) {
	super(options);
	this.location = location;
	this.child = child;
	this.silent = silent;
    }

    computeExpression() : string {
	var form : ServicePattern = this.computeForm();
	var expression : string = generator.createGenerator().service(form);
	return( expression );
    }

    computeForm() : ServicePattern {
	var childPattern =<Pattern> this.child.computeForm();
	return( {type: 'service',
		 name: Term(this.location),
		 silent: this.silent,
		 patterns: [ childPattern ] } );
    }
    computeQuery(): SelectQuery {
	var where =<SparqlForm[]> SparqlOperation.mapSources(this, function(operation: SparqlOperation) { return( operation.form ); });	
	var form = {type: 'query', queryType: 'SELECT', variables: SparqlOperation.wildcardVariableList, prefixes: {},
		    where: where.reverse() };
	return( <SelectQuery>form );
    }
    computeView(options: JSONObject = {}) : Layer {
	let view = new SparqlServiceLayer(this, Object.assign({}, options, {id: this.id}));
	return( view );
    }
}

/**
 * a Unit represents a dimensioned, null field with no source.
 */

export class Unit extends SparqlOperation {
    constructor(options: SparqlOptions = {}) {
	super(options);
    }
    computeExpression() : string {
	return( "{ }" );
    }
    computeForm() : GroupPattern {
	return( { type: 'group',
		  patterns: <PatternList>[] } );
    }
    computeQuery(): SelectQuery {
	var query =<unknown> { type: 'query',
			       queryType: 'SELECT',
			       variables: this.variableForms,
			       prefixes: {},
			       where: [ this.form ]
			     };
	return( <SelectQuery>query );
    }

}



export class Values extends SparqlOperation {
    values: ValuePatternRow[];
    constructor(values: ValuePatternRow[], options: SparqlOptions = {}) {
	super(options);
	this.values = values;
    }

    computeExpression() : string {
	var form : ValuesPattern = this.computeForm();
	var expression : string = generator.createGenerator().values(form);
	return( expression );
    }

    computeForm() : ValuesPattern {
	return( {type: 'values',
		 values: this.values} );
    }
    computeQuery(): SelectQuery {
	var where =<SparqlForm[]> SparqlOperation.mapSources(this, function(operation: SparqlOperation) { return( operation.form ); });	
	var form = {type: 'query', queryType: 'SELECT', variables: SparqlOperation.wildcardVariableList, prefixes: {},
		    where: where.reverse() };
	return( <SelectQuery>form );
    }
}


/*
 * Translate parsed forms into operations
 * for some forms (filter, values, bgp) this is direct as the type and the
 * immediate fields describe the operation.
 * for others (query, group) either a secondary type is needed or a component
 * object described the operation.
 */
    
function translateAskForm (sparqlForm: AskQuery) : SparqlOperation {
    var where =<SparqlForm[]> sparqlForm.where;
    if (where) {
	var source = SparqlOperation.translateSparqlWhere(where);
	var ask = new Ask();
	ask.source = source;
	return( ask );
    }
    return( translationErrorUnit("invalid ASK form", sparqlForm) );
}
SparqlOperation.formTranslators.set('ask', translateAskForm);

function translateBGPForm(sparqlForm: BgpPattern | BlockPattern) : SparqlOperation {
    if (sparqlForm.type == 'group') {
	var patterns = sparqlForm.patterns;
	sparqlForm =<BgpPattern> patterns[0];
    }
    if (sparqlForm.type == "bgp") {
	var triples = sparqlForm.triples;
	if (triples) {
	    return( new BGP(triples) );
	}
    }
    return( translationErrorUnit("invalid BGP form", sparqlForm) );
}
SparqlOperation.formTranslators.set('bgp', translateBGPForm);

function translateConstructForm (sparqlForm: ConstructQuery) : SparqlOperation {
    var where = sparqlForm.where;
    var template = sparqlForm.template;
    if (where) {
	var source = SparqlOperation.translateSparqlWhere(where);
	var construct = new Construct(<Triple[]> template);
	construct.source = source;
	return( construct );
    }
    return( translationErrorUnit("invalid CONSTRUCT form", sparqlForm) );
}
SparqlOperation.formTranslators.set('construct', translateConstructForm);

function translateDescribeForm (sparqlForm: DescribeQuery) : SparqlOperation {
    var where = sparqlForm.where;
    var variables : TypedTermList =<TypedTermList> (<unknown>sparqlForm.variables);
    if (where && variables) {
	var source = SparqlOperation.translateSparqlWhere(where);
	var describe = new Describe(variables);
	describe.source = source;
	return( describe );
    }
    return( translationErrorUnit("invalid DESCRIBE form", sparqlForm) );
}
SparqlOperation.formTranslators.set('describe', translateDescribeForm);

function translateExtendForm (sparqlForm: BindPattern) : SparqlOperation {
    var variable : Variable =<Variable> sparqlForm.variable;
    var expression = sparqlForm.expression;
    if (variable && expression) {
	var extend = new Extend(variable, expression);
	return( extend );
    }
    return( translationErrorUnit("invalid EXTEND form", sparqlForm) );
}
SparqlOperation.formTranslators.set('extend', translateExtendForm);

function translateFilterForm(sparqlForm: FilterPattern) : SparqlOperation {
    var expression = sparqlForm.expression;
    if (expression) {
	return( new Filter(expression) );
    }
    return( translationErrorUnit("invalid FILTER form", sparqlForm) );
}
SparqlOperation.formTranslators.set('filter', translateFilterForm);

function translateGraphForm(sparqlForm: GraphPattern) : SparqlOperation {
    var name =<TypedTerm> (<unknown>sparqlForm.name);
    var patterns = SparqlOperation.translateSparqlWhere(sparqlForm.patterns);
    // console.log('tGF: patterns: ', patterns);
    if (name && patterns) {
	return( new Graph(name, patterns) );
    }
    return( translationErrorUnit("invalid GRAPH form", sparqlForm) );
}
SparqlOperation.formTranslators.set('graph', translateGraphForm);

function translateGroupForm(sparqlForm: GraphPattern) : SparqlOperation {
    var patterns = sparqlForm.patterns;
    if (patterns) {
	var operation = SparqlOperation.translateSparqlWhere(patterns);
	return( operation );
    }
    return( translationErrorUnit("invalid GROUP form", sparqlForm) );
}


SparqlOperation.formTranslators.set('group', translateGroupForm);

// no Join as it does not appear explicitly in parsed forms

function translateOptionalForm (sparqlForm: BlockPattern) : SparqlOperation {
    var patterns =<SparqlForm[]> (<unknown> sparqlForm.patterns);
    if (patterns) {
	return( new Optional(SparqlOperation.translateSparqlWhere(patterns)) );
    }
    return( translationErrorUnit("invalid OPTIONAL form", sparqlForm) );
}
SparqlOperation.formTranslators.set('optional', translateOptionalForm);

function translateQueryForm(sparqlForm: Query) : SparqlOperation {
    var queryType = sparqlForm.queryType;
    if (queryType) {
	return( SparqlOperation.translateSparqlForm(sparqlForm, queryType) );
    }
    return( translationErrorUnit("invalid QUERY form", sparqlForm) );
}
SparqlOperation.formTranslators.set('query', translateQueryForm);

function translateSelectForm(sparqlForm: SelectQuery)  : SparqlOperation {
    var where =<SparqlForm[]> (<unknown> sparqlForm.where);
    var variables =<TypedTermList> (<unknown>sparqlForm.variables);
    if (where) {
	var source = SparqlOperation.translateSparqlWhere(where);
	var select = new Select({variables: variables});
	select.source = source;
	return( select );
    }
    return( translationErrorUnit("invalid SELECT form", sparqlForm) );
}
SparqlOperation.formTranslators.set('select', translateSelectForm);

function translateUnionForm (sparqlForm: BlockPattern) : SparqlOperation {
    var patterns =<SparqlFormList> (<unknown> sparqlForm.patterns);
    // console.log("tuf: patterns", patterns);
    if (patterns && patterns.length == 2) {
	var operations =<SparqlOperationList> (<unknown>patterns.map(function(pattern) {
	    return( SparqlOperation.translateSparqlForm(pattern) );
	}));
	// console.log("tuf: operations", operations);
	var source : SparqlOperation = operations[0];
	var child : SparqlOperation = operations[1];
	return( new Union(source, child) );
    }
    return( translationErrorUnit("invalid UNION form", sparqlForm) );
}
SparqlOperation.formTranslators.set('union', translateUnionForm);

function translateServiceForm(sparqlForm: ServicePattern) : SparqlOperation {
    var location = TypedTerm(sparqlForm.name);
    var silent = sparqlForm.silent || false;
    var patterns =<SparqlFormList> (<unknown> sparqlForm.patterns);
    // console.log("tuf: patterns", patterns);
    if (patterns && patterns.length == 1) {
	var child = SparqlOperation.translateSparqlForm(patterns[0]);
	return( new Service(location, child, silent) );
    }
    return( translationErrorUnit("invalid SERVICE form", sparqlForm) );
}
SparqlOperation.formTranslators.set('service', translateServiceForm);

function translateUnitForm(sparqlForm: SelectQuery) : SparqlOperation {
    var variables =<TypedTermList> (<unknown>sparqlForm.variables);
    return( new Unit({variables: variables}) );
}
SparqlOperation.formTranslators.set('unit', translateUnitForm);

function translateValuesForm(sparqlForm: SparqlForm) : SparqlOperation {
    var values =(<ValuesPattern> sparqlForm).values;
    if (values) {
	return( new Values(values) );
    }
    return( translationErrorUnit("invalid VALUES form", sparqlForm) );
}
SparqlOperation.formTranslators.set('values', translateValuesForm);
