'use strict';

/**
 * @name keta.servicesEventBus
 * @author Marco Lehmann <marco.lehmann@kiwigrid.com>
 * @copyright Kiwigrid GmbH 2014
 * @module keta.servicesEventBus
 * @description Event Bus Service
 */
angular.module('keta.servicesEventBus', ['keta.servicesAccessToken', 'keta.servicesLogger'])

	/**
	 * @class ketaEventBusProvider
	 * @propertyOf keta.servicesEventBus
	 * @description Event Bus Provider wrapping Vert.x event bus
	 */
	.provider('ketaEventBus', function() {

		/**
		 * @const
		 * @private
		 * @description Service name used in log messages for instance.
		 */
		var SERVICE_NAME = 'ketaEventBus';

		/**
		 * @const
		 * @private
		 * @description Connecting state constant.
		 */
		var STATE_CONNECTING = 0;

		/**
		 * @const
		 * @private
		 * @description Open state constant.
		 */
		var STATE_OPEN = 1;

		/**
		 * @const
		 * @private
		 * @description Closing state constant.
		 */
		var STATE_CLOSING = 2;

		/**
		 * @const
		 * @private
		 * @description Closed state constant.
		 */
		var STATE_CLOSED = 3;

		/**
		 * @const
		 * @private
		 * @description Unknown state constant.
		 */
		var STATE_UNKNOWN = 4;

		/**
		 * @const
		 * @private
		 * @description State labels.
		 */
		var STATE_LABELS = {};

		STATE_LABELS[STATE_CONNECTING] = 'connecting';
		STATE_LABELS[STATE_OPEN] = 'open';
		STATE_LABELS[STATE_CLOSING] = 'closing';
		STATE_LABELS[STATE_CLOSED] = 'closed';
		STATE_LABELS[STATE_UNKNOWN] = 'unknown';

		/**
		 * @const
		 * @private
		 * @description Multiplicator to transform milli units to units.
		 */
		var MILLI_MULTIPLICATOR = 1000;

		/**
		 * @const
		 * @private
		 * @description Created event id.
		 */
		var EVENT_CREATED = 'CREATED';

		/**
		 * @const
		 * @private
		 * @description Updated event id.
		 */
		var EVENT_UPDATED = 'UPDATED';

		/**
		 * @const
		 * @private
		 * @description Deleted event id.
		 */
		var EVENT_DELETED = 'DELETED';

		/**
		 * @const
		 * @private
		 * @description Failed event id.
		 */
		var EVENT_FAILED = 'FAILED';

		/**
		 * @const
		 * @private
		 * @description Response code if everything is fine.
		 */
		var RESPONSE_CODE_OK = 200;

		/**
		 * @const
		 * @private
		 * @description Response code if an API call was malformed.
		 */
		var RESPONSE_CODE_BAD_REQUEST = 400;

		/**
		 * @const
		 * @private
		 * @description Response code if something wasn't found.
		 */
		var RESPONSE_CODE_NOT_FOUND = 404;

		/**
		 * @const
		 * @private
		 * @description Response code if request timed out.
		 */
		var RESPONSE_CODE_TIMEOUT = 408;

		/**
		 * @const
		 * @private
		 * @description Response code if auth token expired.
		 */
		var RESPONSE_CODE_AUTH_TOKEN_EXPIRED = 419;

		/**
		 * @const
		 * @private
		 * @description Response code if something unexpected happened.
		 */
		var RESPONSE_CODE_INTERNAL_SERVER_ERROR = 500;

		/**
		 * @const
		 * @private
		 * @description Response code if event bus isn't open.
		 */
		var RESPONSE_CODE_SERVICE_UNAVAILABLE = 503;

		/**
		 * @const
		 * @private
		 * @description Default value for web socket URL.
		 */
		var DEFAULT_SOCKET_URL = 'https://localhost:10443/kiwibus';

		/**
		 * @const
		 * @private
		 * @description Default value for auto connect.
		 */
		var DEFAULT_AUTO_CONNECT = false;

		/**
		 * @const
		 * @private
		 * @description Default value for auto unregister.
		 */
		var DEFAULT_AUTO_UNREGISTER = true;

		/**
		 * @const
		 * @private
		 * @description Default value for reconnect.
		 */
		var DEFAULT_RECONNECT = true;

		/**
		 * @const
		 * @private
		 * @description Default value for reconnect timeout in seconds.
		 */
		var DEFAULT_RECONNECT_TIMEOUT = 10;

		/**
		 * @const
		 * @private
		 * @description Default value for mock mode.
		 */
		var DEFAULT_MOCK_MODE = false;

		/**
		 * @const
		 * @private
		 * @description Default value for debug mode.
		 */
		var DEFAULT_DEBUG_MODE = false;

		/**
		 * @const
		 * @private
		 * @description Default value for send method timeout in seconds.
		 */
		var DEFAULT_SEND_TIMEOUT = 10;

		/**
		 * @const
		 * @private
		 * @description Internal stack for configuration.
		 * @property {string} socketURL socket url
		 * @property {number} socketState socket state
		 * @property {boolean} autoConnect auto connect to socket
		 * @property {boolean} autoUnregister auto unregister listeners upon route change start
		 * @property {boolean} reconnect reconnect if socket closed
		 * @property {number} reconnectTimeout reconnect timeout to open socket again
		 * @property {boolean} mockMode mock mode enabled
		 * @property {boolean} debugMode debug mode enabled
		 * @property {number} sendTimeout timeout in seconds for send method
		 */
		var config = {
			socketURL: DEFAULT_SOCKET_URL,
			socketState: STATE_CLOSED,
			autoConnect: DEFAULT_AUTO_CONNECT,
			autoUnregister: DEFAULT_AUTO_UNREGISTER,
			reconnect: DEFAULT_RECONNECT,
			reconnectTimeout: DEFAULT_RECONNECT_TIMEOUT,
			mockMode: DEFAULT_MOCK_MODE,
			debugMode: DEFAULT_DEBUG_MODE,
			sendTimeout: DEFAULT_SEND_TIMEOUT
		};

		/**
		 * @const
		 * @private
		 * @description Internal stack for mocked responses and handlers.
		 * @property {object} responses mocked responses
		 * @property {object} handlers mocked handlers
		 */
		var mocked = {
			responses: {},
			handlers: {}
		};

		/**
		 * @const
		 * @private
		 * @description Stubbed Vert.x event bus instance.
		 */
		var eventBus = null;

		/**
		 * @const
		 * @private
		 * @description Internal stack of on open handlers.
		 */
		var onOpenHandlers = {};

		/**
		 * @const
		 * @private
		 * @description Internal stack of on close handlers.
		 */
		var onCloseHandlers = {};

		/**
		 * @const
		 * @private
		 * @description Internal stack of registered bus handlers.
		 */
		var busHandlers = {};

		// CONFIG
		// ------

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for web socket URL.
		 */
		this.DEFAULT_SOCKET_URL = DEFAULT_SOCKET_URL;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for auto connect.
		 */
		this.DEFAULT_AUTO_CONNECT = DEFAULT_AUTO_CONNECT;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for auto unregister.
		 */
		this.DEFAULT_AUTO_UNREGISTER = DEFAULT_AUTO_UNREGISTER;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for reconnect.
		 */
		this.DEFAULT_RECONNECT = DEFAULT_RECONNECT;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for reconnect timeout in seconds.
		 */
		this.DEFAULT_RECONNECT_TIMEOUT = DEFAULT_RECONNECT_TIMEOUT;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for mock mode.
		 */
		this.DEFAULT_MOCK_MODE = DEFAULT_MOCK_MODE;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for debug mode.
		 */
		this.DEFAULT_DEBUG_MODE = DEFAULT_DEBUG_MODE;

		/**
		 * @const
		 * @memberOf ketaEventBusProvider
		 * @description Default value for send method timeout in seconds.
		 */
		this.DEFAULT_SEND_TIMEOUT = DEFAULT_SEND_TIMEOUT;

		/**
		 * @name setSocketURL
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Set URL of web socket EventBus connects to.
		 * @param {string} [url=https://localhost:10443/kiwibus] URL of web socket
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.setSocketURL('http://localhost:8080/eventbus');
		 *     });
		 */
		this.setSocketURL = function(url) {
			config.socketURL = (angular.isString(url) ? String(url) : DEFAULT_SOCKET_URL);
		};

		/**
		 * @name enableAutoConnect
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Enable automatic connect upon start.
		 * @param {boolean} [enabled=false] Flag
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.enableAutoConnect(true);
		 *     });
		 */
		this.enableAutoConnect = function(enabled) {
			config.autoConnect = ((enabled === true || enabled === false) ? Boolean(enabled) : false);
		};

		/**
		 * @name enableAutoUnregister
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Enable automatic unregister of listeners upon route change start.
		 * @param {boolean} [enabled=true] Flag
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.enableAutoUnregister(false);
		 *     });
		 */
		this.enableAutoUnregister = function(enabled) {
			config.autoUnregister = ((enabled === true || enabled === false) ? Boolean(enabled) : true);
		};

		/**
		 * @name enableReconnect
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Enable reconnect if web socket was closed.
		 * @param {boolean} [enabled=false] Flag
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.enableReconnect(true);
		 *     });
		 */
		this.enableReconnect = function(enabled) {
			config.reconnect = ((enabled === true || enabled === false) ? Boolean(enabled) : true);
		};

		/**
		 * @name setReconnectTimeout
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Set timeout for retry of reconnect in case of closed web socket.
		 * @param {number} [timeout=10] Timeout in seconds
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.setReconnectTimeout(5);
		 *     });
		 */
		this.setReconnectTimeout = function(timeout) {
			config.reconnectTimeout =
				(angular.isDefined(timeout) && angular.isNumber(timeout) && (timeout > 0)) ?
					timeout : DEFAULT_RECONNECT_TIMEOUT;
		};

		/**
		 * @name enableMockMode
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Enable mock mode to use event bus service without real socket.
		 * @param {boolean} [enabled=false] Flag
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.enableMockMode(true);
		 *     });
		 */
		this.enableMockMode = function(enabled) {
			config.mockMode = ((enabled === true || enabled === false) ? Boolean(enabled) : false);
		};

		/**
		 * @name enableDebugMode
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Enable debug mode to print formatted outputs to dev tools console.
		 * @param {boolean} [enabled=false] Flag
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.enableDebugMode(true);
		 *     });
		 */
		this.enableDebugMode = function(enabled) {
			config.debugMode = ((enabled === true || enabled === false) ? Boolean(enabled) : false);
		};

		/**
		 * @name addMockResponse
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description
		 * <p>
		 *   Add mocked response for given id representing address and action on event bus.
		 * </p>
		 * <p>
		 *   Only works if mock mode is enabled.
		 * </p>
		 * @see ketaEventBusProvider.enableMockMode
		 * @param {string} id Address and action on event bus in format address:action
		 * @param {function} callback Callback method to return response
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *
		 *         // return static list of devices
		 *         ketaEventBusProvider.addMockResponse('devices:getDevices', function(request) {
		 *             return {
		 *                 code: 200,
		 *                 message: null,
		 *                 result: [{
		 *                     guid: 'sample-guid',
		 *                     currentAddress: 'sample-current-address'
		 *                 }],
		 *                 status: 'ok'
		 *             };
		 *         });
		 *
		 *     });
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *
		 *         // use request body and return it unmodified
		 *         ketaEventBusProvider.addMockResponse('devices:createDevice', function(request) {
		 *             return {
		 *                 code: 200,
		 *                 message: null,
		 *                 result: request.body,
		 *                 status: 'ok'
		 *             };
		 *         });
		 *
		 *     });
		 */
		this.addMockResponse = function(id, callback) {
			if (!angular.isDefined(mocked.responses[id]) &&	angular.isFunction(callback)) {
				mocked.responses[id] = callback;
			}
		};

		/**
		 * @name setSendTimeout
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Set timeout for send method.
		 * @param {number} [timeout=10] Timeout in seconds
		 * @example
		 * angular.module('exampleApp', [])
		 *     .config(function(ketaEventBusProvider) {
		 *         ketaEventBusProvider.setSendTimeout(5);
		 *     });
		 */
		this.setSendTimeout = function(timeout) {
			config.sendTimeout =
				(angular.isDefined(timeout) && angular.isNumber(timeout) && (timeout > 0)) ?
					timeout : DEFAULT_SEND_TIMEOUT;
		};

		/**
		 * @name getConfig
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Get configuration object.
		 * @returns {object} config object
		 * @example
		 * angular.module('exampleApp')
		 *     .config(function(ketaEventBusProvider) {
		 *         var config = ketaEventBusProvider.getConfig();
		 *     });
		 */
		this.getConfig = function() {
			return config;
		};

		/**
		 * @name getMocked
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Get mocked object.
		 * @returns {object} mocked object
		 * @example
		 * angular.module('exampleApp')
		 *     .config(function(ketaEventBusProvider) {
		 *         var mocked = ketaEventBusProvider.getMocked();
		 *     });
		 */
		this.getMocked = function() {
			return mocked;
		};

		/**
		 * @name getEventBus
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Get event bus object.
		 * @returns {object} event bus object
		 * @example
		 * angular.module('exampleApp')
		 *     .config(function(ketaEventBusProvider) {
		 *         var eventBus = ketaEventBusProvider.getEventBus();
		 *     });
		 */
		this.getEventBus = function() {
			return eventBus;
		};

		/**
		 * @name getOnOpenHandlers
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Get on open handlers stack.
		 * @returns {object} on open handlers object (uuid: handler)
		 * @example
		 * angular.module('exampleApp')
		 *     .config(function(ketaEventBusProvider) {
		 *         var onOpenHandlers = ketaEventBusProvider.getOnOpenHandlers();
		 *     });
		 */
		this.getOnOpenHandlers = function() {
			return onOpenHandlers;
		};

		/**
		 * @name getOnCloseHandlers
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Get on close handlers stack.
		 * @returns {object} on close handlers object (uuid: handler)
		 * @example
		 * angular.module('exampleApp')
		 *     .config(function(ketaEventBusProvider) {
		 *         var onCloseHandlers = ketaEventBusProvider.getOnCloseHandlers();
		 *     });
		 */
		this.getOnCloseHandlers = function() {
			return onCloseHandlers;
		};

		/**
		 * @name getBusHandlers
		 * @function
		 * @memberOf ketaEventBusProvider
		 * @description Get bus handlers stack.
		 * @returns {object} bus handlers object (uuid: handler)
		 * @example
		 * angular.module('exampleApp')
		 *     .config(function(ketaEventBusProvider) {
		 *         var busHandlers = ketaEventBusProvider.getBusHandlers();
		 *     });
		 */
		this.getBusHandlers = function() {
			return busHandlers;
		};

		// RUN
		// ---

		// keep reference
		var that = this;

		// return service API
		this.$get = function($rootScope, $location, $timeout, $window, ketaAccessToken, ketaAppContext, ketaLogger) {

			// refresh default socket url
			var busUrl = ketaAppContext.get('bus.url');
			config.socketURL = (busUrl !== null) ? busUrl : DEFAULT_SOCKET_URL;

			// Internal open handler, which calls all registered on open handlers.
			var openHandler = function() {

				// update internal socket state
				config.socketState = STATE_OPEN;

				// loop on open handlers
				angular.forEach(onOpenHandlers, function(handler) {
					if (angular.isFunction(handler)) {
						handler();
					}
				});

			};

			// Internal close handler, which calls all registered on close handlers and
			// automatically tries to reconnect if configured
			var closeHandler = function() {

				// update internal socket state
				config.socketState = STATE_CLOSED;

				// loop on close handlers
				angular.forEach(onCloseHandlers, function(handler) {
					if (angular.isFunction(handler)) {
						handler();
					}
				});

				// TODO: make this a singleton
				// reconnect
				if (config.reconnect) {
					$timeout(function() {
						stub.open();
					}, config.reconnectTimeout * MILLI_MULTIPLICATOR);
				}

			};

			// matches mock handler by requested action and send corresponding event message
			var matchMockHandler = function(message, response) {

				// check mocked handlers
				angular.forEach(mocked.handlers, function(handlerConfig, id) {
					angular.forEach(handlerConfig.actions, function(action) {
						if (action === message.action) {

							ketaLogger.debug(
								action + ' matched for handler ' + id,
								message,
								response
							);

							// build event message type
							var type = '';

							if (message.action.indexOf('create') === 0) {
								type = EVENT_CREATED;
							}
							if (message.action.indexOf('update') === 0) {
								type = EVENT_UPDATED;
							}
							if (message.action.indexOf('delete') === 0) {
								type = EVENT_DELETED;
							}

							handlerConfig.handler({
								type: type,
								value: response.result
							});

						}
					});
				});

			};

			// unregister all bus handlers and listeners upon route changes
			$rootScope.$on('$routeChangeStart', function() {

				// unregister all bus handlers
				angular.forEach(busHandlers, function(handler, uuid) {
					stub.unregisterBusHandler(uuid, handler);
				});

				// clear internal stack
				busHandlers = {};

				// unregister all listeners
				stub.send('deviceservice', {
					action: 'unregisterAllListeners',
					body: null
				});

				// unregister all event handler
				if (config.autoUnregister) {

					// on open handler
					angular.forEach(onOpenHandlers, function(handler, uuid) {
						stub.unregisterEventHandler(stub.EVENT_ON_OPEN, uuid);
					});

					// on close handler
					angular.forEach(onCloseHandlers, function(handler, uuid) {
						stub.unregisterEventHandler(stub.EVENT_ON_CLOSE, uuid);
					});

					// clear internal stacks
					onOpenHandlers = {};
					onCloseHandlers = {};

				}

			});

			/**
			 * @class ketaEventBusService
			 * @propertyOf ketaEventBusProvider
			 * @description Event Bus Service wrapping Vert.x event bus
			 */
			var stub = {

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description On open event id.
				 */
				EVENT_ON_OPEN: 'onOpen',

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description On close event id.
				 */
				EVENT_ON_CLOSE: 'onClose',

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Created event id.
				 */
				EVENT_CREATED: EVENT_CREATED,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Updated event id.
				 */
				EVENT_UPDATED: EVENT_UPDATED,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Deleted event id.
				 */
				EVENT_DELETED: EVENT_DELETED,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Failed event id.
				 */
				EVENT_FAILED: EVENT_FAILED,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if everything is fine.
				 */
				RESPONSE_CODE_OK: RESPONSE_CODE_OK,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if an API call was malformed.
				 */
				RESPONSE_CODE_BAD_REQUEST: RESPONSE_CODE_BAD_REQUEST,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if something wasn't found.
				 */
				RESPONSE_CODE_NOT_FOUND: RESPONSE_CODE_NOT_FOUND,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if request timed out.
				 */
				RESPONSE_CODE_TIMEOUT: RESPONSE_CODE_TIMEOUT,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if auth token expired.
				 */
				RESPONSE_CODE_AUTH_TOKEN_EXPIRED: RESPONSE_CODE_AUTH_TOKEN_EXPIRED,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if something unexpected happened.
				 */
				RESPONSE_CODE_INTERNAL_SERVER_ERROR: RESPONSE_CODE_INTERNAL_SERVER_ERROR,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description Response code if event bus isn't open.
				 */
				RESPONSE_CODE_SERVICE_UNAVAILABLE: RESPONSE_CODE_SERVICE_UNAVAILABLE,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get configured web socket URL.
				 * @returns {string} socketURL
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var socketURL = ketaEventBus.getSocketURL();
				 *     });
				 */
				getSocketURL: function() {
					return config.socketURL;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get internal value of socket state.
				 * @returns {number} socketState
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         // returns 0 for connecting, 1 for open, 2 for closing, 3 for closed, 4 for unknown
				 *         var socketState = ketaEventBus.getSocketState();
				 *     });
				 */
				getSocketState: function() {
					return config.socketState;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get label of internal value of socket state.
				 * @returns {string}
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var getSocketStateLabel = function() {
				 *             // returns 'connecting', 'open', 'closing', 'closed' or 'unknown'
				 *             return ketaEventBus.getSocketStateLabel();
				 *         };
				 *     });
				 */
				getSocketStateLabel: function() {
					return (angular.isDefined(STATE_LABELS[config.socketState])) ?
						STATE_LABELS[config.socketState] : STATE_LABELS[STATE_UNKNOWN];
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Check if auto connect is enabled.
				 * @returns {boolean} autoConnect
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var autoConnectEnabled = function() {
				 *             return ketaEventBus.autoConnectEnabled();
				 *         };
				 *     });
				 * @example
				 * &lt;div data-ng-controller="exampleController"&gt;
				 *     &lt;p data-ng-show="autoConnectEnabled()"&gt;Auto connect on&lt;/p&gt;
				 *     &lt;p data-ng-hide="autoConnectEnabled()"&gt;Auto connect off&lt;/p&gt;
				 * &lt;/div&gt;
				 */
				autoConnectEnabled: function() {
					return config.autoConnect;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Check if auto unregister is enabled.
				 * @returns {boolean} autoUnregister
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var autoUnregisterEnabled = function() {
				 *             return ketaEventBus.autoUnregisterEnabled();
				 *         };
				 *     });
				 * @example
				 * &lt;div data-ng-controller="exampleController"&gt;
				 *     &lt;p data-ng-show="autoUnregisterEnabled()"&gt;Auto unregister on&lt;/p&gt;
				 *     &lt;p data-ng-hide="autoUnregisterEnabled()"&gt;Auto unregister off&lt;/p&gt;
				 * &lt;/div&gt;
				 */
				autoUnregisterEnabled: function() {
					return config.autoUnregister;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Check if reconnect is enabled.
				 * @returns {boolean} reconnect
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var reconnectEnabled = function() {
				 *             return ketaEventBus.reconnectEnabled();
				 *         };
				 *     });
				 * @example
				 * &lt;div data-ng-controller="exampleController"&gt;
				 *     &lt;p data-ng-show="reconnectEnabled()"&gt;Reconnect on&lt;/p&gt;
				 *     &lt;p data-ng-hide="reconnectEnabled()"&gt;Reconnect off&lt;/p&gt;
				 * &lt;/div&gt;
				 */
				reconnectEnabled: function() {
					return config.reconnect;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get reconnect timeout configured.
				 * @returns {number} reconnect timeout in seconds
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var reconnectTimeout = ketaEventBus.getReconnectTimeout();
				 *     });
				 */
				getReconnectTimeout: function() {
					return config.reconnectTimeout;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Check if mock mode is enabled.
				 * @returns {boolean} mockMode
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var mockModeEnabled = function() {
				 *             return ketaEventBus.mockModeEnabled();
				 *         };
				 *     });
				 * @example
				 * &lt;div data-ng-controller="exampleController"&gt;
				 *     &lt;p data-ng-show="mockModeEnabled()"&gt;Mock mode on&lt;/p&gt;
				 *     &lt;p data-ng-hide="mockModeEnabled()"&gt;Mock mode off&lt;/p&gt;
				 * &lt;/div&gt;
				 */
				mockModeEnabled: function() {
					return config.mockMode;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Check if debug mode is enabled.
				 * @returns {boolean} mockMode
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var debugModeEnabled = function() {
				 *             return ketaEventBus.debugModeEnabled();
				 *         };
				 *     });
				 * @example
				 * &lt;div data-ng-controller="exampleController"&gt;
				 *     &lt;p data-ng-show="debugModeEnabled()"&gt;Debug mode on&lt;/p&gt;
				 *     &lt;p data-ng-hide="debugModeEnabled()"&gt;Debug mode off&lt;/p&gt;
				 * &lt;/div&gt;
				 */
				debugModeEnabled: function() {
					return config.debugMode;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get configuration object.
				 * @returns {object} config object
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var config = ketaEventBus.getConfig();
				 *     });
				 */
				getConfig: that.getConfig,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get mocked object.
				 * @returns {object} mocked object
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var mocked = ketaEventBus.getMocked();
				 *     });
				 */
				getMocked: that.getMocked,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get event bus object.
				 * @returns {object} event bus object
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var eventBus = ketaEventBus.getEventBus();
				 *     });
				 */
				getEventBus: that.getEventBus,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get on open handlers stack.
				 * @returns {object} on open handlers object (uuid: handler)
				 * @example
				 * angular.module('exampleApp')
				 *     .config(function(ketaEventBus) {
				 *         var onOpenHandlers = ketaEventBus.getOnOpenHandlers();
				 *     });
				 */
				getOnOpenHandlers: that.getOnOpenHandlers,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get on close handlers stack.
				 * @returns {object} on close handlers object (uuid: handler)
				 * @example
				 * angular.module('exampleApp')
				 *     .config(function(ketaEventBus) {
				 *         var onCloseHandlers = ketaEventBus.getOnCloseHandlers();
				 *     });
				 */
				getOnCloseHandlers: that.getOnCloseHandlers,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description Get bus handlers stack.
				 * @returns {object} bus handlers object (uuid: handler)
				 * @example
				 * angular.module('exampleApp')
				 *     .config(function(ketaEventBus) {
				 *         var busHandlers = ketaEventBus.getBusHandlers();
				 *     });
				 */
				getBusHandlers: that.getBusHandlers,

				// VERT.X EVENT BUS STUB
				// ---------------------

				// socket states

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description State while connecting to web socket.
				 */
				STATE_CONNECTING: STATE_CONNECTING,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description State while web socket is open.
				 */
				STATE_OPEN: STATE_OPEN,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description State while closing web socket.
				 */
				STATE_CLOSING: STATE_CLOSING,

				/**
				 * @const
				 * @memberOf ketaEventBusService
				 * @description State while web socket is closed.
				 */
				STATE_CLOSED: STATE_CLOSED,

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Open web socket connection to configured socket URL.
				 * </p>
				 * <p>
				 *   By default a generic open and close handler will be attached.
				 *   This means every handler registered via <i>registerOnOpenHandler</i> or
				 *   <i>registerOnCloseHandler</i> will be saved and called inside of generic handlers if
				 *   <i>onOpen</i> or <i>onClose</i> events occur.
				 * </p>
				 * <p>
				 *   If <i>autoConnect</i> is enabled no direct call to <i>ketaEventBus.open()</i> is necessary.
				 * </p>
				 * <p>
				 *   In mocked mode internal socket state is set to open immediately and open handler is called.
				 * </p>
				 * @see ketaEventBusProvider.enableAutoConnect
				 * @see ketaEventBusProvider.enableMockMode
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         ketaEventBus.open();
				 *     });
				 */
				open: function() {

					if (config.socketState === STATE_CLOSED) {

						ketaLogger.info(SERVICE_NAME + '.open', stub.getConfig());

						if (!config.mockMode) {

							// establish web socket
							eventBus = new vertx.EventBus(config.socketURL);

							// register on open handler
							eventBus.onopen = openHandler;

							// register on close handler
							eventBus.onclose = closeHandler;

						} else {

							// set internal state to open
							config.socketState = STATE_OPEN;

							// call open handler
							openHandler();

						}

					}

				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Close web socket connection.
				 * </p>
				 * <p>
				 *   In mocked mode internal socket state is set to closed immediately and close handler is called.
				 * </p>
				 * @see ketaEventBusProvider.enableMockMode
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         ketaEventBus.close();
				 *     });
				 */
				close: function() {

					if (config.socketState === STATE_OPEN) {
						if (!config.mockMode) {

							// close web socket
							stub.getEventBus().close();

						} else {

							// set internal state to closed
							config.socketState = STATE_CLOSED;

							// call close handler
							closeHandler();

						}
					}

				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Return state of web socket.
				 * </p>
				 * <p>
				 *   In mocked mode internal socket state is returned immediately.
				 * </p>
				 * @see ketaEventBusProvider.enableMockMode
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var state = ketaEventBus.getState();
				 *     });
				 */
				getState: function() {

					var state = stub.getSocketState();

					if (!config.mockMode && stub.getEventBus()) {
						state = stub.getEventBus().readyState();
					}

					return state;
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Send message to given address and register response handler.
				 * </p>
				 * <p>
				 *   If access token has expired response code is 419, access token will be refreshed automatically and
				 *   request will be repeated. If access token could not be refreshed an error is thrown and the application halts.
				 * </p>
				 * <p>
				 *   In mocked mode registered responses are checked by matching given address and
				 *   mocked response is returned if one was found. Also a corresponding event will be
				 *   broadcasted if action within message matches registered actions of a listener.
				 * </p>
				 * @see ketaEventBusProvider.enableMockMode
				 * @param {string} address unique address on event bus
				 * @param {object} message message object to send
				 * @param {function} responseHandler handler to process response
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus, ketaLogger) {
				 *         ketaEventBus.send('devices', {
				 *             action: 'getDevices'
				 *         }, function(response) {
				 *             ketaLogger.info('ketaEventBus send reponse', {
				 *                 action: 'getDevices'
				 *             }, response);
				 *         });
				 *     });
				 */
				send: function(address, message, responseHandler) {

					ketaLogger.debug(
						SERVICE_NAME + '.send » request to ' + address + ':' + message.action,
						message
					);

					if (config.socketState === STATE_OPEN) {
						if (!config.mockMode) {

							// inject access token
							message.accessToken = ketaAccessToken.get();

							var requestReturned = false;

							// start timeout
							$timeout(function() {
								if (!requestReturned && angular.isFunction(responseHandler)) {

									ketaLogger.error(
										SERVICE_NAME + '.send « response for ' + address + ':' + message.action + ' timed out',
										message
									);

									requestReturned = true;
									responseHandler({
										code: stub.RESPONSE_CODE_TIMEOUT,
										message: 'Response for ' + address + ':' + message.action + ' timed out'
									});

								}
							}, config.sendTimeout * MILLI_MULTIPLICATOR);

							// send message
							stub.getEventBus().send(address, message, function(reply) {

								if (!requestReturned && reply) {

									requestReturned = true;

									if (angular.isDefined(reply.code)) {
										if (reply.code === stub.RESPONSE_CODE_AUTH_TOKEN_EXPIRED) {

											// access token expired
											ketaAccessToken.refresh().then(function(response) {
												if (angular.isDefined(response.data.accessToken)) {
													ketaAccessToken.set(response.data.accessToken);
													stub.send(address, message, responseHandler);
												}
											}, function() {
												$window.location.reload();
											});

										} else {

											ketaLogger.debug(
												SERVICE_NAME + '.send « response from ' + address + ':' + message.action,
												message,
												reply
											);

											// non-interceptable response code (200, 401, ...)
											if (angular.isFunction(responseHandler)) {
												responseHandler(reply);
											}

										}
									} else {

										ketaLogger.error(
											SERVICE_NAME + '.send « response for ' + address + ':' + message.action + ' was "Bad request"',
											message
										);

										responseHandler({
											code: stub.RESPONSE_CODE_BAD_REQUEST,
											message: 'Bad request'
										});

									}

								}

							});

						} else {

							if (angular.isDefined(message.action) &&
								angular.isDefined(mocked.responses[address + ':' + message.action])) {

								// get reply
								var reply = mocked.responses[address + ':' + message.action](message);

								ketaLogger.debug(
									SERVICE_NAME + '.send « response (mocked) from ' + address + ':' + message.action,
									message,
									reply
								);

								// send mocked reply
								if (angular.isFunction(responseHandler)) {
									responseHandler(reply);
								}

								// check mocked handlers
								matchMockHandler(message, reply);

							} else {

								// if no mocked response was found send a 404 reply
								ketaLogger.warning(
									SERVICE_NAME + '.send « no mocked response for ' + address + ':' + message.action + ' found',
									message
								);

								if (angular.isFunction(responseHandler)) {
									responseHandler({
										code: stub.RESPONSE_CODE_NOT_FOUND,
										message: 'No mocked response for ' + address + ':' + message.action + ' found'
									});
								}

							}

						}
					} else {

						ketaLogger.error(
							SERVICE_NAME + '.send « request to ' + address + ':' + message.action + ' denied. EventBus not open.',
							message
						);

						if (angular.isFunction(responseHandler)) {
							responseHandler({
								code: stub.RESPONSE_CODE_SERVICE_UNAVAILABLE,
								message: 'EventBus not open'
							});
						}

					}

				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Publish message to given address.
				 * </p>
				 * <p>
				 *   In mocked mode nothing happens as there is no response handler for publishing messages.
				 * </p>
				 * @see ketaEventBusProvider.enableMockMode
				 * @param {string} address unique address on event bus
				 * @param {object} message message object to send
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         ketaEventBus.publish('logger', {
				 *             action: 'log',
				 *             body: {
				 *                 message: 'log this'
				 *             }
				 *         });
				 *     });
				 */
				publish: function(address, message) {

					ketaLogger.debug(
						SERVICE_NAME + '.publish » request to ' + address + ':' + message.action,
						message
					);

					if (config.socketState === STATE_OPEN) {
						if (!config.mockMode && stub.getEventBus()) {

							// inject access token
							message.accessToken = ketaAccessToken.get();

							// send message
							stub.getEventBus().publish(address, message);

						}
					} else {
						ketaLogger.error(
							SERVICE_NAME + '.publish « request to ' + address + ':' + message.action + ' denied. EventBus not open.',
							message
						);
					}

				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Register a handler with a universal unique identifier on event bus.
				 * </p>
				 * <p>
				 *   For mocked mode a third parameter exists, which defines actions the listener is responsible for.
				 *   The EventBusService holds a handler array internally in which handler UUID and actions are saved.
				 *   Inside <i>send</i> methods response handler a check is performed, if one of the registered actions
				 *   was received and in case of true the handler is called with a generated event message.
				 * </p>
				 * <p>
				 *   A handler UUID can be generated with <i>generateUUID</i>. Handler UUIDs are saved internally and
				 *   unregistered upon route changes.
				 * </p>
				 * @see ketaEventBusProvider.enableMockMode
				 * @see ketaEventBusService.send
				 * @see ketaEventBusService.generateUUID
				 * @param {string} uuid UUID on event bus
				 * @param {function} handler handler registered with UUID
				 * @param {string[]} [actions=[]] array of actions listener is responsible for
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus, ketaLogger) {
				 *
				 *         // generate handler uuid
				 *         var listenerUUID = ketaEventBus.generateUUID();
				 *
				 *         // register bus handler with disabled mock mode
				 *         ketaEventBus.registerBusHandler(listenerUUID, function(message) {
				 *             ketaLogger.info('ketaEventBus device set listener', message);
				 *         });
				 *
				 *     });
				 * @example
				 * angular.module('exampleApp')
				 *     .config(function(EventBusProvider) {
				 *
				 *         // enable mock mode
				 *         EventBusProvider.enableMockMode(true);
				 *
				 *     })
				 *     .controller('exampleController', function(ketaEventBus, ketaLogger) {
				 *
				 *         // generate handler uuid
				 *         var listenerUUID = ketaEventBus.generateUUID();
				 *
				 *         // register bus handler with enabled mock mode
				 *         ketaEventBus.registerBusHandler(listenerUUID, function(message) {
				 *             ketaLogger.info('ketaEventBus device set listener', message);
				 *         }, ['createDevice', 'updateDevice', 'deleteDevice']);
				 *
				 *     });
				 */
				registerBusHandler: function(uuid, handler, actions) {

					ketaLogger.debug(
						SERVICE_NAME + '.registerBusHandler » request for ' + uuid,
						actions
					);

					if (config.socketState === STATE_OPEN) {
						if (!config.mockMode && stub.getEventBus()) {
							stub.getEventBus().registerHandler(uuid, handler);
							busHandlers[uuid] = handler;
						} else {
							if (!angular.isDefined(mocked.handlers[uuid])) {
								mocked.handlers[uuid] = {
									handler: handler,
									actions: actions
								};
								ketaLogger.info(
									SERVICE_NAME + '.registerBusHandler ' + uuid + ' in mock mode',
									mocked.handlers[uuid].actions
								);
							} else {
								ketaLogger.warning(
									SERVICE_NAME + '.registerBusHandler « no mocked response found',
									mocked.handlers[uuid].actions
								);
							}
						}
					} else {
						ketaLogger.error(
							SERVICE_NAME + '.registerBusHandler « request for ' + uuid + ' denied. EventBus not open.',
							actions
						);
					}
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Unregister a handler with a universal unique identifier on event bus.
				 * </p>
				 * <p>
				 *   For mocked mode the internal handler list is updated by removing the specified handler with given UUID.
				 * </p>
				 * @see ketaEventBusProvider.enableMockMode
				 * @param {string} uuid UUID on event bus
				 * @param {function} handler handler registered with UUID
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus, ketaLogger) {
				 *
				 *         // generate handler uuid
				 *         var listenerUUID = ketaEventBus.generateUUID();
				 *
				 *         // register bus handler with disabled mock mode
				 *         ketaEventBus.registerBusHandler(listenerUUID, function(message) {
				 *             ketaLogger.info('ketaEventBus device set listener registered', message);
				 *         });
				 *
				 *         // unregister bus handler with disabled mock mode
				 *         ketaEventBus.unregisterBusHandler(listenerUUID, function(message) {
				 *             ketaLogger.info('ketaEventBus device set listener unregistered', message);
				 *         });
				 *
				 *     });
				 */
				unregisterBusHandler: function(uuid, handler) {

					ketaLogger.debug(
						SERVICE_NAME + '.unregisterBusHandler » request for ' + uuid
					);

					if (config.socketState === STATE_OPEN) {
						if (!config.mockMode && stub.getEventBus() && angular.isDefined(busHandlers[uuid])) {
							stub.getEventBus().unregisterHandler(uuid, handler);
							delete busHandlers[uuid];
						} else {
							if (angular.isDefined(mocked.handlers[uuid])) {
								var handlers = [];
								angular.forEach(mocked.handlers[uuid], function(h) {
									if (handler !== h) {
										handlers.push(h);
									}
								});
								mocked.handlers[uuid] = handlers;
								ketaLogger.info(SERVICE_NAME + '.unregisterBusHandler ' + uuid + ' in mock mode');
							} else {
								ketaLogger.warning(SERVICE_NAME + '.unregisterBusHandler « no mocked response found');
							}
						}
					} else {
						ketaLogger.error(
							SERVICE_NAME + '.unregisterBusHandler « request for ' + uuid + ' denied. EventBus not open.'
						);
					}
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Register an event handler.
				 * </p>
				 * @see ketaEventBusService.EVENT_ON_OPEN
				 * @see ketaEventBusService.EVENT_ON_CLOSE
				 * @see ketaEventBusService.unregisterEventHandler
				 * @param {string} event event id
				 * @param {string} uuid UUID for internal list
				 * @param {function} handler handler registered with UUID
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus, ketaLogger) {
				 *
				 *         // generate handler uuids
				 *         var onOpenHandlerUUID = ketaEventBus.generateUUID();
				 *         var onCloseHandlerUUID = ketaEventBus.generateUUID();
				 *
				 *         // register on open handler
				 *         ketaEventBus.registerOnOpenHandler(ketaEventBus.EVENT_ON_OPEN, onOpenHandlerUUID, function() {
				 *             ketaLogger.info('ketaEventBus open');
				 *         });
				 *
				 *         // register on close handler
				 *         ketaEventBus.registerOnCloseHandler(ketaEventBus.EVENT_ON_CLOSE, onCloseHandlerUUID, function() {
				 *             ketaLogger.info('ketaEventBus closed');
				 *         });
				 *
				 *     });
				 */
				registerEventHandler: function(event, uuid, handler) {
					if (event === stub.EVENT_ON_OPEN) {
						if (!angular.isDefined(onOpenHandlers[uuid])) {
							onOpenHandlers[uuid] = handler;
						}
					}
					if (event === stub.EVENT_ON_CLOSE) {
						if (!angular.isDefined(onCloseHandlers[uuid])) {
							onCloseHandlers[uuid] = handler;
						}
					}
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Unregister an event handler.
				 * </p>
				 * @see ketaEventBusService.EVENT_ON_OPEN
				 * @see ketaEventBusService.EVENT_ON_CLOSE
				 * @see ketaEventBusService.registerEventHandler
				 * @param {string} event event id
				 * @param {string} uuid UUID for internal list
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus, ketaLogger) {
				 *
				 *         // generate handler uuids
				 *         var onOpenHandlerUUID = ketaEventBus.generateUUID();
				 *         var onCloseHandlerUUID = ketaEventBus.generateUUID();
				 *
				 *         // register on open handler
				 *         ketaEventBus.registerOnOpenHandler(ketaEventBus.EVENT_ON_OPEN, onOpenHandlerUUID, function() {
				 *             ketaLogger.info('ketaEventBus open');
				 *             ketaEventBus.unregisterOnOpenHandler(ketaEventBus.EVENT_ON_OPEN, onOpenHandlerUUID);
				 *         });
				 *
				 *         // register on close handler
				 *         ketaEventBus.registerOnCloseHandler(ketaEventBus.EVENT_ON_CLOSE, onCloseHandlerUUID, function() {
				 *             ketaLogger.info('ketaEventBus closed');
				 *             ketaEventBus.unregisterOnOpenHandler(ketaEventBus.EVENT_ON_CLOSE, onCloseHandlerUUID);
				 *         });
				 *
				 *     });
				 */
				unregisterEventHandler: function(event, uuid) {
					if (event === stub.EVENT_ON_OPEN) {
						if (angular.isDefined(onOpenHandlers[uuid])) {
							delete onOpenHandlers[uuid];
						}
					}
					if (event === stub.EVENT_ON_CLOSE) {
						if (angular.isDefined(onCloseHandlers[uuid])) {
							delete onCloseHandlers[uuid];
						}
					}
				},

				/**
				 * @function
				 * @memberOf ketaEventBusService
				 * @description
				 * <p>
				 *   Generate an UUID for handler.
				 * </p>
				 * @returns {string} uuid
				 * @example
				 * angular.module('exampleApp')
				 *     .controller('exampleController', function(ketaEventBus) {
				 *         var handlerUUID = ketaEventBus.generateUUID();
				 *     });
				 */
				generateUUID: function() {
					return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
						.replace(/[xy]/g, function(a, b) {
							return b = Math.random() * 16, (a === 'y' ? (b & 3 | 8) : (b | 0)).toString(16); // buddy ignore:line
						});
				}

			};

			if (config.autoConnect) {
				stub.open();
			}

			return stub;
		};

	});
