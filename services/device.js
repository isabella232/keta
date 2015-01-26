'use strict';

/**
 * @name keta.services.Device
 * @author Marco Lehmann <marco.lehmann@kiwigrid.com>
 * @copyright Kiwigrid GmbH 2014
 * @module keta.services.Device
 * @description Device Provider
 */
angular.module('keta.services.Device',
	[
		'keta.services.EventBusDispatcher',
		'keta.services.EventBusManager',
		'keta.services.Logger'
	])
	
	/**
	 * @class DeviceProvider
	 * @propertyOf keta.services.Device
	 * @description Device Provider
	 */
	.provider('Device', function DeviceProvider() {
		
		this.$get = function DeviceService($q, $log, EventBusDispatcher, EventBusManager) {
			
			/**
			 * @class DeviceInstance
			 * @propertyOf Device
			 * @description Device Instance
			 */
			var DeviceInstance = function(givenEventBus, properties) {
				
				// keep reference
				var that = this;
				
				// save EventBus instance
				var eventBus = givenEventBus;
				
				// populate properties
				angular.forEach(properties, function(value, key) {
					that[key] = value;
					
					// save copy under $pristine
					if (!angular.isDefined(that.$pristine)) {
						that.$pristine = {};
					}
					
					that.$pristine[key] = angular.copy(value);
				});
				
				// send message and return promise
				var sendMessage = function(message) {
					var deferred = $q.defer();
					
					EventBusDispatcher.send(eventBus, 'devices', message, function(reply) {
						
						// log if in debug mode
						if (EventBusManager.inDebugMode()) {
							$log.request([message, reply], $log.ADVANCED_FORMATTER);
						}
						
						if (reply.code === 200) {
							deferred.resolve(reply);
						} else {
							deferred.reject(reply);
						}
						
					});
					
					return deferred.promise;
				};
				
				var returnRejectedPromise = function(message) {
					var deferred = $q.defer();
					deferred.reject(message);
					return deferred.promise;
				};
				
				/**
				 * @name update
				 * @function
				 * @memberOf DeviceInstance
				 * @description
				 * <p>
				 *   Updates a remote DeviceInstance from local one the method is called on.
				 * </p>
				 * <p>
				 *   Only value changes in <code>tagValues</code> property will be recognized as changes.
				 * </p>
				 * @return {promise} promise
				 * @example
				 * angular.module('exampleApp', ['keta.services.Device'])
				 *     .controller('ExampleController', function(Device) {
				 *         var device = Device.create({
				 *             guid: 'guid',
				 *             tagValues: {
				 *                 IdName: {
				 *                     name: 'IdName',
				 *                     value: 'Device',
				 *                     oca: 0,
				 *                     timestamp: 123456789
				 *                 }
				 *             }
				 *         });
				 *         device.tagValues.IdName.value = 'Modified Device';
				 *         device.update()
				 *             .then(function(reply) {
				 *                 // success handler
				 *                 // ...
				 *             }, function(reply) {
				 *                 // error handler
				 *                 // ...
				 *             });
				 *     });
				 */
				that.update = function() {
					
					// collect changes in tagValues property
					var changes = {
						tagValues: {}
					};
					
					angular.forEach(that.tagValues, function(tagValue, tagName) {
						if (!angular.equals(that.tagValues[tagName].value, that.$pristine.tagValues[tagName].value)) {
							changes.tagValues[tagName] = {};
							changes.tagValues[tagName].value = tagValue.value;
							changes.tagValues[tagName].oca = tagValue.oca;
						}
					});
					
					if (Object.keys(changes.tagValues).length) {
						var deferred = $q.defer();
						
						sendMessage({
							action: 'updateDevice',
							params: {
								deviceId: that.guid
							},
							body: changes
						}).then(function(reply) {
							
							// update $pristine copies after success
							angular.forEach(that.$pristine, function(value, key) {
								that.$pristine[key] = angular.copy(that[key]);
							});
							
							deferred.resolve(reply);
						}, function(reply) {
							deferred.reject(reply);
						});
						
						return deferred.promise;
					} else {
						return returnRejectedPromise('No changes found');
					}
				};
				
				/**
				 * @name delete
				 * @function
				 * @memberOf DeviceInstance
				 * @description
				 * <p>
				 *   Deletes a remote DeviceInstance from local one the method is called on.
				 * </p>
				 * @return {promise} promise
				 * @example
				 * angular.module('exampleApp', ['keta.services.Device'])
				 *     .controller('ExampleController', function(Device) {
				 *         var device = Device.create({
				 *             guid: 'guid'
				 *         });
				 *         device.delete()
				 *             .then(function(reply) {
				 *                 // success handler
				 *                 // ...
				 *             }, function(reply) {
				 *                 // error handler
				 *                 // ...
				 *             });
				 *     });
				 */
				that.delete = function() {
					return sendMessage({
						action: 'deleteDevice',
						params: {
							deviceId: that.guid
						}
					});
				};
				
			};
			
			/**
			 * @class Device
			 * @propertyOf DeviceProvider
			 * @description Device Service
			 */
			var api = {
				
				/**
				 * @function
				 * @memberOf Device
				 * @description
				 * <p>
				 *   Creates a DeviceInstance with given EventBus instance and properties.
				 * </p>
				 * @param {EventBus} eventBus EventBus instance to use for communication
				 * @param {Object} properties Properties to set upon DeviceInstance creation
				 * @returns {DeviceInstance}
				 * @example
				 * angular.module('exampleApp', ['keta.services.Device'])
				 *     .controller('ExampleController', function(Device) {
				 *         var device = Device.create(eventBus, {
				 *             tagValues: {
				 *                 IdName: {
				 *                     name: 'IdName',
				 *                     value: 'Device',
				 *                     oca: 0,
				 *                     timestamp: 123456789
				 *                 }
				 *             }
				 *         });
				 *     });
				 */
				create: function(eventBus, properties) {
					return new DeviceInstance(eventBus, properties);
				}
				
			};
			
			return api;
			
		};
		
	});
