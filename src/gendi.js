'use strict';

var Promise = require('bluebird');

var COMMENTS = /((\/\/.*$)|(\/\*[\s\S]*?\*\/))/mg;
function getParameterNames(fn) {
	var code = fn.toString().replace(COMMENTS, '');
	var result = code.slice(code.indexOf('(') + 1, code.indexOf(')'))
		.match(/([^\s,]+)/g);

	return result === null ? []	: result;
}

function preprocessFunction(fn) {
	if (fn.__IS_GENERATOR__ !== undefined) {
		return;
	}

	fn.__IS_GENERATOR__ = typeof fn === 'function' && fn.constructor.name === 'GeneratorFunction';
	if (fn.__IS_GENERATOR__) {
		fn.__COROUTINE__ = Promise.coroutine(fn);
	}

	fn.__PARAMS__ = getParameterNames(fn);
}

function isGenerator(fn) { 
	return fn.__IS_GENERATOR__;
}

function InstanceResolver(actions, level) {
	if (! ('create' in actions)) {
		throw new Error('Actions must include "create"');
	}

	for (var action in actions) {
		if (typeof actions[action] !== 'function') {
			throw new Error('Actions should be functions');
		}

		preprocessFunction(actions[action]);
		this[action] = actions[action];
	}

	this._level = level;
};

function ContainerItem(type, value) {
	this.type = type;
	this.value = value;
}

var cleanProto = Object.create(null);
cleanProto.__HAS_OWN_PROPERTY__ = Object.hasOwnProperty;

function ContainerDefinition(name, parent, intf) {
	this._name = name;
	this._parent = parent;
	this._intf = intf;

	if (!parent) {
		this._items = Object.create(cleanProto);
	} else {
		this._items = Object.create(parent._items);
	}
}

ContainerDefinition.prototype.defineChild = function(name) {
	return this._intf.define(name, this._name);
};

ContainerDefinition.prototype.resolver = function(name, actions) {
	if (this._items.__HAS_OWN_PROPERTY__(name)) {
		throw 'Already registered container definition item with name ' + name;
	}

	if (typeof actions === 'function') {
		this._items[name] = new ContainerItem('resolver', 
			new InstanceResolver({
				create: actions
			}, this._level));
	} else {
		this._items[name] = new ContainerItem('resolver', 
			new InstanceResolver(actions, this._level));
	}

	return this;
};

ContainerDefinition.prototype.getItem = function(name) {
	return this._items[name];
}

ContainerDefinition.prototype.constant = function(name, value) {
	this._items[name] = new ContainerItem('constant', value);
	return this;
}

function Container(parent, definition, intf) {
	this._parent = parent;
	this._definition = definition;
	this._intf = intf;

	if (!parent) {
		if (definition._parent) {
			throw new Error('Definition does not match parent');	
		}

		this._instances = Object.create(cleanProto);
	} else {
		if (parent && parent._definition !== definition._parent) {
			throw new Error('Definition does not match parent');
		}

		this._instances = Object.create(parent._instances);
	}
}

Container.prototype.action = function(action) {
	var injectResults = [];

	var keys = Object.keys(this._instances);

	for (var i = 0; i < keys.length; ++i) {
		var item = this._definition.getItem(keys[i]);
		if (item !== undefined && item.type === 'resolver' && item.value[action] !== undefined) {
			injectResults.push(
				this.inject(item.value[action], this._instances[keys[i]])
			);
		}
	}

	return Promise.all(injectResults);
};

Container.prototype.createChild = function(definitionName) {
	return new Container(this, this._intf.getDefinition(definitionName), this._intf);
};

Container.prototype.instance = function(name, value) {
	this._instances[name] = value;
	return this;
}


Container.prototype.resolve = function(name) {
	return this.inject(name);
}

function isPromise(value) {
	return value && typeof value.then === 'function';
}

Container.prototype.resolve = function(name) {
	var defItem = this._definition.getItem(name);
	var instance = this._instances[name];

	// No resolver, just take the nearest instance
	if (!defItem) {
		if (instance === undefined) {
			throw new Error('Could not resolve instance with name: ' + name);
		} else {
			return Promise.resolve(instance);
		}
	} else if (defItem.type === 'constant' && instance === undefined) {
		// If there is no instance and a constant is defined, just return the constant
		return Promise.resolve(defItem.value)
	} else {
		for (var current = this; current !== null; current = current._parent) {
			// If there is an instance here, it's higher priority than any resolvers
			if (current._instances.__HAS_OWN_PROPERTY__(name)) {
				return Promise.resolve(current._instances[name]);
			} else {
				if (current._definition._items.__HAS_OWN_PROPERTY__(name)) {
					if (defItem.type === 'constant') {
						return Promise.resolve(defItem.value);
					} else {
						var res = current.inject(defItem.value.create, current);

						if (isPromise(res)) {
							return res.then(function(val) {
								current._instances[name] = val; 
								return val;
							});
						}	else {
							current._instances[name] = res;
							return Promise.resolve(res);
						}
					}
				}
			}
		}
	}
};

Container.prototype.injectWith = function(fn, dict, receiver) {
	receiver = receiver || fn;

	preprocessFunction(fn);

	var params = fn.__PARAMS__;
	var args = [];
	var hasPromises = false;
	var self = this;

	var thenFunc = function(results) {
		var foundSync = true;
		var res;

		while (results.length < params.length) {
			if (dict !== undefined && params[results.length] in dict) {
				results.push(dict[params[results.length]]);
			}

			if (results.length === params.length) {
				continue;
			}

			res = self.resolve(params[results.length]);

			if (res instanceof Promise) {
				return res.then(function(r) { results.push(r); return thenFunc(results); });
			}

			results.push(res);
		}

		return results;
	};

	var result = thenFunc([]);

	if (isPromise(result)) {
		return result.then(function(results) {
			if (fn.__IS_GENERATOR__) {
				return fn.__COROUTINE__.apply(receiver, results);
			} else {
				return fn.apply(receiver, results);
			}
		})
	} else {
		if (fn.__IS_GENERATOR__) {
			return fn.__COROUTINE__.apply(receiver, result);
		} else {
			return fn.apply(receiver, result);
		}
	}
};

Container.prototype.inject = function(fn, receiver) {
	return this.injectWith(fn, undefined, receiver);
};

function ContainerInterface() {
	this._containerDefinitions = Object.create(null);
};

ContainerInterface.prototype.getDefinition = function(definitionName) {
	if (typeof definitionName !== 'string') {
		throw 'getDefinition() expects a definition name';
	}

	var definition = this._containerDefinitions[definitionName];
	if (definition === undefined) {
		throw 'getDefinition() could not find definition ' + definitionName;
	}

	return definition;
};

ContainerInterface.prototype.createRoot = function(definitionName) {
	return new Container(null, this.getDefinition(definitionName), this);
};

ContainerInterface.prototype.define = function(name, parentName) {
	var parent;

	if (name in this._containerDefinitions) {
		throw 'define() could not define container, name is not unique: ' + name;
	}

	if (parentName) {
		parent = this.getDefinition(parentName);
	} else {
		parent = null;
	}

	var definition = new ContainerDefinition(name, parent, this);
	this._containerDefinitions[name] = definition;
	return definition;
}

module.exports = ContainerInterface;