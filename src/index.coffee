IronMQ     = require("iron_mq")
IronMQStub = require("../test/stubs/ironmq")
_          = require("lodash")
debug      = require("debug")("loop")
jobLog     = require("debug")("jobs")

###
  Dead simple DojoConsumer that interfaces with ironMq and passes messages back
  to workers.  The workers specify a RegEx pattern for the jobs they want to
  handle.
  
  Pattern matching happens in the order of workers registerd.

###


###
  worker1Script = require("./workers/script1")

  consumer = new Consumer({project: "", token: "", env: "production"})
  consumer.register "job", worker1Script
  consumer.start()

###

###
  Loop is the arbiter between the queue and our internal workers.


  queue ---> Loop pulls using consumer ---> Loop delegates to Proper Item --->
  Loop removes from queue on success/Handles error appropriately --> Repeat

  There can essentially be some
###

class Consumer

  constructor: (options) ->
    @__queue = new Queue(options)
    @__sleepTime = options.sleep || 20
    @__jobHandlers = []
    @__errors =
      count: 0
      errors: []


  register: (job, worker) ->
    @__jobHandlers[job] = worker




  deregister: (job) ->
    delete @__jobHandlers[job]

  ###
    An event loop using 1ms ticks.
  ###

  start: (cb) ->
    @__interval = setInterval(@_loop.bind(@), @__sleepTime)
    #delegate
    #handle result appropriately

  stop: (cb) ->
    clearInterval @__interval

  info: (cb) ->
    console.log "Printing error information"

  _loop: () ->
    @__queue.get (err, jobs) =>
      if err?
        @__errors.count++
        @__errors.push err
      else if not _.isEmpty(jobs)
        #job will be an array!
        jobLog "#{JSON.stringify(jobs, null, 4)}"
        jobs.forEach (job) => 
          type = job.body.type
          if not type?
            @__errors.count++
            @__errors.push new Error("Job Id #{job.id} has not `type` field")
            #increment attempts?
            @__queue.error job
          else
            #find a registered job handler. naive and goes with first match for now
            for j,worker of @__jobHandlers
              if type.match(j)
                return worker job.body.data, (err) =>
                  if err?
                    @__queue.error job
                  else
                    @__queue.del job
      else
        debug "No jobs. Sleeping for #{@__sleepTime} ms"


###
{ id: '5942486501293943295',
  body: '{"type":"mailgun:update_list","data":{"list":"teachers@classdojo.mailgun.org","memberId":"corey.brady@peelsb.com","body":{"address":"corey.brady@peelsb.com","name":"Mr. Corey Brady","vars":{"title":"Mr.","first_name":"Corey","last_name":"Brady"}}},"created":"\\"2013-11-04T19:22:37.423Z\\"","attempts":0}',
  timeout: 60,
  reserved_count: 1,
  push_status: {} }
###


###
  abstracts away details of ironmq client
###
class Queue

  ###

  ###
  constructor: (options) ->
    if not options.token or not options.projectId
      throw new Error("You must provide proper IronMQ credentials {token: '', projectId: ''}")
    if not options.queueName
      throw new Error("You must initialize queue with a name")
    if options.env is "production"
      Client = IronMQ.Client
      @__mq = new Client({token: options.token, project_id: options.projectId}) #options.client used for testing
      @__q = @__mq.queue(options.queueName)
    else #use stub with option to initialize with client defined messages
      Client = IronMQStub.Client
      @__mq = new Client({token: options.token, project_id: options.projectId})
      @__q = @__mq.queue(options.queueName)
      if options.messages
        @__q.setMessages options.messages
  ###
    delegates to ironmq client GET. Uses defaults options but can pass
    in options to override those.


  ###
  get: (options, cb) ->
    if _.isFunction options
      cb = options
      options = {}
    @__q.get options, (error, messages) =>
      if error
        return cb error
      if not messages
        return cb null, [] #no message on queue
      #need to parse this
      if not _.isArray messages
        messages = [messages]
      #for every message let's parse the body
      for message in messages
        try
          message.body = JSON.parse message.body
        catch e
          return cb new Error("Bad json data message: #{message}")
      cb null, messages

  ###
    Delete from queue
  ###
  del: (job, cb) ->
    cb = cb || ->
    @__q.del job.id, cb

  ###
    Releases item to go back to queue
  ###
  release: (job, cb) ->
    cb = cb || ->
    @__q.msg_release job.id, {}, cb


  error: (job, cb) ->
    #increment attempts ?
    cb = cb || ->
    @release job, cb


Consumer.Queue = Queue   #expose for testing

module.exports = Consumer
