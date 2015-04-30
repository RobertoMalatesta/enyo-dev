var
	module3 = require('./module3');

module.exports = function () {
	console.log('module2.' + module3());
}