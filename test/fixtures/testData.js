exports.queue = "jobs";
exports.data = [
  {
    type: "consumer:update",
    data: {
      body: "hello world"
    },
    attempts: 0
  }
];
