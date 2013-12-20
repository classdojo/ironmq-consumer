var expect = require("expect.js");
var Consumer = require("../lib");
var IronMQStub = require("stubs").IronMQ;
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
      messages: [jobFixtures.exampleJob1, jobFixtures.exampleJob2],
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
          var queueMessages = consumer.queue.dump();
          expect(queueMessages.messages).to.have.length(2);
        }, 5);
        setTimeout(function() {
          //checks that one message has been taken off queue
          var queueMessages = consumer.queue.dump();
          expect(queueMessages.messages).to.have.length(1);
          done();
        }, TICK_TIME + 15);
      });

      it("should default to 1s interval when sleep is not specified", function(done) {
        consumer = new Consumer({consumer: {parallel:1}, queue: defaultOptions.queue});
        consumer.start();
        setTimeout(function() {
          var queueMessages = consumer.queue.dump();
          expect(queueMessages.messages).to.have.length(2);
        },600);

        setTimeout(function() {
          var queueMessages = consumer.queue.dump();
          expect(queueMessages.messages).to.have.length(1);
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
        var queueMessages = consumer.queue.dump();
        expect(queueMessages.messages).to.have.length(2);
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
        done();
      });

      after(function(done) {
        if(consumer && consumer.stop) {
          consumer.stop(done);
        } else {done();}
      });

      it("should mark a job as an error if the job processing fails", function(done) {
        consumer.eventLoop.on("tick", function() {
          var errors = consumer.errorJournal.queue.dump();
          expect(_.isEmpty(errors)).to.be(false);
          done();
        });
        consumer.start();
      });
    });

    describe("error across multiple ticks", function() {
      var consumer;
      before(function(done) {
        var options = _.cloneDeep(defaultOptions);
        options.queue.messages = [jobFixtures.exampleJob2];
        options.queue.releaseTime = TICK_TIME;
        consumer = new Consumer(options);
        consumer.register("job", CounterIncWithError);
        done();
      });
      after(function(done) {
        CounterIncWithError.resetCounter();
        if(consumer && consumer.stop) {
          consumer.stop(done);
        } else {done();}
      });

      it("should not reprocess a job that was marked as an error", function(done) {
        var tickTimes = 0;
        consumer.eventLoop.on("tick", function() {
          tickTimes++;
          if(tickTimes > 5) {
            expect(CounterIncWithError.counter()).to.be(1);
            var queueMessages = consumer.queue.dump();
            expect(queueMessages.messages.concat(queueMessages.outstandingMessages))
                .to.have.length(1);
            done();
          }
        });
        consumer.start();
      });
    });
  });

  describe("admin", function() {
    var options = _.cloneDeep(defaultOptions);
    options.queue.messages.push(jobFixtures.exampleJob2);
    options.admin = {
      port: 9876,
      user: "testUser",
      password: "test"
    };

    describe("setup", function() {
      var consumer;
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
      var consumer;
      var auth = {
        auth: {
          user: "testUser",
          password: "test"
        }
      };
      before(function(done) {
        consumer = new Consumer(options);
        consumer.register("job", SimpleErrorWorker);
        consumer.start()
        setTimeout(done, TICK_TIME * 10);
      });
      after(function(done) {
        consumer.stop(done);
      });

      describe("GET /status", function() {
        var endpoint = "http://localhost:9876/status";
        var statusResponse;
        before(function(done) {
          request.get(endpoint, auth, function(error, response, b) {
            statusResponse = JSON.parse(b);
            done();
          });
        });

        it("should return 401 if auth is not included in the request", function(done) {
          request(endpoint, function(error, response, b) {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(401);
            done();
          });
        });

        it("should report the correct number of jobs processed", function(done) {
          expect(statusResponse.jobsProcessed).to.be(0);
          done();
        });
        it("should report the correct number of system errors", function(done) {
          expect(statusResponse.errors.system).to.be(0);
          done();
        });
        it("should report the correct number of queue errors", function(done) {
          expect(statusResponse.errors.queue).to.be(3);
          done();
        });
      });

      describe("GET /failed-jobs", function() {
        var endpoint = "http://localhost:9876/failed-jobs";
        it("should return 401 if auth is not included in the request", function(done) {
          request(endpoint, function(error, response, b) {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(401);
            done();
          });
        });

        it("should return a list of failed jobs when hitting that endpoint", function(done) {
          request.get(endpoint, auth, function(error, response, b) {
            var body = JSON.parse(b);
            expect(Object.keys(body.queue)).to.have.length(3);
            done();
          });
        });
      });

      describe("DEL /failed-jobs/:id", function() {
        it("should return 401 if auth is not included in the request", function(done) {
          request.del("http://localhost:9876/failed-jobs/someId", function(error, response, b) {
            expect(error).to.be(null);
            expect(response.statusCode).to.be(401);
            done();
          });
        });
        describe("with auth", function() {
          var failedJobList;
          var failedJobId;
          before(function(done) {
            request.get("http://localhost:9876/failed-jobs", auth, function(error, response, b) {
              failedJobList = JSON.parse(b).queue;
              failedJobId = Object.keys(failedJobList).shift();
              done();
            });
          });
          it("should allow me to properly delete a job", function(done) {
            request.del("http://localhost:9876/failed-jobs/" + failedJobId, auth, function(error, response, b) {
              expect(response.statusCode).to.be(200);
              done();
            });
          });

          it("should not return that job when fetched from a new list of failed jobs", function(done) {
            var options = {
              uri: "http://localhost:9876/failed-jobs",
              method: "GET",
              auth: {
                user: "testUser",
                password: "test"
              }
            };
            request(options, function(error, response, b) {
              expect(response.statusCode).to.be(200);
              var newFailedJobIds = Object.keys(JSON.parse(b).queue);
              expect(newFailedJobIds).to.have.length(2);
              expect(newFailedJobIds).to.not.contain(failedJobId);
              done();
            });
          });
        });
      });
    });
  });
});

