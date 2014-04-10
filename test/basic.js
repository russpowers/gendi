var should = require('chai').should();
//require('../mocha-generators');
var Promise = require('bluebird');

var DI = require('../src/gendi');

describe('DI', function() {
	var di;

	beforeEach(function() {
		di = new DI();
	});

	it('should create an empty container definition', function() {
		var def = di.define('global');
		def._name.should.equal('global');
	});

	it('should get a named container definition', function() {
		var def = di.define('global');
		var getDef = di.getDefinition('global');
		def._name.should.equal(getDef._name);
	});

	it('should create resolvers in a container definition', function() {
		var resolver = { create: function() { return {}; } }		
		var def = di.define('global')
								.resolver('myresolver', resolver);
		var getResolver = def.getItem('myresolver').value;
		resolver.create.should.equal(getResolver.create);
	});

	it('should create resolvers in a container definition using shorthand', function() {
		var resolver = function() { return {}; };
		var def = di.define('global')
								.resolver('myresolver', resolver);
		var getResolver = def.getItem('myresolver').value;
		resolver.should.equal(getResolver.create);
	});

	it('should resolve resolvers in a container definition', function*() {
		var resolver = { create: function() { return { test: 'test' }; } }		
		var def = di.define('global')
								.resolver('myresolver', resolver);

		var root = di.createRoot('global');
		var resolved = yield root.resolve('myresolver');
		resolved.test.should.equal('test');
	});

	it('should resolve resolvers in a container definition only once', function*() {
		var resolver = { create: function() { return { test: 'test' }; } }		
		var def = di.define('global')
								.resolver('myresolver', resolver);

		var root = di.createRoot('global');
		var resolved = yield root.resolve('myresolver');
		var resolvedAgain = yield root.resolve('myresolver');
		resolved.should.equal(resolvedAgain);
	});

	it('should create a child container', function() {
		var def = di.define('global');
		di.define('child', 'global');
		var root = di.createRoot('global');
		var child = root.createChild('child');
		child.should.not.equal(null);
	});

	it('should resolve inherited instances', function*() {
		var myinstance = { name: 'hey' };
		var def = di.define('global')
			.constant('myinstance', myinstance);

		def.defineChild('child');

		var root = di.createRoot('global');
		var child = root.createChild('child');

		var resolved = yield child.resolve('myinstance');
		myinstance.should.equal(resolved);
	});

	it('should resolve inherited resolvers', function*() {
		var resolver = { create: function() { return { test: 'test' }; } }		
		var def = di.define('global')
								.resolver('myresolver', resolver);

		def.defineChild('child');

		var root = di.createRoot('global');
		var child = root.createChild('child');
		var resolved = yield child.resolve('myresolver');
		resolved.test.should.equal('test');
	});

	it('should resolve inherited resolvers only once', function*() {
		var resolver = { create: function() { return { test: 'test' }; } }		
		var def = di.define('global')
								.resolver('myresolver', resolver);

		def.defineChild('child');

		var root = di.createRoot('global');
		var child = root.createChild('child');
		var resolved = yield child.resolve('myresolver');
		var resolvedAgain = yield child.resolve('myresolver');
		resolved.should.equal(resolvedAgain);
	});


	it('should create a new root container', function() {
		di.define('global');
		var root = di.createRoot('global');
		root.should.be.a('object');
	});

	describe('should create a new root container that', function() { 
		var root;

		beforeEach(function() {
			root = di.createRoot();
		});

	});


});
