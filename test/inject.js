var should = require('chai').should();
//require('../mocha-generators');
var Promise = require('bluebird');
var DI = require('../src/gendi');

describe('DI', function() {
	var di;
	var rootCont, reqCont;
	var rootDef, reqDef;
	var rootInst, reqInst;

	beforeEach(function() {
		di = new DI();

		rootInst = { name: 'rootInst' };
		reqInst = { name: 'reqInst' };

		rootDef = di.define('global')
			.constant('rootInst', rootInst);
								
		reqDef = di.define('request', 'global')
			.constant('reqInst', reqInst);

		rootCont = di.createRoot('global');
		reqCont = rootCont.createChild('request');
								
	});

	it('should resolve an injection from an instance in the same container', function*() {
		rootDef.resolver('tester', {
			create: function(rootInst) {
				return { test: rootInst };
			}
		});
		
		var tester = yield rootCont.resolve('tester');
		tester.test.should.equal(rootInst);
	});

	it('should resolve an injection from an instance in an ancestor container', function*() {
		rootDef.resolver('tester', {
			create: function(rootInst) {
				return { test: rootInst };
			}
		});

		var tester = yield reqCont.resolve('tester');
		tester.test.should.equal(rootInst);
	});

	it('should resolve an injection from a resolver in an ancestor container', function*() {
		rootDef.resolver('tester', {
			create: function(rootInst) {
				return { a: rootInst };
			}
		});

		reqDef.resolver('depTester', {
			create: function(tester) {
				return { b: tester.a };
			}
		});

		var depTester = yield reqCont.resolve('depTester');
		depTester.b.should.equal(rootInst);
	});

	it('should resolve an injection from a promise resolver in an ancestor container', function*() {
		rootDef.resolver('tester', {
			create: function(rootInst) {
				return Promise.resolve({ a: rootInst });
			}
		});

		reqDef.resolver('depTester', {
			create: function(tester) {
				return { b: tester.a };
			}
		});

		dt = yield reqCont.resolve('depTester');

		dt.b.should.equal(rootInst);
	});

	it('should resolve an injection from a promise resolver in an ancestor container only once', function*() {
		rootDef.resolver('tester', {
			create: function(rootInst) {
				return Promise.resolve({ a: rootInst });
			}
		});

		reqDef.resolver('depTester', {
			create: function(tester) {
				return { b: tester.a };
			}
		});

		var dt = yield reqCont.resolve('depTester');
		dt.b.should.equal(rootInst);
		var newDt = yield reqCont.resolve('depTester');
		dt.should.equal(newDt);
	});

	it('should resolve two levels of promise injections', function*() {
		rootDef.resolver('tester1', {
			create: function(rootInst) {
				return Promise.resolve({ a: rootInst });
			}
		});

		reqDef.resolver('tester2', {
			create: function(tester1) {
				return { b: tester1.a };
			}
		});

		reqDef.resolver('tester3', {
			create: function(tester2) {
				return { c: tester2.b };
			}
		});

		dt = yield reqCont.resolve('tester3');
		dt.c.should.equal(rootInst);
	
	});


});