IronMQ     = require("iron_mq")
IronMQStub = require("stubs").IronMQ
_          = require("lodash")
loopLog    = require("debug")("loop")
jobLog     = require("debug")("jobs")
restify    = require("restify")

EventLoop = require("./utils").EventLoop


###
  Dead simple DojoConsumer that interfaces with ironMq and passes messages back
  to workers.  The workers specify a RegEx pattern for the jobs they want to
  handle.
  
  Pattern matching happens in the order of workers registered.

###




# DEFAULT options. No default admin.

DEFAULT_OPTIONS =
  consumer:
    sleep: 1000
    parallel: 10
  queue:
    name: "jobs"
DEFAULT_ADMIN_PORT = 9876

class Consumer

  constructor: (options) ->
    @errorJournal = 
      system: new ErrorJournal()
      queue: new ErrorJournal()
    options = _.merge({},
      _.cloneDeep(DEFAULT_OPTIONS),
      {queue: {errorJournal: @errorJournal.queue}},
      options
    );
    @queue = new Queue(options.queue)
    @eventLoop = new EventLoop(options.consumer.sleep)
    @eventLoop.on "tick", @_loop.bind(@)
    @__consumerOpts = options.consumer
    @__jobHandlers = []
    @processed = 0
    if options.admin
      _setupAdmin(options.admin, @)


  register: (job, worker) ->
    @__jobHandlers[job] = worker

  deregister: (job) ->
    delete @__jobHandlers[job]

  ###
    An event loop using 1ms ticks.
  ###

  start: (cb) ->
    @eventLoop.start()

  stop: (cb) ->
    @eventLoop.stop()
    if @server
      @server.close(cb)
    else
      cb()

  info: (cb) ->
    console.log "Printing error information"

  _loop: () ->
    n = @__consumerOpts.parallel
    @queue.get {n: n}, (err, jobs) =>
      if err
        @errorJournal.system.add new Date().toISOString(), err
      else if not _.isEmpty(jobs)
        #job will be an array!
        jobLog "#{JSON.stringify(jobs, null, 4)}"
        jobs.forEach (job) =>
          if @errorJournal.queue.contains job.id
            @queue.release job, (err) =>
              if err #record the system error releasing the job
                @errorJournal.system.add new Error("Problem releasing an already errored out job #{err.message || err}")
          else
            service = job.body.service
            if not service
              #increment attempts?
              @queue.error job, new Error("Job Id #{job.id} has no `service` field")
            else
              #find a registered job handler. naive and goes with first match for now
              for j,worker of @__jobHandlers
                if service.match(j)
                  return worker _.omit(job.body, "service"), (err) =>
                    if err
                      errorMessage = err.message || err
                      @errorJournal.queue.add job.id, {job: job, error: errorMessage} 
                      @queue.error job, err
                    else
                      @processed++
                      @queue.del job
      else
        loopLog "No jobs. Sleeping for #{@__sleepTime} ms"

###
  abstracts away details of ironmq client
###
class Queue

  ###

  ###
  constructor: (options) ->
    if not options.token or not options.projectId
      throw new Error("You must provide proper IronMQ credentials {queue: {token: '', projectId: ''}}")
    if not options.name
      throw new Error("You must initialize queue with a name")
    if not options.errorJournal
      throw new Error("You must include an instance of ErrorJournal")
    @__errorJournal = options.errorJournal
    if options.env is "production"
      Client = IronMQ.Client
      config =
        token: options.token
        project_id: options.projectId
      if options.host?
        config.host = options.host
      @__mq = new Client(config) #options.client used for testing
      @__q = @__mq.queue(options.name)
    else #use stub with option to initialize with client defined messages
      Client = IronMQStub.Client
      @__mq = new Client({token: options.token, project_id: options.projectId})
      releaseTime = if options.releaseTime then [options.releaseTime] else []
      @__q = @__mq.queue.apply(@__mq, [options.name].concat(releaseTime))
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
      returnThese = []
      for message in messages by 1
        try
          message.body = JSON.parse message.body
          returnThese.push message
        catch e
          @__errorJournal.add message.id, new Error("Bad json data for message: #{JSON.stringify(message.body, null, 4)}")
      cb null, returnThese

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

  error: (job, error, cb) ->
    cb = cb || ->
    @release job, cb

  ###
    Hook for testing. Simply dumps the messages from the ironmq stub.
  ###
  dump: () ->
    return @__q.dump();


###
  Just a collection of errors. Used by Consumer and required by Queue.
###
class ErrorJournal

  constructor: () ->
    @__journal = {}

  contains: (id) ->
    @__journal[id]

  add: (id, message) ->
    @__journal[id] = message

  get: (id) ->
    @__journal[id]

  del: (id) ->
    delete @__journal[id]

  reset: () ->
    @__journal = {}

  dump: () ->
    @__journal

  print: () ->
    JSON.stringify @__journal, null, 4

###
  Expose for testing
###

Consumer.ErrorJournal = ErrorJournal
Consumer.Queue = Queue



_auth = (opts) ->
  return (req, res, next) ->
    auth = req.authorization
    if auth?.basic and auth.basic.username is opts.user and auth.basic.password is opts.password
      next()
    else
      res.json 401, {message: "Not Authorized"}

_setupAdmin = (opts, consumer) ->
  start = new Date();
  server = restify.createServer()
  server.use(restify.authorizationParser())
  server.get {path: "/failed-jobs", version: "0.0.1"}, _auth(opts), (req, res) ->
    queue = consumer.errorJournal.queue.dump()
    system = consumer.errorJournal.system.dump()
    res.json 200, {queue: queue, system: system}

  server.get {path: "/failed-jobs/:id", version: "0.0.1"}, _auth(opts), (req, res) ->
    if not consumer.errorJournal.queue.contains req.params.id
      return res.json 404, {status: "Not found"}
    res.json 200, consumer.errorJournal.queue.get req.params.id

  server.del {path: "/failed-jobs/:id", version: "0.0.1"}, _auth(opts), (req, res) ->
    if not consumer.errorJournal.queue.contains req.params.id
      return res.json 404, {status: "Not found"}
    consumer.errorJournal.queue.del req.params.id
    consumer.queue.del {id: req.params.id}, (err) ->
      if err?
        res.json 500, {status: err.message}
      else
        res.json 200, {status: "Success"} 

  server.post {path: "/failed-jobs/:id/retry", verions: "0.0.1"}, _auth(opts), (req, res) ->
    if not consumer.errorJournal.queue.contains req.params.id
      return res.json 404, {status: "Not found"}
    consumer.errorJournal.queue.del req.params.id
    res.json 200, {status: "Success"}

  server.get {path: "/status", version: "0.0.1"}, _auth(opts), (req, res) ->
    r =
      upSince: start.toISOString()
      jobsProcessed: consumer.processed
      errors:
        system: Object.keys(consumer.errorJournal.system.dump()).length
        queue: Object.keys(consumer.errorJournal.queue.dump()).length
    res.json 200, r

  server.listen(opts.port || DEFAULT_ADMIN_PORT)
  consumer.server = server;

module.exports = Consumer
