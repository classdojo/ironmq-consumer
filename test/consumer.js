var expect = require("expect.js");
var Consumer = require("../lib");
var IronMQStub = require("./stubs/ironmq");
var sleep = require("sleep");
var request = require("request");
var jobFixtures = require("./fixtures/testJobs");
var _ = require("lodash");
var SimpleErrorWorker = require("./workers/simpleError");
var CounterIncWithError = require("./workers/counterIncrementWithError");

var TICK_TIME = 25;

/* 
 * Tests the full integration loop that consumes the queue.
 */

describe("Consumer", function() {
  var defaultOptions = {
    consumer: {
      sleep: TICK_TIME,
      parallel: 1
    },
    queue: {
      token: "someToken",
      projectId: "someProjectId",
      name: "jobtest",
      messages: [jobFixtures.exampleJob1, jobFixtures.exampleJob2]
    }
  };
  describe("options", function() {
    describe("consumer", function() {
      /*
       * These tests assume that the functions passed to the setTimeout have
       * runtime < consumer sleep time.
      */
      var consumer;

      afterEach(function(done) {
        if(consumer && consumer.stop) {
          consumer.stop(done);
        }
      });

      it("should pull messages at specified interval", function(done) {
        consumer = new Consumer(defaultOptions);
        consumer.start();
        setTimeout(function(){
          //checks that messages haven't been taken off queue in this interval.
          var messages = consumer.__queue._dump();
          expect(messages).to.have.length(2);
        }, 5);
        setTimeout(function() {
          //checks that one message has been taken off queue
          var messages = consumer.__queue._dump();
          expect(messages).to.have.length(1);
          done();
        }, TICK_TIME + 15);
      });

      it("should default to 1s interval when sleep is not specified", function(done) {
        consumer = new Consumer({consumer: {parallel:1}, queue: defaultOptions.queue});
        consumer.start();
        setTimeout(function() {
          var messages = consumer.__queue._dump();
          expect(messages).to.have.length(2);
        },600);

        setTimeout(function() {
          var messages = consumer.__queue._dump();
          expect(messages).to.have.length(1);
          done();
        },1300);
      });
    });

    describe("queue", function() {
      var consumer;

      afterEach(function(done) {
        if(consumer && consumer.stop) {
          consumer.stop(done);
        } else {done();}
      });

      it("should load messages if specified in the options hash", function(done) {
        options = _.cloneDeep(defaultOptions);
        options.queue.messages = [jobFixtures.exampleJob1, jobFixtures.exampleJob2];
        var consumer = new Consumer(options);
        var messages = consumer.__queue._dump();
        expect(messages).to.have.length(2);
        done();
      });
    });
  });

  describe("Job processing", function() {
    describe("simple job error", function() {
      var consumer;
      before(function(done) {
        consumer = new Consumer(defaultOptions);
        consumer.register("job", SimpleErrorWorker);
        consumer.start();
        done();
      });

      after(function(done) {
        if(consumer && consumer.stop) {
          consumer.stop(done);
        } else {done();}
      });

      it("should mark a job as an error if the job processing fails", function(done) {
        //wait until after one tick and check if errors array is empty
        setTimeout(function() {
          var errors = consumer.errorJournal.queue.dump();
          expect(_.isEmpty(errors)).to.be(false);
          done();
        }, TICK_TIME + TICK_TIME/5);
      });
    });

    describe("error across multiple ticks", function() {
      var consumer;
      before(function(done) {
        var options = _.cloneDeep(defaultOptions);
        options.queue.messages = [jobFixtures.exampleJob2];
        consumer = new Consumer(options);
        consumer.register("job", CounterIncWithError);
        consumer.start();
        done();
      });
      after(function(done) {
        CounterIncWithError.resetCounter();
        if(consumer && consumer.stop) {
          consumer.stop(done);
        } else {done();}
      });

      it("should not reprocess a job that was marked as an error", function(done) {
        setTimeout(function() {
          //counter worker should only have been called once
          expect(CounterIncWithError.counter()).to.be(1);
          done();
        }, TICK_TIME * 5);
      });
    });
  });

  describe("admin", function() {
    var consumer;
    var options = _.cloneDeep(defaultOptions);
    options.queue.messages.push(jobFixtures.badJob1);
    options.admin = {
      port: 9876,
      user: "testUser",
      password: "test"
    };

    describe("setup", function() {
      afterEach(function(done) {
        consumer.stop(done);
      });
      it("should not setup the admin server if admin options are not passed in", function(done) {
        consumer = new Consumer(defaultOptions);
        request.get("http://localhost:9876/status", function(error) { //9876 is default admin port
          expect(error.message).to.contain("ECONNREFUSED");
          done();
        });
      });

      it("should properly setup the admin server on default port 9876 if admin options are passed in and port omitted", function(done) {
        var clonedOptions = _.cloneDeep(options);
        delete clonedOptions.admin.port
        consumer = new Consumer(clonedOptions);
        request.get("http://localhost:9876/status", function(error, response) {
          expect(error).to.be(null);
          expect(response.statusCode).to.not.be(null);
          done();
        });
      });
      it("should setup the admin server on the user defined port if admin options are passed in", function(done) {
        var clonedOptions = _.cloneDeep(options);
        clonedOptions.admin.port = 9000;
        consumer = new Consumer(clonedOptions);
        request.get("http://localhost:9000/status", function(error, response) {
          expect(error).to.be(null);
          expect(response.statusCode).to.not.be(null);
          done();
        });
      });
    });

    describe("routes", function() {
      before(function(done) {
        consumer = new Consumer(options);
        done();
      });
      after(function(done) {
        consumer.stop(done);
      });

      describe("GET /status", function() {
        var endpoint = "http://localhost:9876/status";
        it("should return 401 if auth is not included in the request", function(done) {
          request(endpoint, function(error, response, b) {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(401);
            done();
          });
        });
      });

      describe("GET /failed-jobs", function() {
        var endpoint = "http://localhost:9876/failed-jobs";
        it("should return 401 if auth is not included in the request",function(done) {
          request(endpoint, function(error, response, b) {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(401);
            done();
          });
        });
      });

      describe("DEL /failed-jobs/:id", function() {
        var endpoint = "http://localhost:9876/failed-jobs/someId"
        it("should return 401 if auth is not included in the request", function(done) {
          request.del(endpoint, function(error, response, b) {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(401);
            done();
          });
        });
      });
    });
  });
});

