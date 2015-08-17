'use strict';

/**
 * @name keta.utils.Application
 * @author Marco Lehmann <marco.lehmann@kiwigrid.com>
 * @copyright Kiwigrid GmbH 2014-2015
 * @module keta.utils.Application
 * @description
 * <p>
 *   Application service utilities for cross-component usage.
 * </p>
 */

angular.module('keta.utils.Application',
	[
		'keta.services.ApplicationSet',
		'keta.utils.Common'
	])

	.constant('ApplicationUtilsConstants', {
		MEDIA_TYPE_APPICON: 'APPICON',
		AUTHOR_TYPE_SELLER: 'SELLER'
	})

	/**
	 * @class ApplicationUtils
	 * @propertyOf keta.utils.Application
	 * @description Application Utils Factory
	 */
	.factory('ApplicationUtils', function ApplicationUtils(
		$log, $q,
		ApplicationSet, EventBusManager, CommonUtils,
		ApplicationUtilsConstants
	) {

		var deferred = {
			getAppList: null
		};

		return {

			/**
			 * @name getAppName
			 * @memberOf ApplicationUtils
			 * @description
			 * <p>
			 *   uiLocale is the current (user set) UI language of the running app.
			 *   Can be either short ('de') or long ('en-US') format.
			 * </p>
			 * @param {object} labels object of all labels grouped by locale keys
			 * @param {string} uiLocale current locale
			 * @returns {string} application localized application name
			 */

			getAppName: function getAppName(labels, uiLocale) {
				return CommonUtils.getLabelByLocale('name', labels, uiLocale);
			},

			/**
			 * @name getAppList
			 * @function
			 * @memberOf ApplicationUtils
			 * @description
			 * <p>
			 *   Returns an array with all apps that are not blacklisted and have an entryUri. It is also
			 *   possible to get apps for a specific user by providing an appropriate filter with key userId.
			 * </p>
			 * @param {object} options options to configure the API call
			 * @returns {promise} app list promise
			 * @example
			 * angular.module('exampleApp', ['keta.utils.Application'])
			 *     .controller('ExampleController', function(ApplicationUtils) {
			 *
			 *         // get apps with default options
			 *         // eventBusId: kiwibus
			 *         // forceRefresh: false
			 *         // filter: {} (no filter applied)
			 *         ApplicationUtils.getAppList().then(function(apps) {
			 *             // ...
			 *         });
			 *
			 *         // get apps with options in place
			 *         ApplicationUtils.getAppList({
			 *             eventBusId: 'myCustomEventBusId',
			 *             forceRefresh: true,
			 *             filter: {
			 *                 userId: 'john.doe'
			 *             },
			 *             excludeAppIds: {
			 *                 'kiwigrid.clouddesktop': true
			 *             }
			 *         }).then(function(apps) {
			 *             // ...
			 *         });
			 *
			 *     });
			 */
			getAppList: function getAppList(options) {

				var DEFAULT_OPTIONS = {
					eventBusId: 'kiwibus',
					forceRefresh: false,
					filter: {},
					excludeAppIds: {}
				};

				var usedOptions = angular.extend({}, DEFAULT_OPTIONS, options || {});

				if (deferred.getAppList === null || usedOptions.forceRefresh === true) {
					deferred.getAppList = $q.defer();

					ApplicationSet.create(EventBusManager.get(usedOptions.eventBusId))
						.filter(usedOptions.filter)
						.query()
						.then(function(reply) {

							if (angular.isDefined(reply.result) &&
								angular.isDefined(reply.result.items)) {

								var filteredApps = [];
								angular.forEach(reply.result.items, function(app) {
									if (angular.isDefined(app.appId) &&
										angular.isDefined(app.visible) &&
										app.visible === true &&
										!angular.isDefined(usedOptions.excludeAppIds[app.appId]) ||
										usedOptions.excludeAppIds[app.appId] === false	&&
										angular.isString(app.entryUri) && app.entryUri !== '' &&
										CommonUtils.doesPropertyExist(app, 'meta.i18n.en.name')) {

										filteredApps.push(app);
									}
								});

								deferred.getAppList.resolve(filteredApps);

							} else {
								var errorMessage = 'Something bad happened. Got no reply.';
								deferred.getAppList.reject(errorMessage);
							}
						}, function() {
							var errorMessage = 'Could not load application information.';
							deferred.getAppList.reject(errorMessage);
						});

				}

				return deferred.getAppList.promise;
			},

			/**
			 * @name getAppIcon
			 * @function
			 * @memberOf ApplicationUtils
			 * @description
			 * <p>
			 *   Returns app icon source from app meta object by using
			 *   link-element to easily access url params.
			 *   If app has no icon informations it return <code>null</code>.
			 * </p>
			 * @param {object} app application instance
			 * @param {string} language current language
			 * @returns {string} app icon src
			 */
			getAppIcon: function(app, language) {

				var appIcon = null;

				language = angular.isDefined(language) ? language : 'en';

				var mediaSource = CommonUtils.doesPropertyExist(app, 'meta.i18n') &&
					angular.isDefined(app.meta.i18n[language]) &&
					angular.isDefined(app.meta.i18n[language].media) ?
						app.meta.i18n[language].media : null;

				if (mediaSource === null &&
					CommonUtils.doesPropertyExist(app, 'meta.i18n.en.media')) {
					mediaSource = app.meta.i18n.en.media;
				}

				if (angular.isDefined(app.entryUri)) {

					var link = document.createElement('a');
					link.href = app.entryUri;

					angular.forEach(mediaSource, function(media) {

						if (angular.isDefined(media.type) &&
							media.type === ApplicationUtilsConstants.MEDIA_TYPE_APPICON &&
							angular.isDefined(media.src)) {

							appIcon =
								link.origin[link.origin.length - 1] !== '/' && media.src[0] !== '/' ?
								link.origin + '/' + media.src :
								link.origin + media.src;

						}

					});

				}

				return appIcon;

			},

			/**
			 * @name getAppAuthor
			 * @function
			 * @memberOf ApplicationUtils
			 * @description
			 * <p>
			 *   Returns author from type or the first author in app.meta.author array.
			 * </p>
			 * @param {object} app application instance
			 * @param {string} type author type
			 * @returns {string} app author name
			 */
			getAppAuthor: function(app, type) {

				var appAuthor = null;

				type = angular.isDefined(type) ? type : ApplicationUtilsConstants.AUTHOR_TYPE_SELLER;

				if (CommonUtils.doesPropertyExist(app, 'meta.authors')) {

					angular.forEach(app.meta.authors, function(author) {

						if (author.type === type) {
							appAuthor = author.name;
						}

					});

					if (appAuthor === null) {
						appAuthor = app.meta.authors[0].name;
					}

				}

				return appAuthor;

			}

		};

	});
