exports.exampleJob1 = {
  body: {
    service: "job",
    action: "subJob",
    payload: {
      job: "one"
    },
    created: "2013-11-04T19:22:37.423Z",
    attempts: 0
  }
};

exports.exampleJob2 = {
  body: {
    service: "job",
    action: "subJob",
    payload: {
      job: "two"
    },
    created: "2013-11-04T19:22:38.423Z",
    attempts: 0
  }
};


/*
 * A job with bad json data.
*/
exports.badJob1 = {
  body: '{"service": "job", "action": "subJob", "payload": {"job": "two",}, "created": "2013-11-04T19:22:38.423Z", "attempts": 0}'
};
