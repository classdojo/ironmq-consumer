var expect = require("expect.js");
var expect = require("expect.js");
var Queue = require("../lib").Queue;
var ErrorJournal = require("../lib").ErrorJournal;
var IronMQStub = require("stubs").IronMQ;
var sleep = require("sleep");
var _     = require("lodash");
var jobFixtures = require("./fixtures/testJobs");

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
    token: "someToken",
    projectId: "someprojectId",
    name: queueName,
  };
  beforeEach(function() {
    defaultQueueOptions.errorJournal = new ErrorJournal();
  });

  describe("options constructor", function() {
    it("should require `token` on initialialization", function(done) {
      options = _.cloneDeep(defaultQueueOptions);
      delete options.token;
      try {
        new Consumer(options);
      } catch (e) {
        return done();
      }
      done(new Error("`token` omitted and Queue did not throw an error"));
    });

    it("should require `projectId` on initialization", function(done) {
      options = _.cloneDeep(defaultQueueOptions);
      delete options.projectId;
      try {
        new Consumer(options);
      } catch (e) {
        return done();
      }
      done(new Error("`projectId` omitted and Queue did not throw an error"));
    });
  });

  describe("#get", function() {
    var exampleJob1 = jobFixtures.exampleJob1;
    var exampleJob2 = jobFixtures.exampleJob2;
    var badJob1     = jobFixtures.badJob1;

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
        //create queue with one message injected
        queue = new Queue(_.extend(defaultQueueOptions, {messages: [exampleJob1]}));
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
      beforeEach(function() {
        //create queue with two messages injected
        queue = new Queue(_.extend(defaultQueueOptions, {messages: [exampleJob1, exampleJob2]}));
      });

      it("should return an array with exactly N messages if n == queue.length where N == queue.length", function(done) {
        queue.get({n: 2}, function(err, messages) {
          expect(err).to.be(null);
          expect(messages).to.have.length(2);
          done();
        });
      });

      it("should return an array with exactly N messages if n > queue.length where N == queue.length", function(done) {
        queue.get({n: 3}, function(err, messages) {
          expect(err).to.be(null);
          expect(messages).to.have.length(2);
          done();
        });
      });
    });

    describe("bad data", function() {

      it("should callback with no error and an empty array when n=1", function(done) {
        var payload = {
          messages: [badJob1]
        };
        queue = new Queue(_.extend(defaultQueueOptions, payload));
        queue.get({n: 1}, function(err, messages) {
          expect(err).to.be(null);
          expect(messages).to.have.length(0);
          done();
        });
      });

      describe("n > 1 with one bad job", function() {
        var payload = {
          messages: [badJob1, exampleJob1]
        };
        before(function() {
          queue = new Queue(_.extend(defaultQueueOptions, payload));
        });

        it("should return the proper jobs", function(done) {
          queue.get({n: 2}, function(err, messages) {
            expect(err).to.be(null);
            expect(messages).to.have.length(1);
            done();
          });
        });

        it("should remember the bad job", function(done) {
          expect(_.isEmpty(queue.__errorJournal.dump())).to.be(false);
          done();
        });
      });
    });
  });
});


