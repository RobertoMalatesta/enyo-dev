var
	module3 = require('./module3');

module.exports = function (str) {
	console.log(str + 'module2.' + module3());
}