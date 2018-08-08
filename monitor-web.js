//This file ensures bots keep running continuously
//Starting and stopping:
//https://devcenter.heroku.com/articles/one-off-dynos#running-tasks-in-background
/*var forever = require('forever-monitor');
var kinStellar = new (forever.Monitor)('kin-stellar.js', {
  max: 10000,
  silent: true,
  args: [],
  minUptime: 10000,     // Minimum time a child process has to be up. Forever will 'exit' otherwise.
  spinSleepTime: 180000, // Interval between restarts if a child is spinning (i.e. alive < minUptime).
});
kinStellar.start();
*/

