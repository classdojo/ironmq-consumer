/*

simple worker that increments a counter each time it's called. It then
allows that counter to be inspected by a calling program. Used for
testing that jobs that error out are not reprocessed by the consumer.

*/

var counter = 0;

var Worker = function(data, done) {
  counter++;
  done(new Error("Don't give me this job again."));
}

Worker.counter = function() {
  return counter;
}

Worker.resetCounter = function() {
  counter = 0;
}

module.exports = Worker;
