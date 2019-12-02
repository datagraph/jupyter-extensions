// Copyright (c) 2019 datagraph gmbh

/**
 Implement SPARQL and Graph Store protocol operations based on
 - fetch network operators
 - rdf codecs and data model

 The operations are defined as static functions for the GSP and SPARQL classes.
 */

import { NamedNode, BlankNode, Literal } from './rdf-environment';
import ulog from "ulog";
ulog.level = ulog.DEBUG;
const log = ulog('view');

const now = Date.now;

function logFetch(location, args) {
  log.debug('fetch: location: ', location, 'args: ', args);
  var headers = args.headers;
  for (var [k,v] of headers.entries()) { log.debug('fetch: header:', [k,v])};
  var p = fetch(location, args);
  p.location = location;
  p = p.then(function(response) {
        if (response.ok) {
          return (response);
        } else {
            log.debug("fetch response: ${response.status}");
	    for (var [k,v] of response.headers.entries()) { log.debug('response: header:', [k,v])};
            return (response);
        }
      });
  // console.log(p);
  return (p);
}

/**
 The GSP class comprises the interface operators for the Graph Store Protocol
 */
export class GSP {
}
window.GSP = GSP;
GSP.locationSuffix = "/service";
GSP.fetchOp = logFetch;

/**
 The SPARQL class comprises the interface operators for the SPARQL Protocol
 */
export class SPARQL {
    static decode(response, continuation, mediaType = (response.headers['content-type'] || SPARQL.get.acceptMediaType)) {
	log.debug('SPARQL.decode: ', response);
	SPARQL.decode[mediaType](response, continuation);
    }

}
window.SPARQL = SPARQL;
SPARQL.locationSuffix = "/sparql";
SPARQL.fetchOp = logFetch;

/**
 * decode json representation as per
 *    https://www.w3.org/TR/sparql11-results-json/#select-encode-terms
 */

SPARQL.decode['application/sparql-results+json'] = function(response, continuation) {
    log.debug("SPARQL: response: ", response);
    response.json().then(function(result) {
	console.log("SPARQL: json: ", result);
	var dimensions = result.head.vars;
	var field = result.results.bindings.map(function(solution) {
	    var values = dimensions.map(function(dimension) {
		var valueObject = solution[dimension];
		var value = valueObject.value;
		var type = valueObject.type;
		switch (type) {
		case 'URI':
		case 'uri':
		    return( new NamedNode(value) );
		case 'bnode':
		case 'BNODE':
		    return( new BlankNode(value) );
		case 'literal':
		case 'literal':
		    var lang = valueObject['xml:lang'] || null;
		    var datatype = valueObject['datatype'] || null;
		    return( new Literal(value, language, datatype) );
		default:
		    log.warn('SPARQL.decode: unknown type: ', type, value);
		    return( new Literal(`${type}(${value})`, null, null) );
		}
	    });
	    return( values );
	});
	console.log("SPARQL: field: ", field);
	return( {dimensions: dimensions, solutions: field} );
    }).then(continuation);
}

// provide default encoding functions
String.prototype.encode = {
 'application/n-quads': function(object) { return( object ); },
 'text/turtle': function(object) { return( object ); },
 'application/n-quads': function(object) { return( object ); }
};



// define generic protocol interface
// graph store protocol


/**
 GSP.delete
 Perform a GSP delete given the location, options for authentication and response
 content type, and an optional continuation operator.
 @param {string} location - the host and target repository name
 @param {Object} [options]
 @param {string} options.etag - the client revision identifer to identify the transaction
 @param {string} options.authentication - the basic authoentication string
 @param {string} options.Accept - the media type for the confirmation response
 @param {string} options.contentDisposition - the replication disposition route
 @param {string} options.graph - the target graph
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 @returns {Promise}
 */

