exports.exampleJob1 = {
  body: {
    type: "job:subJob",
    data: {
      job: "one"
    },
    created: "2013-11-04T19:22:37.423Z",
    attempts: 0
  }
};

exports.exampleJob2 = {
  body: {
    type: "job:subJob",
    data: {
      job: "two"
    },
    created: "2013-11-04T19:22:38.423Z",
    attempts: 0
  }
};

exports.jobWithId1 = {
  body: {
    id: "5955911460968073845",
    type: "job:subJob",
    data: {
      job: "withId"
    },
    created: "2013-12-10T23:46:19.808Z",
    attempts: 0
  }
};

/*
 * A job with bad json data.
*/
exports.badJob1 = {
  body: '{"type": "job:subJob", "data": {"job": "two",}, "created": "2013-11-04T19:22:38.423Z", "attempts": 0}'
};
