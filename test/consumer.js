var expect = require("expect.js");
var Consumer = require("../lib");
var IronMQStub = require("./stubs/ironmq");
var sleep = require("sleep");
var request = require("request")

/* 
 * Tests the 
 */

describe("Consumer", function() {

  describe("Options", function() {
    describe("consumer", function() {});

    describe("queue", function() {});

    describe("admin", function() {});

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

