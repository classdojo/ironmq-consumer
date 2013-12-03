# ironmq-consumer

## Tests
```bash
make test
```

```coffeescript
options =
  consumer:
    sleep: 200
    parallel: 100
  queue:
    token: "sometoken"
    projectId: "someprojectId"
    name: "jobstest"
  admin:
    port: 8123
    user: "user"
    password: "somePassword"

consumer = new IronMqConsumer options
consumer.register "mailgun", mailgunWorker

```


Now to interface with the api use HTTP Basic Auth. IronMQ-Consumer only keeps a record of failed jobs allowing some external process to review and delete them if necessary.

GET    /failed-jobs
GET    /failed-jobs/:id
DELETE /failed-jobs/:id


You can also get stats about the server
GET  /stats

You can also reset all data on the ironmq-consumer
POST /reset

## TODO

* Implement admin REST interface.