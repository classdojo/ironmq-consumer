events = require("events")

class EventLoop extends events.EventEmitter

  constructor: (ms) ->
    @__ms = ms

  start: () ->
    if not @__interval
      @__interval = setInterval(
        () => @emit("tick")
      , @__ms)

  stop: () ->
    clearInterval @__interval
    @__interval = null

exports.EventLoop = EventLoop
