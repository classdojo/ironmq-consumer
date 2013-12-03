IronMQ     = require("iron_mq")
IronMQStub = require("../test/stubs/ironmq")
_          = require("lodash")
debug      = require("debug")("loop")
jobLog     = require("debug")("jobs")


###
  Dead simple DojoConsumer that interfaces with ironMq and passes messages back
  to workers.  The workers specify a RegEx pattern for the jobs they want to
  handle.
  
  Pattern matching happens in the order of workers registered.

###




# DEFAULT options. No default admin.

DEFAULT =
  consumer:
    sleep: 20
    parallel: 10
  queue:
    name: "jobs"

class Consumer

  constructor: (options) ->
    options = _.merge(DEFAULT, options)
    @__queue = new Queue(options.queue)
    @__consumerOpts = options.consumer
    @__jobHandlers = []
    @__errors =
      system: {}
      common: {}
    if options.admin
      _setupAdmin(options.admin)


  register: (job, worker) ->
    @__jobHandlers[job] = worker




  deregister: (job) ->
    delete @__jobHandlers[job]

  ###
    An event loop using 1ms ticks.
  ###

  start: (cb) ->
    @__interval = setInterval(@_loop.bind(@), @__consumerOpts.sleep)

  stop: (cb) ->
    clearInterval @__interval

  info: (cb) ->
    console.log "Printing error information"

  _loop: () ->
    n = @__consumerOpts.parallel
    @__queue.get {n: n}, (err, jobs) =>
      if err
        @__errors.system[new Date().toISOString()] = err
      else if not _.isEmpty(jobs)
        #job will be an array!
        jobLog "#{JSON.stringify(jobs, null, 4)}"
        jobs.forEach (job) => 
          type = job.body.type
          if not type
            #increment attempts?
            @__queue.error job, new Error("Job Id #{job.id} has no `type` field")
          else
            #find a registered job handler. naive and goes with first match for now
            for j,worker of @__jobHandlers
              if type.match(j)
                return worker job.body.data, (err) =>
                  if err
                    @__queue.error job, err
                  else
                    @__queue.del job
      else
        debug "No jobs. Sleeping for #{@__sleepTime} ms"

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
    if options.env is "production"
      Client = IronMQ.Client
      @__mq = new Client({token: options.token, project_id: options.projectId}) #options.client used for testing
      @__q = @__mq.queue(options.name)
    else #use stub with option to initialize with client defined messages
      Client = IronMQStub.Client
      @__mq = new Client({token: options.token, project_id: options.projectId})
      @__q = @__mq.queue(options.name)
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


  error: (job, error, cb) ->
    cb = cb || ->
    @release job, cb


Consumer.Queue = Queue   #expose for testing

_auth = (opts) ->
  return (req, res, next) ->
    if auth.basic.username is opts.user and auth.basic.password is opts.password
      next()
    else
      res.json 401, {message: "Not Authorized"}

_setupAdmin = (opts) ->
  server = restify.createServer()
  server.use(restify.authorizationParser())
  server.get {path: "/failed-jobs", version: "0.0.1"}, _auth(opts), (req, res) ->
    res.json 200, {}

  server.get {path: "/failed-jobs/:id", version: "0.0.1"}, _auth(opts), (req, res) ->

  server.del {path: "/failed-jobs/:id", version: "0.0.1"}, _auth(opts), (req, res) ->


module.exports = Consumer
