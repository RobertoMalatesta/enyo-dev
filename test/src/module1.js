var
	module2 = require('./module2'),
	module4 = require('./module4');

module.exports = function () {
	module2(module4('module1'));
};