GSP.delete = function(location, options = {}, continuation) {
  var headers = new Headers({ "Accept": (options["Accept"] || GSP.get.acceptMediaType) });
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  if (options.etag) { headers.set("ETag", options.etag) }
  if (options.contentDisposition) { headers.set("Content-Disposition", options.contentDisposition); }
  var args = { method: "DELETE",
               cache: "no-cache",
               headers: headers };
  var constraint = options['graph'];
  location = location + GSP.locationSuffix;
  if (constraint) {
    location = location + '?graph=' + encodeURIComponent(constraint);
  }
  var p = GSP.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
/**
 The default accept media type for delete requests
 */
GSP.delete.acceptMediaType = 'text/turtle';


/**
 GSP.get
 Perform a GSP delete given the location, options for authentication and response
 content type, and an optional continuation operator.
 @param {string} location - the host and target repository name
 @param {Object} [options]
 @param {string} options.etag - the client revision identifer to identify the transaction
 @param {string} options.authentication - the basic authoentication string
 @param {string} options.Accept - the media type for the response document
 @param {string} options.subject - a subject constraint
 @param {string} options.predicate - a predicate constraint
 @param {string} options.object - an object constraint
 @param {string} options.graph - a graph constraint
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 */

GSP.get = function(location, options = {}, continuation) {
  var headers = new Headers({ "Accept": (options["Accept"] || GSP.get.acceptMediaType) });
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  var args = { method: "GET",
               cache: "no-cache",
               headers: headers };
  var constraintCount = 0;
  location = location + GSP.locationSuffix;
  ['subject', 'predicate', 'object', 'graph'].forEach(function(term) {
    var constraint = options[term];
    if (constraint) {
      location = location + ( (0 == constraintCount) ? '?' : '&') + term + '=';
      location = location + encodeURIComponent(constraint);
    }
  });
  var p = GSP.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
GSP.get.acceptMediaType = 'application/n-quads';


/**
 GSP.head
 @param {string} location - the host and target repository name
 @param {Object} [options]
 @param {string} options.authentication - the basic authoentication string
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 */

GSP.head = function(location, options, continuation) {
  var headers = new Headers({});
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  var args = { method: "HEAD",
               cache: "no-cache",
               headers: headers };
  location = location + GSP.locationSuffix;
  var p = GSP.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}


/**
 GSP.patch
 Perform a GSP patch given the location, content, options for authentication and section
 content type, and an optional continuation operator.
 The content is first encoded as per the given content type and a request is issued
 with the given headers.
 @param {string} location - the host and target repository name
 @param {Patch} content - the request content
 @param {Object} [options]
 @param {string} options.etag - the client revision identifer to identify the transaction
 @param {string} options.authentication - the basic authentication string
 @param {string} options.Accept - the media type for the response document
 @param {string} options.contentDisposition - the replication disposition route
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 */

GSP.patch = function (location, content, options = {}, continuation) {
  console.log("GSP.patch", location, content, options);
  var contentType = options["Content-Type"] || GSP.patch.contentMediaType;
  var headers = new Headers({ "Accept": (options["Accept"] || GSP.patch.acceptMediaType),
                              "Content-Type": contentType,});
  var contentEncoded = ""
  var boundary = null;
  //console.log("GSP.patch");
  //console.log(options);
  if (options['authentication']) {
    headers.set("Authorization",'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  if (options.etag) { headers.set("ETag", options.etag) }
  if (options.contentDisposition) { headers.set("Content-Disposition", options.contentDisposition); }
  //console.log(headers);
  //console.log(content);
  //console.log(contentType);
  content.encode(contentType, function(e, options ={}) {
    contentEncoded = e;
    boundary = options.boundary
  });
  if (boundary) {
    headers.set("Content-Type", headers.get("Content-Type") + `; boundary=${boundary}`);
  }
  var args = { method: "PATCH",
               headers: headers,
               body: contentEncoded };
  var httpURL = location + GSP.patch.locationSuffix;
  var p = GSP.fetchOp(httpURL, args);
  return (continuation ? p.then(continuation) : p);
}
GSP.patch.acceptMediaType = 'text/turtle';
GSP.patch.contentMediaType = 'multipart/related';
GSP.patch.locationSuffix = GSP.locationSuffix;


/**
 GSP.post
 Perform a GSP post given the location, content, options for authentication, and an optional continuation operator.
 The content is first encoded as per the given content type and a request is issued
 with the given headers.
 @param {string} location - the host and target repository name
 @param {Graph} content - the request content
 @param {Object} [options]
 @param {string} options.etag - the client revision identifer to identify the transaction
 @param {string} options.authentication - the basic authentication string
 @param {string} options.Accept - the media type for the response document
 @param {string} options.contentDisposition - the replication disposition route
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 */

GSP.post = function (location, content, options = {}, continuation) {
  var contentType = options["Content-Type"] || GSP.post.contentMediaType;
  var headers = new Headers({ "Accept": (options["Accept"] || GSP.post.acceptMediaType),
                              "Content-Type": contentType });
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  if (options.etag) { headers.set("ETag", options.etag) }
  if (options.contentDisposition) { headers.set("Content-Disposition", options.contentDisposition); }
  var contentEncoded = "";
  content.encode(contentType, function(e) { contentEncoded = e; });

  var args = { method: "POST",
               headers: headers,
               body: contentEncoded };
  location = location + GSP.locationSuffix;
  var p = GSP.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
GSP.post.acceptMediaType = 'text/turtle';
GSP.post.contentMediaType = 'application/n-quads';


/**
 GSP.put
 Perform a GSP put given the location, content, options for authentication, and an optional continuation operator.
 The content is first encoded as per the given content type and a request is issued
 with the given headers.
 @param {string} location - the host and target repository name
 @param {Graph} content - the request content
 @param {Object} [options]
 @param {string} options.etag - the client revision identifer to identify the transaction
 @param {string} options.authentication - the basic authentication string
 @param {string} options.Accept - the media type for the response document
 @param {string} options.contentDisposition - the replication disposition route
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 */

GSP.put = function (location, content, options = {}, continuation) {
  var contentType = options["Content-Type"] || GSP.put.contentMediaType;
  var headers = new Headers({ "Accept": (options["Accept"] || GSP.put.acceptMediaType),
                              "Content-Type": contentType });
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  if (options.etag) { headers.set("ETag", options.etag) }
  if (options.contentDisposition) { headers.set("Content-Disposition", options.contentDisposition); }
  var contentEncoded = "";
  content.encode(contentType, function(e) { contentEncoded = e; });

  var args = { method: "PUT",
               headers: headers,
               body: contentEncoded };
  location = location + GSP.locationSuffix;
  var p = GSP.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
GSP.put.AcceptType = 'text/turtle';
GSP.put.ContentType = 'application/n-quads';



// sparql protocol


/**
 SPARQL.get
 Execute a SPARQL query given a location and a query text.
 The request URL combines the location, the SPARQL endpoint suffix and the url-encoded query text.
 A promise is created. Given a continuation, it is supplied to the promise,
 otherwise the active promise is returned.
 @param {string} location - the host and target repository name
 @param {string} query - the request content
 @param {Object} [options]
 @param {string} options.authentication - the basic authentication string
 @param {string} options.Accept - the media type for the response document
 @param {function} [continuation] - if supplied, used to invoke the fetch promise.
 */

SPARQL.get = function(location, query, options = {}, continuation = null) {
  // console.log("SPARQL.get ", query, options);
  var headers = new Headers({ "Accept": (options["Accept"] || SPARQL.get.acceptMediaType) });
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  var args = { method: "GET",
               cache: "no-cache",
               headers: headers  };
  if (query) {
    var queryArgument = (query ? ("query=" + encodeURIComponent(query)) : null);
    location = location + SPARQL.locationSuffix;
    location += "?" + queryArgument;
  } else if (location.split('/').length = 6) {
      // it is a view
  } else {
    throw (new Error(`SPARQL.get: a query text is required: '${location}'`));
  }
  var p = SPARQL.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
SPARQL.get.contentMediaType = null;
SPARQL.get.acceptMediaType = 'application/sparql-results+json';


/**
 SPARQL.view
 Execute a SPARQL query given a location and a view name
 The request URL combines the location, the SPARQL endpoint suffix and the view name.
 A promise is created. Given a continuation, it is supplied to the promise,
 otherwise the active promise is returned.
 */

SPARQL.view = function(location, viewName, options = {}, continuation) {
  var headers = new Headers({ "Accept": (options["Accept"] || SPARQL.view.acceptMediaType)});
  if (options['authentication']) {
    headers.set("Authorization",
                'Basic ' + btoa(":" + options['authentication']));
  } else {
    headers.delete("Authorization");
  }
  var args = { method: "GET",
               cache: "no-cache",
               headers: headers  };
  if (viewName) {
    location = location + "/" + viewName
  } else {
    throw (new Error(`SPARQL.view: a view name is required: '${location}'`));
  }
  var p = SPARQL.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
SPARQL.view.contentMediaType = null;
SPARQL.view.acceptMediaType = 'application/sparql-results+json';


/**
 SPARQL.post
 Execute a SPARQL query given a location and a query text.
 The request URL combines the location and the SPARQL endpoint suffix.
 The query text is sent a the request body.
 A promise is created.
 Given a continuation, it is supplied to the promise,
 otherwise the active promise is returned.
 */
SPARQL.post = function(location, query, options = {}, continuation) {
  var contentType = options["Content-Type"] || SPARQL.post.contentMediaType;
  var headers = new Headers({ "Accept": (options["Accept"] || SPARQL.post.acceptMediaType),
                              "Content-Type": contentType });
  var args = { method: "POST",
               cache: "no-cache",
               headers: headers,
               body: query };
  if (query) {
    location = location + SPARQL.locationSuffix;
  } else {
    throw (new Error(`SPARQL.get: a query text is required: '${location}'`));
  }

  var p = SPARQL.fetchOp(location, args);
  return (continuation ? p.then(continuation) : p);
}
SPARQL.post.acceptMediaType = 'text/turtle';
SPARQL.post.contentMediaType = 'application/sparql-query';

////////////////////////////////////////////////////////////////////////////////

// console.log('rdf-graph-store: loaded');

