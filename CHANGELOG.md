![keta](keta.png "keta")

#### Frontend Components for Kiwigrid Platform based AngularJS Apps

Copyright Kiwigrid GmbH 2014-2015

---

Official page: [http://kiwigrid.github.io/keta/](http://kiwigrid.github.io/keta/)

# Changelog

## Version 0.4.2

_Released: 2015-07-22_

* Added support for new `meta.json` format to `AppBar` directive
* Several features and bugfixes for CSS parts

## Version 0.4.1

_Released: 2015-07-17_

* Bugfix for `AppBar` directive: Overwriting the logout link is now possible
* Added `tableClassCallback` to `ExtendedTable` directive to modify table classes

## Version 0.4.0

_Released: 2015-07-10_

### General changes

* New utility service `ApplicationUtils`
* New $log decorator with different logging levels (description see module `Logger`)
* Removed module `keta.shared`, constant `ketaSharedConfig` and factory `ketaSharedFactory`. 
* Constants have been moved into the modules they belong to (and new constant names were defined), `ketaSharedFactory` has been renamed into `CommonUtils`

### Changes in `appBar` directive

* Parameter `links` is not necessary anymore because all links are automatically filled by the directive itself with default values
* If the `links` property is provided every key that is given in this object overrides the default values
* Parameter `labels` is not necessary anymore because all links are automatically filled by the directive itself with default values
* Labels can be overwritten, it is also possible to add new locales (see module `appBar` for examples)
* New parameter `rootApp` as an object which is set by the directive itself and can afterwards be used to set the logo link in the transcluded html markup for example

### Changes in `extendedTable` directive

* Parameter `labels` is not necessary anymore because all links are automatically filled by the directive itself with default values
* Labels can be overwritten, it is also possible to add new locales (see module `extendedTable` for examples)

---

## Version 0.3.25

_Released: 2015-07-10_

* Pager gets displayed only if there are at least two pages

## Version 0.3.24

_Released: 2015-07-07_

* New pager style for Extended Table, Added columnClassCallback to actions row

## Version 0.3.23

_Released: 2015-06-08_

* Some smaller CSS fixes and changes

## Version 0.3.22

_Released: 2015-06-01_

* Made main menu link configuration more flexible

## Version 0.3.21

_Released: 2015-05-29_

* Optimized main menu icon configuration

## Version 0.3.20

_Released: 2015-05-27_

* Fixed App Bar current locale usage
* Added App Bar app title link configuration option
* Added App Bar element, size and state constants to ketaShared

## Version 0.3.19

_Released: 2015-05-26_

* Fixed App Bar current locale configuration

## Version 0.3.18

_Released: 2015-05-26_

* Fixed App Bar affix behavior
* Fixed Extended Table row filter

## Version 0.3.17

_Released: 2015-05-21_

* Changed syntax for display modes in App Bar Directive

## Version 0.3.16

_Released: 2015-05-21_

* Fixed some issues with App Bar Directive

## Version 0.3.15

_Released: 2015-05-20_

* Added $reset method to device and user instance
* Added documentation for app bar directive

## Version 0.3.14

_Released: 2015-05-20_

* New App Bar Directive, World Bar Directive was removed
* Extended AccessToken service with encode and decode methods
* CSS Updates

## Version 0.3.13

_Released: 2015-04-24_

* Bugfix for change detection in user wrapper

## Version 0.3.12

_Released: 2015-04-23_

* Bugfix for automatically registered device set listener

## Version 0.3.11

_Released: 2015-04-21_

* Updated World Bar directive to be compatible with new API
* Bugfix for Unit filter with input: 0 and separate: true
* Removed getDeviceClasses method in Device wrapper

## Version 0.3.10

_Released: 2015-04-14_

* More configuration possibilities for unit filter
* Bugfix for unit filter rounding numbers which change SI prefix

## Version 0.3.9

_Released: 2015-04-09_

* Bugfix for change detection in user update method

## Version 0.3.8

_Released: 2015-04-09_

* Added wrapper for applications
* Added wrapper for users
* Several bug fixes
* Clean up

## Version 0.3.7

_Released: 2015-03-31_

* Added Bower support

## Version 0.3.6

_Released: 2015-03-26_

* Update of css parts

## Version 0.3.5

_Released: 2015-03-25_

* Bugfix for toggle sidebar out of other directives

## Version 0.3.4

_Released: 2015-03-20_

* Moved `Device.getDeviceClasses` method
* Improved test code coverage

## Version 0.3.3

_Released: 2015-03-18_

* Added `Device.getDeviceClasses` method
* Updated CSS parts

## Version 0.3.2

_Released: 2015-02-13_

* Bugfix for ExtendedTable not updating itself upon updates from outside

## Version 0.3.1

_Released: 2015-02-09_

* Bugfix for response timeout fired although request was successful

## Version 0.3.0

_Released: 2015-02-09_

* Complete refactoring to improve usability of library for applications
* Introduction of chained queries
* Multiple EventBus instances are possible now
* Logging is implemented as `$log` decorator
* Registration of DeviceSetListener is disabled by default, but can be activated with a one-liner
* A couple of directives (e.g. `main-menu`, `world-bar`) are included

---

## Version 0.2.14

_Released: 2014-12-16_

* Bugfix-Release for first version of library