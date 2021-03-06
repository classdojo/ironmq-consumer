// Generated by CoffeeScript 1.6.3
(function() {
  var EventLoop, events,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  events = require("events");

  EventLoop = (function(_super) {
    __extends(EventLoop, _super);

    function EventLoop(ms) {
      this.__ms = ms;
    }

    EventLoop.prototype.start = function() {
      var _this = this;
      if (!this.__interval) {
        return this.__interval = setInterval(function() {
          return _this.emit("tick");
        }, this.__ms);
      }
    };

    EventLoop.prototype.stop = function() {
      clearInterval(this.__interval);
      return this.__interval = null;
    };

    return EventLoop;

  })(events.EventEmitter);

  exports.EventLoop = EventLoop;

}).call(this);
