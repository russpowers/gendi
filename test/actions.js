var should = require('chai').should();
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
								
		reqDef = rootDef.defineChild('request')
			.constant('reqInst', reqInst);

		rootCont = di.createRoot('global');
								
		reqCont = rootCont.createChild('request');
								
	});

	it('should call an action on all resolvers', function*() {
		rootDef.resolver('tester1', {
			create: function(rootInst) {
				return { a: rootInst };
			},
			complete: function() {
				throw "Should not get here"
			}
		});

		var success = false;

		reqDef.resolver('depTester', {
			create: function(tester1) {
				return { b: tester1.a };
			},
			complete: function() {
				success = true;
			}
		});

		var depTester = yield reqCont.resolve('depTester');
		yield reqCont.action('complete');
		success.should.equal(true);
	});

	it('should call an action with instance as receiver', function*() {
		var depTester;

		rootDef.resolver('tester1', {
			create: function(rootInst) {
				return { a: rootInst };
			},
			complete: function() {
				throw "Should not get here"
			}
		});

		var success = false;

		reqDef.resolver('depTester', {
			create: function(tester1) {
				return { b: tester1.a };
			},
			complete: function() {
				this.should.equal(depTester);
				success = true;
			}
		});

		depTester = yield reqCont.resolve('depTester');
		yield reqCont.action('complete');
		success.should.equal(true);
	});

	it('should call an action on all resolvers with injection', function*() {
		rootDef.resolver('tester1', {
			create: function(rootInst) {
				return { a: rootInst };
			},
			complete: function() {
				throw "Should not get here"
			}
		});

		var success = false;

		reqDef.resolver('depTester', {
			create: function(tester1) {
				return { b: tester1.a };
			},
			complete: function(tester1, depTester) {
				tester1.a.should.equal(rootInst);
				depTester.b.should.equal(tester1.a);
				success = true;
			}
		});

		var depTester = yield reqCont.resolve('depTester');
		yield reqCont.action('complete');
	});

	it('should call an action on all resolvers with injection with promises', function*() {
		rootDef.resolver('tester1', {
			create: function(rootInst) {
				return Promise.resolve({ a: rootInst });
			},
			complete: function() {
				throw "Should not get here"
			}
		});

		var success = false;

		reqDef.resolver('depTester', {
			create: function(tester1) {
				return { b: tester1.a };
			},
			complete: function(tester1, depTester) {
				return Promise.resolve().then(function(){
					tester1.a.should.equal(rootInst);
					depTester.b.should.equal(tester1.a);
					success = true;
				});
			}
		});

		yield reqCont.resolve('depTester');
		yield reqCont.action('complete');
		success.should.equal(true);
	});
});