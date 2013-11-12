/* 

  Stub that captures the data sent to ironmq. The
  functionality is taken from the official IronMQ node
  client found here: https://github.com/iron-io/iron_mq_node

*/
var _ = require("lodash");

function Client (opts) {
  this.__opts = opts;
  this.__queues = {};
}

Client.prototype.queue = function(queueName) {
  if (this.__queues[queueName]) {
    return this.__queues[queueName];
  }
  var q = new Queue(queueName);
  this.__queues[queueName] = q;
  return q;
}

function Queue(name){
  this.name = name;
  this.__messages = [];
}

/**
 * Post an object to the IronMQ queue.
 * 
 * Examples:
 *
 *  queue.post("Hello World!", function(err){
 *
 *  });
 *   
 * queue.post({body: "Hello World!"}, function(err) {
 *
 *  });
 *
 *  queue.post(
 *    [{body: "Hello World1!"},
 *     {body: "Hello World2!"}],
 *    function(err) {}
 *  );
 *
 * @param {String|Object|Array} data
 * @param {Function} cb
 */

Queue.prototype.post = function(data, cb) {
  if (_.isArray(data)) {
    //map through body and push onto data.
    for (item in data) {
      _pushMessage(this, data[item]);
    }
  } else if (_.isString(data)) {
    _pushMessage(this, data);
  } else if (_.isObject(data)) {
    _pushMessage(this, data);
  } else {
    return cb(new Error("Invalid Type"));
  }
  cb(null); //always success
}

/**
 * Get N objects from the IronMQ queue.
 * 
 * Examples:
 *
 * queue.get({}, function(err, body){
 *    //body is 1 message object
 * });
 *   
 * queue.get({n: 5}, function(err, body) {
 *   //body is an array of message objects
 * });
 *
 * An example of a body object is:
 *
 * {
 *   "type": "mailgun:update_list",
 *   "data": {
 *     // Object|String included depending on data `post`ed to queue.
 *   },
 *   "created": "'2013-11-02T00:30:17.765Z'",
 *   "attempts": 0
 * }
 *
 * If there are no messages on the queue [] is passed to the callback if n > 1, else
 * `undefined` is passed back.
 *
 * @param {Object} options
 * @param {Function} cb
 */
Queue.prototype.get = function(options, cb) {
  var BaseId = 5940635112690560000;
  var random = 1000 + Math.floor(Math.random() * 100);
  var value;
  var defaultResponse = {
    timeout: 60,
    reserved_count: 3,
    push_status: {}
  };
  if (options && options.n > 1) {
    //create array
    if (_.isEmpty(this.__messages)) {
      return cb(null, []);
    }
    var me = this;
    value = _.times(options.n, function() {
      return _popMessage(me);
    });
  }
  else {
    value = _popMessage(this);
  }
  cb(null, value);
}

Queue.prototype.del = function(id, cb) {
 //null, '1': { msg: 'Deleted' } }
 //{ '0': [Error: {"msg":"Message not found"}], '1': null }
 //find message in queue
 var index = _.find(this.__messages, function(e) {return e == id});
 if (index < 0) {
  cb(new Error("Message not found"), null)
 } else {
  var message = this.__messages[index];
  this.__messages = this.__messages.splice(index, 1); //remove message from array
  cb(null, {msg: "Deleted"});
 }
}

Queue.prototype.msg_release = function(id, options, cb) {
  //just always succeed on release
  cb(null, {msg: "Released"});
}

Queue.prototype.clear = function() {
  this.__messages = [];
}

/*
  Test method.  Sets the Queue
*/
Queue.prototype.setMessages = function(messages) {
  this.clear();
  for ( message in messages ) {
    _pushMessage(this, messages[message]);
  }
}

exports.Client = Client;


/*
  private fns
*/

var _popMessage = function(queue) {
  var body = queue.__messages.splice(0,1)[0]; //pop a message off
  if(!body) {
    return undefined;
  }
  //if there's a message package up with some default meta-data.
  var BaseId = 5940635112690500000;
  var defaultResponse = {
    timeout: 60,
    reserved_count: 3,
    push_status: {}
  };
  var randomId = BaseId + (10000 + Math.floor(Math.random() * 1000));
  return _.extend(defaultResponse, {id: randomId, body: body});
}

var _pushMessage = function(queue, message) {
  if (_.isString(message)) {
    //just push onto queue
    queue.__messages.push(message);
  } else if (_.isObject(message)) {
    //must have body: param.
    if (message.body) {
      //if is object stringify and pass on.
      if(_.isString(message.body)) {
        queue.__messages.push(message.body);
      } else if (_.isObject(message.body)) {
        queue.__messages.push(JSON.stringify(message.body))
      } else {/*do nothing*/}
    }
  }
}
