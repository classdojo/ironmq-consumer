var expect = require("expect.js");
var expect = require("expect.js");
var Queue = require("../lib").Queue;
var IronMQStub = require("./stubs/ironmq");
var sleep = require("sleep");
var _     = require("lodash");

/*
{ id: '5942486501293943295',
  body: '{"type":"job:subJob","data":{},"created":"\\"2013-11-04T19:22:37.423Z\\"","attempts":0}',
  timeout: 60,
  reserved_count: 1,
  push_status: {} }
*/


describe("Queue", function() {
  var queueName = "jobtest";
  var defaultQueueOptions = {
    token: "sometoken",
    projectId: "someprojectId",
    name: queueName  
  };


  describe("#get", function() {
    var exampleJob1 = {
      body: {
        "type": "job:subJob",
        "data": {
          "job": "one"
        },
        "created": "2013-11-04T19:22:37.423Z",
        "attempts": 0
      }
    };

    var exampleJob2 = {
      body: {
        "type": "job:subJob",
        "data": {
          "job": "two"
        },
        "created": "2013-11-04T19:22:38.423Z",
        "attempts": 0
      }
    };

    it("should accept the options parameter", function(done) {
      var queue = new Queue(defaultQueueOptions);
      queue.get({}, function(err, messages) {
        done();
      });
    });

    it("should not require the options parameter", function(done) {
      var queue = new Queue(defaultQueueOptions);
      queue.get(function(err, messages) {
        done();
      });
    });


    describe("from an empty queue", function() {
      var queue;
      before(function() {
        queue = new Queue(defaultQueueOptions);
      });

      it("should return an empty array", function(done) {
        queue.get(function(err, messages) {
          expect(err).to.be(null);
          expect(messages).to.have.length(0);
          done();
        });
      });
    });

    describe("one message from non-empty queue", function() {
      var queue;
      before(function() {
        //create ironmq stub with one message injected
        var ironMQ = new IronMQStub.Client();
        ioQueue = ironMQ.queue(queueName);
        ioQueue.setMessages([exampleJob1]);
        //create
        queue = new Queue(_.extend(defaultQueueOptions, {client: ironMQ}));
      });

      it("should return an array with one message", function(done) {
        queue.get(function(err, messages) {
          expect(err).to.be(null);
          expect(messages).to.have.length(1);
          done();
        });
      });

    });

    describe("> 1 message from non-empty queue", function() {
      var queue;
      before(function() {
        //create ironmq stub with one message injected
        var ironMQ = new IronMQStub.Client();
        ioQueue = ironMQ.queue(queueName);
        ioQueue.setMessages([exampleJob1, exampleJob2]);
        //create
        queue = new Queue(_.extend(defaultQueueOptions, {client: ironMQ}));
      });

      it("should return an array with > 1 message in it", function(done) {
        queue.get({n: 2}, function(err, messages) {
          expect(err).to.be(null);
          expect(messages).to.have.length(2);
          done();
        });
      });
    });
  });

});


