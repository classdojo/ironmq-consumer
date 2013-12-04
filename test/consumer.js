var expect = require("expect.js");
var Consumer = require("../lib");
var IronMQStub = require("./stubs/ironmq");
var sleep = require("sleep");
var request = require("request");
var jobFixtures = require("./fixtures/testJobs");
var _ = require("lodash");


/* 
 * Tests the full integration loop that consumes the queue.
 */

describe("Consumer", function() {
  var defaultOptions = {
    consumer: {
      sleep: 25,
      parallel: 1
    },
    queue: {
      token: "someToken",
      projectId: "someProjectId",
      name: "jobtest",
      messages: [jobFixtures.exampleJob1, jobFixtures.exampleJob2]
    }
  };
  describe("Options", function() {
    describe("consumer", function() {
      /*
       * These tests assume that the functions passed to the setTimeout have
       * runtime < consumer sleep time.
      */
      var consumer;

      afterEach(function(done) {
        if(consumer && consumer.stop) {
          consumer.stop();
        }
        done();
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
        }, 35);
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
          consumer.stop();
        }
        done();
      });

      it("should require `token` on initialization", function(done) {
        options = _.cloneDeep(defaultOptions);
        delete options.queue.token;
        try {
          new Consumer(options);
        } catch (e) {
          return done();
        }
        done(new Error("`queue.token` omitted and Consumer did not throw an error"));
      });

      it("should require `projectId` on initialization", function(done) {
        options = _.cloneDeep(defaultOptions);
        delete options.queue.projectId;
        try {
          new Consumer(options);
        } catch (e) {
          return done();
        }
        done(new Error("`queue.projectId` omitted and Consumer did not throw an error"));
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

  describe("admin", function() {

    describe("setup", function() {
      it("should not setup the admin server if admin options are not passed in");

      it("should properly setup the admin server if admin options are passed in");

    });

    describe("auth", function() {

      it("should return 401 on every route if basic auth is not included in request");

      it("should return 401 on every route if wrong credentials are included in request");

      it("should return 200 on every route if proper credentials are included in request");
    });

    describe("GET /failed-jobs", function() {

    });

    describe("GET /failed-jobs/:id", function() {

    });

    describe("DEL /failed-jobs/:id", function() {

    });
  });
});

