/*
Comment widget easiest one , test the Canvas
*/
import { Widget } from '@phosphor/widgets';
//import { v4 as uuid } from '@types/uuid';
import { SPARQL } from './replication/rdf-client';
import { Parser } from 'sparqljs';
var parser = new Parser();

//import {
 // VirtualDOM, VirtualElement, VirtualText, h
//} from '@phosphor/virtualdom';
  
export class Comment extends Widget {
  id: string;
  type: string;

  constructor(widget_id: string, query: string) {
    /* Constructor takes an optional id for reconstruction
    of an existing canvas, otherwise a new id is assigned*/
    if (widget_id) {
      super({ node: Comment.createNode(widget_id) });
    } else {
      super({ node: Comment.createNode('comment') });
    }
    // To make tsc happy
    this.id = widget_id;
    this.type = 'sth';
    console.log('node', this.node);
    let divs = this.node.getElementsByTagName('div');
    console.log('divs', divs);
    let theDiv = divs.item(3);
    console.log('div', theDiv);
    let theText = theDiv.getElementsByTagName('textarea').item(0);
    let parsedQuery = parser.parse(query);

    SPARQL.get('https://nl4.dydra.com/james/foaf', query)
              .then(function(response: any) {
	        console.log(response);
		response.text().then(function(text: string) {
		  theText.innerHTML =  query + ' =\n' + JSON.stringify(parsedQuery) + ' =\n' + text ;
		}) });
  }

  static createNode(widget_id: string): HTMLElement {
    // Create two widgets, delete me and make me dynamic later
    let node_comment = document.createElement('div');
    node_comment.id = widget_id;

    node_comment.innerHTML =
      '<div class="head">' +
      '<div class="left">Comment</div>' +
      '<div class="right">' +
      '<a href="#" class="close"><i class="icon-exit"></i></a>' +
      '</div>' +
      '</div>' +
      '<div class="body">' +
      '<textarea id="comment" rows=8 placeholder= "Your comment here.."> </textarea>' +
      '</div>';

    node_comment.setAttribute('class', 'window');

    /*node_comment.setAttribute(
      'onMouseUp',
      "get_window_position_state('" + widget_id + "')"
    );*/
    return node_comment;
  }
  public createInstance(): void {
    //let body = document.body;
    //window.console.log(' Creating a comment');
    // Get canvas
    let canvas = document.getElementById('graphContainer');
    Widget.attach(this, canvas);
    (window as any).eval('visualize()');
  }
}
