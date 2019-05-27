(function() {
    window._satellite = window._satellite || {};
    window._satellite.container = {
        "buildInfo": {
            "buildDate": "2018-10-01T18:52:36Z",
            "environment": "production",
            "turbineBuildDate": "2018-06-20T22:24:50Z",
            "turbineVersion": "25.1.3"
        },
        "dataElements": {
            "Page Name": {
                "defaultValue": "not available",
                "forceLowerCase": true,
                "cleanText": true,
                "storageDuration": "pageview",
                "modulePath": "core/src/lib/dataElements/javascriptVariable.js",
                "settings": {
                    "path": "digitalData.pageName"
                }
            }
        },
        "extensions": {
            "adobe-analytics": {
                "displayName": "Adobe Analytics",
                "modules": {
                    "adobe-analytics/src/lib/actions/sendBeacon.js": {
                        "name": "send-beacon",
                        "displayName": "Send Beacon",
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            var getTracker = require('../sharedModules/getTracker');

                            var isLink = function(element) {
                                return element && element.nodeName && element.nodeName.toLowerCase() === 'a';
                            };

                            var getLinkName = function(element) {
                                if (isLink(element)) {
                                    return element.innerHTML;
                                } else {
                                    return 'link clicked';
                                }
                            };

                            var sendBeacon = function(tracker, settings, targetElement) {
                                if (settings.type === 'page') {
                                    turbine.logger.info('Firing page view beacon.');
                                    tracker.t();
                                } else {
                                    var linkSettings = {
                                        linkType: settings.linkType || 'o',
                                        linkName: settings.linkName || getLinkName(targetElement)
                                    };

                                    turbine.logger.info(
                                        'Firing link track beacon using the values: ' +
                                        JSON.stringify(linkSettings) + '.'
                                    );

                                    tracker.tl(
                                        isLink(targetElement) ? targetElement : 'true',
                                        linkSettings.linkType,
                                        linkSettings.linkName
                                    );
                                }
                            };

                            module.exports = function(settings, event) {
                                return getTracker().then(function(tracker) {
                                    sendBeacon(tracker, settings, event.element);
                                }, function(errorMessage) {
                                    turbine.logger.error(
                                        'Cannot send beacon: ' +
                                        errorMessage
                                    );
                                });
                            };

                        }

                    },
                    "adobe-analytics/src/lib/actions/setVariables.js": {
                        "name": "set-variables",
                        "displayName": "Set Variables",
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            var getTracker = require('../sharedModules/getTracker');
                            var applyTrackerVariables = require('../helpers/applyTrackerVariables');

                            module.exports = function(settings, event) {
                                return getTracker().then(function(tracker) {
                                    turbine.logger.info('Set variables on the tracker.');
                                    applyTrackerVariables(tracker, settings.trackerProperties);
                                    if (settings.customSetup && settings.customSetup.source) {
                                        settings.customSetup.source.call(event.element, event, tracker);
                                    }
                                }, function(errorMessage) {
                                    turbine.logger.error(
                                        'Cannot set variables: ' +
                                        errorMessage
                                    );
                                });
                            };

                        }

                    },
                    "adobe-analytics/src/lib/sharedModules/getTracker.js": {
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            var cookie = require('@adobe/reactor-cookie');
                            var Promise = require('@adobe/reactor-promise');
                            var window = require('@adobe/reactor-window');
                            var augmenters = require('../helpers/augmenters');
                            var loadScript = require('@adobe/reactor-load-script');

                            var applyTrackerVariables = require('../helpers/applyTrackerVariables');
                            var loadLibrary = require('../helpers/loadLibrary');
                            var generateVersion = require('../helpers/generateVersion');

                            var version = generateVersion(turbine.buildInfo.turbineBuildDate);
                            var BEFORE_SETTINGS_LOAD_PHASE = 'beforeSettings';

                            var mcidInstance = turbine.getSharedModule('adobe-mcid', 'mcid-instance');

                            var checkEuCompliance = function(trackingCoookieName) {
                                if (!trackingCoookieName) {
                                    return true;
                                }

                                var euCookieValue = cookie.get(trackingCoookieName);
                                return euCookieValue === 'true';
                            };

                            var augmentTracker = function(tracker) {
                                return Promise.all(augmenters.map(function(augmenterFn) {
                                    var result;

                                    // If a tracker augmenter fails, we don't want to fail too. We'll re-throw the error in a
                                    // timeout so it still hits the console but doesn't reject our promise.
                                    try {
                                        result = augmenterFn(tracker);
                                    } catch (e) {
                                        setTimeout(function() {
                                            throw e;
                                        });
                                    }

                                    return Promise.resolve(result);
                                })).then(function() {
                                    return tracker;
                                });
                            };

                            var linkVisitorId = function(tracker) {
                                if (mcidInstance) {
                                    turbine.logger.info('Setting MCID instance on the tracker.');
                                    tracker.visitor = mcidInstance;
                                }

                                return tracker;
                            };

                            var updateTrackerVersion = function(tracker) {
                                turbine.logger.info('Setting version on tracker: "' + version + '".');

                                if (typeof tracker.tagContainerMarker !== 'undefined') {
                                    tracker.tagContainerMarker = version;
                                } else if (typeof tracker.version === 'string'
                                    && tracker.version.substring(tracker.version.length - 5) !== ('-' + version)) {
                                    tracker.version += '-' + version;
                                }

                                return tracker;
                            };

                            var updateTrackerVariables = function(trackerProperties, customSetup, tracker) {
                                if (customSetup.loadPhase === BEFORE_SETTINGS_LOAD_PHASE && customSetup.source) {
                                    turbine.logger.info('Calling custom script before settings.');
                                    customSetup.source.call(window, tracker);
                                }

                                applyTrackerVariables(tracker, trackerProperties || {});

                                if (customSetup.loadPhase !== BEFORE_SETTINGS_LOAD_PHASE && customSetup.source) {
                                    turbine.logger.info('Calling custom script after settings.');
                                    customSetup.source.call(window, tracker);
                                }

                                return tracker;
                            };

                            var loadTrackerModules = function(moduleProperties, tracker) {
                                if (moduleProperties &&
                                    moduleProperties.audienceManager &&
                                    moduleProperties.audienceManager.config) {
                                    var libFileName = 'AppMeasurement_Module_AudienceManagement.js';
                                    var libFileUrl = turbine.getHostedLibFileUrl(libFileName);
                                    return loadScript(libFileUrl)
                                        .then( function() {
                                            tracker.loadModule('AudienceManagement');
                                            //turbine.logger.info('Initializing AudienceManagement module:');
                                            //turbine.logger.info(JSON.stringify(moduleProperties.audienceManager.config, null, 3));
                                            tracker.AudienceManagement.setup(moduleProperties.audienceManager.config);
                                            return tracker;
                                        });
                                } else {
                                    return tracker;
                                }
                            };

                            var initialize = function(settings) {
                                if (checkEuCompliance(settings.trackingCookieName)) {
                                    return loadLibrary(settings)
                                        .then(augmentTracker)
                                        .then(linkVisitorId)
                                        .then(updateTrackerVersion)
                                        .then(updateTrackerVariables.bind(
                                            null,
                                            settings.trackerProperties,
                                            settings.customSetup || {}
                                        ))
                                        .then(loadTrackerModules.bind(null, settings.moduleProperties));
                                } else {
                                    return Promise.reject('EU compliance was not acknowledged by the user.');
                                }
                            };

                            var promise = initialize(turbine.getExtensionSettings());
                            module.exports = function() {
                                return promise;
                            };

                        }
                        ,
                        "name": "get-tracker",
                        "shared": true
                    },
                    "adobe-analytics/src/lib/sharedModules/augmentTracker.js": {
                        "name": "augment-tracker",
                        "shared": true,
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2017 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            var augmenters = require('../helpers/augmenters');

                            module.exports = function(fn) {
                                augmenters.push(fn);
                            };

                        }

                    },
                    "adobe-analytics/src/lib/helpers/augmenters.js": {
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2017 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            module.exports = [];

                        }

                    },
                    "adobe-analytics/src/lib/helpers/applyTrackerVariables.js": {
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            var queryString = require('@adobe/reactor-query-string');
                            var window = require('@adobe/reactor-window');

                            var eVarRegExp = /eVar([0-9]+)/;
                            var propRegExp = /prop([0-9]+)/;
                            var linkTrackVarsKeys = new RegExp('^(eVar[0-9]+)|(prop[0-9]+)|(hier[0-9]+)|campaign|purchaseID|' +
                                'channel|server|state|zip|pageType$');

                            var onlyUnique = function(value, index, self) {
                                return self.indexOf(value) === index;
                            };

                            var buildLinkTrackVars = function(tracker, newTrackerProperties, addEvents) {
                                var linkTrackVarsValues = Object.keys(newTrackerProperties)
                                    .filter(linkTrackVarsKeys.test.bind(linkTrackVarsKeys));

                                if (addEvents) {
                                    linkTrackVarsValues.push('events');
                                }

                                // Merge with the values already set on tracker.
                                linkTrackVarsValues = linkTrackVarsValues.concat((tracker.linkTrackVars || '').split(','));

                                return linkTrackVarsValues.filter(function(value, index, self) {
                                    return value !== 'None' && value && onlyUnique(value, index, self);
                                }).join(',');
                            };

                            var buildLinkTrackEvents = function(tracker, eventsData) {
                                var linkTrackEventsValues = eventsData.map(function(event) {
                                    return event.name;
                                });

                                // Merge with the values already set on tracker.
                                linkTrackEventsValues = linkTrackEventsValues.concat((tracker.linkTrackEvents || '').split(','));

                                return linkTrackEventsValues.filter(function(value, index, self) {
                                    return value !== 'None'  && onlyUnique(value, index, self);
                                }).join(',');
                            };

                            var commaJoin = function(store, keyName, trackerProperties) {
                                store[keyName] = trackerProperties[keyName].join(',');
                            };

                            var variablesTransform = function(store, keyName, trackerProperties) {
                                var dynamicVariablePrefix = trackerProperties.dynamicVariablePrefix || 'D=';

                                trackerProperties[keyName].forEach(function(variableData) {
                                    var value;
                                    if (variableData.type === 'value') {
                                        value = variableData.value;
                                    } else {
                                        var eVarData = eVarRegExp.exec(variableData.value);

                                        if (eVarData) {
                                            value = dynamicVariablePrefix + 'v' + eVarData[1];
                                        } else {
                                            var propData = propRegExp.exec(variableData.value);

                                            if (propData) {
                                                value = dynamicVariablePrefix + 'c' + propData[1];
                                            }
                                        }
                                    }

                                    store[variableData.name] = value;
                                });
                            };

                            var transformers = {
                                linkDownloadFileTypes: commaJoin,
                                linkExternalFilters: commaJoin,
                                linkInternalFilters: commaJoin,
                                hierarchies: function(store, keyName, trackerProperties) {
                                    trackerProperties[keyName].forEach(function(hierarchyData) {
                                        store[hierarchyData.name] = hierarchyData.sections.join(hierarchyData.delimiter);
                                    });
                                },
                                props: variablesTransform,
                                eVars: variablesTransform,
                                campaign: function(store, keyName, trackerProperties) {
                                    if (trackerProperties[keyName].type === 'queryParam') {
                                        var queryParams = queryString.parse(window.location.search);
                                        store[keyName] = queryParams[trackerProperties[keyName].value];
                                    } else {
                                        store[keyName] = trackerProperties[keyName].value;
                                    }
                                },
                                events: function(store, keyName, trackerProperties) {
                                    var events = trackerProperties[keyName].map(function(data) {
                                        if (data.value) {
                                            return [data.name, data.value].join('=');
                                        } else {
                                            return data.name;
                                        }
                                    });
                                    store[keyName] = events.join(',');
                                }
                            };

                            module.exports = function(tracker, trackerProperties) {
                                var newProperties = {};

                                Object.keys(trackerProperties).forEach(function(propertyName) {
                                    var transform = transformers[propertyName];
                                    var value = trackerProperties[propertyName];

                                    if (transform) {
                                        transform(newProperties, propertyName, trackerProperties);
                                    } else {
                                        newProperties[propertyName] = value;
                                    }
                                });

                                // New events are added to existing tracker events
                                if (newProperties.events) {
                                    if (tracker.events && tracker.events.length > 0) {
                                        newProperties.events = tracker.events + ',' + newProperties.events;
                                    }
                                }

                                var hasEvents =
                                    trackerProperties && trackerProperties.events && trackerProperties.events.length > 0;
                                var linkTrackVars = buildLinkTrackVars(tracker, newProperties, hasEvents);
                                if (linkTrackVars) {
                                    newProperties.linkTrackVars = linkTrackVars;
                                }

                                var linkTrackEvents = buildLinkTrackEvents(tracker, trackerProperties.events || []);
                                if (linkTrackEvents) {
                                    newProperties.linkTrackEvents = linkTrackEvents;
                                }

                                turbine.logger.info(
                                    'Applying the following properties on tracker: "' +
                                    JSON.stringify(newProperties) +
                                    '".'
                                );

                                Object.keys(newProperties).forEach(function(propertyName) {
                                    tracker[propertyName] = newProperties[propertyName];
                                });
                            };

                        }

                    },
                    "adobe-analytics/src/lib/helpers/loadLibrary.js": {
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';

                            var loadScript = require('@adobe/reactor-load-script');
                            var window = require('@adobe/reactor-window');
                            var Promise = require('@adobe/reactor-promise');

                            var LIB_TYPES = {
                                MANAGED: 'managed',
                                PREINSTALLED: 'preinstalled',
                                REMOTE: 'remote',
                                CUSTOM: 'custom'
                            };

                            var loadAppMeasurementScript = function(url) {
                                turbine.logger.info('Loading AppMeasurement script from: ' + url + '.');
                                return loadScript(url);
                            };

                            var getReportSuites = function(reportSuitesData) {
                                var reportSuiteValues = reportSuitesData.production;
                                if (reportSuitesData[turbine.buildInfo.environment]) {
                                    reportSuiteValues = reportSuitesData[turbine.buildInfo.environment];
                                }

                                return reportSuiteValues.join(',');
                            };

                            var createTracker = function(settings, reportSuites) {
                                if (!window.s_gi) {
                                    throw new Error(
                                        'Unable to create AppMeasurement tracker, `s_gi` function not found.' + window.AppMeasurement
                                    );
                                }
                                turbine.logger.info('Creating AppMeasurement tracker with these report suites: "' +
                                    reportSuites + '"');
                                var tracker = window.s_gi(reportSuites);
                                if (settings.libraryCode.scopeTrackerGlobally) {
                                    turbine.logger.info('Setting the tracker as window.s');
                                    window.s = tracker;
                                }
                                return tracker;
                            };

                            var loadManagedLibrary = function(settings) {
                                var reportSuites = getReportSuites(settings.libraryCode.accounts);
                                return loadAppMeasurementScript(turbine.getHostedLibFileUrl('AppMeasurement.js'))
                                    .then(createTracker.bind(null, settings, reportSuites));
                            };

                            var setReportSuitesOnTracker = function(settings, tracker) {
                                if (settings.libraryCode.accounts) {
                                    if (!tracker.sa) {
                                        turbine.logger.warn('Cannot set report suites on tracker. `sa` method not available.');
                                    } else {
                                        var reportSuites = getReportSuites(settings.libraryCode.accounts);
                                        turbine.logger.info('Setting the following report suites on the tracker: "' +
                                            reportSuites + '"');
                                        tracker.sa(reportSuites);
                                    }
                                }

                                return tracker;
                            };

                            var poll = function(trackerVariableName) {
                                turbine.logger.info('Waiting for the tracker to become accessible at: "' +
                                    trackerVariableName + '".');
                                return new Promise(function(resolve, reject) {
                                    var i = 1;
                                    var intervalId = setInterval(function() {
                                        if (window[trackerVariableName]) {
                                            turbine.logger.info('Found tracker located at: "' + trackerVariableName + '".');
                                            resolve(window[trackerVariableName]);
                                            clearInterval(intervalId);
                                        }

                                        if (i >= 10) {
                                            clearInterval(intervalId);
                                            reject(new Error(
                                                'Bailing out. Cannot find the global variable name: "' + trackerVariableName + '".'
                                            ));
                                        }

                                        i++;
                                    }, 1000);
                                });
                            };

                            var detectPreinstalledLibrary = function(settings) {
                                return poll(settings.libraryCode.trackerVariableName)
                                    .then(setReportSuitesOnTracker.bind(null, settings));
                            };

                            var getTrackerFromVariable = function(trackerVariableName) {
                                if (window[trackerVariableName]) {
                                    turbine.logger.info('Found tracker located at: "' + trackerVariableName + '".');
                                    return window[trackerVariableName];
                                } else {
                                    throw new Error('Cannot find the global variable name: "' + trackerVariableName + '".');
                                }
                            };

                            var loadRemoteLibrary = function(url, settings) {
                                return loadAppMeasurementScript(url)
                                    .then(getTrackerFromVariable.bind(null, settings.libraryCode.trackerVariableName))
                                    .then(setReportSuitesOnTracker.bind(null, settings));
                            };

                            module.exports = function(settings) {
                                var url;
                                var libraryPromise;

                                switch (settings.libraryCode.type) {
                                    case LIB_TYPES.MANAGED:
                                        libraryPromise = loadManagedLibrary(settings);
                                        break;

                                    case LIB_TYPES.PREINSTALLED:
                                        libraryPromise = detectPreinstalledLibrary(settings);
                                        break;

                                    case LIB_TYPES.CUSTOM:
                                        url = settings.libraryCode.source;

                                        libraryPromise = loadRemoteLibrary(url, settings);
                                        break;

                                    case LIB_TYPES.REMOTE:
                                        url = window.location.protocol === 'https:' ?
                                            settings.libraryCode.httpsUrl : settings.libraryCode.httpUrl;

                                        libraryPromise = loadRemoteLibrary(url, settings);
                                        break;

                                    default:
                                        throw new Error('Cannot load library. Type not supported.');
                                }

                                return libraryPromise;
                            };

                        }

                    },
                    "adobe-analytics/src/lib/helpers/generateVersion.js": {
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

// The Launch code version is a 4 characters string.  The first character will always be L
// followed by year, month, and day codes.
// For example: JS-1.4.3-L53O = JS 1.4.3 code, Launch 2015 March 24th release (revision 1)
// More info: https://wiki.corp.adobe.com/pages/viewpage.action?spaceKey=tagmanager&title=DTM+Analytics+Code+Versions

                            'use strict';

                            var THIRD_OF_DAY = 8; //hours

                            var getDayField = function(date) {
                                return date.getUTCDate().toString(36);
                            };

                            var getLastChar = function(str) {
                                return str.substr(str.length - 1);
                            };

                            var getRevision = function(date) {
                                // We are under the assumption that a Turbine version will be release at least 8h apart (max 3
                                // releases per day).
                                return Math.floor(date.getUTCHours() / THIRD_OF_DAY);
                            };

                            var getMonthField = function(date) {
                                var monthNumber = date.getUTCMonth() + 1;
                                var revision = getRevision(date);

                                var monthField = (monthNumber + revision * 12).toString(36);

                                return getLastChar(monthField);
                            };

                            var getYearField = function(date) {
                                return (date.getUTCFullYear() - 2010).toString(36);
                            };

                            module.exports = function(dateString) {
                                var date = new Date(dateString);

                                if (isNaN(date)) {
                                    throw new Error('Invalid date provided');
                                }

                                return ('L' + getYearField(date) + getMonthField(date) + getDayField(date)).toUpperCase();
                            };

                        }

                    }
                },
                "settings": {
                    "libraryCode": {
                        "type": "managed",
                        "accounts": {
                            "staging": [
                                "agsldlaunchqsstaging"
                            ],
                            "production": [
                                "agsldlaunchqsproduction"
                            ],
                            "development": [
                                "agsldlaunchqsdev"
                            ]
                        }
                    },
                    "moduleProperties": {
                        "audienceManager": {
                            "config": {
                                "partner": "agslaunchdemo"
                            }
                        }
                    },
                    "trackerProperties": {
                        "trackingServer": "agsld.sc.omtrdc.net",
                        "trackInlineStats": true,
                        "trackDownloadLinks": true,
                        "trackExternalLinks": true,
                        "linkInternalFilters": [
                            "businesscatalyst.com"
                        ],
                        "linkLeaveQueryString": true,
                        "linkDownloadFileTypes": [
                            "doc",
                            "docx",
                            "eps",
                            "jpg",
                            "png",
                            "svg",
                            "xls",
                            "ppt",
                            "pptx",
                            "pdf",
                            "xlsx",
                            "tab",
                            "csv",
                            "zip",
                            "txt",
                            "vsd",
                            "vxd",
                            "xml",
                            "js",
                            "css",
                            "rar",
                            "exe",
                            "wma",
                            "mov",
                            "avi",
                            "wmv",
                            "mp3",
                            "wav",
                            "m4v"
                        ]
                    }
                },
                "hostedLibFilesBaseUrl": "//assets.adobedtm.com/extensions/EP143333dab9bb4582a773c81f3a840074/"
            },
            "adobe-target": {
                "displayName": "Adobe Target",
                "modules": {
                    "adobe-target/lib/loadTarget.js": {
                        "name": "load-target-async",
                        "displayName": "Load Target Async (deprecated)",
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            /* eslint-disable import/no-extraneous-dependencies */
                            var win = require("@adobe/reactor-window");
                            var doc = require("@adobe/reactor-document");
                            var Promise = require("@adobe/reactor-promise");

                            var _require = require("./modules/load-target-common"),
                                initLibrarySettings = _require.initLibrarySettings,
                                overridePublicApi = _require.overridePublicApi;

                            var augmentTracker = turbine.getSharedModule("adobe-analytics", "augment-tracker");
                            var extensionSettings = turbine.getExtensionSettings();

                            var _require2 = require("./modules/event-util"),
                                addEventListener = _require2.addEventListener,
                                removeEventListener = _require2.removeEventListener;

                            var REQUEST_SUCCEEDED = "at-request-succeeded";
                            var REQUEST_FAILED = "at-request-failed";

                            function requestHandler(func) {
                                if (!func) {
                                    return;
                                }

                                func(function (tracker) {
                                    var promise = new Promise(function (resolve) {
                                        if (!tracker) {
                                            resolve();
                                            return;
                                        }

                                        var timerId = setTimeout(resolve, extensionSettings.targetSettings.timeout);

                                        var requestSuccess = function requestSuccess(e) {
                                            if (e.detail && e.detail.redirect === true) {
                                                // eslint-disable-next-line
                                                tracker.abort = true;
                                            }

                                            clearTimeout(timerId);
                                            removeEventListener(doc, e, requestSuccess);
                                            resolve();
                                        };
                                        var requestFail = function requestFail(e) {
                                            clearTimeout(timerId);
                                            removeEventListener(doc, e, requestFail);
                                            resolve();
                                        };

                                        addEventListener(doc, REQUEST_SUCCEEDED, requestSuccess);
                                        addEventListener(doc, REQUEST_FAILED, requestFail);
                                    });

                                    return promise;
                                });
                            }

                            module.exports = function () {
                                var targetSettings = initLibrarySettings();

                                if (!targetSettings) {
                                    overridePublicApi(win);
                                    return;
                                }

                                if (!targetSettings.enabled) {
                                    overridePublicApi(win);
                                    return;
                                }

                                var _require3 = require("./modules/libs/at-launch"),
                                    init = _require3.init; //eslint-disable-line

                                init(win, doc, targetSettings);
                                requestHandler(augmentTracker);
                            };
                        }

                    },
                    "adobe-target/lib/addMboxParams.js": {
                        "name": "add-mbox-params",
                        "displayName": "Add Params to All Mboxes",
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            var _require = require("./modules/mbox-params-store"),
                                mergeParams = _require.mergeParams;

                            module.exports = function (settings) {
                                mergeParams(settings.mboxParams);
                            };
                        }

                    },
                    "adobe-target/lib/fireGlobalMbox.js": {
                        "name": "fire-global-mbox-async",
                        "displayName": "Fire Global Mbox Async (deprecated)",
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            /* eslint-disable import/no-extraneous-dependencies */
                            var win = require("@adobe/reactor-window");

                            var _require = require("./modules/libs/at-launch"),
                                initConfig = _require.initConfig,
                                initGlobalMbox = _require.initGlobalMbox;

                            var initGlobalMboxSettings = require("./modules/global-mbox-common");
                            var messages = require("./messages");

                            function isLibraryPresent() {
                                return win.adobe && win.adobe.target && win.adobe.target.VERSION;
                            }

                            module.exports = function (settings) {
                                var targetSettings = initGlobalMboxSettings(settings);

                                if (!isLibraryPresent()) {
                                    if (window.console) {
                                        turbine.logger.warn(messages.NO_GLOBAL_MBOX_REQUEST);
                                    }

                                    return;
                                }

                                initConfig(targetSettings);
                                initGlobalMbox();
                            };
                        }

                    },
                    "adobe-target/lib/modules/load-target-common.js": {
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            /* eslint-disable import/no-extraneous-dependencies */
                            var win = require("@adobe/reactor-window");
                            var doc = require("@adobe/reactor-document");
                            var messages = require("../messages");

                            var _require = require("./mbox-params-store"),
                                getParams = _require.getParams,
                                getGlobalParams = _require.getGlobalParams;

                            var overrideProps = require("./object-override-util");

                            function isStandardMode(document) {
                                var compatMode = document.compatMode,
                                    documentMode = document.documentMode;

                                var standardMode = compatMode && compatMode === "CSS1Compat";
                                var ie9OrModernBrowser = documentMode ? documentMode >= 9 : true;

                                return standardMode && ie9OrModernBrowser;
                            }

                            function noop() {}

                            /* eslint-disable no-param-reassign */
                            function overridePublicApi(window) {
                                window.adobe = window.adobe || {};
                                window.adobe.target = {
                                    VERSION: "",
                                    event: {},
                                    init: noop,
                                    getOffer: noop,
                                    applyOffer: noop,
                                    trackEvent: noop,
                                    registerExtension: noop
                                };
                                window.mboxCreate = noop;
                                window.mboxDefine = noop;
                                window.mboxUpdate = noop;
                            }
                            /* eslint-enable no-param-reassign */

                            function isLibraryPresent() {
                                return win.adobe && win.adobe.target && typeof win.adobe.target.getOffer !== "undefined";
                            }

                            function initLibrarySettings() {
                                if (isLibraryPresent()) {
                                    turbine.logger.warn(messages.ALREADY_INITIALIZED);
                                    return null;
                                }

                                var extensionSettings = turbine.getExtensionSettings();
                                var targetSettings = extensionSettings.targetSettings || {};
                                targetSettings.mboxParams = getParams();
                                targetSettings.globalMboxParams = getGlobalParams();

                                overrideProps(targetSettings, win.targetGlobalSettings || {}, ["clientCode", "serverDomain", "cookieDomain", "crossDomain", "timeout", "visitorApiTimeout", "enabled", "defaultContentHiddenStyle", "defaultContentVisibleStyle", "bodyHidingEnabled", "bodyHiddenStyle", "imsOrgId", "overrideMboxEdgeServer", "overrideMboxEdgeServerTimeout", "optoutEnabled", "secureOnly", "supplementalDataIdParamTimeout", "authoringScriptUrl", "urlSizeLimit"]);

                                if (!isStandardMode(doc)) {
                                    targetSettings.enabled = false;

                                    turbine.logger.warn(messages.DELIVERY_DISABLED);
                                }

                                return targetSettings;
                            }

                            module.exports = {
                                initLibrarySettings: initLibrarySettings,
                                overridePublicApi: overridePublicApi
                            };
                        }

                    },
                    "adobe-target/lib/modules/event-util.js": {
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            function addEventListener(elem, type, handler) {
                                elem.addEventListener(type, handler);
                            }

                            function removeEventListener(elem, type, handler) {
                                elem.removeEventListener(type, handler);
                            }

                            module.exports = {
                                addEventListener: addEventListener,
                                removeEventListener: removeEventListener
                            };
                        }

                    },
                    "adobe-target/lib/modules/libs/at-launch.js": {
                        "script": function(module, exports, require, turbine) {
                            /**
                             * @license
                             * at.js 1.6.0 | (c) Adobe Systems Incorporated | All rights reserved
                             * zepto.js | (c) 2010-2016 Thomas Fuchs | zeptojs.com/license
                             */
                            "use strict";

                            var define;

                            function _interopDefault(ex) {
                                return ex && typeof ex === "object" && "default" in ex ? ex["default"] : ex;
                            }

                            var assign = _interopDefault(require("@adobe/reactor-object-assign"));
                            var window$1 = _interopDefault(require("@adobe/reactor-window"));
                            var document$1 = _interopDefault(require("@adobe/reactor-document"));
                            var cookie = _interopDefault(require("@adobe/reactor-cookie"));
                            var queryString = _interopDefault(require("@adobe/reactor-query-string"));
                            var Promise$1 = _interopDefault(require("@adobe/reactor-promise"));
                            var loadScript = _interopDefault(require("@adobe/reactor-load-script"));

                            var objectProto = Object.prototype;
                            var nativeObjectToString = objectProto.toString;
                            function objectToString(value) {
                                return nativeObjectToString.call(value);
                            }
                            function baseGetTag(value) {
                                return objectToString(value);
                            }

                            var _typeof =
                                typeof Symbol === "function" && typeof Symbol.iterator === "symbol"
                                    ? function(obj) {
                                        return typeof obj;
                                    }
                                    : function(obj) {
                                        return obj &&
                                        typeof Symbol === "function" &&
                                        obj.constructor === Symbol &&
                                        obj !== Symbol.prototype
                                            ? "symbol"
                                            : typeof obj;
                                    };

                            function isObject(value) {
                                var type = typeof value === "undefined" ? "undefined" : _typeof(value);
                                var notNull = value != null;
                                return notNull && (type === "object" || type === "function");
                            }

                            var funcTag = "[object Function]";
                            function isFunction(value) {
                                if (!isObject(value)) {
                                    return false;
                                }
                                return baseGetTag(value) === funcTag;
                            }

                            function delay(func) {
                                var wait =
                                    arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : 0;
                                if (!isFunction(func)) {
                                    return;
                                }
                                setTimeout(func, Number(wait) || 0);
                            }

                            function isNil(value) {
                                return value == null;
                            }

                            var isArray = Array.isArray;

                            function identity(value) {
                                return value;
                            }

                            function castFunction(value) {
                                return isFunction(value) ? value : identity;
                            }

                            function keys(object) {
                                if (isNil(object)) {
                                    return [];
                                }
                                return Object.keys(object);
                            }

                            var arrayEach = function arrayEach(iteratee, collection) {
                                return collection.forEach(iteratee);
                            };

                            var baseEach = function baseEach(iteratee, collection) {
                                arrayEach(function(key) {
                                    return iteratee(collection[key], key);
                                }, keys(collection));
                            };

                            var arrayFilter = function arrayFilter(predicate, collection) {
                                return collection.filter(predicate);
                            };
                            var baseFilter = function baseFilter(predicate, collection) {
                                var result = {};
                                baseEach(function(value, key) {
                                    if (predicate(value, key)) {
                                        result[key] = value;
                                    }
                                }, collection);
                                return result;
                            };
                            function filter(predicate, collection) {
                                if (isNil(collection)) {
                                    return [];
                                }
                                var func = isArray(collection) ? arrayFilter : baseFilter;
                                return func(castFunction(predicate), collection);
                            }

                            function first(array) {
                                return array && array.length ? array[0] : undefined;
                            }

                            function flatten(array) {
                                if (isNil(array)) {
                                    return [];
                                }
                                return [].concat.apply([], array);
                            }

                            function flow(funcs) {
                                var _this = this;
                                var length = funcs ? funcs.length : 0;
                                var index = length;
                                while ((index -= 1)) {
                                    if (!isFunction(funcs[index])) {
                                        throw new TypeError("Expected a function");
                                    }
                                }
                                return function() {
                                    for (
                                        var _len = arguments.length, args = Array(_len), _key = 0;
                                        _key < _len;
                                        _key++
                                    ) {
                                        args[_key] = arguments[_key];
                                    }
                                    var i = 0;
                                    var result = length ? funcs[i].apply(_this, args) : args[0];
                                    while ((i += 1) < length) {
                                        result = funcs[i].call(_this, result);
                                    }
                                    return result;
                                };
                            }

                            function forEach(iteratee, collection) {
                                if (isNil(collection)) {
                                    return;
                                }
                                var func = isArray(collection) ? arrayEach : baseEach;
                                func(castFunction(iteratee), collection);
                            }

                            function isObjectLike(value) {
                                var notNull = value != null;
                                return (
                                    notNull &&
                                    (typeof value === "undefined" ? "undefined" : _typeof(value)) === "object"
                                );
                            }

                            var stringTag = "[object String]";
                            function isString(value) {
                                return (
                                    typeof value === "string" ||
                                    (!isArray(value) && isObjectLike(value) && baseGetTag(value) === stringTag)
                                );
                            }

                            function hash(string) {
                                if (!isString(string)) {
                                    return -1;
                                }
                                var result = 0;
                                var length = string.length;
                                for (var i = 0; i < length; i += 1) {
                                    result = ((result << 5) - result + string.charCodeAt(i)) & 0xffffffff;
                                }
                                return result;
                            }

                            var MAX_SAFE_INTEGER = 9007199254740991;
                            function isLength(value) {
                                return (
                                    typeof value === "number" &&
                                    value > -1 &&
                                    value % 1 === 0 &&
                                    value <= MAX_SAFE_INTEGER
                                );
                            }

                            function isArrayLike(value) {
                                return value != null && isLength(value.length) && !isFunction(value);
                            }

                            var arrayMap = function arrayMap(iteratee, collection) {
                                return collection.map(iteratee);
                            };

                            function baseValues(props, object) {
                                return arrayMap(function(key) {
                                    return object[key];
                                }, props);
                            }
                            function copyArray(source) {
                                var index = 0;
                                var length = source.length;
                                var array = Array(length);
                                while (index < length) {
                                    array[index] = source[index];
                                    index += 1;
                                }
                                return array;
                            }
                            function stringToArray(str) {
                                return str.split("");
                            }
                            function toArray$1(value) {
                                if (isNil(value)) {
                                    return [];
                                }
                                if (isArrayLike(value)) {
                                    return isString(value) ? stringToArray(value) : copyArray(value);
                                }
                                return baseValues(keys(value), value);
                            }

                            var objectProto$1 = Object.prototype;
                            var hasOwnProperty = objectProto$1.hasOwnProperty;
                            function isEmpty(value) {
                                if (value == null) {
                                    return true;
                                }
                                if (
                                    isArrayLike(value) &&
                                    (isArray(value) || isString(value) || isFunction(value.splice))
                                ) {
                                    return !value.length;
                                }
                                for (var key in value) {
                                    if (hasOwnProperty.call(value, key)) {
                                        return false;
                                    }
                                }
                                return true;
                            }

                            var stringProto = String.prototype;
                            var nativeStringTrim = stringProto.trim;
                            function trim(string) {
                                return isNil(string) ? "" : nativeStringTrim.call(string);
                            }

                            function isBlank(value) {
                                return isString(value) ? !trim(value) : isEmpty(value);
                            }

                            var objectTag = "[object Object]";
                            var funcProto = Function.prototype;
                            var objectProto$2 = Object.prototype;
                            var funcToString = funcProto.toString;
                            var hasOwnProperty$1 = objectProto$2.hasOwnProperty;
                            var objectCtorString = funcToString.call(Object);
                            function getPrototype(value) {
                                return Object.getPrototypeOf(Object(value));
                            }
                            function isPlainObject(value) {
                                if (!isObjectLike(value) || baseGetTag(value) !== objectTag) {
                                    return false;
                                }
                                var proto = getPrototype(value);
                                if (proto === null) {
                                    return true;
                                }
                                var Ctor = hasOwnProperty$1.call(proto, "constructor") && proto.constructor;
                                return (
                                    typeof Ctor === "function" &&
                                    Ctor instanceof Ctor &&
                                    funcToString.call(Ctor) === objectCtorString
                                );
                            }

                            function isElement(value) {
                                return isObjectLike(value) && value.nodeType === 1 && !isPlainObject(value);
                            }

                            var isNotBlank = function isNotBlank(value) {
                                return !isBlank(value);
                            };

                            var numberTag = "[object Number]";
                            function isNumber(value) {
                                return (
                                    typeof value === "number" ||
                                    (isObjectLike(value) && baseGetTag(value) === numberTag)
                                );
                            }

                            var baseMap = function baseMap(iteratee, collection) {
                                var result = {};
                                baseEach(function(value, key) {
                                    result[key] = iteratee(value, key);
                                }, collection);
                                return result;
                            };
                            function map(iteratee, collection) {
                                if (isNil(collection)) {
                                    return [];
                                }
                                var func = isArray(collection) ? arrayMap : baseMap;
                                return func(castFunction(iteratee), collection);
                            }

                            function noop() {}

                            function now() {
                                return new Date().getTime();
                            }

                            var arrayReduce = function arrayReduce(iteratee, accumulator, collection) {
                                return collection.reduce(iteratee, accumulator);
                            };
                            var baseReduce = function baseReduce(iteratee, accumulator, collection) {
                                var localAcc = accumulator;
                                baseEach(function(value, key) {
                                    localAcc = iteratee(localAcc, value, key);
                                }, collection);
                                return localAcc;
                            };
                            function reduce(iteratee, accumulator, collection) {
                                if (isNil(collection)) {
                                    return accumulator;
                                }
                                var func = isArray(collection) ? arrayReduce : baseReduce;
                                return func(castFunction(iteratee), accumulator, collection);
                            }

                            var arrayProto = Array.prototype;
                            var nativeReverse = arrayProto.reverse;
                            function reverse(array) {
                                return array == null ? array : nativeReverse.call(array);
                            }

                            function split(separator, string) {
                                if (isBlank(string)) {
                                    return [];
                                }
                                return string.split(separator);
                            }

                            function random(lower, upper) {
                                return lower + Math.floor(Math.random() * (upper - lower + 1));
                            }
                            function uuid() {
                                var d = now();
                                return "xxxxxxxxxxxx4xxxyxxxxxxxxxxxxxxx".replace(/[xy]/g, function(c) {
                                    var r = ((d + random(0, 16)) % 16) | 0;
                                    d = Math.floor(d / 16);
                                    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
                                });
                            }

                            var ACTION = "action";
                            var ATTRIBUTE = "attribute";
                            var VALUE = "value";
                            var CLICK_TRACK_ID = "clickTrackId";
                            var CONTENT = "content";
                            var CONTENT_TYPE = "contentType";
                            var FINAL_HEIGHT = "finalHeight";
                            var FINAL_WIDTH = "finalWidth";
                            var HEIGHT = "height";
                            var WIDTH = "width";
                            var FINAL_LEFT_POSITION = "finalLeftPosition";
                            var FINAL_TOP_POSITION = "finalTopPosition";
                            var LEFT = "left";
                            var TOP = "top";
                            var POSITION = "position";
                            var FROM = "from";
                            var TO = "to";
                            var URL = "url";
                            var INCLUDE_ALL_URL_PARAMETERS = "includeAllUrlParameters";
                            var PASS_MBOX_SESSION = "passMboxSession";
                            var PROPERTY = "property";
                            var PRIORITY = "priority";
                            var SELECTOR = "selector";
                            var CSS_SELECTOR = "cssSelector";
                            var STYLE = "style";
                            var SET_CONTENT = "setContent";
                            var SET_TEXT = "setText";
                            var SET_JSON = "setJson";
                            var SET_ATTRIBUTE = "setAttribute";
                            var SET_STYLE = "setStyle";
                            var REARRANGE = "rearrange";
                            var RESIZE = "resize";
                            var MOVE = "move";
                            var REMOVE = "remove";
                            var CUSTOM_CODE = "customCode";
                            var APPEND_CONTENT = "appendContent";
                            var REDIRECT = "redirect";
                            var TRACK_CLICK = "trackClick";
                            var SIGNAL_CLICK = "signalClick";
                            var INSERT_BEFORE = "insertBefore";
                            var INSERT_AFTER = "insertAfter";
                            var PREPEND_CONTENT = "prependContent";
                            var REPLACE_CONTENT = "replaceContent";
                            var DEBUG = "mboxDebug";
                            var DISABLE = "mboxDisable";
                            var AUTHORING = "mboxEdit";
                            var CHECK = "check";
                            var TRUE = "true";
                            var MBOX_LENGTH = 250;
                            var LETTERS_ONLY_PATTERN = /^[a-zA-Z]+$/;
                            var DATA_SRC = "data-at-src";
                            var DATA_MBOX_NAME = "data-at-mbox-name";
                            var CLICKED_SUFFIX = "-clicked";
                            var MBOX_NAME_CLASS_PREFIX = "mbox-name-";
                            var JSON$1 = "json";
                            var HTML = "html";
                            var SCRIPT = "script";
                            var TEXT = "text";
                            var SRC = "src";
                            var ID = "id";
                            var CLASS = "class";
                            var TYPE = "type";
                            var CLICK = "click";
                            var HEAD_TAG = "head";
                            var SCRIPT_TAG = "script";
                            var STYLE_TAG = "style";
                            var LINK_TAG = "link";
                            var IMAGE_TAG = "img";
                            var DIV_TAG = "div";
                            var ANCHOR_TAG = "a";
                            var DELIVERY_DISABLED =
                                'Adobe Target content delivery is disabled. Ensure that you can save cookies to your current domain, there is no "mboxDisable" cookie and there is no "mboxDisable" parameter in query string.';
                            var ALREADY_INITIALIZED = "Adobe Target has already been initialized.";
                            var OPTIONS_REQUIRED = "options argument is required";
                            var MBOX_REQUIRED = "mbox option is required";
                            var MBOX_TOO_LONG = "mbox option is too long";
                            var SUCCESS_REQUIRED = "success option is required";
                            var ERROR_REQUIRED = "error option is required";
                            var OFFER_REQUIRED = "offer option is required";
                            var NAME_REQUIRED = "name option is required";
                            var NAME_INVALID = "name is invalid";
                            var MODULES_REQUIRED = "modules option is required";
                            var REGISTER_REQUIRED = "register option is required";
                            var MODULES_INVALID = "modules do not exists";
                            var MISSING_SELECTORS = "Actions with missing selectors";
                            var UNEXPECTED_ERROR = "Unexpected error";
                            var ACTIONS_TO_BE_RENDERED = "actions to be rendered";
                            var REQUEST_FAILED = "request failed";
                            var ACTIONS_RENDERED = "All actions rendered successfully";
                            var ACTION_RENDERED = "Action rendered successfully";
                            var ACTION_RENDERING = "Rendering action";
                            var EMPTY_CONTENT = "Action has no content";
                            var EMPTY_ATTRIBUTE = "Action has no attribute or value";
                            var EMPTY_PROPERTY = "Action has no property or value";
                            var EMPTY_SIZES = "Action has no height or width";
                            var EMPTY_COORDINATES = "Action has no left, top or position";
                            var EMPTY_REARRANGE = "Action has no from or to";
                            var EMPTY_URL = "Action has no url";
                            var EMPTY_CLICK_TRACK_ID = "Action has no click track ID";
                            var REARRANGE_MISSING = "Rearrange elements are missing";
                            var LOADING_IMAGE = "Loading image";
                            var TRACK_EVENT_SUCCESS = "Track event request succeeded";
                            var TRACK_EVENT_ERROR = "Track event request failed";
                            var MBOX_CONTAINER_NOT_FOUND = "Mbox container not found";
                            var RENDERING_MBOX = "Rendering mbox";
                            var RENDERING_MBOX_FAILED = "Rendering mbox failed";
                            var MBOX_DEFINE_ID_MISSING = "ID is missing";
                            var NO_ACTIONS = "No actions to be rendered";
                            var REDIRECT_ACTION = "Redirect action";
                            var FORCE_HEAD = "default to HEAD";
                            var CURRENT_SCRIPT_MISSING =
                                "document.currentScript is missing or not supported";
                            var HTML_HEAD_EXECUTION = "executing from HTML HEAD";
                            var REMOTE_SCRIPT = "Script load";
                            var ERROR_UNKNOWN = "unknown error";
                            var ERROR = "error";
                            var WARNING = "warning";
                            var UNKNOWN = "unknown";
                            var VALID = "valid";
                            var SUCCESS = "success";
                            var MBOX = "mbox";
                            var OFFER = "offer";
                            var NAME = "name";
                            var MODULES = "modules";
                            var REGISTER = "register";
                            var STATUS = "status";
                            var PARAMS = "params";
                            var ACTIONS = "actions";
                            var RESPONSE_TOKENS = "responseTokens";
                            var MESSAGE = "message";
                            var RESPONSE = "response";
                            var REQUEST = "request";
                            var DYNAMIC = "dynamic";
                            var PLUGINS = "plugins";
                            var CLICK_TOKEN = "clickToken";
                            var OFFERS = "offers";
                            var SELECTORS = "selectors";
                            var PROVIDER = "provider";
                            var MBOX_CSS_CLASS = "mboxDefault";
                            var FLICKER_CONTROL_CLASS = "at-flicker-control";
                            var MARKER_CSS_CLASS = "at-element-marker";
                            var CLICK_TRACKING_CSS_CLASS = "at-element-click-tracking";
                            var MBOX_COOKIE = MBOX;
                            var ENABLED = "enabled";
                            var CLIENT_CODE = "clientCode";
                            var IMS_ORG_ID = "imsOrgId";
                            var SERVER_DOMAIN = "serverDomain";
                            var CROSS_DOMAIN = "crossDomain";
                            var TIMEOUT = "timeout";
                            var GLOBAL_MBOX_NAME = "globalMboxName";
                            var GLOBAL_MBOX_AUTO_CREATE = "globalMboxAutoCreate";
                            var VERSION = "version";
                            var DEFAULT_CONTENT_HIDDEN_STYLE = "defaultContentHiddenStyle";
                            var DEFAULT_CONTENT_VISIBLE_STYLE = "defaultContentVisibleStyle";
                            var BODY_HIDDEN_STYLE = "bodyHiddenStyle";
                            var BODY_HIDING_ENABLED = "bodyHidingEnabled";
                            var DEVICE_ID_LIFETIME = "deviceIdLifetime";
                            var SESSION_ID_LIFETIME = "sessionIdLifetime";
                            var SELECTORS_POLLING_TIMEOUT = "selectorsPollingTimeout";
                            var VISITOR_API_TIMEOUT = "visitorApiTimeout";
                            var OVERRIDE_MBOX_EDGE_SERVER = "overrideMboxEdgeServer";
                            var OVERRIDE_MBOX_EDGE_SERVER_TIMEOUT = "overrideMboxEdgeServerTimeout";
                            var OPTOUT_ENABLED = "optoutEnabled";
                            var SECURE_ONLY = "secureOnly";
                            var SUPPLEMENTAL_DATA_ID_PARAM_TIMEOUT = "supplementalDataIdParamTimeout";
                            var AUTHORING_SCRIPT_URL = "authoringScriptUrl";
                            var CROSS_DOMAIN_ONLY = "crossDomainOnly";
                            var CROSS_DOMAIN_ENABLED = "crossDomainEnabled";
                            var SCHEME = "scheme";
                            var COOKIE_DOMAIN = "cookieDomain";
                            var MBOX_PARAMS = "mboxParams";
                            var GLOBAL_MBOX_PARAMS = "globalMboxParams";
                            var URL_SIZE_LIMIT = "urlSizeLimit";
                            var BROWSER_HEIGHT = "browserHeight";
                            var BROWSER_WIDTH = "browserWidth";
                            var BROWSER_TIME_OFFSET = "browserTimeOffset";
                            var SCREEN_HEIGHT = "screenHeight";
                            var SCREEN_WIDTH = "screenWidth";
                            var SCREEN_ORIENTATION = "screenOrientation";
                            var COLOR_DEPTH = "colorDepth";
                            var PIXEL_RATIO = "devicePixelRatio";
                            var WEB_GL_RENDERER = "webGLRenderer";
                            var MBOX_PARAM = MBOX;
                            var SESSION_ID_PARAM = "mboxSession";
                            var DEVICE_ID_PARAM = "mboxPC";
                            var PAGE_ID_PARAM = "mboxPage";
                            var REQUEST_ID_PARAM = "mboxRid";
                            var VERSION_PARAM = "mboxVersion";
                            var COUNT_PARAM = "mboxCount";
                            var TIME_PARAM = "mboxTime";
                            var HOST_PARAM = "mboxHost";
                            var URL_PARAM = "mboxURL";
                            var REFERRER_PARAM = "mboxReferrer";
                            var CROSS_DOMAIN_PARAM = "mboxXDomain";
                            var DEVICE_ID_COOKIE = "PC";
                            var EDGE_CLUSTER_COOKIE = "mboxEdgeCluster";
                            var SESSION_ID_COOKIE = "session";
                            var TICK_EVENT = "at-tick";
                            var RENDER_COMPLETE_EVENT = "at-render-complete";
                            var TIMEOUT_EVENT = "at-timeout";
                            var NO_OFFERS_EVENT = "at-no-offers";
                            var SELECTORS_HIDDEN_EVENT = "at-selectors-hidden";
                            var GLOBAL_MBOX_FAILED_EVENT = "at-global-mbox-failed";
                            var TRACES_SUFFIX = "Traces";
                            var SETTINGS = "settings";
                            var CLIENT_TRACES = "client" + TRACES_SUFFIX;
                            var SERVER_TRACES = "server" + TRACES_SUFFIX;
                            var TRACES = "___target_traces";
                            var GLOBAL_SETTINGS = "targetGlobalSettings";
                            var DATA_PROVIDER = "dataProvider";
                            var DATA_PROVIDERS = DATA_PROVIDER + "s";
                            var TIMESTAMP = "timestamp";
                            var CONTENT_TYPE_HEADER = "Content-Type";
                            var FORM_URL_ENCODED = "application/x-www-form-urlencoded";

                            var IP_V4_REGEX = /^(?!0)(?!.*\.$)((1?\d?\d|25[0-5]|2[0-4]\d)(\.|$)){4}$/;
                            var STANDARD_DOMAIN_REGEX = /^(com|edu|gov|net|mil|org|nom|co|name|info|biz)$/i;
                            function isIPv4(domain) {
                                return IP_V4_REGEX.test(domain);
                            }
                            function getCookieDomain(domain) {
                                if (isIPv4(domain)) {
                                    return domain;
                                }
                                var parts = reverse(split(".", domain));
                                var len = parts.length;
                                if (len >= 3) {
                                    if (STANDARD_DOMAIN_REGEX.test(parts[1])) {
                                        return parts[2] + "." + parts[1] + "." + parts[0];
                                    }
                                }
                                if (len === 1) {
                                    return parts[0];
                                }
                                return parts[1] + "." + parts[0];
                            }

                            var config = {};
                            var overrides = [
                                ENABLED,
                                CLIENT_CODE,
                                IMS_ORG_ID,
                                SERVER_DOMAIN,
                                COOKIE_DOMAIN,
                                CROSS_DOMAIN,
                                TIMEOUT,
                                GLOBAL_MBOX_AUTO_CREATE,
                                MBOX_PARAMS,
                                GLOBAL_MBOX_PARAMS,
                                DEFAULT_CONTENT_HIDDEN_STYLE,
                                DEFAULT_CONTENT_VISIBLE_STYLE,
                                BODY_HIDDEN_STYLE,
                                BODY_HIDING_ENABLED,
                                SELECTORS_POLLING_TIMEOUT,
                                VISITOR_API_TIMEOUT,
                                OVERRIDE_MBOX_EDGE_SERVER,
                                OVERRIDE_MBOX_EDGE_SERVER_TIMEOUT,
                                OPTOUT_ENABLED,
                                SECURE_ONLY,
                                SUPPLEMENTAL_DATA_ID_PARAM_TIMEOUT,
                                AUTHORING_SCRIPT_URL,
                                URL_SIZE_LIMIT
                            ];
                            function overrideSettingsIfRequired(settings, globalSettings) {
                                if (!settings.enabled) {
                                    return;
                                }
                                forEach(function(field) {
                                    if (!isNil(globalSettings[field])) {
                                        settings[field] = globalSettings[field];
                                    }
                                }, overrides);
                            }
                            function isIE10OrModernBrowser(doc) {
                                var documentMode = doc.documentMode;
                                return documentMode ? documentMode >= 10 : true;
                            }
                            function isStandardMode(doc) {
                                var compatMode = doc.compatMode;
                                return compatMode && compatMode === "CSS1Compat";
                            }
                            function overrideFromGlobalSettings(win, doc, settings) {
                                settings[COOKIE_DOMAIN] = getCookieDomain(win.location.hostname);
                                settings[ENABLED] = isStandardMode(doc) && isIE10OrModernBrowser(doc);
                                overrideSettingsIfRequired(settings, win[GLOBAL_SETTINGS] || {});
                            }
                            function initConfig(settings) {
                                overrideFromGlobalSettings(window$1, document$1, settings);
                                config = assign({}, settings);
                                config[DEVICE_ID_LIFETIME] = settings[DEVICE_ID_LIFETIME] / 1000;
                                config[SESSION_ID_LIFETIME] = settings[SESSION_ID_LIFETIME] / 1000;
                                config[CROSS_DOMAIN_ONLY] = config[CROSS_DOMAIN] === "x-only";
                                config[CROSS_DOMAIN_ENABLED] = config[CROSS_DOMAIN] !== "disabled";
                                config[SCHEME] = config[SECURE_ONLY] ? "https:" : "";
                            }
                            function getConfig() {
                                return config;
                            }

                            var getCookie = cookie.get;

                            var setCookie = cookie.set;

                            var removeCookie = cookie.remove;

                            function decode(value) {
                                try {
                                    return decodeURIComponent(value);
                                } catch (e) {
                                    return value;
                                }
                            }

                            function encode(value) {
                                try {
                                    return encodeURIComponent(value);
                                } catch (e) {
                                    return value;
                                }
                            }

                            var index = function parseURI(str, opts) {
                                opts = opts || {};
                                var o = {
                                    key: [
                                        "source",
                                        "protocol",
                                        "authority",
                                        "userInfo",
                                        "user",
                                        "password",
                                        "host",
                                        "port",
                                        "relative",
                                        "path",
                                        "directory",
                                        "file",
                                        "query",
                                        "anchor"
                                    ],
                                    q: {
                                        name: "queryKey",
                                        parser: /(?:^|&)([^&=]*)=?([^&]*)/g
                                    },
                                    parser: {
                                        strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/,
                                        loose: /^(?:(?![^:@]+:[^:@\/]*@)([^:\/?#.]+):)?(?:\/\/)?((?:(([^:@]*)(?::([^:@]*))?)?@)?([^:\/?#]*)(?::(\d*))?)(((\/(?:[^?#](?![^?#\/]*\.[^?#\/.]+(?:[?#]|$)))*\/?)?([^?#\/]*))(?:\?([^#]*))?(?:#(.*))?)/
                                    }
                                };
                                var m = o.parser[opts.strictMode ? "strict" : "loose"].exec(str);
                                var uri = {};
                                var i = 14;
                                while (i--) {
                                    uri[o.key[i]] = m[i] || "";
                                }
                                uri[o.q.name] = {};
                                uri[o.key[12]].replace(o.q.parser, function($0, $1, $2) {
                                    if ($1) uri[o.q.name][$1] = $2;
                                });
                                return uri;
                            };

                            var ANCHOR = document$1.createElement(ANCHOR_TAG);
                            var CACHE = {};
                            function parseUri(url) {
                                if (CACHE[url]) {
                                    return CACHE[url];
                                }
                                ANCHOR.href = url;
                                CACHE[url] = index(ANCHOR.href);
                                return CACHE[url];
                            }

                            var parseQueryString = queryString.parse;

                            var stringifyQueryString = queryString.stringify;

                            function createCookie(name, value, expires) {
                                return { name: name, value: value, expires: expires };
                            }
                            function deserialize(str) {
                                var parts = split("#", str);
                                if (isEmpty(parts) || parts.length < 3) {
                                    return null;
                                }
                                if (isNaN(parseInt(parts[2], 10))) {
                                    return null;
                                }
                                return createCookie(decode(parts[0]), decode(parts[1]), Number(parts[2]));
                            }
                            function getInternalCookies(cookieValue) {
                                if (isBlank(cookieValue)) {
                                    return [];
                                }
                                return split("|", cookieValue);
                            }
                            function readCookies() {
                                var cookies = map(deserialize, getInternalCookies(getCookie(MBOX_COOKIE)));
                                var nowInSeconds = Math.ceil(now() / 1000);
                                var isExpired = function isExpired(cookie$$1) {
                                    return isObject(cookie$$1) && nowInSeconds <= cookie$$1.expires;
                                };
                                return reduce(
                                    function(acc, cookie$$1) {
                                        acc[cookie$$1.name] = cookie$$1;
                                        return acc;
                                    },
                                    {},
                                    filter(isExpired, cookies)
                                );
                            }

                            function getTargetCookie(name) {
                                var cookiesMap = readCookies();
                                var cookie$$1 = cookiesMap[name];
                                return isObject(cookie$$1) ? cookie$$1.value : "";
                            }

                            function serialize(cookie$$1) {
                                return [
                                    encode(cookie$$1.name),
                                    encode(cookie$$1.value),
                                    cookie$$1.expires
                                ].join("#");
                            }
                            function getExpires(cookie$$1) {
                                return cookie$$1.expires;
                            }
                            function getMaxExpires(cookies) {
                                var expires = map(getExpires, cookies);
                                return Math.max.apply(null, expires);
                            }
                            function saveCookies(cookiesMap, domain) {
                                var cookies = toArray$1(cookiesMap);
                                var maxExpires = Math.abs(getMaxExpires(cookies) * 1000 - now());
                                var serializedCookies = map(serialize, cookies).join("|");
                                var expires = new Date(now() + maxExpires);
                                setCookie(MBOX_COOKIE, serializedCookies, {
                                    domain: domain,
                                    expires: expires
                                });
                            }
                            function setTargetCookie(options) {
                                var name = options.name,
                                    value = options.value,
                                    expires = options.expires,
                                    domain = options.domain;
                                var cookiesMap = readCookies();
                                cookiesMap[name] = createCookie(
                                    name,
                                    value,
                                    Math.ceil(expires + now() / 1000)
                                );
                                saveCookies(cookiesMap, domain);
                            }

                            function isCookiePresent(name) {
                                return isNotBlank(getCookie(name));
                            }
                            function isParamPresent(win, name) {
                                var location = win.location;
                                var search = location.search;
                                var params = parseQueryString(search);
                                return isNotBlank(params[name]);
                            }
                            function isRefParamPresent(doc, name) {
                                var referrer = doc.referrer;
                                var refParams = parseUri(referrer).queryKey;
                                return isNil(refParams) ? false : isNotBlank(refParams[name]);
                            }
                            function exists(win, doc, name) {
                                return (
                                    isCookiePresent(name) ||
                                    isParamPresent(win, name) ||
                                    isRefParamPresent(doc, name)
                                );
                            }

                            function isCookieEnabled() {
                                var _getConfig = getConfig(),
                                    cookieDomain = _getConfig.cookieDomain;
                                setCookie(CHECK, TRUE, { domain: cookieDomain });
                                var result = getCookie(CHECK) === TRUE;
                                removeCookie(CHECK);
                                return result;
                            }
                            function isDeliveryDisabled() {
                                return exists(window$1, document$1, DISABLE);
                            }
                            function isDeliveryEnabled() {
                                var _getConfig2 = getConfig(),
                                    enabled = _getConfig2.enabled;
                                return enabled && isCookieEnabled() && !isDeliveryDisabled();
                            }
                            function isDebugEnabled() {
                                return exists(window$1, document$1, DEBUG);
                            }
                            function isAuthoringEnabled() {
                                return exists(window$1, document$1, AUTHORING);
                            }

                            var ADOBE_TARGET_PREFIX = "AT:";
                            function exists$1(win, method) {
                                var console = win.console;
                                return !isNil(console) && isFunction(console[method]);
                            }
                            function warn(win, args) {
                                var console = win.console;
                                if (!exists$1(win, "warn")) {
                                    return;
                                }
                                console.warn.apply(console, [ADOBE_TARGET_PREFIX].concat(args));
                            }
                            function debug(win, args) {
                                var console = win.console;
                                if (!exists$1(win, "debug")) {
                                    return;
                                }
                                if (isDebugEnabled()) {
                                    console.debug.apply(console, [ADOBE_TARGET_PREFIX].concat(args));
                                }
                            }

                            function logWarn() {
                                for (
                                    var _len = arguments.length, args = Array(_len), _key = 0;
                                    _key < _len;
                                    _key++
                                ) {
                                    args[_key] = arguments[_key];
                                }
                                warn(window$1, args);
                            }
                            function logDebug() {
                                for (
                                    var _len2 = arguments.length, args = Array(_len2), _key2 = 0;
                                    _key2 < _len2;
                                    _key2++
                                ) {
                                    args[_key2] = arguments[_key2];
                                }
                                debug(window$1, args);
                            }

                            var TRACES_FORMAT_VERSION = "1";
                            var EXPORTED_SETTINGS = [
                                ENABLED,
                                CLIENT_CODE,
                                IMS_ORG_ID,
                                SERVER_DOMAIN,
                                COOKIE_DOMAIN,
                                CROSS_DOMAIN,
                                TIMEOUT,
                                GLOBAL_MBOX_AUTO_CREATE,
                                MBOX_PARAMS,
                                GLOBAL_MBOX_PARAMS,
                                DEFAULT_CONTENT_HIDDEN_STYLE,
                                DEFAULT_CONTENT_VISIBLE_STYLE,
                                BODY_HIDDEN_STYLE,
                                BODY_HIDING_ENABLED,
                                SELECTORS_POLLING_TIMEOUT,
                                VISITOR_API_TIMEOUT,
                                OVERRIDE_MBOX_EDGE_SERVER,
                                OVERRIDE_MBOX_EDGE_SERVER_TIMEOUT,
                                OPTOUT_ENABLED,
                                SECURE_ONLY,
                                SUPPLEMENTAL_DATA_ID_PARAM_TIMEOUT,
                                AUTHORING_SCRIPT_URL
                            ];
                            function getSettings(config) {
                                return reduce(
                                    function(acc, key) {
                                        acc[key] = config[key];
                                        return acc;
                                    },
                                    {},
                                    EXPORTED_SETTINGS
                                );
                            }
                            function initialize(win, config, debugEnabled) {
                                var result = win[TRACES] || [];
                                if (debugEnabled) {
                                    var oldPush = result.push;
                                    result[VERSION] = TRACES_FORMAT_VERSION;
                                    result[SETTINGS] = getSettings(config);
                                    result[CLIENT_TRACES] = [];
                                    result[SERVER_TRACES] = [];
                                    result.push = function push(trace) {
                                        result[SERVER_TRACES].push(trace);
                                        oldPush.call(this, trace);
                                    };
                                }
                                win[TRACES] = result;
                            }
                            function saveTrace(win, debugEnabled, namespace, trace) {
                                if (!debugEnabled) {
                                    return;
                                }
                                var entry = {};
                                entry[TIMESTAMP] = now();
                                win[TRACES][namespace].push(assign(entry, trace));
                            }

                            function initTraces() {
                                initialize(window$1, getConfig(), isDebugEnabled());
                            }
                            function addTrace(namespace, trace) {
                                saveTrace(window$1, isDebugEnabled(), namespace, trace);
                            }

                            function createValid() {
                                var result = {};
                                result[VALID] = true;
                                return result;
                            }
                            function createInvalid(error) {
                                var result = {};
                                result[VALID] = false;
                                result[ERROR] = error;
                                return result;
                            }
                            function validateMbox(mbox) {
                                if (isBlank(mbox)) {
                                    return createInvalid(MBOX_REQUIRED);
                                }
                                if (mbox.length > MBOX_LENGTH) {
                                    return createInvalid(MBOX_TOO_LONG);
                                }
                                return createValid();
                            }
                            function validateGetOfferOptions(options) {
                                if (!isObject(options)) {
                                    return createInvalid(OPTIONS_REQUIRED);
                                }
                                var mbox = options[MBOX];
                                var mboxValidation = validateMbox(mbox);
                                if (!mboxValidation[VALID]) {
                                    return mboxValidation;
                                }
                                if (!isFunction(options[SUCCESS])) {
                                    return createInvalid(SUCCESS_REQUIRED);
                                }
                                if (!isFunction(options[ERROR])) {
                                    return createInvalid(ERROR_REQUIRED);
                                }
                                return createValid();
                            }
                            function validateApplyOfferOptions(options) {
                                if (!isObject(options)) {
                                    return createInvalid(OPTIONS_REQUIRED);
                                }
                                var mbox = options[MBOX];
                                var mboxValidation = validateMbox(mbox);
                                if (!mboxValidation[VALID]) {
                                    return mboxValidation;
                                }
                                var offer = options[OFFER];
                                if (!isArray(offer)) {
                                    return createInvalid(OFFER_REQUIRED);
                                }
                                return createValid();
                            }
                            function validateTrackEventOptions(options) {
                                if (!isObject(options)) {
                                    return createInvalid(OPTIONS_REQUIRED);
                                }
                                var mbox = options[MBOX];
                                var mboxValidation = validateMbox(mbox);
                                if (!mboxValidation[VALID]) {
                                    return mboxValidation;
                                }
                                return createValid();
                            }
                            function validateRegisterExtensionOptions(options, exposedModules) {
                                if (!isObject(options)) {
                                    return createInvalid(OPTIONS_REQUIRED);
                                }
                                var name = options[NAME];
                                if (isBlank(name)) {
                                    return createInvalid(NAME_REQUIRED);
                                }
                                var parts = split(".", name);
                                var isInvalid = function isInvalid(part) {
                                    return !LETTERS_ONLY_PATTERN.test(part);
                                };
                                if (!isEmpty(filter(isInvalid, parts))) {
                                    return createInvalid(NAME_INVALID);
                                }
                                var modules = options[MODULES];
                                if (!isArray(modules) || isEmpty(modules)) {
                                    return createInvalid(MODULES_REQUIRED);
                                }
                                var isMissing = function isMissing(n) {
                                    return isNil(exposedModules[n]);
                                };
                                if (!isEmpty(filter(isMissing, modules))) {
                                    return createInvalid(MODULES_INVALID);
                                }
                                var registerFunc = options[REGISTER];
                                if (!isFunction(registerFunc)) {
                                    return createInvalid(REGISTER_REQUIRED);
                                }
                                return createValid();
                            }

                            var SESSION_ID = uuid();
                            function saveSessionId(value, config) {
                                setTargetCookie({
                                    name: SESSION_ID_COOKIE,
                                    value: value,
                                    expires: config[SESSION_ID_LIFETIME],
                                    domain: config[COOKIE_DOMAIN]
                                });
                            }
                            function setSessionId(value) {
                                var config = getConfig();
                                if (config[CROSS_DOMAIN_ONLY]) {
                                    return;
                                }
                                saveSessionId(value, config);
                            }
                            function getSessionId() {
                                var config = getConfig();
                                if (config[CROSS_DOMAIN_ONLY]) {
                                    return SESSION_ID;
                                }
                                var sessionId = getTargetCookie(SESSION_ID_COOKIE);
                                if (isBlank(sessionId)) {
                                    saveSessionId(SESSION_ID, config);
                                }
                                return getTargetCookie(SESSION_ID_COOKIE);
                            }

                            function setDeviceId(value) {
                                var config = getConfig();
                                if (config[CROSS_DOMAIN_ONLY]) {
                                    return;
                                }
                                setTargetCookie({
                                    name: DEVICE_ID_COOKIE,
                                    value: value,
                                    expires: config[DEVICE_ID_LIFETIME],
                                    domain: config[COOKIE_DOMAIN]
                                });
                            }
                            function getDeviceId() {
                                var config = getConfig();
                                if (config[CROSS_DOMAIN_ONLY]) {
                                    return "";
                                }
                                return getTargetCookie(DEVICE_ID_COOKIE);
                            }

                            var CLUSTER_ID_REGEX = /.*\.(\d+)_\d+/;
                            function extractCluster(id) {
                                var result = CLUSTER_ID_REGEX.exec(id);
                                if (isEmpty(result) || result.length !== 2) {
                                    return "";
                                }
                                return result[1];
                            }
                            function getEdgeCluster() {
                                var config = getConfig();
                                if (!config[OVERRIDE_MBOX_EDGE_SERVER]) {
                                    return "";
                                }
                                var result = getCookie(EDGE_CLUSTER_COOKIE);
                                return isBlank(result) ? "" : result;
                            }
                            function setEdgeCluster(id) {
                                var config = getConfig();
                                if (!config[OVERRIDE_MBOX_EDGE_SERVER]) {
                                    return;
                                }
                                var cluster = extractCluster(id);
                                if (isBlank(cluster)) {
                                    return;
                                }
                                var expires = new Date(now() + config[OVERRIDE_MBOX_EDGE_SERVER_TIMEOUT]);
                                setCookie(EDGE_CLUSTER_COOKIE, cluster, {
                                    domain: config[COOKIE_DOMAIN],
                                    expires: expires
                                });
                            }

                            function isRedirect(action) {
                                return action[ACTION] === REDIRECT;
                            }
                            function bootstrapNotify(win, doc) {
                                if (isFunction(win.CustomEvent)) {
                                    return;
                                }
                                function CustomEvent(event, params) {
                                    var evt = doc.createEvent("CustomEvent");
                                    params = params || { bubbles: false, cancelable: false, detail: undefined };
                                    evt.initCustomEvent(
                                        event,
                                        params.bubbles,
                                        params.cancelable,
                                        params.detail
                                    );
                                    return evt;
                                }
                                CustomEvent.prototype = win.Event.prototype;
                                win.CustomEvent = CustomEvent;
                            }
                            function createTracking(getSessionId, getDeviceId) {
                                var sessionId = getSessionId();
                                var deviceId = getDeviceId();
                                var result = {};
                                result.sessionId = sessionId;
                                if (isNotBlank(deviceId)) {
                                    result.deviceId = deviceId;
                                    return result;
                                }
                                return result;
                            }
                            function notify(win, doc, eventName, detail) {
                                var event = new win.CustomEvent(eventName, { detail: detail });
                                doc.dispatchEvent(event);
                            }
                            function hasRedirect(actions) {
                                if (isEmpty(actions)) {
                                    return false;
                                }
                                return !isEmpty(filter(isRedirect, actions));
                            }

                            bootstrapNotify(window$1, document$1);
                            var LIBRARY_LOADED = "at-library-loaded";
                            var REQUEST_START = "at-request-start";
                            var REQUEST_SUCCEEDED = "at-request-succeeded";
                            var REQUEST_FAILED$1 = "at-request-failed";
                            var CONTENT_RENDERING_START = "at-content-rendering-start";
                            var CONTENT_RENDERING_SUCCEEDED = "at-content-rendering-succeeded";
                            var CONTENT_RENDERING_FAILED = "at-content-rendering-failed";
                            var CONTENT_RENDERING_NO_OFFERS = "at-content-rendering-no-offers";
                            var CONTENT_RENDERING_REDIRECT = "at-content-rendering-redirect";
                            function notifyLibraryLoaded() {
                                var payload = {
                                    type: LIBRARY_LOADED
                                };
                                notify(window$1, document$1, LIBRARY_LOADED, payload);
                            }
                            function notifyRequestStart(detail) {
                                var payload = {
                                    type: REQUEST_START,
                                    mbox: detail.mbox,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                };
                                notify(window$1, document$1, REQUEST_START, payload);
                            }
                            function notifyRequestSucceeded(detail, actions) {
                                var responseTokens = detail.responseTokens;
                                var payload = {
                                    type: REQUEST_SUCCEEDED,
                                    mbox: detail.mbox,
                                    redirect: hasRedirect(actions),
                                    tracking: createTracking(getSessionId, getDeviceId)
                                };
                                if (!isEmpty(responseTokens)) {
                                    payload.responseTokens = responseTokens;
                                }
                                notify(window$1, document$1, REQUEST_SUCCEEDED, payload);
                            }
                            function notifyRequestFailed(detail) {
                                notify(window$1, document$1, REQUEST_FAILED$1, {
                                    type: REQUEST_FAILED$1,
                                    mbox: detail.mbox,
                                    message: detail.message,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                });
                            }
                            function notifyRenderingStart(detail) {
                                var payload = {
                                    type: CONTENT_RENDERING_START,
                                    mbox: detail.mbox,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                };
                                notify(window$1, document$1, CONTENT_RENDERING_START, payload);
                            }
                            function notifyRenderingSucceeded(detail) {
                                notify(window$1, document$1, CONTENT_RENDERING_SUCCEEDED, {
                                    type: CONTENT_RENDERING_SUCCEEDED,
                                    mbox: detail.mbox,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                });
                            }
                            function notifyRenderingFailed(detail) {
                                notify(window$1, document$1, CONTENT_RENDERING_FAILED, {
                                    type: CONTENT_RENDERING_FAILED,
                                    mbox: detail.mbox,
                                    message: detail.message,
                                    selectors: detail.selectors,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                });
                            }
                            function notifyRenderingNoOffers(detail) {
                                var payload = {
                                    type: CONTENT_RENDERING_NO_OFFERS,
                                    mbox: detail.mbox,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                };
                                notify(window$1, document$1, CONTENT_RENDERING_NO_OFFERS, payload);
                            }
                            function notifyRenderingRedirect(detail) {
                                var payload = {
                                    type: CONTENT_RENDERING_REDIRECT,
                                    mbox: detail.mbox,
                                    url: detail.url,
                                    tracking: createTracking(getSessionId, getDeviceId)
                                };
                                notify(window$1, document$1, CONTENT_RENDERING_REDIRECT, payload);
                            }

                            var ARRAY_EXPECTED = "Expected an array of promises";
                            function create(func) {
                                return new Promise$1(func);
                            }
                            function resolve(value) {
                                return Promise$1.resolve(value);
                            }
                            function reject(value) {
                                return Promise$1.reject(value);
                            }
                            function race(arr) {
                                if (!isArray(arr)) {
                                    return reject(new TypeError(ARRAY_EXPECTED));
                                }
                                return Promise$1.race(arr);
                            }
                            function all(arr) {
                                if (!isArray(arr)) {
                                    return reject(new TypeError(ARRAY_EXPECTED));
                                }
                                return Promise$1.all(arr);
                            }
                            function delayPromise(time) {
                                var func = function func(res) {
                                    return delay(res, time);
                                };
                                return create(func);
                            }
                            function timeout(promise, time, message) {
                                var delayedPromise = delayPromise(time).then(function() {
                                    throw new Error(message);
                                });
                                return race([promise, delayedPromise]);
                            }

                            var NETWORK_ERROR = "Network request failed";
                            var REQUEST_TIMEOUT = "Request timed out";
                            var URL_REQUIRED = "URL is required";
                            var GET = "GET";
                            var POST = "POST";
                            var METHOD = "method";
                            var URL$1 = "url";
                            var HEADERS = "headers";
                            var DATA$1 = "data";
                            var CREDENTIALS = "credentials";
                            var TIMEOUT$1 = "timeout";
                            var ASYNC = "async";
                            function throwError(message) {
                                throw new Error(message);
                            }
                            function processOptions(options) {
                                var method = options[METHOD] || GET;
                                var url = options[URL$1] || throwError(URL_REQUIRED);
                                var headers = options[HEADERS] || {};
                                var data = options[DATA$1] || null;
                                var credentials = options[CREDENTIALS] || false;
                                var timeout$$1 = options[TIMEOUT$1] || 3000;
                                var async = isNil(options[ASYNC]) ? true : options[ASYNC] === true;
                                var result = {};
                                result[METHOD] = method;
                                result[URL$1] = url;
                                result[HEADERS] = headers;
                                result[DATA$1] = data;
                                result[CREDENTIALS] = credentials;
                                result[TIMEOUT$1] = timeout$$1;
                                result[ASYNC] = async;
                                return result;
                            }
                            function addOnload(xhr, resolve$$1, reject$$1, trace) {
                                xhr.onload = function() {
                                    var status = xhr.status === 1223 ? 204 : xhr.status;
                                    if (status < 100 || status > 599) {
                                        trace[ERROR] = NETWORK_ERROR;
                                        addTrace(CLIENT_TRACES, trace);
                                        reject$$1(new Error(NETWORK_ERROR));
                                        return;
                                    }
                                    var response = xhr.responseText;
                                    var headers = xhr.getAllResponseHeaders();
                                    var result = { status: status, headers: headers, response: response };
                                    trace[RESPONSE] = result;
                                    addTrace(CLIENT_TRACES, trace);
                                    resolve$$1(result);
                                };
                                return xhr;
                            }
                            function addOnerror(xhr, reject$$1, trace) {
                                xhr.onerror = function() {
                                    trace[ERROR] = NETWORK_ERROR;
                                    addTrace(CLIENT_TRACES, trace);
                                    reject$$1(new Error(NETWORK_ERROR));
                                };
                                return xhr;
                            }
                            function addOntimeout(xhr, timeout$$1, reject$$1, trace) {
                                xhr.timeout = timeout$$1;
                                xhr.ontimeout = function() {
                                    trace[ERROR] = REQUEST_TIMEOUT;
                                    addTrace(CLIENT_TRACES, trace);
                                    reject$$1(new Error(REQUEST_TIMEOUT));
                                };
                                return xhr;
                            }
                            function addCredentials(xhr, credentials) {
                                if (credentials === true) {
                                    xhr.withCredentials = credentials;
                                }
                                return xhr;
                            }
                            function addHeaders(xhr, headers) {
                                forEach(function(value, key) {
                                    forEach(function(v) {
                                        return xhr.setRequestHeader(key, v);
                                    }, value);
                                }, headers);
                                return xhr;
                            }
                            function createXhrPromise(win, opts) {
                                var trace = {};
                                var options = processOptions(opts);
                                var method = options[METHOD];
                                var url = options[URL$1];
                                var headers = options[HEADERS];
                                var data = options[DATA$1];
                                var credentials = options[CREDENTIALS];
                                var timeout$$1 = options[TIMEOUT$1];
                                var async = options[ASYNC];
                                trace[REQUEST] = options;
                                return create(function(resolve$$1, reject$$1) {
                                    var xhr = new win.XMLHttpRequest();
                                    xhr = addOnload(xhr, resolve$$1, reject$$1, trace);
                                    xhr = addOnerror(xhr, reject$$1, trace);
                                    xhr.open(method, url, async);
                                    xhr = addCredentials(xhr, credentials);
                                    xhr = addHeaders(xhr, headers);
                                    if (async) {
                                        xhr = addOntimeout(xhr, timeout$$1, reject$$1, trace);
                                    }
                                    xhr.send(data);
                                });
                            }

                            function xhr(options) {
                                return createXhrPromise(window$1, options);
                            }

                            function saveSessionId$1(setSessionId, response) {
                                var id = response.sessionId;
                                if (isNotBlank(id)) {
                                    setSessionId(id);
                                }
                                return response;
                            }

                            function saveDeviceId(setDeviceId, response) {
                                var id = response.tntId;
                                if (isNotBlank(id)) {
                                    setDeviceId(id);
                                }
                                return response;
                            }

                            function saveEdgeCluster(setEdgeCluster, response) {
                                var id = response.tntId;
                                if (isNotBlank(id)) {
                                    setEdgeCluster(id);
                                }
                                return response;
                            }

                            function addTrace$1(win, trace) {
                                win[TRACES].push(trace);
                            }
                            function saveTrace$1(win, response) {
                                var trace = response.trace;
                                if (isObject(trace)) {
                                    addTrace$1(win, trace);
                                }
                                return response;
                            }

                            function handleError(response) {
                                var error = response[ERROR];
                                if (isNotBlank(error)) {
                                    var exception = {};
                                    exception[STATUS] = ERROR;
                                    exception[ERROR] = error;
                                    throw exception;
                                }
                                return response;
                            }

                            var DISABLE_COOKIE = "mboxDisable";
                            var DISABLED = "disabled";
                            var DISABLED_DURATION = 86400000;
                            var DISABLED_MESSAGE = "3rd party cookies disabled";
                            function getDisabledMessage(disabled) {
                                var message = disabled.message;
                                return isBlank(message) ? DISABLED_MESSAGE : message;
                            }
                            function getDisabledDuration(disabled) {
                                var duration = disabled.duration;
                                return isNumber(duration) ? duration : DISABLED_DURATION;
                            }
                            function saveDisabledData(config, setCookie, disabled) {
                                var cookieDomain = config[COOKIE_DOMAIN];
                                var message = getDisabledMessage(disabled);
                                var expires = new Date(now() + getDisabledDuration(disabled));
                                setCookie(DISABLE_COOKIE, message, {
                                    domain: cookieDomain,
                                    expires: expires
                                });
                            }
                            function saveDisabled(config, setCookie, response) {
                                var disabled = response.disabled;
                                if (isObject(disabled)) {
                                    var exception = {};
                                    exception[STATUS] = DISABLED;
                                    exception[ERROR] = getDisabledMessage(disabled);
                                    saveDisabledData(config, setCookie, disabled);
                                    throw exception;
                                }
                                return response;
                            }

                            function isHtml(offer) {
                                return isNotBlank(offer[HTML]);
                            }
                            function isJson(offer) {
                                return isObject(offer[JSON$1]) || isArray(offer[JSON$1]);
                            }
                            function isRedirect$1(offer) {
                                return isNotBlank(offer[REDIRECT]);
                            }
                            function isActions(offer) {
                                return isArray(offer[ACTIONS]) && !isEmpty(offer[ACTIONS]);
                            }
                            function isDynamic(offer) {
                                return isObject(offer[DYNAMIC]) && isNotBlank(offer[DYNAMIC][URL]);
                            }
                            function isDefault(offer) {
                                return (
                                    isNil(offer[HTML]) &&
                                    isNil(offer[REDIRECT]) &&
                                    isNil(offer[ACTIONS]) &&
                                    isNil(offer[DYNAMIC])
                                );
                            }
                            function hasClickToken(value) {
                                return isNotBlank(value[CLICK_TOKEN]);
                            }
                            function hasPlugins(offer) {
                                return isArray(offer[PLUGINS]) && !isEmpty(offer[PLUGINS]);
                            }

                            function createClickToken(offer) {
                                if (hasClickToken(offer)) {
                                    var action = {};
                                    action[ACTION] = SIGNAL_CLICK;
                                    action[CLICK_TRACK_ID] = offer[CLICK_TOKEN];
                                    return [action];
                                }
                                return [];
                            }

                            function getHtml(offer) {
                                if (hasPlugins(offer)) {
                                    return [offer.html].concat(offer.plugins);
                                }
                                return [offer.html];
                            }
                            function createHtml(offers) {
                                var contents = filter(isHtml, offers);
                                if (isEmpty(contents)) {
                                    return resolve([]);
                                }
                                var clickTrackActions = flatten(map(createClickToken, offers));
                                var action = {};
                                action[ACTION] = SET_CONTENT;
                                action[CONTENT] = flatten(map(getHtml, contents)).join("");
                                return resolve([action].concat(clickTrackActions));
                            }

                            function getJson(offer) {
                                return offer[JSON$1];
                            }
                            function getContents(offers) {
                                return reduce(
                                    function(acc, offer) {
                                        acc.push(getJson(offer));
                                        return acc;
                                    },
                                    [],
                                    offers
                                );
                            }
                            function createJson(offers) {
                                var jsonOffers = filter(isJson, offers);
                                if (isEmpty(jsonOffers)) {
                                    return resolve([]);
                                }
                                var action = {};
                                action[ACTION] = SET_JSON;
                                action[CONTENT] = getContents(jsonOffers);
                                return resolve([action]);
                            }

                            function createRedirect(processRedirect, offer) {
                                var action = { action: REDIRECT, url: offer[REDIRECT] };
                                return resolve([processRedirect(action)]);
                            }

                            function createCustomCode(pluginCode) {
                                return { action: CUSTOM_CODE, content: pluginCode };
                            }
                            function createPlugins(offer) {
                                if (hasPlugins(offer)) {
                                    return map(createCustomCode, offer.plugins);
                                }
                                return [];
                            }

                            var CLICK_TRACK_PATTERN = /CLKTRK#(\S+)/;
                            var CLICK_TRACK_REPLACE_PATTERN = /CLKTRK#(\S+)\s/;
                            function getClickTrackNodeId(action) {
                                var selector = action[SELECTOR];
                                if (isBlank(selector)) {
                                    return "";
                                }
                                var result = CLICK_TRACK_PATTERN.exec(selector);
                                if (isEmpty(result) || result.length !== 2) {
                                    return "";
                                }
                                return result[1];
                            }
                            function getContent(id, content) {
                                var div = document.createElement(DIV_TAG);
                                div.innerHTML = content;
                                var firstElement = div.firstElementChild;
                                if (isNil(firstElement)) {
                                    return content;
                                }
                                firstElement.id = id;
                                return firstElement.outerHTML;
                            }
                            function processClickTrackId(action) {
                                var content = action[CONTENT];
                                var nodeId = getClickTrackNodeId(action);
                                if (isBlank(nodeId) || isBlank(content)) {
                                    return action;
                                }
                                var selector = action[SELECTOR];
                                action[SELECTOR] = selector.replace(CLICK_TRACK_REPLACE_PATTERN, "");
                                action[CONTENT] = getContent(nodeId, content);
                                return action;
                            }
                            function processAsset(action) {
                                var value = action[VALUE];
                                if (isBlank(value)) {
                                    return action;
                                }
                                action[CONTENT] = "<" + IMAGE_TAG + " " + SRC + '="' + value + '" />';
                                return action;
                            }

                            function setContent(action) {
                                var result = processClickTrackId(action);
                                var content = result[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, result);
                                    return null;
                                }
                                var contentType = action[CONTENT_TYPE];
                                if (TEXT === contentType) {
                                    action[ACTION] = SET_TEXT;
                                }
                                return action;
                            }

                            function appendContent(action) {
                                var result = processClickTrackId(action);
                                var content = result[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, result);
                                    return null;
                                }
                                return result;
                            }

                            function prependContent(action) {
                                var result = processClickTrackId(action);
                                var content = result[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, result);
                                    return null;
                                }
                                return result;
                            }

                            function replaceContent(action) {
                                var result = processClickTrackId(action);
                                var content = result[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, result);
                                    return null;
                                }
                                return result;
                            }

                            function insertBefore(action) {
                                var result = processClickTrackId(processAsset(action));
                                var content = result[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, result);
                                    return null;
                                }
                                return result;
                            }

                            function insertAfter(action) {
                                var result = processClickTrackId(processAsset(action));
                                var content = result[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, result);
                                    return null;
                                }
                                return result;
                            }

                            function customCode(action) {
                                var content = action[CONTENT];
                                if (!isString(content)) {
                                    logDebug(EMPTY_CONTENT, action);
                                    return null;
                                }
                                return action;
                            }

                            function setAttribute(action) {
                                var attribute = action[ATTRIBUTE];
                                var value = action[VALUE];
                                if (isBlank(attribute) || isBlank(value)) {
                                    logDebug(EMPTY_ATTRIBUTE, action);
                                    return null;
                                }
                                return action;
                            }

                            function setStyle(action) {
                                var property = action[PROPERTY];
                                var value = action[VALUE];
                                if (isBlank(property) || isBlank(value)) {
                                    logDebug(EMPTY_PROPERTY, action);
                                    return null;
                                }
                                var style = {};
                                style[property] = value;
                                action[STYLE] = style;
                                return action;
                            }

                            function resize(action) {
                                var height = action[FINAL_HEIGHT];
                                var width = action[FINAL_WIDTH];
                                if (isBlank(height) || isBlank(width)) {
                                    logDebug(EMPTY_SIZES, action);
                                    return null;
                                }
                                var style = {};
                                style[HEIGHT] = height;
                                style[WIDTH] = width;
                                action[ACTION] = SET_STYLE;
                                action[STYLE] = style;
                                return action;
                            }

                            function move(action) {
                                var left = Number(action[FINAL_LEFT_POSITION]);
                                var top = Number(action[FINAL_TOP_POSITION]);
                                if (isNaN(left) || isNaN(top)) {
                                    logDebug(EMPTY_COORDINATES, action);
                                    return null;
                                }
                                var position = action[POSITION];
                                var style = {};
                                style[LEFT] = left;
                                style[TOP] = top;
                                if (isNotBlank(position)) {
                                    style[POSITION] = position;
                                }
                                action[ACTION] = SET_STYLE;
                                action[STYLE] = style;
                                return action;
                            }

                            function rearrange(action) {
                                var from = Number(action[FROM]);
                                var to = Number(action[TO]);
                                if (isNaN(from) || isNaN(to)) {
                                    logDebug(EMPTY_REARRANGE, action);
                                    return null;
                                }
                                return action;
                            }

                            function redirect(processRedirect, action) {
                                return processRedirect(action);
                            }

                            function trackClick(action) {
                                var clickTrackId = action[CLICK_TRACK_ID];
                                if (isBlank(clickTrackId)) {
                                    logDebug(EMPTY_CLICK_TRACK_ID, action);
                                    return null;
                                }
                                return action;
                            }

                            function transformAction(processRedirect, action) {
                                var type = action[ACTION];
                                switch (type) {
                                    case SET_CONTENT:
                                        return setContent(action);
                                    case APPEND_CONTENT:
                                        return appendContent(action);
                                    case PREPEND_CONTENT:
                                        return prependContent(action);
                                    case REPLACE_CONTENT:
                                        return replaceContent(action);
                                    case INSERT_BEFORE:
                                        return insertBefore(action);
                                    case INSERT_AFTER:
                                        return insertAfter(action);
                                    case CUSTOM_CODE:
                                        return customCode(action);
                                    case SET_ATTRIBUTE:
                                        return setAttribute(action);
                                    case SET_STYLE:
                                        return setStyle(action);
                                    case RESIZE:
                                        return resize(action);
                                    case MOVE:
                                        return move(action);
                                    case REMOVE:
                                        return action;
                                    case REARRANGE:
                                        return rearrange(action);
                                    case REDIRECT:
                                        return redirect(processRedirect, action);
                                    case TRACK_CLICK:
                                        return trackClick(action);
                                    default:
                                        return null;
                                }
                            }
                            function processActions(processRedirect, actions) {
                                var notNull = function notNull(action) {
                                    return !isNil(action);
                                };
                                return filter(
                                    notNull,
                                    map(function(action) {
                                        return transformAction(processRedirect, action);
                                    }, actions)
                                );
                            }
                            function createActions(processRedirect, offer) {
                                return resolve(
                                    [].concat(
                                        processActions(processRedirect, offer.actions),
                                        createPlugins(offer)
                                    )
                                );
                            }

                            function createUrl(url, params) {
                                var parsedUri = parseUri(url);
                                var protocol = parsedUri.protocol;
                                var host = parsedUri.host;
                                var path = parsedUri.path;
                                var port = parsedUri.port === "" ? "" : ":" + parsedUri.port;
                                var anchor = isBlank(parsedUri.anchor) ? "" : "#" + parsedUri.anchor;
                                var uriParams = parsedUri.queryKey;
                                var queryString$$1 = stringifyQueryString(assign({}, uriParams, params));
                                var query = isBlank(queryString$$1) ? "" : "?" + queryString$$1;
                                return protocol + "://" + host + port + path + query + anchor;
                            }

                            function getDynamicParams(dynamic) {
                                var result = {};
                                forEach(function(param) {
                                    if (isNil(result[param.type])) {
                                        result[param.type] = {};
                                    }
                                    result[param.type][param.name] = param.defaultValue;
                                }, dynamic[PARAMS]);
                                return result;
                            }
                            function getRequestParams(dynamicParams) {
                                if (isNil(dynamicParams[REQUEST])) {
                                    return {};
                                }
                                return dynamicParams[REQUEST];
                            }
                            function isMboxParam(name) {
                                return name.indexOf(MBOX) !== -1;
                            }
                            function getMboxParams(dynamicParams) {
                                var mboxParams = {};
                                if (isNil(dynamicParams[MBOX])) {
                                    return mboxParams;
                                }
                                forEach(function(value, key) {
                                    if (isMboxParam(key)) {
                                        return;
                                    }
                                    mboxParams[key] = value;
                                }, dynamicParams[MBOX]);
                                return mboxParams;
                            }
                            function modifyParams(first$$1, second) {
                                forEach(function(_, key) {
                                    var value = second[key];
                                    if (isNil(value)) {
                                        return;
                                    }
                                    first$$1[key] = value;
                                }, first$$1);
                            }
                            function processParams(
                                dynamicRequestParams,
                                requestParams,
                                dynamicMboxParams,
                                mboxParams
                            ) {
                                modifyParams(dynamicRequestParams, requestParams);
                                modifyParams(dynamicMboxParams, mboxParams);
                                return assign({}, dynamicRequestParams, dynamicMboxParams);
                            }
                            function createOptions(url, params, timeout) {
                                var result = {};
                                result[METHOD] = GET;
                                result[URL$1] = createUrl(url, params);
                                result[TIMEOUT$1] = timeout;
                                return result;
                            }
                            function isSuccess(status) {
                                return (status >= 200 && status < 300) || status === 304;
                            }
                            function createAction(resObj, offer) {
                                var status = resObj[STATUS];
                                if (!isSuccess(status)) {
                                    return [];
                                }
                                var content = resObj[RESPONSE];
                                if (isBlank(content)) {
                                    return [];
                                }
                                var action = {};
                                action[ACTION] = SET_CONTENT;
                                action[CONTENT] = content;
                                return [action].concat(createClickToken(offer), createPlugins(offer));
                            }
                            function createDynamic(win, xhr$$1, request, offer) {
                                var dynamic = offer[DYNAMIC];
                                var dynamicParams = getDynamicParams(dynamic);
                                var dynamicRequestParams = getRequestParams(dynamicParams);
                                var dynamicMboxParams = getMboxParams(dynamicParams);
                                var requestParams = parseQueryString(win.location.search);
                                var mboxParams = request[PARAMS];
                                var url = dynamic[URL$1];
                                var params = processParams(
                                    dynamicRequestParams,
                                    requestParams,
                                    dynamicMboxParams,
                                    mboxParams
                                );
                                var timeout = request[TIMEOUT$1];
                                var processResponse = function processResponse(resObj) {
                                    return createAction(resObj, offer);
                                };
                                return xhr$$1(createOptions(url, params, timeout))
                                    .then(processResponse)
                                    ["catch"](function() {
                                    return [];
                                });
                            }

                            function createDefault(offer) {
                                return resolve([].concat(createClickToken(offer), createPlugins(offer)));
                            }

                            function getActions(win, xhr, processRedirect, request, offers) {
                                var result = [];
                                forEach(function(offer) {
                                    if (isRedirect$1(offer)) {
                                        result.push(createRedirect(processRedirect, offer));
                                        return;
                                    }
                                    if (isActions(offer)) {
                                        result.push(createActions(processRedirect, offer));
                                        return;
                                    }
                                    if (isDynamic(offer)) {
                                        result.push(createDynamic(win, xhr, request, offer));
                                        return;
                                    }
                                    if (isDefault(offer)) {
                                        result.push(createDefault(offer));
                                        return;
                                    }
                                }, offers);
                                return result.concat(createHtml(offers), createJson(offers));
                            }
                            function getResponseTokens(offers) {
                                var result = [];
                                forEach(function(offer) {
                                    var tokens = offer[RESPONSE_TOKENS];
                                    if (!isObject(tokens)) {
                                        return;
                                    }
                                    result.push(tokens);
                                }, offers);
                                return result;
                            }
                            function createResult(actions, responseTokens) {
                                var result = {};
                                result[ACTIONS] = actions;
                                result[RESPONSE_TOKENS] = responseTokens;
                                return result;
                            }
                            function processOffers(win, xhr, processRedirect, request, response) {
                                var offers = response[OFFERS];
                                if (!isArray(offers)) {
                                    return resolve(createResult([], []));
                                }
                                var actions = getActions(win, xhr, processRedirect, request, offers);
                                var responseTokens = getResponseTokens(offers);
                                var createResponse = function createResponse(actions) {
                                    return createResult(flatten(actions), responseTokens);
                                };
                                return all(actions).then(createResponse);
                            }

                            var SESSION_ID_PARAM$1 = "mboxSession";
                            var TRUE$1 = "true";
                            function handleRedirect(win, getSessionId, action) {
                                var url = action[URL];
                                if (isBlank(url)) {
                                    logDebug(EMPTY_URL, action);
                                    return null;
                                }
                                var includeParams = String(action[INCLUDE_ALL_URL_PARAMETERS]) === TRUE$1;
                                var includeSession = String(action[PASS_MBOX_SESSION]) === TRUE$1;
                                var params = {};
                                if (includeParams) {
                                    params = assign(params, parseQueryString(win.location.search));
                                }
                                if (includeSession) {
                                    params[SESSION_ID_PARAM$1] = getSessionId();
                                }
                                action[URL] = createUrl(url, params);
                                return action;
                            }

                            function isPair(pair) {
                                return !isEmpty(pair) && pair.length === 2 && isNotBlank(pair[0]);
                            }
                            function createPair(param) {
                                var index = param.indexOf("=");
                                if (index === -1) {
                                    return [];
                                }
                                return [param.substr(0, index), param.substr(index + 1)];
                            }
                            function objectToParamsInternal(obj, ks, result, keyFunc) {
                                forEach(function(value, key) {
                                    if (isObject(value)) {
                                        ks.push(key);
                                        objectToParamsInternal(value, ks, result, keyFunc);
                                        ks.pop();
                                    } else if (isEmpty(ks)) {
                                        result[keyFunc(key)] = value;
                                    } else {
                                        result[keyFunc(ks.concat(key).join("."))] = value;
                                    }
                                }, obj);
                            }
                            function queryStringToParams(queryString$$1) {
                                return filter(function(value, key) {
                                    return isNotBlank(key);
                                }, parseQueryString(queryString$$1));
                            }
                            function arrayToParams(array) {
                                var pairs = reduce(
                                    function(acc, param) {
                                        acc.push(createPair(param));
                                        return acc;
                                    },
                                    [],
                                    filter(isNotBlank, array)
                                );
                                return reduce(
                                    function(acc, pair) {
                                        acc[decode(trim(pair[0]))] = decode(trim(pair[1]));
                                        return acc;
                                    },
                                    {},
                                    filter(isPair, pairs)
                                );
                            }
                            function objectToParams(object, keyFunc) {
                                var result = {};
                                if (isNil(keyFunc)) {
                                    objectToParamsInternal(object, [], result, identity);
                                } else {
                                    objectToParamsInternal(object, [], result, keyFunc);
                                }
                                return result;
                            }
                            function functionToParams(func) {
                                if (!isFunction(func)) {
                                    return {};
                                }
                                var params = null;
                                try {
                                    params = func();
                                } catch (_ignore) {
                                    return {};
                                }
                                if (isNil(params)) {
                                    return {};
                                }
                                if (isArray(params)) {
                                    return arrayToParams(params);
                                }
                                if (isString(params) && isNotBlank(params)) {
                                    return queryStringToParams(params);
                                }
                                if (isObject(params)) {
                                    return objectToParams(params);
                                }
                                return {};
                            }

                            function getWebGLRendererInternal() {
                                var canvas = document$1.createElement("canvas");
                                var gl =
                                    canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
                                if (isNil(gl)) {
                                    return null;
                                }
                                var glInfo = gl.getExtension("WEBGL_debug_renderer_info");
                                if (isNil(glInfo)) {
                                    return null;
                                }
                                var result = gl.getParameter(glInfo.UNMASKED_RENDERER_WEBGL);
                                if (isNil(result)) {
                                    return null;
                                }
                                return result;
                            }
                            var WEB_GL_RENDERER_INTERNAL = getWebGLRendererInternal();
                            function getPixelRatio() {
                                var ratio = window$1.devicePixelRatio;
                                if (!isNil(ratio)) {
                                    return ratio;
                                }
                                ratio = 1;
                                var screen = window$1.screen;
                                var systemXDPI = screen.systemXDPI,
                                    logicalXDPI = screen.logicalXDPI;
                                if (!isNil(systemXDPI) && !isNil(logicalXDPI) && systemXDPI > logicalXDPI) {
                                    ratio = systemXDPI / logicalXDPI;
                                }
                                return ratio;
                            }
                            function getScreenOrientation() {
                                var screen = window$1.screen;
                                var orientation = screen.orientation,
                                    width = screen.width,
                                    height = screen.height;
                                if (isNil(orientation)) {
                                    return width > height ? "landscape" : "portrait";
                                }
                                if (isNil(orientation.type)) {
                                    return null;
                                }
                                var parts = split("-", orientation.type);
                                if (isEmpty(parts)) {
                                    return null;
                                }
                                var result = parts[0];
                                if (!isNil(result)) {
                                    return result;
                                }
                                return null;
                            }
                            function getWebGLRenderer() {
                                return WEB_GL_RENDERER_INTERNAL;
                            }
                            function getBrowserParameters() {
                                var screen = window$1.screen;
                                var documentElement = document$1.documentElement;
                                var result = {};
                                result[BROWSER_HEIGHT] = documentElement.clientHeight;
                                result[BROWSER_WIDTH] = documentElement.clientWidth;
                                result[BROWSER_TIME_OFFSET] = -new Date().getTimezoneOffset();
                                result[SCREEN_HEIGHT] = screen.height;
                                result[SCREEN_WIDTH] = screen.width;
                                result[COLOR_DEPTH] = screen.colorDepth;
                                result[PIXEL_RATIO] = getPixelRatio();
                                var orientation = getScreenOrientation();
                                if (!isNil(orientation)) {
                                    result[SCREEN_ORIENTATION] = orientation;
                                }
                                var glRenderer = getWebGLRenderer();
                                if (!isNil(glRenderer)) {
                                    result[WEB_GL_RENDERER] = glRenderer;
                                }
                                return result;
                            }

                            var PAGE_ID = uuid();
                            var COUNTER = 1;
                            function getPageId() {
                                return PAGE_ID;
                            }
                            function getTime() {
                                var now$$1 = new Date();
                                return now$$1.getTime() - now$$1.getTimezoneOffset() * 60000;
                            }
                            function getPageParameters() {
                                var config = getConfig();
                                var location = window$1.location;
                                var params = {};
                                params[SESSION_ID_PARAM] = getSessionId();
                                if (!config[CROSS_DOMAIN_ONLY]) {
                                    params[DEVICE_ID_PARAM] = getDeviceId();
                                }
                                params[PAGE_ID_PARAM] = getPageId();
                                params[REQUEST_ID_PARAM] = uuid();
                                params[VERSION_PARAM] = config[VERSION];
                                params[COUNT_PARAM] = COUNTER;
                                params[TIME_PARAM] = getTime();
                                params[HOST_PARAM] = location.hostname;
                                params[URL_PARAM] = location.href;
                                params[REFERRER_PARAM] = document$1.referrer;
                                if (config[CROSS_DOMAIN_ENABLED]) {
                                    params[CROSS_DOMAIN_PARAM] = config[CROSS_DOMAIN];
                                }
                                COUNTER += 1;
                                return params;
                            }

                            function getTargetPageParamsAll(mboxParams) {
                                return assign({}, mboxParams, functionToParams(window$1.targetPageParamsAll));
                            }
                            function getTargetPageParams(globalMboxParams) {
                                return assign(
                                    {},
                                    globalMboxParams,
                                    functionToParams(window$1.targetPageParams)
                                );
                            }
                            function getTargetPageParamsParameters(mboxName) {
                                var config = getConfig();
                                var globalMboxName = config[GLOBAL_MBOX_NAME];
                                var mboxParams = config[MBOX_PARAMS];
                                var globalMboxParams = config[GLOBAL_MBOX_PARAMS];
                                if (globalMboxName !== mboxName) {
                                    return getTargetPageParamsAll(mboxParams || {});
                                }
                                return assign(
                                    getTargetPageParamsAll(mboxParams || {}),
                                    getTargetPageParams(globalMboxParams || {})
                                );
                            }

                            function getMboxParameters(mboxName, args) {
                                var mboxParam = {};
                                mboxParam[MBOX_PARAM] = mboxName;
                                var argsParams = arrayToParams(args);
                                var pageParams = getPageParameters();
                                var browserParams = getBrowserParameters();
                                var targetPageParams = getTargetPageParamsParameters(mboxName);
                                return assign(
                                    {},
                                    mboxParam,
                                    argsParams,
                                    pageParams,
                                    browserParams,
                                    targetPageParams
                                );
                            }

                            function getGlobalMboxParameters() {
                                var config = getConfig();
                                var globalMboxName = config[GLOBAL_MBOX_NAME];
                                var mboxParam = {};
                                mboxParam[MBOX_PARAM] = globalMboxName;
                                var pageParams = getPageParameters();
                                var browserParams = getBrowserParameters();
                                var targetPageParams = getTargetPageParamsParameters(globalMboxName);
                                return assign({}, mboxParam, pageParams, browserParams, targetPageParams);
                            }

                            var VISITOR = "Visitor";
                            var GET_INSTANCE_METHOD = "getInstance";
                            var IS_ALLOWED_METHOD = "isAllowed";
                            function getInstance(win, imsOrgId, sdidParamExpiry) {
                                if (isBlank(imsOrgId)) {
                                    return null;
                                }
                                if (isNil(win[VISITOR])) {
                                    return null;
                                }
                                if (!isFunction(win[VISITOR][GET_INSTANCE_METHOD])) {
                                    return null;
                                }
                                var visitor = win[VISITOR][GET_INSTANCE_METHOD](imsOrgId, {
                                    sdidParamExpiry: sdidParamExpiry
                                });
                                if (
                                    isObject(visitor) &&
                                    isFunction(visitor[IS_ALLOWED_METHOD]) &&
                                    visitor[IS_ALLOWED_METHOD]()
                                ) {
                                    return visitor;
                                }
                                return null;
                            }

                            var OPTOUT_MESSAGE = "Disabled due to optout";
                            var MID_METHOD = "getMarketingCloudVisitorID";
                            var AAMB_METHOD = "getAudienceManagerBlob";
                            var AID_METHOD = "getAnalyticsVisitorID";
                            var AAMLH_METHOD = "getAudienceManagerLocationHint";
                            var OPTOUT_METHOD = "isOptedOut";
                            var OPTOUT_PROP = "OptOut";
                            var MCAAMB = "MCAAMB";
                            var MCAAMLH = "MCAAMLH";
                            var MCAID = "MCAID";
                            var MCMID = "MCMID";
                            var MCOPTOUT = "MCOPTOUT";
                            var MCAID_PARAM = "mboxMCAVID";
                            var MCAAMB_PARAM = "mboxAAMB";
                            var MCAAMLH_PARAM = "mboxMCGLH";
                            var MCMID_PARAM = "mboxMCGVID";
                            var SDID_PARAM = "mboxMCSDID";
                            var SDID_METHOD = "getSupplementalDataID";
                            var CIDS_METHOD = "getCustomerIDs";
                            var TRCK_SERVER_PROP = "trackingServer";
                            var TRCK_SERVER_SECURE_PROP = TRCK_SERVER_PROP + "Secure";
                            var MC_PREFIX = "vst.";
                            var MC_TRCK_SERVER = MC_PREFIX + "trk";
                            var MC_TRCK_SERVER_SECURE = MC_PREFIX + "trks";
                            function buildKey(key) {
                                return "" + MC_PREFIX + key;
                            }
                            function getCustomerIdsParams(visitor) {
                                if (!isFunction(visitor[CIDS_METHOD])) {
                                    return {};
                                }
                                var customerIds = visitor[CIDS_METHOD]();
                                if (!isObject(customerIds)) {
                                    return {};
                                }
                                return objectToParams(customerIds, buildKey);
                            }
                            function getTrackingServersParams(visitor) {
                                var result = {};
                                if (isNotBlank(visitor[TRCK_SERVER_PROP])) {
                                    result[MC_TRCK_SERVER] = visitor[TRCK_SERVER_PROP];
                                }
                                if (isNotBlank(visitor[TRCK_SERVER_SECURE_PROP])) {
                                    result[MC_TRCK_SERVER_SECURE] = visitor[TRCK_SERVER_SECURE_PROP];
                                }
                                return result;
                            }
                            function getSdidParams(visitor, mbox) {
                                var result = {};
                                if (!isFunction(visitor[SDID_METHOD])) {
                                    return {};
                                }
                                result[SDID_PARAM] = visitor[SDID_METHOD](MBOX + ":" + mbox);
                                return result;
                            }
                            function getInstanceParameters(visitor, mbox) {
                                if (isNil(visitor)) {
                                    return {};
                                }
                                var cidsParams = getCustomerIdsParams(visitor);
                                var trckParams = getTrackingServersParams(visitor);
                                var sdidParams = getSdidParams(visitor, mbox);
                                return assign({}, sdidParams, trckParams, cidsParams);
                            }
                            function convertToParams(visitorValues) {
                                var result = {};
                                var mid = visitorValues[MCMID];
                                var aid = visitorValues[MCAID];
                                var aamb = visitorValues[MCAAMB];
                                var aamlh = visitorValues[MCAAMLH];
                                if (isNotBlank(mid)) {
                                    result[MCMID_PARAM] = mid;
                                }
                                if (isNotBlank(aid)) {
                                    result[MCAID_PARAM] = aid;
                                }
                                if (isNotBlank(aamb)) {
                                    result[MCAAMB_PARAM] = aamb;
                                }
                                if (!isNaN(parseInt(aamlh, 10))) {
                                    result[MCAAMLH_PARAM] = aamlh;
                                }
                                return result;
                            }
                            function collectParams(arr) {
                                return reduce(
                                    function(acc, value) {
                                        return assign(acc, value);
                                    },
                                    {},
                                    arr
                                );
                            }
                            function shouldUseOptout(win, visitor, optoutEnabled) {
                                return (
                                    optoutEnabled &&
                                    isFunction(visitor[OPTOUT_METHOD]) &&
                                    !isNil(win[VISITOR][OPTOUT_PROP])
                                );
                            }
                            function createPair$1(key, value) {
                                var result = {};
                                result[key] = value;
                                return result;
                            }

                            var TIMEOUT_MESSAGE = "Visitor API requests timed out";
                            var ERROR_MESSAGE = "Visitor API requests error";
                            function getVisitorOptout(win, visitor, optoutEnabled) {
                                if (!shouldUseOptout(win, visitor, optoutEnabled)) {
                                    return resolve(createPair$1(MCOPTOUT, false));
                                }
                                return create(function(res) {
                                    visitor[OPTOUT_METHOD](
                                        function(optout) {
                                            return res(createPair$1(MCOPTOUT, optout));
                                        },
                                        win[VISITOR][OPTOUT_PROP].GLOBAL,
                                        true
                                    );
                                });
                            }
                            function executeRequest(visitor, method, key) {
                                if (!isFunction(visitor[method])) {
                                    return resolve({});
                                }
                                return create(function(res) {
                                    visitor[method](function(value) {
                                        return res(createPair$1(key, value));
                                    }, true);
                                });
                            }
                            function executeRequests(win, visitor, optoutEnabled) {
                                var requests = [
                                    executeRequest(visitor, MID_METHOD, MCMID),
                                    executeRequest(visitor, AAMB_METHOD, MCAAMB),
                                    executeRequest(visitor, AID_METHOD, MCAID),
                                    executeRequest(visitor, AAMLH_METHOD, MCAAMLH),
                                    getVisitorOptout(win, visitor, optoutEnabled)
                                ];
                                return all(requests).then(collectParams);
                            }
                            function handleError$1(error) {
                                logDebug(ERROR_MESSAGE, error);
                                return {};
                            }
                            function getAsyncValues(win, visitor, visitorApiTimeout, optoutEnabled) {
                                if (isNil(visitor)) {
                                    return resolve({});
                                }
                                var requests = executeRequests(win, visitor, optoutEnabled);
                                return timeout(requests, visitorApiTimeout, TIMEOUT_MESSAGE)["catch"](
                                    handleError$1
                                );
                            }

                            function createError() {
                                return { status: ERROR, error: OPTOUT_MESSAGE };
                            }
                            function getAsyncParameters(visitor, instParams, values) {
                                if (isNil(visitor)) {
                                    return resolve({});
                                }
                                if (values[MCOPTOUT] === true) {
                                    return reject(createError());
                                }
                                return resolve(assign({}, instParams, convertToParams(values)));
                            }

                            function getSyncVisitorOptout(win, visitor, optoutEnabled) {
                                if (!shouldUseOptout(win, visitor, optoutEnabled)) {
                                    return createPair$1(MCOPTOUT, false);
                                }
                                var optout = visitor[OPTOUT_METHOD](null, win[VISITOR][OPTOUT_PROP].GLOBAL);
                                return createPair$1(MCOPTOUT, optout);
                            }
                            function executeSyncRequest(visitor, method, key) {
                                if (!isFunction(visitor[method])) {
                                    return {};
                                }
                                return createPair$1(key, visitor[method]());
                            }
                            function executeSyncRequests(win, visitor, optoutEnabled) {
                                var requests = [
                                    executeSyncRequest(visitor, MID_METHOD, MCMID),
                                    executeSyncRequest(visitor, AAMB_METHOD, MCAAMB),
                                    executeSyncRequest(visitor, AID_METHOD, MCAID),
                                    executeSyncRequest(visitor, AAMLH_METHOD, MCAAMLH),
                                    getSyncVisitorOptout(win, visitor, optoutEnabled)
                                ];
                                return collectParams(requests);
                            }
                            function getSyncValues(win, visitor, optoutEnabled) {
                                if (isNil(visitor)) {
                                    return {};
                                }
                                return executeSyncRequests(win, visitor, optoutEnabled);
                            }

                            function getSyncParameters(visitor, instParams, values) {
                                if (isNil(visitor)) {
                                    return {};
                                }
                                if (values[MCOPTOUT] === true) {
                                    return {};
                                }
                                return assign({}, instParams, convertToParams(values));
                            }

                            function getVisitorInstance() {
                                var config = getConfig();
                                var imsOrgId = config[IMS_ORG_ID];
                                var sdidParamExpiry = config[SUPPLEMENTAL_DATA_ID_PARAM_TIMEOUT];
                                return getInstance(window$1, imsOrgId, sdidParamExpiry);
                            }
                            function getAsyncVisitorValues() {
                                var visitor = getVisitorInstance();
                                var config = getConfig();
                                var visitorApiTimeout = config[VISITOR_API_TIMEOUT];
                                var optoutEnabled = config[OPTOUT_ENABLED];
                                return getAsyncValues(window$1, visitor, visitorApiTimeout, optoutEnabled);
                            }
                            function getSyncVisitorValues() {
                                var visitor = getVisitorInstance();
                                var config = getConfig();
                                var optoutEnabled = config[OPTOUT_ENABLED];
                                return getSyncValues(window$1, visitor, optoutEnabled);
                            }
                            function getAsyncVisitorParameters(mbox) {
                                var visitor = getVisitorInstance();
                                var instParams = getInstanceParameters(visitor, mbox);
                                var handleValues = function handleValues(values) {
                                    return getAsyncParameters(visitor, instParams, values);
                                };
                                return getAsyncVisitorValues().then(handleValues);
                            }
                            function getSyncVisitorParameters(mbox) {
                                var visitor = getVisitorInstance();
                                var instParams = getInstanceParameters(visitor, mbox);
                                var values = getSyncVisitorValues();
                                return getSyncParameters(visitor, instParams, values);
                            }

                            var storage = {};
                            function setItem(key, value) {
                                storage[key] = value;
                            }
                            function getItem(key) {
                                return storage[key];
                            }

                            var LOG_PREFIX = "Data provider";
                            var TIMED_OUT = "timed out";
                            var MAX_TIMEOUT = 2000;
                            function areDataProvidersPresent(win) {
                                var globalSettings = win[GLOBAL_SETTINGS];
                                if (isNil(globalSettings)) {
                                    return false;
                                }
                                var dataProviders = globalSettings[DATA_PROVIDERS];
                                if (!isArray(dataProviders) || isEmpty(dataProviders)) {
                                    return false;
                                }
                                return true;
                            }
                            function isValidDataProvider(dataProvider) {
                                var name = dataProvider[NAME];
                                if (!isString(name) || isEmpty(name)) {
                                    return false;
                                }
                                var version = dataProvider[VERSION];
                                if (!isString(version) || isEmpty(version)) {
                                    return false;
                                }
                                var wait = dataProvider[TIMEOUT];
                                if (!isNil(wait) && !isNumber(wait)) {
                                    return false;
                                }
                                var provider = dataProvider[PROVIDER];
                                if (!isFunction(provider)) {
                                    return false;
                                }
                                return true;
                            }
                            function createPromise(provider) {
                                return create(function(success, error) {
                                    provider(function(err, params) {
                                        if (!isNil(err)) {
                                            error(err);
                                            return;
                                        }
                                        success(params);
                                    });
                                });
                            }
                            function createTrace(nameKey, name, versionKey, version, resKey, res) {
                                var dataProviderTrace = {};
                                dataProviderTrace[nameKey] = name;
                                dataProviderTrace[versionKey] = version;
                                dataProviderTrace[resKey] = res;
                                var result = {};
                                result[DATA_PROVIDER] = dataProviderTrace;
                                return result;
                            }
                            function convertToPromise(dataProvider) {
                                var name = dataProvider[NAME];
                                var version = dataProvider[VERSION];
                                var wait = dataProvider[TIMEOUT] || MAX_TIMEOUT;
                                var provider = dataProvider[PROVIDER];
                                var promise = createPromise(provider);
                                return timeout(promise, wait, TIMED_OUT)
                                    .then(function(params) {
                                        var trace = createTrace(NAME, name, VERSION, version, PARAMS, params);
                                        logDebug(LOG_PREFIX, SUCCESS, trace);
                                        addTrace(CLIENT_TRACES, trace);
                                        return params;
                                    })
                                    ["catch"](function(error) {
                                    var trace = createTrace(NAME, name, VERSION, version, ERROR, error);
                                    logDebug(LOG_PREFIX, ERROR, trace);
                                    addTrace(CLIENT_TRACES, trace);
                                    return {};
                                });
                            }
                            function collectParams$1(arr) {
                                var result = reduce(
                                    function(acc, value) {
                                        return assign(acc, value);
                                    },
                                    {},
                                    arr
                                );
                                setItem(DATA_PROVIDERS, result);
                                return result;
                            }
                            function executeAsyncDataProviders(win) {
                                if (!areDataProvidersPresent(win)) {
                                    return resolve({});
                                }
                                var dataProviders = win[GLOBAL_SETTINGS][DATA_PROVIDERS];
                                var validProviders = filter(isValidDataProvider, dataProviders);
                                return all(map(convertToPromise, validProviders)).then(collectParams$1);
                            }
                            function executeSyncDataProviders() {
                                var result = getItem(DATA_PROVIDERS);
                                if (isNil(result)) {
                                    return {};
                                }
                                return result;
                            }

                            function getAsyncDataProvidersParameters() {
                                return executeAsyncDataProviders(window$1);
                            }
                            function getSyncDataProvidersParameters() {
                                return executeSyncDataProviders(window$1);
                            }

                            var EDGE_SERVER_PREFIX = "mboxedge";
                            var CLIENT_CODE_VAR = "<clientCode>";
                            var JSON_ENDPOINT_PATTERN = "/m2/" + CLIENT_CODE_VAR + "/mbox/json";
                            var SCHEME_SEPARATOR = "//";
                            function getServerDomain(
                                getCluster,
                                clientCode,
                                serverDomain,
                                overrideMboxEdgeServer
                            ) {
                                if (!overrideMboxEdgeServer) {
                                    return serverDomain;
                                }
                                var cluster = getCluster();
                                if (isBlank(cluster)) {
                                    return serverDomain;
                                }
                                return serverDomain.replace(clientCode, "" + EDGE_SERVER_PREFIX + cluster);
                            }
                            function getPath(clientCode) {
                                return JSON_ENDPOINT_PATTERN.replace(CLIENT_CODE_VAR, clientCode);
                            }
                            function getUrl(config, getCluster) {
                                var clientCode = config[CLIENT_CODE];
                                var serverDomain = config[SERVER_DOMAIN];
                                var overrideMboxEdgeServer = config[OVERRIDE_MBOX_EDGE_SERVER];
                                var scheme = config[SCHEME];
                                return [
                                    scheme,
                                    SCHEME_SEPARATOR,
                                    getServerDomain(
                                        getCluster,
                                        clientCode,
                                        serverDomain,
                                        overrideMboxEdgeServer
                                    ),
                                    getPath(clientCode)
                                ].join("");
                            }
                            function createRequestOptions(config, getCluster, data, request) {
                                var params = assign({}, request[PARAMS], data);
                                var result = {};
                                result[URL$1] = getUrl(config, getCluster);
                                result[DATA$1] = stringifyQueryString(params);
                                return result;
                            }
                            function mergeParameters(arr) {
                                return assign({}, arr[0], arr[1]);
                            }
                            function createAsyncRequestDetails(config, request) {
                                var mbox = request[MBOX];
                                var buildOptions = function buildOptions(arr) {
                                    return createRequestOptions(
                                        config,
                                        getEdgeCluster,
                                        mergeParameters(arr),
                                        request
                                    );
                                };
                                return all([
                                    getAsyncVisitorParameters(mbox),
                                    getAsyncDataProvidersParameters()
                                ]).then(buildOptions);
                            }
                            function createSyncRequestDetails(config, request) {
                                var mbox = request[MBOX];
                                var visitorParams = getSyncVisitorParameters(mbox);
                                var dataProvidersParams = getSyncDataProvidersParameters();
                                var arr = [visitorParams, dataProvidersParams];
                                return createRequestOptions(
                                    config,
                                    getEdgeCluster,
                                    mergeParameters(arr),
                                    request
                                );
                            }

                            var JSON_ERROR = "JSON parser error";
                            function isSuccess$1(status) {
                                return (status >= 200 && status < 300) || status === 304;
                            }
                            function createError$1(message) {
                                var result = {};
                                result[STATUS] = ERROR;
                                result[ERROR] = message;
                                return result;
                            }
                            function transform(config, win, http, processRedirect, request, response) {
                                var handleSessionId = function handleSessionId(res) {
                                    return saveSessionId$1(setSessionId, res);
                                };
                                var handleDeviceId = function handleDeviceId(res) {
                                    return saveDeviceId(setDeviceId, res);
                                };
                                var handleEdgeCluster = function handleEdgeCluster(res) {
                                    return saveEdgeCluster(setEdgeCluster, res);
                                };
                                var handleTrace = function handleTrace(res) {
                                    return saveTrace$1(win, res);
                                };
                                var handleDisabled = function handleDisabled(res) {
                                    return saveDisabled(config, setCookie, res);
                                };
                                var handleOffers = function handleOffers(res) {
                                    return processOffers(win, http, processRedirect, request, res);
                                };
                                return flow([
                                    handleSessionId,
                                    handleDeviceId,
                                    handleEdgeCluster,
                                    handleTrace,
                                    handleError,
                                    handleDisabled,
                                    handleOffers
                                ])(response);
                            }
                            function createHeaders() {
                                var result = {};
                                result[CONTENT_TYPE_HEADER] = [FORM_URL_ENCODED];
                                return result;
                            }
                            function createAjaxOptions(config, request) {
                                var crossDomainOnly = config[CROSS_DOMAIN_ONLY];
                                var urlSizeLimit = config[URL_SIZE_LIMIT];
                                var url = request[URL$1];
                                var data = request[DATA$1];
                                var urlAndQs = url + "?" + data;
                                var result = {};
                                result[CREDENTIALS] = true;
                                result[METHOD] = GET;
                                result[TIMEOUT$1] = request[TIMEOUT$1];
                                result[URL$1] = urlAndQs;
                                if (crossDomainOnly) {
                                    return result;
                                }
                                if (urlAndQs.length > urlSizeLimit) {
                                    result[METHOD] = POST;
                                    result[URL$1] = url;
                                    result[HEADERS] = createHeaders();
                                    result[DATA$1] = data;
                                    return result;
                                }
                                return result;
                            }
                            function processAjaxResponse(resObj) {
                                var status = resObj[STATUS];
                                if (!isSuccess$1(status)) {
                                    return createError$1(ERROR_UNKNOWN);
                                }
                                try {
                                    return JSON.parse(resObj[RESPONSE]);
                                } catch (e) {
                                    return createError$1(e.message || JSON_ERROR);
                                }
                            }
                            function executeAjax(win, config, http, request) {
                                var buildOptions = function buildOptions(req) {
                                    return createAjaxOptions(config, req);
                                };
                                var processRedirect = function processRedirect(action) {
                                    return handleRedirect(win, getSessionId, action);
                                };
                                var transformResponse = function transformResponse(res) {
                                    return transform(
                                        config,
                                        win,
                                        http,
                                        processRedirect,
                                        request,
                                        processAjaxResponse(res)
                                    );
                                };
                                return createAsyncRequestDetails(config, request)
                                    .then(buildOptions)
                                    .then(http)
                                    .then(transformResponse);
                            }

                            function ajax(request) {
                                var config = getConfig();
                                return executeAjax(window$1, config, xhr, request);
                            }
                            function createSyncRequest(request) {
                                var config = getConfig();
                                return createSyncRequestDetails(config, request);
                            }

                            var GET_OFFER = "[getOffer()]";
                            function getErrorMessage(err) {
                                if (isObject(err) && isNotBlank(err[ERROR])) {
                                    return err[ERROR];
                                }
                                if (isObject(err) && isNotBlank(err[MESSAGE])) {
                                    return err[MESSAGE];
                                }
                                if (isNotBlank(err)) {
                                    return err;
                                }
                                return ERROR_UNKNOWN;
                            }
                            function createRequest(config, options) {
                                var mbox = options[MBOX];
                                var params = isObject(options[PARAMS]) ? options[PARAMS] : {};
                                var timeout = options[TIMEOUT];
                                var request = {};
                                request[MBOX] = mbox;
                                request[PARAMS] = assign({}, getMboxParameters(mbox), params);
                                request[TIMEOUT] =
                                    isNumber(timeout) && timeout >= 0 ? timeout : config[TIMEOUT];
                                return request;
                            }
                            function handleRequestSuccess(requestSucceeded, options, response) {
                                var actions = response[ACTIONS];
                                var payload = {};
                                payload[MBOX] = options[MBOX];
                                payload[RESPONSE_TOKENS] = response[RESPONSE_TOKENS];
                                logDebug(GET_OFFER, ACTIONS_TO_BE_RENDERED, actions);
                                options[SUCCESS](actions);
                                requestSucceeded(payload, actions);
                            }
                            function handleRequestError(requestFailed, options, error) {
                                var status = error[STATUS] || UNKNOWN;
                                var message = getErrorMessage(error);
                                var payload = {};
                                payload[MBOX] = options[MBOX];
                                payload[MESSAGE] = message;
                                logWarn(GET_OFFER, REQUEST_FAILED, error);
                                options[ERROR](status, message);
                                requestFailed(payload);
                            }
                            function executeGeOffer(
                                isDeliveryEnabled,
                                validateGetOfferOptions,
                                ajax,
                                requestStart,
                                requestSucceeded,
                                requestFailed,
                                config,
                                options
                            ) {
                                var validationResult = validateGetOfferOptions(options);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(GET_OFFER, validationError);
                                    return;
                                }
                                if (!isDeliveryEnabled()) {
                                    delay(options[ERROR](WARNING, DELIVERY_DISABLED));
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                var payload = {};
                                payload[MBOX] = options[MBOX];
                                var successFunc = function successFunc(response) {
                                    return handleRequestSuccess(requestSucceeded, options, response);
                                };
                                var errorFunc = function errorFunc(error) {
                                    return handleRequestError(requestFailed, options, error);
                                };
                                requestStart(payload);
                                ajax(createRequest(config, options))
                                    .then(successFunc)
                                    ["catch"](errorFunc);
                            }

                            function getOffer(options) {
                                executeGeOffer(
                                    isDeliveryEnabled,
                                    validateGetOfferOptions,
                                    ajax,
                                    notifyRequestStart,
                                    notifyRequestSucceeded,
                                    notifyRequestFailed,
                                    getConfig(),
                                    options
                                );
                            }

                            var $ = (function(window) {
                                var Zepto = (function() {
                                    var undefined,
                                        key,
                                        $,
                                        classList,
                                        emptyArray = [],
                                        _concat = emptyArray.concat,
                                        _filter = emptyArray.filter,
                                        _slice = emptyArray.slice,
                                        document = window.document,
                                        elementDisplay = {},
                                        classCache = {},
                                        cssNumber = {
                                            "column-count": 1,
                                            columns: 1,
                                            "font-weight": 1,
                                            "line-height": 1,
                                            opacity: 1,
                                            "z-index": 1,
                                            zoom: 1
                                        },
                                        fragmentRE = /^\s*<(\w+|!)[^>]*>/,
                                        singleTagRE = /^<(\w+)\s*\/?>(?:<\/\1>|)$/,
                                        tagExpanderRE = /<(?!area|br|col|embed|hr|img|input|link|meta|param)(([\w:]+)[^>]*)\/>/gi,
                                        rootNodeRE = /^(?:body|html)$/i,
                                        capitalRE = /([A-Z])/g,
                                        methodAttributes = [
                                            "val",
                                            "css",
                                            "html",
                                            "text",
                                            "data",
                                            "width",
                                            "height",
                                            "offset"
                                        ],
                                        adjacencyOperators = ["after", "prepend", "before", "append"],
                                        table = document.createElement("table"),
                                        tableRow = document.createElement("tr"),
                                        containers = {
                                            tr: document.createElement("tbody"),
                                            tbody: table,
                                            thead: table,
                                            tfoot: table,
                                            td: tableRow,
                                            th: tableRow,
                                            "*": document.createElement("div")
                                        },
                                        readyRE = /complete|loaded|interactive/,
                                        simpleSelectorRE = /^[\w-]*$/,
                                        class2type = {},
                                        toString = class2type.toString,
                                        zepto = {},
                                        camelize,
                                        uniq,
                                        tempParent = document.createElement("div"),
                                        propMap = {
                                            tabindex: "tabIndex",
                                            readonly: "readOnly",
                                            for: "htmlFor",
                                            class: "className",
                                            maxlength: "maxLength",
                                            cellspacing: "cellSpacing",
                                            cellpadding: "cellPadding",
                                            rowspan: "rowSpan",
                                            colspan: "colSpan",
                                            usemap: "useMap",
                                            frameborder: "frameBorder",
                                            contenteditable: "contentEditable"
                                        },
                                        isArray =
                                            Array.isArray ||
                                            function(object) {
                                                return object instanceof Array;
                                            };
                                    zepto.matches = function(element, selector) {
                                        if (!selector || !element || element.nodeType !== 1) return false;
                                        var matchesSelector =
                                            element.matches ||
                                            element.webkitMatchesSelector ||
                                            element.mozMatchesSelector ||
                                            element.oMatchesSelector ||
                                            element.matchesSelector;
                                        if (matchesSelector) return matchesSelector.call(element, selector);
                                        var match,
                                            parent = element.parentNode,
                                            temp = !parent;
                                        if (temp) (parent = tempParent).appendChild(element);
                                        match = ~zepto.qsa(parent, selector).indexOf(element);
                                        temp && tempParent.removeChild(element);
                                        return match;
                                    };
                                    function type(obj) {
                                        return obj == null
                                            ? String(obj)
                                            : class2type[toString.call(obj)] || "object";
                                    }
                                    function isFunction(value) {
                                        return type(value) == "function";
                                    }
                                    function isWindow(obj) {
                                        return obj != null && obj == obj.window;
                                    }
                                    function isDocument(obj) {
                                        return obj != null && obj.nodeType == obj.DOCUMENT_NODE;
                                    }
                                    function isObject(obj) {
                                        return type(obj) == "object";
                                    }
                                    function isPlainObject(obj) {
                                        return (
                                            isObject(obj) &&
                                            !isWindow(obj) &&
                                            Object.getPrototypeOf(obj) == Object.prototype
                                        );
                                    }
                                    function likeArray(obj) {
                                        var length = !!obj && "length" in obj && obj.length,
                                            type = $.type(obj);
                                        return (
                                            "function" != type &&
                                            !isWindow(obj) &&
                                            ("array" == type ||
                                                length === 0 ||
                                                (typeof length == "number" && length > 0 && length - 1 in obj))
                                        );
                                    }
                                    function compact(array) {
                                        return _filter.call(array, function(item) {
                                            return item != null;
                                        });
                                    }
                                    function flatten(array) {
                                        return array.length > 0 ? $.fn.concat.apply([], array) : array;
                                    }
                                    camelize = function camelize(str) {
                                        return str.replace(/-+(.)?/g, function(match, chr) {
                                            return chr ? chr.toUpperCase() : "";
                                        });
                                    };
                                    function dasherize(str) {
                                        return str
                                            .replace(/::/g, "/")
                                            .replace(/([A-Z]+)([A-Z][a-z])/g, "$1_$2")
                                            .replace(/([a-z\d])([A-Z])/g, "$1_$2")
                                            .replace(/_/g, "-")
                                            .toLowerCase();
                                    }
                                    uniq = function uniq(array) {
                                        return _filter.call(array, function(item, idx) {
                                            return array.indexOf(item) == idx;
                                        });
                                    };
                                    function classRE(name) {
                                        return name in classCache
                                            ? classCache[name]
                                            : (classCache[name] = new RegExp("(^|\\s)" + name + "(\\s|$)"));
                                    }
                                    function maybeAddPx(name, value) {
                                        return typeof value == "number" && !cssNumber[dasherize(name)]
                                            ? value + "px"
                                            : value;
                                    }
                                    function defaultDisplay(nodeName) {
                                        var element, display;
                                        if (!elementDisplay[nodeName]) {
                                            element = document.createElement(nodeName);
                                            document.body.appendChild(element);
                                            display = getComputedStyle(element, "").getPropertyValue("display");
                                            element.parentNode.removeChild(element);
                                            display == "none" && (display = "block");
                                            elementDisplay[nodeName] = display;
                                        }
                                        return elementDisplay[nodeName];
                                    }
                                    function _children(element) {
                                        return "children" in element
                                            ? _slice.call(element.children)
                                            : $.map(element.childNodes, function(node) {
                                                if (node.nodeType == 1) return node;
                                            });
                                    }
                                    function Z(dom, selector) {
                                        var i,
                                            len = dom ? dom.length : 0;
                                        for (i = 0; i < len; i++) {
                                            this[i] = dom[i];
                                        }
                                        this.length = len;
                                        this.selector = selector || "";
                                    }
                                    zepto.fragment = function(html, name, properties) {
                                        var dom, nodes, container;
                                        if (singleTagRE.test(html)) dom = $(document.createElement(RegExp.$1));
                                        if (!dom) {
                                            if (html.replace) html = html.replace(tagExpanderRE, "<$1></$2>");
                                            if (name === undefined) name = fragmentRE.test(html) && RegExp.$1;
                                            if (!(name in containers)) name = "*";
                                            container = containers[name];
                                            container.innerHTML = "" + html;
                                            dom = $.each(_slice.call(container.childNodes), function() {
                                                container.removeChild(this);
                                            });
                                        }
                                        if (isPlainObject(properties)) {
                                            nodes = $(dom);
                                            $.each(properties, function(key, value) {
                                                if (methodAttributes.indexOf(key) > -1) nodes[key](value);
                                                else nodes.attr(key, value);
                                            });
                                        }
                                        return dom;
                                    };
                                    zepto.Z = function(dom, selector) {
                                        return new Z(dom, selector);
                                    };
                                    zepto.isZ = function(object) {
                                        return object instanceof zepto.Z;
                                    };
                                    zepto.init = function(selector, context) {
                                        var dom;
                                        if (!selector) return zepto.Z();
                                        else if (typeof selector == "string") {
                                            selector = selector.trim();
                                            if (selector[0] == "<" && fragmentRE.test(selector))
                                                (dom = zepto.fragment(selector, RegExp.$1, context)),
                                                    (selector = null);
                                            else if (context !== undefined) return $(context).find(selector);
                                            else dom = zepto.qsa(document, selector);
                                        } else if (isFunction(selector)) return $(document).ready(selector);
                                        else if (zepto.isZ(selector)) return selector;
                                        else {
                                            if (isArray(selector)) dom = compact(selector);
                                            else if (isObject(selector)) (dom = [selector]), (selector = null);
                                            else if (fragmentRE.test(selector))
                                                (dom = zepto.fragment(selector.trim(), RegExp.$1, context)),
                                                    (selector = null);
                                            else if (context !== undefined) return $(context).find(selector);
                                            else dom = zepto.qsa(document, selector);
                                        }
                                        return zepto.Z(dom, selector);
                                    };
                                    $ = function $(selector, context) {
                                        return zepto.init(selector, context);
                                    };
                                    function extend(target, source, deep) {
                                        for (key in source) {
                                            if (deep && (isPlainObject(source[key]) || isArray(source[key]))) {
                                                if (isPlainObject(source[key]) && !isPlainObject(target[key]))
                                                    target[key] = {};
                                                if (isArray(source[key]) && !isArray(target[key])) target[key] = [];
                                                extend(target[key], source[key], deep);
                                            } else if (source[key] !== undefined) target[key] = source[key];
                                        }
                                    }
                                    $.extend = function(target) {
                                        var deep,
                                            args = _slice.call(arguments, 1);
                                        if (typeof target == "boolean") {
                                            deep = target;
                                            target = args.shift();
                                        }
                                        args.forEach(function(arg) {
                                            extend(target, arg, deep);
                                        });
                                        return target;
                                    };
                                    zepto.qsa = function(element, selector) {
                                        var found,
                                            maybeID = selector[0] == "#",
                                            maybeClass = !maybeID && selector[0] == ".",
                                            nameOnly = maybeID || maybeClass ? selector.slice(1) : selector,
                                            isSimple = simpleSelectorRE.test(nameOnly);
                                        return element.getElementById && isSimple && maybeID
                                            ? (found = element.getElementById(nameOnly)) ? [found] : []
                                            : element.nodeType !== 1 &&
                                            element.nodeType !== 9 &&
                                            element.nodeType !== 11
                                                ? []
                                                : _slice.call(
                                                    isSimple && !maybeID && element.getElementsByClassName
                                                        ? maybeClass
                                                        ? element.getElementsByClassName(nameOnly)
                                                        : element.getElementsByTagName(selector)
                                                        : element.querySelectorAll(selector)
                                                );
                                    };
                                    function filtered(nodes, selector) {
                                        return selector == null ? $(nodes) : $(nodes).filter(selector);
                                    }
                                    $.contains = document.documentElement.contains
                                        ? function(parent, node) {
                                            return parent !== node && parent.contains(node);
                                        }
                                        : function(parent, node) {
                                            while (node && (node = node.parentNode)) {
                                                if (node === parent) return true;
                                            }
                                            return false;
                                        };
                                    function funcArg(context, arg, idx, payload) {
                                        return isFunction(arg) ? arg.call(context, idx, payload) : arg;
                                    }
                                    function setAttribute(node, name, value) {
                                        value == null
                                            ? node.removeAttribute(name)
                                            : node.setAttribute(name, value);
                                    }
                                    function className(node, value) {
                                        var klass = node.className || "",
                                            svg = klass && klass.baseVal !== undefined;
                                        if (value === undefined) return svg ? klass.baseVal : klass;
                                        svg ? (klass.baseVal = value) : (node.className = value);
                                    }
                                    function deserializeValue(value) {
                                        try {
                                            return value
                                                ? value == "true" ||
                                                (value == "false"
                                                    ? false
                                                    : value == "null"
                                                        ? null
                                                        : +value + "" == value
                                                            ? +value
                                                            : /^[\[\{]/.test(value) ? $.parseJSON(value) : value)
                                                : value;
                                        } catch (e) {
                                            return value;
                                        }
                                    }
                                    $.type = type;
                                    $.isFunction = isFunction;
                                    $.isWindow = isWindow;
                                    $.isArray = isArray;
                                    $.isPlainObject = isPlainObject;
                                    $.isEmptyObject = function(obj) {
                                        var name;
                                        for (name in obj) {
                                            return false;
                                        }
                                        return true;
                                    };
                                    $.isNumeric = function(val) {
                                        var num = Number(val),
                                            type = typeof val === "undefined" ? "undefined" : _typeof(val);
                                        return (
                                            (val != null &&
                                                type != "boolean" &&
                                                (type != "string" || val.length) &&
                                                !isNaN(num) &&
                                                isFinite(num)) ||
                                            false
                                        );
                                    };
                                    $.inArray = function(elem, array, i) {
                                        return emptyArray.indexOf.call(array, elem, i);
                                    };
                                    $.camelCase = camelize;
                                    $.trim = function(str) {
                                        return str == null ? "" : String.prototype.trim.call(str);
                                    };
                                    $.uuid = 0;
                                    $.support = {};
                                    $.expr = {};
                                    $.noop = function() {};
                                    $.map = function(elements, callback) {
                                        var value,
                                            values = [],
                                            i,
                                            key;
                                        if (likeArray(elements))
                                            for (i = 0; i < elements.length; i++) {
                                                value = callback(elements[i], i);
                                                if (value != null) values.push(value);
                                            }
                                        else
                                            for (key in elements) {
                                                value = callback(elements[key], key);
                                                if (value != null) values.push(value);
                                            }
                                        return flatten(values);
                                    };
                                    $.each = function(elements, callback) {
                                        var i, key;
                                        if (likeArray(elements)) {
                                            for (i = 0; i < elements.length; i++) {
                                                if (callback.call(elements[i], i, elements[i]) === false)
                                                    return elements;
                                            }
                                        } else {
                                            for (key in elements) {
                                                if (callback.call(elements[key], key, elements[key]) === false)
                                                    return elements;
                                            }
                                        }
                                        return elements;
                                    };
                                    $.grep = function(elements, callback) {
                                        return _filter.call(elements, callback);
                                    };
                                    if (window.JSON) $.parseJSON = JSON.parse;
                                    $.each(
                                        "Boolean Number String Function Array Date RegExp Object Error".split(
                                            " "
                                        ),
                                        function(i, name) {
                                            class2type["[object " + name + "]"] = name.toLowerCase();
                                        }
                                    );
                                    $.fn = {
                                        constructor: zepto.Z,
                                        length: 0,
                                        forEach: emptyArray.forEach,
                                        reduce: emptyArray.reduce,
                                        push: emptyArray.push,
                                        sort: emptyArray.sort,
                                        splice: emptyArray.splice,
                                        indexOf: emptyArray.indexOf,
                                        concat: function concat() {
                                            var i,
                                                value,
                                                args = [];
                                            for (i = 0; i < arguments.length; i++) {
                                                value = arguments[i];
                                                args[i] = zepto.isZ(value) ? value.toArray() : value;
                                            }
                                            return _concat.apply(zepto.isZ(this) ? this.toArray() : this, args);
                                        },
                                        map: function map(fn) {
                                            return $(
                                                $.map(this, function(el, i) {
                                                    return fn.call(el, i, el);
                                                })
                                            );
                                        },
                                        slice: function slice() {
                                            return $(_slice.apply(this, arguments));
                                        },
                                        ready: function ready(callback) {
                                            if (readyRE.test(document.readyState) && document.body) callback($);
                                            else
                                                document.addEventListener(
                                                    "DOMContentLoaded",
                                                    function() {
                                                        callback($);
                                                    },
                                                    false
                                                );
                                            return this;
                                        },
                                        get: function get$$1(idx) {
                                            return idx === undefined
                                                ? _slice.call(this)
                                                : this[idx >= 0 ? idx : idx + this.length];
                                        },
                                        toArray: function toArray$$1() {
                                            return this.get();
                                        },
                                        size: function size() {
                                            return this.length;
                                        },
                                        remove: function remove() {
                                            return this.each(function() {
                                                if (this.parentNode != null) this.parentNode.removeChild(this);
                                            });
                                        },
                                        each: function each(callback) {
                                            var len = this.length,
                                                idx = 0,
                                                el;
                                            while (idx < len) {
                                                el = this[idx];
                                                if (callback.call(el, idx, el) === false) {
                                                    break;
                                                }
                                                idx++;
                                            }
                                            return this;
                                        },
                                        filter: function filter(selector) {
                                            if (isFunction(selector)) return this.not(this.not(selector));
                                            return $(
                                                _filter.call(this, function(element) {
                                                    return zepto.matches(element, selector);
                                                })
                                            );
                                        },
                                        add: function add(selector, context) {
                                            return $(uniq(this.concat($(selector, context))));
                                        },
                                        is: function is(selector) {
                                            return this.length > 0 && zepto.matches(this[0], selector);
                                        },
                                        not: function not(selector) {
                                            var nodes = [];
                                            if (isFunction(selector) && selector.call !== undefined)
                                                this.each(function(idx) {
                                                    if (!selector.call(this, idx)) nodes.push(this);
                                                });
                                            else {
                                                var excludes =
                                                    typeof selector == "string"
                                                        ? this.filter(selector)
                                                        : likeArray(selector) && isFunction(selector.item)
                                                        ? _slice.call(selector)
                                                        : $(selector);
                                                this.forEach(function(el) {
                                                    if (excludes.indexOf(el) < 0) nodes.push(el);
                                                });
                                            }
                                            return $(nodes);
                                        },
                                        has: function has(selector) {
                                            return this.filter(function() {
                                                return isObject(selector)
                                                    ? $.contains(this, selector)
                                                    : $(this)
                                                        .find(selector)
                                                        .size();
                                            });
                                        },
                                        eq: function eq(idx) {
                                            return idx === -1 ? this.slice(idx) : this.slice(idx, +idx + 1);
                                        },
                                        first: function first() {
                                            var el = this[0];
                                            return el && !isObject(el) ? el : $(el);
                                        },
                                        last: function last() {
                                            var el = this[this.length - 1];
                                            return el && !isObject(el) ? el : $(el);
                                        },
                                        find: function find(selector) {
                                            var result,
                                                $this = this;
                                            if (!selector) result = $();
                                            else if (
                                                (typeof selector === "undefined" ? "undefined" : _typeof(selector)) ==
                                                "object"
                                            )
                                                result = $(selector).filter(function() {
                                                    var node = this;
                                                    return emptyArray.some.call($this, function(parent) {
                                                        return $.contains(parent, node);
                                                    });
                                                });
                                            else if (this.length == 1) result = $(zepto.qsa(this[0], selector));
                                            else
                                                result = this.map(function() {
                                                    return zepto.qsa(this, selector);
                                                });
                                            return result;
                                        },
                                        closest: function closest(selector, context) {
                                            var nodes = [],
                                                collection =
                                                    (typeof selector === "undefined"
                                                        ? "undefined"
                                                        : _typeof(selector)) == "object" && $(selector);
                                            this.each(function(_, node) {
                                                while (
                                                    node &&
                                                    !(collection
                                                        ? collection.indexOf(node) >= 0
                                                        : zepto.matches(node, selector))
                                                    ) {
                                                    node = node !== context && !isDocument(node) && node.parentNode;
                                                }
                                                if (node && nodes.indexOf(node) < 0) nodes.push(node);
                                            });
                                            return $(nodes);
                                        },
                                        parents: function parents(selector) {
                                            var ancestors = [],
                                                nodes = this;
                                            while (nodes.length > 0) {
                                                nodes = $.map(nodes, function(node) {
                                                    if (
                                                        (node = node.parentNode) &&
                                                        !isDocument(node) &&
                                                        ancestors.indexOf(node) < 0
                                                    ) {
                                                        ancestors.push(node);
                                                        return node;
                                                    }
                                                });
                                            }
                                            return filtered(ancestors, selector);
                                        },
                                        parent: function parent(selector) {
                                            return filtered(uniq(this.pluck("parentNode")), selector);
                                        },
                                        children: function children(selector) {
                                            return filtered(
                                                this.map(function() {
                                                    return _children(this);
                                                }),
                                                selector
                                            );
                                        },
                                        contents: function contents() {
                                            return this.map(function() {
                                                return this.contentDocument || _slice.call(this.childNodes);
                                            });
                                        },
                                        siblings: function siblings(selector) {
                                            return filtered(
                                                this.map(function(i, el) {
                                                    return _filter.call(_children(el.parentNode), function(child) {
                                                        return child !== el;
                                                    });
                                                }),
                                                selector
                                            );
                                        },
                                        empty: function empty() {
                                            return this.each(function() {
                                                this.innerHTML = "";
                                            });
                                        },
                                        pluck: function pluck(property) {
                                            return $.map(this, function(el) {
                                                return el[property];
                                            });
                                        },
                                        show: function show() {
                                            return this.each(function() {
                                                this.style.display == "none" && (this.style.display = "");
                                                if (getComputedStyle(this, "").getPropertyValue("display") == "none")
                                                    this.style.display = defaultDisplay(this.nodeName);
                                            });
                                        },
                                        replaceWith: function replaceWith(newContent) {
                                            return this.before(newContent).remove();
                                        },
                                        wrap: function wrap(structure) {
                                            var func = isFunction(structure);
                                            if (this[0] && !func)
                                                var dom = $(structure).get(0),
                                                    clone = dom.parentNode || this.length > 1;
                                            return this.each(function(index) {
                                                $(this).wrapAll(
                                                    func
                                                        ? structure.call(this, index)
                                                        : clone ? dom.cloneNode(true) : dom
                                                );
                                            });
                                        },
                                        wrapAll: function wrapAll(structure) {
                                            if (this[0]) {
                                                $(this[0]).before((structure = $(structure)));
                                                var children;
                                                while ((children = structure.children()).length) {
                                                    structure = children.first();
                                                }
                                                $(structure).append(this);
                                            }
                                            return this;
                                        },
                                        wrapInner: function wrapInner(structure) {
                                            var func = isFunction(structure);
                                            return this.each(function(index) {
                                                var self = $(this),
                                                    contents = self.contents(),
                                                    dom = func ? structure.call(this, index) : structure;
                                                contents.length ? contents.wrapAll(dom) : self.append(dom);
                                            });
                                        },
                                        unwrap: function unwrap() {
                                            this.parent().each(function() {
                                                $(this).replaceWith($(this).children());
                                            });
                                            return this;
                                        },
                                        clone: function clone() {
                                            return this.map(function() {
                                                return this.cloneNode(true);
                                            });
                                        },
                                        hide: function hide() {
                                            return this.css("display", "none");
                                        },
                                        toggle: function toggle(setting) {
                                            return this.each(function() {
                                                var el = $(this);
                                                (setting === undefined ? el.css("display") == "none" : setting)
                                                    ? el.show()
                                                    : el.hide();
                                            });
                                        },
                                        prev: function prev(selector) {
                                            return $(this.pluck("previousElementSibling")).filter(selector || "*");
                                        },
                                        next: function next(selector) {
                                            return $(this.pluck("nextElementSibling")).filter(selector || "*");
                                        },
                                        html: function html(_html) {
                                            return 0 in arguments
                                                ? this.each(function(idx) {
                                                    var originHtml = this.innerHTML;
                                                    $(this)
                                                        .empty()
                                                        .append(funcArg(this, _html, idx, originHtml));
                                                })
                                                : 0 in this ? this[0].innerHTML : null;
                                        },
                                        text: function text(_text) {
                                            return 0 in arguments
                                                ? this.each(function(idx) {
                                                    var newText = funcArg(this, _text, idx, this.textContent);
                                                    this.textContent = newText == null ? "" : "" + newText;
                                                })
                                                : 0 in this ? this.pluck("textContent").join("") : null;
                                        },
                                        attr: function attr(name, value) {
                                            var result;
                                            return typeof name == "string" && !(1 in arguments)
                                                ? 0 in this &&
                                                this[0].nodeType == 1 &&
                                                (result = this[0].getAttribute(name)) != null
                                                    ? result
                                                    : undefined
                                                : this.each(function(idx) {
                                                    if (this.nodeType !== 1) return;
                                                    if (isObject(name))
                                                        for (key in name) {
                                                            setAttribute(this, key, name[key]);
                                                        }
                                                    else
                                                        setAttribute(
                                                            this,
                                                            name,
                                                            funcArg(this, value, idx, this.getAttribute(name))
                                                        );
                                                });
                                        },
                                        removeAttr: function removeAttr(name) {
                                            return this.each(function() {
                                                this.nodeType === 1 &&
                                                name.split(" ").forEach(function(attribute) {
                                                    setAttribute(this, attribute);
                                                }, this);
                                            });
                                        },
                                        prop: function prop(name, value) {
                                            name = propMap[name] || name;
                                            return 1 in arguments
                                                ? this.each(function(idx) {
                                                    this[name] = funcArg(this, value, idx, this[name]);
                                                })
                                                : this[0] && this[0][name];
                                        },
                                        removeProp: function removeProp(name) {
                                            name = propMap[name] || name;
                                            return this.each(function() {
                                                delete this[name];
                                            });
                                        },
                                        data: function data(name, value) {
                                            var attrName = "data-" + name.replace(capitalRE, "-$1").toLowerCase();
                                            var data =
                                                1 in arguments ? this.attr(attrName, value) : this.attr(attrName);
                                            return data !== null ? deserializeValue(data) : undefined;
                                        },
                                        val: function val(value) {
                                            if (0 in arguments) {
                                                if (value == null) value = "";
                                                return this.each(function(idx) {
                                                    this.value = funcArg(this, value, idx, this.value);
                                                });
                                            } else {
                                                return (
                                                    this[0] &&
                                                    (this[0].multiple
                                                        ? $(this[0])
                                                            .find("option")
                                                            .filter(function() {
                                                                return this.selected;
                                                            })
                                                            .pluck("value")
                                                        : this[0].value)
                                                );
                                            }
                                        },
                                        offset: function offset(coordinates) {
                                            if (coordinates)
                                                return this.each(function(index) {
                                                    var $this = $(this),
                                                        coords = funcArg(this, coordinates, index, $this.offset()),
                                                        parentOffset = $this.offsetParent().offset(),
                                                        props = {
                                                            top: coords.top - parentOffset.top,
                                                            left: coords.left - parentOffset.left
                                                        };
                                                    if ($this.css("position") == "static")
                                                        props["position"] = "relative";
                                                    $this.css(props);
                                                });
                                            if (!this.length) return null;
                                            if (
                                                document.documentElement !== this[0] &&
                                                !$.contains(document.documentElement, this[0])
                                            )
                                                return { top: 0, left: 0 };
                                            var obj = this[0].getBoundingClientRect();
                                            return {
                                                left: obj.left + window.pageXOffset,
                                                top: obj.top + window.pageYOffset,
                                                width: Math.round(obj.width),
                                                height: Math.round(obj.height)
                                            };
                                        },
                                        css: function css(property, value) {
                                            if (arguments.length < 2) {
                                                var element = this[0];
                                                if (typeof property == "string") {
                                                    if (!element) return;
                                                    return (
                                                        element.style[camelize(property)] ||
                                                        getComputedStyle(element, "").getPropertyValue(property)
                                                    );
                                                } else if (isArray(property)) {
                                                    if (!element) return;
                                                    var props = {};
                                                    var computedStyle = getComputedStyle(element, "");
                                                    $.each(property, function(_, prop) {
                                                        props[prop] =
                                                            element.style[camelize(prop)] ||
                                                            computedStyle.getPropertyValue(prop);
                                                    });
                                                    return props;
                                                }
                                            }
                                            var css = "";
                                            if (type(property) == "string") {
                                                if (!value && value !== 0)
                                                    this.each(function() {
                                                        this.style.removeProperty(dasherize(property));
                                                    });
                                                else css = dasherize(property) + ":" + maybeAddPx(property, value);
                                            } else {
                                                for (key in property) {
                                                    if (!property[key] && property[key] !== 0)
                                                        this.each(function() {
                                                            this.style.removeProperty(dasherize(key));
                                                        });
                                                    else
                                                        css +=
                                                            dasherize(key) + ":" + maybeAddPx(key, property[key]) + ";";
                                                }
                                            }
                                            return this.each(function() {
                                                this.style.cssText += ";" + css;
                                            });
                                        },
                                        index: function index(element) {
                                            return element
                                                ? this.indexOf($(element)[0])
                                                : this.parent()
                                                    .children()
                                                    .indexOf(this[0]);
                                        },
                                        hasClass: function hasClass(name) {
                                            if (!name) return false;
                                            return emptyArray.some.call(
                                                this,
                                                function(el) {
                                                    return this.test(className(el));
                                                },
                                                classRE(name)
                                            );
                                        },
                                        addClass: function addClass(name) {
                                            if (!name) return this;
                                            return this.each(function(idx) {
                                                if (!("className" in this)) return;
                                                classList = [];
                                                var cls = className(this),
                                                    newName = funcArg(this, name, idx, cls);
                                                newName.split(/\s+/g).forEach(function(klass) {
                                                    if (!$(this).hasClass(klass)) classList.push(klass);
                                                }, this);
                                                classList.length &&
                                                className(this, cls + (cls ? " " : "") + classList.join(" "));
                                            });
                                        },
                                        removeClass: function removeClass(name) {
                                            return this.each(function(idx) {
                                                if (!("className" in this)) return;
                                                if (name === undefined) return className(this, "");
                                                classList = className(this);
                                                funcArg(this, name, idx, classList)
                                                    .split(/\s+/g)
                                                    .forEach(function(klass) {
                                                        classList = classList.replace(classRE(klass), " ");
                                                    });
                                                className(this, classList.trim());
                                            });
                                        },
                                        toggleClass: function toggleClass(name, when) {
                                            if (!name) return this;
                                            return this.each(function(idx) {
                                                var $this = $(this),
                                                    names = funcArg(this, name, idx, className(this));
                                                names.split(/\s+/g).forEach(function(klass) {
                                                    (when === undefined ? !$this.hasClass(klass) : when)
                                                        ? $this.addClass(klass)
                                                        : $this.removeClass(klass);
                                                });
                                            });
                                        },
                                        scrollTop: function scrollTop(value) {
                                            if (!this.length) return;
                                            var hasScrollTop = "scrollTop" in this[0];
                                            if (value === undefined)
                                                return hasScrollTop ? this[0].scrollTop : this[0].pageYOffset;
                                            return this.each(
                                                hasScrollTop
                                                    ? function() {
                                                        this.scrollTop = value;
                                                    }
                                                    : function() {
                                                        this.scrollTo(this.scrollX, value);
                                                    }
                                            );
                                        },
                                        scrollLeft: function scrollLeft(value) {
                                            if (!this.length) return;
                                            var hasScrollLeft = "scrollLeft" in this[0];
                                            if (value === undefined)
                                                return hasScrollLeft ? this[0].scrollLeft : this[0].pageXOffset;
                                            return this.each(
                                                hasScrollLeft
                                                    ? function() {
                                                        this.scrollLeft = value;
                                                    }
                                                    : function() {
                                                        this.scrollTo(value, this.scrollY);
                                                    }
                                            );
                                        },
                                        position: function position() {
                                            if (!this.length) return;
                                            var elem = this[0],
                                                offsetParent = this.offsetParent(),
                                                offset = this.offset(),
                                                parentOffset = rootNodeRE.test(offsetParent[0].nodeName)
                                                    ? { top: 0, left: 0 }
                                                    : offsetParent.offset();
                                            offset.top -= parseFloat($(elem).css("margin-top")) || 0;
                                            offset.left -= parseFloat($(elem).css("margin-left")) || 0;
                                            parentOffset.top +=
                                                parseFloat($(offsetParent[0]).css("border-top-width")) || 0;
                                            parentOffset.left +=
                                                parseFloat($(offsetParent[0]).css("border-left-width")) || 0;
                                            return {
                                                top: offset.top - parentOffset.top,
                                                left: offset.left - parentOffset.left
                                            };
                                        },
                                        offsetParent: function offsetParent() {
                                            return this.map(function() {
                                                var parent = this.offsetParent || document.body;
                                                while (
                                                    parent &&
                                                    !rootNodeRE.test(parent.nodeName) &&
                                                    $(parent).css("position") == "static"
                                                    ) {
                                                    parent = parent.offsetParent;
                                                }
                                                return parent;
                                            });
                                        }
                                    };
                                    $.fn.detach = $.fn.remove;
                                    ["width", "height"].forEach(function(dimension) {
                                        var dimensionProperty = dimension.replace(/./, function(m) {
                                            return m[0].toUpperCase();
                                        });
                                        $.fn[dimension] = function(value) {
                                            var offset,
                                                el = this[0];
                                            if (value === undefined)
                                                return isWindow(el)
                                                    ? el["inner" + dimensionProperty]
                                                    : isDocument(el)
                                                        ? el.documentElement["scroll" + dimensionProperty]
                                                        : (offset = this.offset()) && offset[dimension];
                                            else
                                                return this.each(function(idx) {
                                                    el = $(this);
                                                    el.css(dimension, funcArg(this, value, idx, el[dimension]()));
                                                });
                                        };
                                    });
                                    function traverseNode(node, fun) {
                                        fun(node);
                                        for (var i = 0, len = node.childNodes.length; i < len; i++) {
                                            traverseNode(node.childNodes[i], fun);
                                        }
                                    }
                                    adjacencyOperators.forEach(function(operator, operatorIndex) {
                                        var inside = operatorIndex % 2;
                                        $.fn[operator] = function() {
                                            var argType,
                                                nodes = $.map(arguments, function(arg) {
                                                    var arr = [];
                                                    argType = type(arg);
                                                    if (argType == "array") {
                                                        arg.forEach(function(el) {
                                                            if (el.nodeType !== undefined) return arr.push(el);
                                                            else if ($.zepto.isZ(el)) return (arr = arr.concat(el.get()));
                                                            arr = arr.concat(zepto.fragment(el));
                                                        });
                                                        return arr;
                                                    }
                                                    return argType == "object" || arg == null
                                                        ? arg
                                                        : zepto.fragment(arg);
                                                }),
                                                parent,
                                                copyByClone = this.length > 1;
                                            if (nodes.length < 1) return this;
                                            return this.each(function(_, target) {
                                                parent = inside ? target : target.parentNode;
                                                target =
                                                    operatorIndex == 0
                                                        ? target.nextSibling
                                                        : operatorIndex == 1
                                                        ? target.firstChild
                                                        : operatorIndex == 2 ? target : null;
                                                var parentInDocument = $.contains(document.documentElement, parent);
                                                var SCRIPT_TYPES = /^(text|application)\/(javascript|ecmascript)$/;
                                                nodes.forEach(function(node) {
                                                    if (copyByClone) node = node.cloneNode(true);
                                                    else if (!parent) return $(node).remove();
                                                    parent.insertBefore(node, target);
                                                    if (parentInDocument)
                                                        traverseNode(node, function(el) {
                                                            if (
                                                                el.nodeName != null &&
                                                                el.nodeName.toUpperCase() === "SCRIPT" &&
                                                                (!el.type || SCRIPT_TYPES.test(el.type.toLowerCase())) &&
                                                                !el.src
                                                            ) {
                                                                var target = el.ownerDocument
                                                                    ? el.ownerDocument.defaultView
                                                                    : window;
                                                                target["eval"].call(target, el.innerHTML);
                                                            }
                                                        });
                                                });
                                            });
                                        };
                                        $.fn[
                                            inside
                                                ? operator + "To"
                                                : "insert" + (operatorIndex ? "Before" : "After")
                                            ] = function(html) {
                                            $(html)[operator](this);
                                            return this;
                                        };
                                    });
                                    zepto.Z.prototype = Z.prototype = $.fn;
                                    zepto.uniq = uniq;
                                    zepto.deserializeValue = deserializeValue;
                                    $.zepto = zepto;
                                    return $;
                                })();
                                (function($) {
                                    var _zid = 1,
                                        undefined,
                                        slice = Array.prototype.slice,
                                        isFunction = $.isFunction,
                                        isString = function isString(obj) {
                                            return typeof obj == "string";
                                        },
                                        handlers = {},
                                        specialEvents = {},
                                        focusinSupported = "onfocusin" in window,
                                        focus = { focus: "focusin", blur: "focusout" },
                                        hover = { mouseenter: "mouseover", mouseleave: "mouseout" };
                                    specialEvents.click = specialEvents.mousedown = specialEvents.mouseup = specialEvents.mousemove =
                                        "MouseEvents";
                                    function zid(element) {
                                        return element._zid || (element._zid = _zid++);
                                    }
                                    function findHandlers(element, event, fn, selector) {
                                        event = parse(event);
                                        if (event.ns) var matcher = matcherFor(event.ns);
                                        return (handlers[zid(element)] || []).filter(function(handler) {
                                            return (
                                                handler &&
                                                (!event.e || handler.e == event.e) &&
                                                (!event.ns || matcher.test(handler.ns)) &&
                                                (!fn || zid(handler.fn) === zid(fn)) &&
                                                (!selector || handler.sel == selector)
                                            );
                                        });
                                    }
                                    function parse(event) {
                                        var parts = ("" + event).split(".");
                                        return {
                                            e: parts[0],
                                            ns: parts
                                                .slice(1)
                                                .sort()
                                                .join(" ")
                                        };
                                    }
                                    function matcherFor(ns) {
                                        return new RegExp("(?:^| )" + ns.replace(" ", " .* ?") + "(?: |$)");
                                    }
                                    function eventCapture(handler, captureSetting) {
                                        return (
                                            (handler.del && !focusinSupported && handler.e in focus) ||
                                            !!captureSetting
                                        );
                                    }
                                    function realEvent(type) {
                                        return hover[type] || (focusinSupported && focus[type]) || type;
                                    }
                                    function add(element, events, fn, data, selector, delegator, capture) {
                                        var id = zid(element),
                                            set$$1 = handlers[id] || (handlers[id] = []);
                                        events.split(/\s/).forEach(function(event) {
                                            if (event == "ready") return $(document).ready(fn);
                                            var handler = parse(event);
                                            handler.fn = fn;
                                            handler.sel = selector;
                                            if (handler.e in hover)
                                                fn = function fn(e) {
                                                    var related = e.relatedTarget;
                                                    if (!related || (related !== this && !$.contains(this, related)))
                                                        return handler.fn.apply(this, arguments);
                                                };
                                            handler.del = delegator;
                                            var callback = delegator || fn;
                                            handler.proxy = function(e) {
                                                e = compatible(e);
                                                if (e.isImmediatePropagationStopped()) return;
                                                e.data = data;
                                                var result = callback.apply(
                                                    element,
                                                    e._args == undefined ? [e] : [e].concat(e._args)
                                                );
                                                if (result === false) e.preventDefault(), e.stopPropagation();
                                                return result;
                                            };
                                            handler.i = set$$1.length;
                                            set$$1.push(handler);
                                            if ("addEventListener" in element)
                                                element.addEventListener(
                                                    realEvent(handler.e),
                                                    handler.proxy,
                                                    eventCapture(handler, capture)
                                                );
                                        });
                                    }
                                    function remove(element, events, fn, selector, capture) {
                                        var id = zid(element);
                                        (events || "").split(/\s/).forEach(function(event) {
                                            findHandlers(element, event, fn, selector).forEach(function(handler) {
                                                delete handlers[id][handler.i];
                                                if ("removeEventListener" in element)
                                                    element.removeEventListener(
                                                        realEvent(handler.e),
                                                        handler.proxy,
                                                        eventCapture(handler, capture)
                                                    );
                                            });
                                        });
                                    }
                                    $.event = { add: add, remove: remove };
                                    $.proxy = function(fn, context) {
                                        var args = 2 in arguments && slice.call(arguments, 2);
                                        if (isFunction(fn)) {
                                            var proxyFn = function proxyFn() {
                                                return fn.apply(
                                                    context,
                                                    args ? args.concat(slice.call(arguments)) : arguments
                                                );
                                            };
                                            proxyFn._zid = zid(fn);
                                            return proxyFn;
                                        } else if (isString(context)) {
                                            if (args) {
                                                args.unshift(fn[context], fn);
                                                return $.proxy.apply(null, args);
                                            } else {
                                                return $.proxy(fn[context], fn);
                                            }
                                        } else {
                                            throw new TypeError("expected function");
                                        }
                                    };
                                    $.fn.bind = function(event, data, callback) {
                                        return this.on(event, data, callback);
                                    };
                                    $.fn.unbind = function(event, callback) {
                                        return this.off(event, callback);
                                    };
                                    $.fn.one = function(event, selector, data, callback) {
                                        return this.on(event, selector, data, callback, 1);
                                    };
                                    var returnTrue = function returnTrue() {
                                            return true;
                                        },
                                        returnFalse = function returnFalse() {
                                            return false;
                                        },
                                        ignoreProperties = /^([A-Z]|returnValue$|layer[XY]$|webkitMovement[XY]$)/,
                                        eventMethods = {
                                            preventDefault: "isDefaultPrevented",
                                            stopImmediatePropagation: "isImmediatePropagationStopped",
                                            stopPropagation: "isPropagationStopped"
                                        };
                                    function compatible(event, source) {
                                        if (source || !event.isDefaultPrevented) {
                                            source || (source = event);
                                            $.each(eventMethods, function(name, predicate) {
                                                var sourceMethod = source[name];
                                                event[name] = function() {
                                                    this[predicate] = returnTrue;
                                                    return sourceMethod && sourceMethod.apply(source, arguments);
                                                };
                                                event[predicate] = returnFalse;
                                            });
                                            try {
                                                event.timeStamp || (event.timeStamp = new Date().getTime());
                                            } catch (ignored) {}
                                            if (
                                                source.defaultPrevented !== undefined
                                                    ? source.defaultPrevented
                                                    : "returnValue" in source
                                                    ? source.returnValue === false
                                                    : source.getPreventDefault && source.getPreventDefault()
                                            )
                                                event.isDefaultPrevented = returnTrue;
                                        }
                                        return event;
                                    }
                                    function createProxy(event) {
                                        var key,
                                            proxy = { originalEvent: event };
                                        for (key in event) {
                                            if (!ignoreProperties.test(key) && event[key] !== undefined)
                                                proxy[key] = event[key];
                                        }
                                        return compatible(proxy, event);
                                    }
                                    $.fn.delegate = function(selector, event, callback) {
                                        return this.on(event, selector, callback);
                                    };
                                    $.fn.undelegate = function(selector, event, callback) {
                                        return this.off(event, selector, callback);
                                    };
                                    $.fn.live = function(event, callback) {
                                        $(document.body).delegate(this.selector, event, callback);
                                        return this;
                                    };
                                    $.fn.die = function(event, callback) {
                                        $(document.body).undelegate(this.selector, event, callback);
                                        return this;
                                    };
                                    $.fn.on = function(event, selector, data, callback, one) {
                                        var autoRemove,
                                            delegator,
                                            $this = this;
                                        if (event && !isString(event)) {
                                            $.each(event, function(type, fn) {
                                                $this.on(type, selector, data, fn, one);
                                            });
                                            return $this;
                                        }
                                        if (!isString(selector) && !isFunction(callback) && callback !== false)
                                            (callback = data), (data = selector), (selector = undefined);
                                        if (callback === undefined || data === false)
                                            (callback = data), (data = undefined);
                                        if (callback === false) callback = returnFalse;
                                        return $this.each(function(_, element) {
                                            if (one)
                                                autoRemove = function autoRemove(e) {
                                                    remove(element, e.type, callback);
                                                    return callback.apply(this, arguments);
                                                };
                                            if (selector)
                                                delegator = function delegator(e) {
                                                    var evt,
                                                        match = $(e.target)
                                                            .closest(selector, element)
                                                            .get(0);
                                                    if (match && match !== element) {
                                                        evt = $.extend(createProxy(e), {
                                                            currentTarget: match,
                                                            liveFired: element
                                                        });
                                                        return (autoRemove || callback).apply(
                                                            match,
                                                            [evt].concat(slice.call(arguments, 1))
                                                        );
                                                    }
                                                };
                                            add(element, event, callback, data, selector, delegator || autoRemove);
                                        });
                                    };
                                    $.fn.off = function(event, selector, callback) {
                                        var $this = this;
                                        if (event && !isString(event)) {
                                            $.each(event, function(type, fn) {
                                                $this.off(type, selector, fn);
                                            });
                                            return $this;
                                        }
                                        if (!isString(selector) && !isFunction(callback) && callback !== false)
                                            (callback = selector), (selector = undefined);
                                        if (callback === false) callback = returnFalse;
                                        return $this.each(function() {
                                            remove(this, event, callback, selector);
                                        });
                                    };
                                    $.fn.trigger = function(event, args) {
                                        event =
                                            isString(event) || $.isPlainObject(event)
                                                ? $.Event(event)
                                                : compatible(event);
                                        event._args = args;
                                        return this.each(function() {
                                            if (event.type in focus && typeof this[event.type] == "function")
                                                this[event.type]();
                                            else if ("dispatchEvent" in this) this.dispatchEvent(event);
                                            else $(this).triggerHandler(event, args);
                                        });
                                    };
                                    $.fn.triggerHandler = function(event, args) {
                                        var e, result;
                                        this.each(function(i, element) {
                                            e = createProxy(isString(event) ? $.Event(event) : event);
                                            e._args = args;
                                            e.target = element;
                                            $.each(findHandlers(element, event.type || event), function(
                                                i,
                                                handler
                                            ) {
                                                result = handler.proxy(e);
                                                if (e.isImmediatePropagationStopped()) return false;
                                            });
                                        });
                                        return result;
                                    };
                                    (
                                        "focusin focusout focus blur load resize scroll unload click dblclick " +
                                        "mousedown mouseup mousemove mouseover mouseout mouseenter mouseleave " +
                                        "change select keydown keypress keyup error"
                                    )
                                        .split(" ")
                                        .forEach(function(event) {
                                            $.fn[event] = function(callback) {
                                                return 0 in arguments
                                                    ? this.bind(event, callback)
                                                    : this.trigger(event);
                                            };
                                        });
                                    $.Event = function(type, props) {
                                        if (!isString(type)) (props = type), (type = props.type);
                                        var event = document.createEvent(specialEvents[type] || "Events"),
                                            bubbles = true;
                                        if (props)
                                            for (var name in props) {
                                                name == "bubbles"
                                                    ? (bubbles = !!props[name])
                                                    : (event[name] = props[name]);
                                            }
                                        event.initEvent(type, bubbles, true);
                                        return compatible(event);
                                    };
                                })(Zepto);
                                (function() {
                                    try {
                                        getComputedStyle(undefined);
                                    } catch (e) {
                                        var nativeGetComputedStyle = getComputedStyle;
                                        window.getComputedStyle = function(element, pseudoElement) {
                                            try {
                                                return nativeGetComputedStyle(element, pseudoElement);
                                            } catch (e) {
                                                return null;
                                            }
                                        };
                                    }
                                })();
                                (function($) {
                                    var zepto = $.zepto,
                                        oldQsa = zepto.qsa,
                                        childRe = /^\s*>/,
                                        classTag = "Zepto" + +new Date();
                                    zepto.qsa = function(node, selector) {
                                        var sel = selector,
                                            nodes,
                                            taggedParent;
                                        try {
                                            if (!sel) sel = "*";
                                            else if (childRe.test(sel))
                                                (taggedParent = $(node).addClass(classTag)),
                                                    (sel = "." + classTag + " " + sel);
                                            nodes = oldQsa(node, sel);
                                        } catch (e) {
                                            throw e;
                                        } finally {
                                            if (taggedParent) taggedParent.removeClass(classTag);
                                        }
                                        return nodes;
                                    };
                                })(Zepto);
                                return Zepto;
                            })(window);

                            var EQ_START = ":eq(";
                            var EQ_END = ")";
                            var EQ_LENGTH = EQ_START.length;
                            var DIGIT_IN_SELECTOR_PATTERN = /((\.|#)\d{1})/g;
                            function createPair$2(match) {
                                return {
                                    key: match,
                                    val: match.charAt(0) + "\\3" + match.charAt(1) + " "
                                };
                            }
                            function escapeDigitsInSelector(selector) {
                                var matches = selector.match(DIGIT_IN_SELECTOR_PATTERN);
                                if (isEmpty(matches)) {
                                    return selector;
                                }
                                var pairs = map(createPair$2, matches);
                                return reduce(
                                    function(acc, pair) {
                                        return acc.replace(pair.key, pair.val);
                                    },
                                    selector,
                                    pairs
                                );
                            }
                            function parseSelector(selector) {
                                var result = [];
                                var sel = trim(selector);
                                var currentIndex = sel.indexOf(EQ_START);
                                var head = void 0;
                                var tail = void 0;
                                var eq = void 0;
                                var index = void 0;
                                while (currentIndex !== -1) {
                                    head = trim(sel.substring(0, currentIndex));
                                    tail = trim(sel.substring(currentIndex));
                                    index = tail.indexOf(EQ_END);
                                    eq = trim(tail.substring(EQ_LENGTH, index));
                                    sel = trim(tail.substring(index + 1));
                                    currentIndex = sel.indexOf(EQ_START);
                                    if (head && eq) {
                                        result.push({ sel: head, eq: Number(eq) });
                                    }
                                }
                                if (sel) {
                                    result.push({ sel: sel });
                                }
                                return result;
                            }
                            function select(selector) {
                                if (isElement(selector)) {
                                    return $(selector);
                                }
                                if (!isString(selector)) {
                                    return $(selector);
                                }
                                var selectorAsString = escapeDigitsInSelector(selector);
                                if (selectorAsString.indexOf(EQ_START) === -1) {
                                    return $(selectorAsString);
                                }
                                var parts = parseSelector(selectorAsString);
                                return reduce(
                                    function(acc, part) {
                                        var sel = part.sel,
                                            eq = part.eq;
                                        acc = acc.find(sel);
                                        if (isNumber(eq)) {
                                            acc = acc.eq(eq);
                                        }
                                        return acc;
                                    },
                                    $(document$1),
                                    parts
                                );
                            }
                            function exists$2(selector) {
                                return select(selector).length > 0;
                            }
                            function fragment(content) {
                                return $("<" + DIV_TAG + "/>").append(content);
                            }
                            function wrap(content) {
                                return $(content);
                            }
                            function prev(selector) {
                                return select(selector).prev();
                            }
                            function next(selector) {
                                return select(selector).next();
                            }
                            function parent(selector) {
                                return select(selector).parent();
                            }
                            function is(query, selector) {
                                return select(selector).is(query);
                            }
                            function find(query, selector) {
                                return select(selector).find(query);
                            }
                            function children(selector) {
                                return select(selector).children();
                            }

                            function listen(type, func, selector) {
                                return select(selector).on(type, func);
                            }

                            function getErrorMessage$1(err) {
                                if (isObject(err) && isNotBlank(err[ERROR])) {
                                    return err[ERROR];
                                }
                                if (isObject(err) && isNotBlank(err[MESSAGE])) {
                                    return err[MESSAGE];
                                }
                                if (isNotBlank(err)) {
                                    return err;
                                }
                                return ERROR_UNKNOWN;
                            }
                            function createSuccessCallback(options) {
                                return function() {
                                    logDebug(TRACK_EVENT_SUCCESS, options);
                                    options[SUCCESS]();
                                };
                            }
                            function createErrorCallback(options) {
                                return function(data) {
                                    var status = data[STATUS] || UNKNOWN;
                                    var message = getErrorMessage$1(data);
                                    logWarn(TRACK_EVENT_ERROR, options, data);
                                    options[ERROR](status, message);
                                };
                            }
                            function normalizeOptions(config, options) {
                                var mbox = options[MBOX];
                                var result = assign({}, options);
                                var params = isObject(options[PARAMS]) ? options[PARAMS] : {};
                                var configTimeout = config[TIMEOUT];
                                var timeout = options[TIMEOUT];
                                result[PARAMS] = assign({}, getMboxParameters(mbox), params);
                                result[TIMEOUT] = isNumber(timeout) && timeout >= 0 ? timeout : configTimeout;
                                result[SUCCESS] = isFunction(options[SUCCESS]) ? options[SUCCESS] : noop;
                                result[ERROR] = isFunction(options[ERROR]) ? options[ERROR] : noop;
                                return result;
                            }

                            function trackImmediate(sendBeacon, options) {
                                var success = createSuccessCallback(options);
                                var error = createErrorCallback(options);
                                sendBeacon(options)
                                    .then(success)
                                    ["catch"](error);
                            }

                            function handleEvent(sendBeacon, options) {
                                trackImmediate(sendBeacon, options);
                                return !options.preventDefault;
                            }
                            function trackBySelector(sendBeacon, listen, options) {
                                var selector = options[SELECTOR];
                                var type = options[TYPE];
                                var elements = toArray$1(select(selector));
                                var onEvent = function onEvent() {
                                    return handleEvent(sendBeacon, options);
                                };
                                forEach(function(element) {
                                    return listen(type, onEvent, element);
                                }, elements);
                            }

                            var TRACK_EVENT = "[trackEvent()]";
                            function shouldTrackBySelector(options) {
                                var type = options[TYPE];
                                var selector = options[SELECTOR];
                                return isNotBlank(type) && (isNotBlank(selector) || isElement(selector));
                            }
                            function executeTrackEvent(
                                config,
                                sendBeacon,
                                listen,
                                isEnabled,
                                trackBySelector,
                                trackImmediate,
                                opts
                            ) {
                                if (!isEnabled()) {
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                var validationResult = validateTrackEventOptions(opts);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(TRACK_EVENT, validationError);
                                    return;
                                }
                                var options = normalizeOptions(config, opts);
                                if (shouldTrackBySelector(options)) {
                                    trackBySelector(sendBeacon, listen, options);
                                    return;
                                }
                                trackImmediate(sendBeacon, options);
                            }

                            var NAVIGATOR = "navigator";
                            var SEND_BEACON = "sendBeacon";
                            var SEND_BEACON_ERROR = "sendBeacon() request failed";
                            function createHeaders$1() {
                                var result = {};
                                result[CONTENT_TYPE_HEADER] = [FORM_URL_ENCODED];
                                return result;
                            }
                            function executeSendBeacon(win, request) {
                                var url = request[URL$1];
                                var data = request[DATA$1];
                                var urlAndQs = url + "?" + data;
                                return create(function(resolve$$1, reject$$1) {
                                    var result = win[NAVIGATOR][SEND_BEACON](urlAndQs);
                                    if (result) {
                                        resolve$$1();
                                        return;
                                    }
                                    reject$$1(SEND_BEACON_ERROR);
                                });
                            }
                            function executeSyncXhr(request) {
                                var url = request[URL$1];
                                var data = request[DATA$1];
                                var options = {};
                                options[METHOD] = POST;
                                options[URL$1] = url + "?" + data;
                                options[CREDENTIALS] = true;
                                options[ASYNC] = false;
                                options[HEADERS] = createHeaders$1();
                                return xhr(options);
                            }
                            function isBeaconSupported(win) {
                                return NAVIGATOR in win && SEND_BEACON in win[NAVIGATOR];
                            }
                            function sendBeacon(win, options) {
                                var request = createSyncRequest(options);
                                if (isBeaconSupported(win)) {
                                    return executeSendBeacon(win, request);
                                }
                                return executeSyncXhr(request);
                            }

                            function trackEvent(options) {
                                var config = getConfig();
                                var executeBeacon = function executeBeacon(opts) {
                                    return sendBeacon(window$1, opts);
                                };
                                executeTrackEvent(
                                    config,
                                    executeBeacon,
                                    listen,
                                    isDeliveryEnabled,
                                    trackBySelector,
                                    trackImmediate,
                                    options
                                );
                            }

                            function remove(selector) {
                                return select(selector)
                                    .empty()
                                    .remove();
                            }
                            function after(content, selector) {
                                return select(selector).after(content);
                            }
                            function before(content, selector) {
                                return select(selector).before(content);
                            }
                            function append(content, selector) {
                                return select(selector).append(content);
                            }
                            function prepend(content, selector) {
                                return select(selector).prepend(content);
                            }
                            function setHtml(content, selector) {
                                return select(selector).html(content);
                            }
                            function getHtml$1(selector) {
                                return select(selector).html();
                            }
                            function setText(content, selector) {
                                return select(selector).text(content);
                            }

                            function getAttr(name, selector) {
                                return select(selector).attr(name);
                            }
                            function setAttr(name, value, selector) {
                                return select(selector).attr(name, value);
                            }
                            function removeAttr(name, selector) {
                                return select(selector).removeAttr(name);
                            }
                            function copyAttr(from, to, selector) {
                                var value = getAttr(from, selector);
                                if (isNotBlank(value)) {
                                    removeAttr(from, selector);
                                    setAttr(to, value, selector);
                                }
                            }
                            function hasAttr(name, selector) {
                                return isNotBlank(getAttr(name, selector));
                            }

                            function saveTrace$2(action) {
                                var trace = {};
                                trace[ACTION] = action;
                                addTrace(CLIENT_TRACES, trace);
                            }
                            function saveErrorTrace(action, error) {
                                var trace = {};
                                trace[ACTION] = action;
                                trace[ERROR] = error;
                                addTrace(CLIENT_TRACES, trace);
                            }

                            function getDataSrc(item) {
                                return getAttr(DATA_SRC, item);
                            }
                            function hasDataSrc(item) {
                                return hasAttr(DATA_SRC, item);
                            }
                            function disableImages(html) {
                                forEach(function(item) {
                                    return copyAttr(SRC, DATA_SRC, item);
                                }, toArray$1(find(IMAGE_TAG, html)));
                                return html;
                            }
                            function enableImages(html) {
                                forEach(function(item) {
                                    return copyAttr(DATA_SRC, SRC, item);
                                }, toArray$1(find(IMAGE_TAG, html)));
                                return html;
                            }
                            function loadImages(html) {
                                var elements = filter(hasDataSrc, toArray$1(find(IMAGE_TAG, html)));
                                if (isEmpty(elements)) {
                                    return html;
                                }
                                forEach(loadImage, map(getDataSrc, elements));
                                return html;
                            }
                            function loadImage(src) {
                                logDebug(LOADING_IMAGE, src);
                                return getAttr(SRC, setAttr(SRC, src, wrap("<" + IMAGE_TAG + "/>")));
                            }
                            function renderImages(html) {
                                return flow([disableImages, loadImages, enableImages])(html);
                            }

                            function getUrl$1(item) {
                                var src = getAttr(SRC, item);
                                return isNotBlank(src) ? src : null;
                            }
                            function getScriptsUrls(html) {
                                return filter(isNotBlank, map(getUrl$1, toArray$1(find(SCRIPT, html))));
                            }
                            function loadScripts(urls) {
                                return reduce(
                                    function(acc, url) {
                                        return acc.then(function() {
                                            logDebug(REMOTE_SCRIPT, url);
                                            return loadScript(url);
                                        });
                                    },
                                    resolve(),
                                    urls
                                );
                            }
                            function handleRenderingSuccess(action) {
                                saveTrace$2(action);
                                return action;
                            }
                            function handleRenderingError(action) {
                                return function(error) {
                                    logDebug(UNEXPECTED_ERROR, error);
                                    saveErrorTrace(action, error);
                                    return action;
                                };
                            }
                            function renderHtml(renderFunc, action) {
                                var container = select(action[SELECTOR]);
                                var html = renderImages(fragment(action[CONTENT]));
                                var urls = getScriptsUrls(html);
                                var result = resolve(renderFunc(container, html));
                                if (isEmpty(urls)) {
                                    return result
                                        .then(function() {
                                            return handleRenderingSuccess(action);
                                        })
                                        ["catch"](handleRenderingError(action));
                                }
                                return result
                                    .then(function() {
                                        return loadScripts(urls);
                                    })
                                    .then(function() {
                                        return handleRenderingSuccess(action);
                                    })
                                    ["catch"](handleRenderingError(action));
                            }

                            function renderFunc(container, html) {
                                return setHtml(getHtml$1(html), container);
                            }
                            function setContent$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc, action);
                            }

                            function setText$1(action) {
                                var container = select(action[SELECTOR]);
                                var content = action[CONTENT];
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                setText(content, container);
                                return resolve(action);
                            }

                            function renderFunc$1(container, html) {
                                return append(getHtml$1(html), container);
                            }
                            function appendContent$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc$1, action);
                            }

                            function renderFunc$2(container, html) {
                                return prepend(getHtml$1(html), container);
                            }
                            function prependContent$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc$2, action);
                            }

                            function renderFunc$3(container, html) {
                                var parentContainer = parent(container);
                                remove(before(getHtml$1(html), container));
                                return parentContainer;
                            }
                            function replaceContent$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc$3, action);
                            }

                            function renderFunc$4(container, html) {
                                return prev(before(getHtml$1(html), container));
                            }
                            function insertBefore$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc$4, action);
                            }

                            function renderFunc$5(container, html) {
                                return next(after(getHtml$1(html), container));
                            }
                            function insertAfter$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc$5, action);
                            }

                            function renderFunc$6(container, html) {
                                return parent(before(getHtml$1(html), container));
                            }
                            function customCode$1(action) {
                                logDebug(ACTION_RENDERING, action);
                                return renderHtml(renderFunc$6, action);
                            }

                            function shouldHandleImageSrc(container, attribute) {
                                return SRC === attribute && is(IMAGE_TAG, container);
                            }
                            function setImageSrc(container, src) {
                                removeAttr(SRC, container);
                                setAttr(SRC, loadImage(src), container);
                            }
                            function setAttribute$1(action) {
                                var attribute = action[ATTRIBUTE];
                                var value = action[VALUE];
                                var container = select(action[SELECTOR]);
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                if (shouldHandleImageSrc(container, attribute)) {
                                    setImageSrc(container, value);
                                } else {
                                    setAttr(attribute, value, container);
                                }
                                return resolve(action);
                            }

                            function addClass(cssClass, selector) {
                                return select(selector).addClass(cssClass);
                            }
                            function removeClass(cssClass, selector) {
                                return select(selector).removeClass(cssClass);
                            }
                            function hasClass(cssClass, selector) {
                                return select(selector).hasClass(cssClass);
                            }
                            function setCss(style, selector) {
                                return select(selector).css(style);
                            }

                            function setCssWithPriority(container, style, priority) {
                                forEach(function(elem) {
                                    forEach(function(value, key) {
                                        return elem.style.setProperty(key, value, priority);
                                    }, style);
                                }, toArray$1(container));
                            }
                            function setStyle$1(action) {
                                var container = select(action[SELECTOR]);
                                var priority = action[PRIORITY];
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                if (isBlank(priority)) {
                                    setCss(action[STYLE], container);
                                } else {
                                    setCssWithPriority(container, action[STYLE], priority);
                                }
                                return resolve(action);
                            }

                            function remove$1(action) {
                                var container = select(action[SELECTOR]);
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                remove(container);
                                return resolve(action);
                            }

                            function rearrange$1(action) {
                                var from = action[FROM];
                                var to = action[TO];
                                var container = select(action[SELECTOR]);
                                var elements = toArray$1(children(container));
                                var elemFrom = elements[from];
                                var elemTo = elements[to];
                                if (!exists$2(elemFrom) || !exists$2(elemTo)) {
                                    logDebug(REARRANGE_MISSING, action);
                                    saveErrorTrace(action, REARRANGE_MISSING);
                                    return resolve(action);
                                }
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                if (from < to) {
                                    after(elemFrom, elemTo);
                                } else {
                                    before(elemFrom, elemTo);
                                }
                                return resolve(action);
                            }

                            var CLICK_TRACK_ID_PARAM = "clickTrackId";
                            function trackClick$1(handleClick, action) {
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                handleClick(CLICK_TRACK_ID_PARAM, action);
                                return resolve(action);
                            }

                            var CLICK_THROUGH_PARAM = "mboxTarget";
                            function signalClick(handleClick, action) {
                                logDebug(ACTION_RENDERING, action);
                                saveTrace$2(action);
                                handleClick(CLICK_THROUGH_PARAM, action);
                                return resolve(action);
                            }

                            var HEAD_TAGS_SELECTOR = SCRIPT_TAG + "," + LINK_TAG + "," + STYLE_TAG;
                            function getHeadContent(content) {
                                var container = fragment(content);
                                var result = reduce(
                                    function(acc, elem) {
                                        acc.push(getHtml$1(fragment(elem)));
                                        return acc;
                                    },
                                    [],
                                    toArray$1(find(HEAD_TAGS_SELECTOR, container))
                                );
                                return result.join("");
                            }
                            function preprocessAction(action) {
                                var content = action[CONTENT];
                                if (isBlank(content)) {
                                    return action;
                                }
                                var container = select(action[SELECTOR]);
                                if (!is(HEAD_TAG, container)) {
                                    return action;
                                }
                                action[ACTION] = APPEND_CONTENT;
                                action[CONTENT] = getHeadContent(content);
                                return action;
                            }
                            function executeRedirectAction(win, action) {
                                var url = action[URL];
                                logDebug(ACTION_RENDERING, action);
                                win.location.replace(url);
                            }
                            function executeRenderAction(handleClick, action) {
                                var processedAction = preprocessAction(action);
                                var type = processedAction[ACTION];
                                switch (type) {
                                    case SET_CONTENT:
                                        return setContent$1(processedAction);
                                    case SET_TEXT:
                                        return setText$1(processedAction);
                                    case APPEND_CONTENT:
                                        return appendContent$1(processedAction);
                                    case PREPEND_CONTENT:
                                        return prependContent$1(processedAction);
                                    case REPLACE_CONTENT:
                                        return replaceContent$1(processedAction);
                                    case INSERT_BEFORE:
                                        return insertBefore$1(processedAction);
                                    case INSERT_AFTER:
                                        return insertAfter$1(processedAction);
                                    case CUSTOM_CODE:
                                        return customCode$1(processedAction);
                                    case SET_ATTRIBUTE:
                                        return setAttribute$1(processedAction);
                                    case SET_STYLE:
                                        return setStyle$1(processedAction);
                                    case REMOVE:
                                        return remove$1(processedAction);
                                    case REARRANGE:
                                        return rearrange$1(processedAction);
                                    case TRACK_CLICK:
                                        return trackClick$1(handleClick, processedAction);
                                    case SIGNAL_CLICK:
                                        return signalClick(handleClick, processedAction);
                                    default:
                                        return resolve(processedAction);
                                }
                            }

                            function E() {}
                            E.prototype = {
                                on: function on(name, callback, ctx) {
                                    var e = this.e || (this.e = {});
                                    (e[name] || (e[name] = [])).push({
                                        fn: callback,
                                        ctx: ctx
                                    });
                                    return this;
                                },
                                once: function once(name, callback, ctx) {
                                    var self = this;
                                    function listener() {
                                        self.off(name, listener);
                                        callback.apply(ctx, arguments);
                                    }
                                    listener._ = callback;
                                    return this.on(name, listener, ctx);
                                },
                                emit: function emit(name) {
                                    var data = [].slice.call(arguments, 1);
                                    var evtArr = ((this.e || (this.e = {}))[name] || []).slice();
                                    var i = 0;
                                    var len = evtArr.length;
                                    for (i; i < len; i++) {
                                        evtArr[i].fn.apply(evtArr[i].ctx, data);
                                    }
                                    return this;
                                },
                                off: function off(name, callback) {
                                    var e = this.e || (this.e = {});
                                    var evts = e[name];
                                    var liveEvents = [];
                                    if (evts && callback) {
                                        for (var i = 0, len = evts.length; i < len; i++) {
                                            if (evts[i].fn !== callback && evts[i].fn._ !== callback)
                                                liveEvents.push(evts[i]);
                                        }
                                    }
                                    liveEvents.length ? (e[name] = liveEvents) : delete e[name];
                                    return this;
                                }
                            };
                            var index$1 = E;

                            function create$1() {
                                return new index$1();
                            }
                            function publishOn(eventBus, name, args) {
                                eventBus.emit(name, args);
                            }
                            function subscribeTo(eventBus, name, func) {
                                eventBus.on(name, func);
                            }
                            function subscribeOnceTo(eventBus, name, func) {
                                eventBus.once(name, func);
                            }
                            function unsubscribeFrom(eventBus, name) {
                                eventBus.off(name);
                            }

                            var EVENT_BUS = create$1();
                            function publish(name, args) {
                                publishOn(EVENT_BUS, name, args);
                            }
                            function subscribe(name, func) {
                                subscribeTo(EVENT_BUS, name, func);
                            }
                            function unsubscribe$1(name) {
                                unsubscribeFrom(EVENT_BUS, name);
                            }

                            var STYLE_PREFIX = "at-";
                            var BODY_STYLE_ID = "at-body-style";
                            var BODY_STYLE_ID_SELECTOR = "#" + BODY_STYLE_ID;
                            var MARKERS_STYLE_ID = "at-makers-style";
                            function createStyleMarkup(id, content) {
                                return (
                                    "<" +
                                    STYLE_TAG +
                                    " " +
                                    ID +
                                    '="' +
                                    id +
                                    '" ' +
                                    CLASS +
                                    '="' +
                                    FLICKER_CONTROL_CLASS +
                                    '">' +
                                    content +
                                    "</" +
                                    STYLE_TAG +
                                    ">"
                                );
                            }
                            function createActionStyle(styleDef, selector) {
                                var id = STYLE_PREFIX + hash(selector);
                                var style = selector + " {" + styleDef + "}";
                                return createStyleMarkup(id, style);
                            }
                            function addHidingSnippet(config) {
                                var bodyHidingEnabled = config[BODY_HIDING_ENABLED];
                                if (bodyHidingEnabled !== true) {
                                    return;
                                }
                                if (exists$2(BODY_STYLE_ID_SELECTOR)) {
                                    return;
                                }
                                var bodyHiddenStyle = config[BODY_HIDDEN_STYLE];
                                append(createStyleMarkup(BODY_STYLE_ID, bodyHiddenStyle), HEAD_TAG);
                            }
                            function removeHidingSnippet(config) {
                                var bodyHidingEnabled = config[BODY_HIDING_ENABLED];
                                if (bodyHidingEnabled !== true) {
                                    return;
                                }
                                if (!exists$2(BODY_STYLE_ID_SELECTOR)) {
                                    return;
                                }
                                remove(BODY_STYLE_ID_SELECTOR);
                            }
                            function addActionHidings(config, selectors) {
                                if (isEmpty(selectors)) {
                                    return;
                                }
                                var styleDef = config[DEFAULT_CONTENT_HIDDEN_STYLE];
                                var buildStyle = function buildStyle(selector) {
                                    return createActionStyle(styleDef, selector);
                                };
                                var content = map(buildStyle, selectors).join("\n");
                                append(content, HEAD_TAG);
                            }
                            function addStyles(config) {
                                var mboxDefaultStyle =
                                    "\n." +
                                    MBOX_CSS_CLASS +
                                    " {" +
                                    config[DEFAULT_CONTENT_HIDDEN_STYLE] +
                                    "}\n";
                                var content = createStyleMarkup(MARKERS_STYLE_ID, mboxDefaultStyle);
                                append(content, HEAD_TAG);
                            }

                            function injectHidingSnippetStyle() {
                                addHidingSnippet(getConfig());
                            }
                            function removeHidingSnippetStyle() {
                                removeHidingSnippet(getConfig());
                            }
                            function injectActionHidingStyles(selectors) {
                                addActionHidings(getConfig(), selectors);
                            }
                            function removeActionHidingStyle(selector) {
                                var id = STYLE_PREFIX + hash(selector);
                                remove("#" + id);
                            }
                            function injectStyles() {
                                addStyles(getConfig());
                            }

                            var MUTATION_OBSERVER = "MutationObserver";
                            var MO_CONFIG = { childList: true, subtree: true };
                            var MO_INSTANCES = [];
                            function handleMutations() {
                                publish(TICK_EVENT);
                            }
                            function isSupported() {
                                return !isNil(window[MUTATION_OBSERVER]);
                            }
                            function startTicker() {
                                var mo = new window[MUTATION_OBSERVER](handleMutations);
                                mo.observe(document$1, MO_CONFIG);
                                publish(TICK_EVENT);
                                MO_INSTANCES.push(mo);
                            }
                            function stopTicker() {
                                var mo = MO_INSTANCES.shift();
                                if (!isNil(mo)) {
                                    mo.disconnect();
                                }
                            }

                            var DELAY = 1000;
                            var VISIBILITY_STATE = "visibilityState";
                            var VISIBLE = "visible";
                            var STARTED = [];
                            function runner(callback) {
                                if (document$1[VISIBILITY_STATE] === VISIBLE) {
                                    window$1.requestAnimationFrame(callback);
                                    return;
                                }
                                delay(callback, DELAY);
                            }
                            function tick() {
                                publish(TICK_EVENT);
                                if (!isEmpty(STARTED)) {
                                    runner(tick);
                                }
                            }
                            function startTicker$1() {
                                STARTED.push(1);
                                tick();
                            }
                            function stopTicker$1() {
                                STARTED.pop();
                            }

                            function startTicker$2() {
                                if (isSupported()) {
                                    startTicker();
                                    return;
                                }
                                startTicker$1();
                            }
                            function stopTicker$2() {
                                if (isSupported()) {
                                    stopTicker();
                                    return;
                                }
                                stopTicker$1();
                            }

                            var notFound = function notFound(action) {
                                return isNil(action.found);
                            };
                            var isClickTracking = function isClickTracking(action) {
                                return action[ACTION] === TRACK_CLICK || action[ACTION] === SIGNAL_CLICK;
                            };
                            function hideActions(actions) {
                                var getCssSelector = function getCssSelector(action) {
                                    return action[CSS_SELECTOR];
                                };
                                var cssSelectors = filter(isNotBlank, map(getCssSelector, actions));
                                injectActionHidingStyles(cssSelectors);
                            }
                            function showElement(selector) {
                                addClass(MARKER_CSS_CLASS, removeClass(MBOX_CSS_CLASS, selector));
                            }
                            function displayAction(action) {
                                var selector = action[SELECTOR];
                                var cssSelector = action[CSS_SELECTOR];
                                if (isNotBlank(selector) || isElement(selector)) {
                                    if (isClickTracking(action)) {
                                        addClass(CLICK_TRACKING_CSS_CLASS, removeClass(MBOX_CSS_CLASS, selector));
                                    } else {
                                        showElement(selector);
                                    }
                                }
                                if (isNotBlank(cssSelector)) {
                                    removeActionHidingStyle(cssSelector);
                                }
                            }
                            function displayActions(actions) {
                                forEach(displayAction, actions);
                            }
                            function handleComplete(actions, resolve$$1, reject$$1) {
                                var notFoundActions = filter(notFound, actions);
                                if (!isEmpty(notFoundActions)) {
                                    displayActions(notFoundActions);
                                    reject$$1(notFoundActions);
                                    return;
                                }
                                resolve$$1();
                            }
                            function renderAndDisplayAction(handleClick, action) {
                                executeRenderAction(handleClick, action)
                                    .then(function() {
                                        logDebug(ACTION_RENDERED, action);
                                        displayAction(action);
                                    })
                                    ["catch"](function(error) {
                                    logDebug(UNEXPECTED_ERROR, error);
                                    displayAction(action);
                                });
                            }
                            function renderActions(handleClick, actions) {
                                forEach(function(action) {
                                    if (!exists$2(action[SELECTOR])) {
                                        return;
                                    }
                                    renderAndDisplayAction(handleClick, action);
                                    action.found = true;
                                }, actions);
                            }
                            function startTimer(eventBus, selectorsPollingTimeout) {
                                delay(function() {
                                    return publishOn(eventBus, TIMEOUT_EVENT);
                                }, selectorsPollingTimeout);
                            }
                            function applyActions(eventBus, handleClick, actions, resolve$$1, reject$$1) {
                                subscribe(TICK_EVENT, function() {
                                    var arr = filter(notFound, actions);
                                    if (isEmpty(arr)) {
                                        publishOn(eventBus, RENDER_COMPLETE_EVENT);
                                        return;
                                    }
                                    renderActions(handleClick, arr);
                                });
                                subscribeOnceTo(eventBus, RENDER_COMPLETE_EVENT, function() {
                                    unsubscribeFrom(eventBus, TIMEOUT_EVENT);
                                    stopTicker$2();
                                    handleComplete(actions, resolve$$1, reject$$1);
                                });
                                subscribeOnceTo(eventBus, TIMEOUT_EVENT, function() {
                                    unsubscribeFrom(eventBus, RENDER_COMPLETE_EVENT);
                                    stopTicker$2();
                                    handleComplete(actions, resolve$$1, reject$$1);
                                });
                                startTicker$2();
                            }
                            function executeRenderActions(notifyActionsHidden, handleClick, actions) {
                                var config = getConfig();
                                var selectorsPollingTimeout = config[SELECTORS_POLLING_TIMEOUT];
                                var eventBus = create$1();
                                startTimer(eventBus, selectorsPollingTimeout);
                                hideActions(actions);
                                notifyActionsHidden();
                                return create(function(resolve$$1, reject$$1) {
                                    return applyActions(eventBus, handleClick, actions, resolve$$1, reject$$1);
                                });
                            }

                            function executeRedirect(action) {
                                executeRedirectAction(window$1, action);
                            }
                            function executeRender(notifyActionsHidden, handleClick, actions) {
                                return executeRenderActions(notifyActionsHidden, handleClick, actions);
                            }

                            function buildClickParams(mbox, param, action) {
                                var params = {};
                                params[param] = action[CLICK_TRACK_ID];
                                var options = {};
                                options[MBOX] = mbox + CLICKED_SUFFIX;
                                options[TYPE] = CLICK;
                                options[SELECTOR] = action[SELECTOR];
                                options[PARAMS] = params;
                                return options;
                            }

                            var APPLY_OFFER = "[applyOffer()]";
                            var isRedirectAction = function isRedirectAction(action) {
                                return !isNil(action[URL]);
                            };
                            function retrieveSelector(selector) {
                                if (isNotBlank(selector)) {
                                    return selector;
                                }
                                if (isElement(selector)) {
                                    return selector;
                                }
                                return HEAD_TAG;
                            }
                            function showElement$1(selector) {
                                addClass(MARKER_CSS_CLASS, removeClass(MBOX_CSS_CLASS, selector));
                            }
                            function setSelector(selector, action) {
                                if (isNil(action[SELECTOR])) {
                                    action[SELECTOR] = selector;
                                }
                            }
                            function setActionsSelectors(selector, actions) {
                                var addSelector = function addSelector(action) {
                                    return setSelector(selector, action);
                                };
                                forEach(addSelector, actions);
                            }
                            function createEventDetails(mbox, selectors) {
                                var details = {};
                                details[MBOX] = mbox;
                                details[MESSAGE] = MISSING_SELECTORS;
                                details[SELECTORS] = selectors;
                                return details;
                            }
                            function createTrace$1(details) {
                                var trace = {};
                                trace[ERROR] = details;
                                return trace;
                            }
                            function handleError$2(mbox, actions) {
                                var getSelector = function getSelector(action) {
                                    return action[SELECTOR];
                                };
                                var isSelector = function isSelector(selector) {
                                    return isNotBlank(selector) || isElement(selector);
                                };
                                var selectors = filter(isSelector, map(getSelector, actions));
                                var details = createEventDetails(mbox, selectors);
                                var trace = createTrace$1(details);
                                logWarn(MISSING_SELECTORS, actions);
                                addTrace(CLIENT_TRACES, trace);
                                notifyRenderingFailed(details);
                            }
                            function handleSuccess(mbox) {
                                var payload = {};
                                payload[MBOX] = mbox;
                                logDebug(ACTIONS_RENDERED);
                                notifyRenderingSucceeded(payload);
                            }
                            function applyOffer(options) {
                                var mbox = options[MBOX];
                                var selector = retrieveSelector(options[SELECTOR]);
                                var validationResult = validateApplyOfferOptions(options);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(APPLY_OFFER, validationError);
                                    showElement$1(selector);
                                    return;
                                }
                                if (!isDeliveryEnabled()) {
                                    logWarn(DELIVERY_DISABLED);
                                    showElement$1(selector);
                                    return;
                                }
                                var actions = options[OFFER];
                                var payload = {};
                                payload[MBOX] = mbox;
                                if (isEmpty(actions)) {
                                    logDebug(APPLY_OFFER, NO_ACTIONS);
                                    showElement$1(selector);
                                    publish(NO_OFFERS_EVENT, mbox);
                                    notifyRenderingNoOffers(payload);
                                    return;
                                }
                                var redirectAction = first(filter(isRedirectAction, actions));
                                if (!isNil(redirectAction)) {
                                    payload[URL] = redirectAction[URL];
                                    logDebug(APPLY_OFFER, REDIRECT_ACTION);
                                    notifyRenderingRedirect(payload);
                                    executeRedirect(redirectAction);
                                    return;
                                }
                                var handleClick = function handleClick(param, a) {
                                    return trackEvent(buildClickParams(mbox, param, a));
                                };
                                var notifyActionsHidden = function notifyActionsHidden() {
                                    return publish(SELECTORS_HIDDEN_EVENT, mbox);
                                };
                                setActionsSelectors(selector, actions);
                                notifyRenderingStart(payload);
                                executeRender(notifyActionsHidden, handleClick, actions)
                                    .then(function() {
                                        return handleSuccess(mbox);
                                    })
                                    ["catch"](function(arr) {
                                    return handleError$2(mbox, arr);
                                });
                            }

                            var ADOBE_NAMESPACE = "adobe";
                            var TARGET_NAMESPACE = "target";
                            var EXTENSION_NAMESPACE = "ext";
                            function buildLogger() {
                                return { log: logDebug, error: logWarn };
                            }
                            function buildSettings(config) {
                                var result = {};
                                result[CLIENT_CODE] = config[CLIENT_CODE];
                                result[SERVER_DOMAIN] = config[SERVER_DOMAIN];
                                result[TIMEOUT] = config[TIMEOUT];
                                result[GLOBAL_MBOX_NAME] = config[GLOBAL_MBOX_NAME];
                                result[GLOBAL_MBOX_AUTO_CREATE] = config[GLOBAL_MBOX_AUTO_CREATE];
                                return result;
                            }
                            function buildNamespace(base, name, value) {
                                var parts = split(".", name);
                                var length = parts.length;
                                for (var i = 0; i < length - 1; i += 1) {
                                    var part = parts[i];
                                    base[part] = base[part] || {};
                                    base = base[part];
                                }
                                base[parts[length - 1]] = value;
                            }
                            function register(win, config, validate, options) {
                                var exposeModules = {
                                    logger: buildLogger(),
                                    settings: buildSettings(config)
                                };
                                var validationResult = validate(options, exposeModules);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    throw new Error(validationError);
                                }
                                var scope = win[ADOBE_NAMESPACE][TARGET_NAMESPACE];
                                scope[EXTENSION_NAMESPACE] = scope[EXTENSION_NAMESPACE] || {};
                                var name = options[NAME];
                                var modules = options[MODULES];
                                var registerModule = options[REGISTER];
                                var args = reduce(
                                    function(acc, elem) {
                                        acc.push(exposeModules[elem]);
                                        return acc;
                                    },
                                    [],
                                    modules
                                );
                                buildNamespace(
                                    scope[EXTENSION_NAMESPACE],
                                    name,
                                    registerModule.apply(undefined, args)
                                );
                            }

                            function registerExtension(options) {
                                register(window$1, getConfig(), validateRegisterExtensionOptions, options);
                            }

                            var commonjsGlobal =
                                typeof window !== "undefined"
                                    ? window
                                    : typeof global !== "undefined"
                                    ? global
                                    : typeof self !== "undefined" ? self : {};

                            function createCommonjsModule(fn, module) {
                                return (module = { exports: {} }), fn(module, module.exports), module.exports;
                            }

                            var currentExecutingScript = createCommonjsModule(function(module, exports) {
                                (function(root, factory) {
                                    if (typeof define === "function" && define.amd) {
                                        define([], factory);
                                    } else if (
                                        (typeof exports === "undefined" ? "undefined" : _typeof(exports)) ===
                                        "object"
                                    ) {
                                        module.exports = factory();
                                    } else {
                                        root.currentExecutingScript = factory();
                                    }
                                })(commonjsGlobal || window, function() {
                                    var scriptReadyRegex = /^(interactive|loaded|complete)$/;
                                    var fullPageUrl = !!window.location ? window.location.href : null;
                                    var pageUrl = fullPageUrl
                                        ? fullPageUrl.replace(/#.*$/, "").replace(/\?.*$/, "") || null
                                        : null;
                                    var scripts = document.getElementsByTagName("script");
                                    var supportsScriptReadyState =
                                        "readyState" in (scripts[0] || document.createElement("script"));
                                    var isNotOpera =
                                        !window.opera || window.opera.toString() !== "[object Opera]";
                                    var hasNativeCurrentScriptAccessor = "currentScript" in document;
                                    if ("stackTraceLimit" in Error && Error.stackTraceLimit !== Infinity) {
                                        Error.stackTraceLimit = Infinity;
                                    }
                                    var hasStackBeforeThrowing = false,
                                        hasStackAfterThrowing = false;
                                    (function() {
                                        try {
                                            var err = new Error();
                                            hasStackBeforeThrowing = typeof err.stack === "string" && !!err.stack;
                                            throw err;
                                        } catch (thrownErr) {
                                            hasStackAfterThrowing =
                                                typeof thrownErr.stack === "string" && !!thrownErr.stack;
                                        }
                                    })();
                                    function normalizeWhitespace(str) {
                                        return str ? str.replace(/^\s+$|\s+$/g, "").replace(/\s\s+/g, " ") : "";
                                    }
                                    function getScriptFromUrl(url, eligibleScripts) {
                                        var i,
                                            script = null;
                                        eligibleScripts = eligibleScripts || scripts;
                                        if (typeof url === "string" && url) {
                                            for (i = eligibleScripts.length; i--; ) {
                                                if (eligibleScripts[i].src === url) {
                                                    script = eligibleScripts[i];
                                                    break;
                                                }
                                            }
                                        }
                                        return script;
                                    }
                                    function getInlineScriptFromCallerSource(callerFnSource, eligibleScripts) {
                                        var i,
                                            inlineScriptText,
                                            script = null,
                                            callerSourceText = normalizeWhitespace(callerFnSource);
                                        eligibleScripts = eligibleScripts || scripts;
                                        if (callerFnSource && callerSourceText) {
                                            for (i = eligibleScripts.length; i--; ) {
                                                if (!eligibleScripts[i].hasAttribute("src")) {
                                                    inlineScriptText = normalizeWhitespace(eligibleScripts[i].text);
                                                    if (inlineScriptText.indexOf(callerSourceText) !== -1) {
                                                        if (script) {
                                                            script = null;
                                                            break;
                                                        }
                                                        script = eligibleScripts[i];
                                                    }
                                                }
                                            }
                                        }
                                        return script;
                                    }
                                    function getSoleInlineScript(eligibleScripts) {
                                        var i,
                                            len,
                                            script = null;
                                        eligibleScripts = eligibleScripts || scripts;
                                        for (i = 0, len = eligibleScripts.length; i < len; i++) {
                                            if (!eligibleScripts[i].hasAttribute("src")) {
                                                if (script) {
                                                    script = null;
                                                    break;
                                                }
                                                script = eligibleScripts[i];
                                            }
                                        }
                                        return script;
                                    }
                                    function getScriptUrlFromStack(stack, skipStackDepth) {
                                        var matches,
                                            remainingStack,
                                            url = null,
                                            ignoreMessage = typeof skipStackDepth === "number";
                                        skipStackDepth = ignoreMessage ? Math.round(skipStackDepth) : 0;
                                        if (typeof stack === "string" && stack) {
                                            if (ignoreMessage) {
                                                matches = stack.match(
                                                    /(data:text\/javascript(?:;[^,]+)?,.+?|(?:|blob:)(?:http[s]?|file):\/\/[\/]?.+?\/[^:\)]*?)(?::\d+)(?::\d+)?/
                                                );
                                            } else {
                                                matches = stack.match(
                                                    /^(?:|[^:@]*@|.+\)@(?=data:text\/javascript|blob|http[s]?|file)|.+?\s+(?: at |@)(?:[^:\(]+ )*[\(]?)(data:text\/javascript(?:;[^,]+)?,.+?|(?:|blob:)(?:http[s]?|file):\/\/[\/]?.+?\/[^:\)]*?)(?::\d+)(?::\d+)?/
                                                );
                                                if (!(matches && matches[1])) {
                                                    matches = stack.match(
                                                        /\)@(data:text\/javascript(?:;[^,]+)?,.+?|(?:|blob:)(?:http[s]?|file):\/\/[\/]?.+?\/[^:\)]*?)(?::\d+)(?::\d+)?/
                                                    );
                                                }
                                            }
                                            if (matches && matches[1]) {
                                                if (skipStackDepth > 0) {
                                                    remainingStack = stack.slice(
                                                        stack.indexOf(matches[0]) + matches[0].length
                                                    );
                                                    url = getScriptUrlFromStack(remainingStack, skipStackDepth - 1);
                                                } else {
                                                    url = matches[1];
                                                }
                                            }
                                        }
                                        return url;
                                    }
                                    function _farthestExecutingScript() {
                                        return null;
                                    }
                                    function _originatingExecutingScript() {
                                        return null;
                                    }
                                    function _nearestExecutingScript() {
                                        if (scripts.length === 0) {
                                            return null;
                                        }
                                        var i,
                                            e,
                                            stack,
                                            url,
                                            script,
                                            eligibleScripts = [],
                                            skipStackDepth = _nearestExecutingScript.skipStackDepth || 1,
                                            callerFnSource = null;
                                        for (i = 0; i < scripts.length; i++) {
                                            if (isNotOpera && supportsScriptReadyState) {
                                                if (scriptReadyRegex.test(scripts[i].readyState)) {
                                                    eligibleScripts.push(scripts[i]);
                                                }
                                            } else {
                                                eligibleScripts.push(scripts[i]);
                                            }
                                        }
                                        e = new Error();
                                        if (hasStackBeforeThrowing) {
                                            stack = e.stack;
                                        }
                                        if (!stack && hasStackAfterThrowing) {
                                            try {
                                                throw e;
                                            } catch (err) {
                                                stack = err.stack;
                                            }
                                        }
                                        if (stack) {
                                            url = getScriptUrlFromStack(stack, skipStackDepth);
                                            script = getScriptFromUrl(url, eligibleScripts);
                                            if (!script && pageUrl && url === pageUrl) {
                                                if (callerFnSource) {
                                                    script = getInlineScriptFromCallerSource(
                                                        callerFnSource,
                                                        eligibleScripts
                                                    );
                                                } else {
                                                    script = getSoleInlineScript(eligibleScripts);
                                                }
                                            }
                                        }
                                        if (!script) {
                                            if (eligibleScripts.length === 1) {
                                                script = eligibleScripts[0];
                                            }
                                        }
                                        if (!script) {
                                            if (hasNativeCurrentScriptAccessor) {
                                                script = document.currentScript;
                                            }
                                        }
                                        if (!script) {
                                            if (isNotOpera && supportsScriptReadyState) {
                                                for (i = eligibleScripts.length; i--; ) {
                                                    if (eligibleScripts[i].readyState === "interactive") {
                                                        script = eligibleScripts[i];
                                                        break;
                                                    }
                                                }
                                            }
                                        }
                                        if (!script) {
                                            script = eligibleScripts[eligibleScripts.length - 1] || null;
                                        }
                                        return script;
                                    }
                                    _nearestExecutingScript.skipStackDepth = 1;
                                    var currentExecutingScript = _nearestExecutingScript;
                                    currentExecutingScript.near = _nearestExecutingScript;
                                    currentExecutingScript.far = _farthestExecutingScript;
                                    currentExecutingScript.origin = _originatingExecutingScript;
                                    return currentExecutingScript;
                                });
                            });

                            function getErrorMessage$2(err) {
                                if (isObject(err) && isNotBlank(err[ERROR])) {
                                    return err[ERROR];
                                }
                                if (!isNil(err) && isNotBlank(err[MESSAGE])) {
                                    return err[MESSAGE];
                                }
                                if (isNotBlank(err)) {
                                    return err;
                                }
                                return ERROR_UNKNOWN;
                            }
                            function markMboxContainer(selector, mbox) {
                                return addClass(
                                    "" + MBOX_NAME_CLASS_PREFIX + mbox,
                                    setAttr(DATA_MBOX_NAME, mbox, selector)
                                );
                            }
                            function handleSuccess$1(mbox, selector, response) {
                                var actions = response[ACTIONS];
                                var payload = {};
                                payload[MBOX] = mbox;
                                payload[RESPONSE_TOKENS] = response[RESPONSE_TOKENS];
                                var options = {};
                                options[MBOX] = mbox;
                                options[SELECTOR] = selector;
                                options[OFFER] = actions;
                                logDebug(RENDERING_MBOX, mbox);
                                notifyRequestSucceeded(payload, actions);
                                applyOffer(options);
                            }
                            function handleError$3(mbox, selector, error) {
                                var message = getErrorMessage$2(error);
                                var payload = {};
                                payload[MBOX] = mbox;
                                payload[MESSAGE] = message;
                                logWarn(RENDERING_MBOX_FAILED, mbox, error);
                                notifyRequestFailed(payload);
                                addClass(MARKER_CSS_CLASS, removeClass(MBOX_CSS_CLASS, selector));
                            }
                            function slice(args, by) {
                                return [].slice.call(args, by);
                            }
                            function key(mbox) {
                                return MBOX + ":" + mbox;
                            }
                            function saveMbox(mbox, item) {
                                var currentMboxes = getItem(mbox);
                                if (isNil(currentMboxes)) {
                                    setItem(key(mbox), [item]);
                                } else {
                                    currentMboxes.push(item);
                                    setItem(key(mbox), currentMboxes);
                                }
                            }
                            function getMboxes(mbox) {
                                return getItem(key(mbox));
                            }
                            function renderMbox(mbox, params, selector) {
                                var config = getConfig();
                                var request = {};
                                request[MBOX] = mbox;
                                request[PARAMS] = params;
                                request[TIMEOUT] = config[TIMEOUT];
                                var payload = {};
                                payload[MBOX] = mbox;
                                var success = function success(response) {
                                    return handleSuccess$1(mbox, selector, response);
                                };
                                var error = function error(err) {
                                    return handleError$3(mbox, selector, err);
                                };
                                notifyRequestStart(payload);
                                ajax(request)
                                    .then(success)
                                    ["catch"](error);
                            }

                            var MBOX_CREATE = "[mboxCreate()]";
                            function getMboxSelector(currentScript, mbox) {
                                if (!isElement(currentScript)) {
                                    logWarn(MBOX_CREATE, CURRENT_SCRIPT_MISSING, FORCE_HEAD, mbox);
                                    return select(HEAD_TAG);
                                }
                                if (is(HEAD_TAG, parent(currentScript))) {
                                    logDebug(MBOX_CREATE, HTML_HEAD_EXECUTION, mbox);
                                    return select(HEAD_TAG);
                                }
                                var node = prev(currentScript);
                                var isContainer = is(DIV_TAG, node) && hasClass(MBOX_CSS_CLASS, node);
                                if (isContainer) {
                                    return node;
                                }
                                logDebug(MBOX_CREATE, MBOX_CONTAINER_NOT_FOUND, FORCE_HEAD, mbox);
                                return select(HEAD_TAG);
                            }
                            function executeMboxCreate(currentScript, mbox, args) {
                                if (!isDeliveryEnabled() && !isAuthoringEnabled()) {
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                var validationResult = validateMbox(mbox);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(MBOX_CREATE, validationError);
                                    return;
                                }
                                var selector = getMboxSelector(currentScript, mbox);
                                var params = getMboxParameters(mbox, args);
                                var item = {};
                                item[MBOX] = mbox;
                                item[PARAMS] = params;
                                item[SELECTOR] = markMboxContainer(selector, mbox);
                                logDebug(MBOX_CREATE, mbox, params, selector);
                                saveMbox(mbox, item);
                                if (isDeliveryEnabled()) {
                                    renderMbox(mbox, params, selector);
                                }
                            }

                            var MBOX_DEFINE = "[mboxDefine()]";
                            function getMboxSelector$1(id, mbox) {
                                var mboxNode = select("#" + id);
                                if (exists$2(mboxNode)) {
                                    return mboxNode;
                                }
                                logDebug(MBOX_DEFINE, MBOX_CONTAINER_NOT_FOUND, FORCE_HEAD, mbox);
                                return select(HEAD_TAG);
                            }
                            function executeMboxDefine(id, mbox, args) {
                                if (!isDeliveryEnabled() && !isAuthoringEnabled()) {
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                if (isBlank(id)) {
                                    logWarn(MBOX_DEFINE, MBOX_DEFINE_ID_MISSING);
                                    return;
                                }
                                var validationResult = validateMbox(mbox);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(MBOX_DEFINE, validationError);
                                    return;
                                }
                                var selector = getMboxSelector$1(id, mbox);
                                var params = getMboxParameters(mbox, args);
                                var item = {};
                                item[MBOX] = mbox;
                                item[PARAMS] = params;
                                item[SELECTOR] = markMboxContainer(selector, mbox);
                                logDebug(MBOX_DEFINE, mbox, params, selector);
                                saveMbox(mbox, item);
                            }

                            var MBOX_UPDATE = "[mboxUpdate()]";
                            function executeMboxUpdate(mbox, args) {
                                if (!isDeliveryEnabled()) {
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                var validationResult = validateMbox(mbox);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(MBOX_UPDATE, validationError);
                                    return;
                                }
                                var argsParams = arrayToParams(args);
                                argsParams[PAGE_ID_PARAM] = uuid();
                                var mboxes = getMboxes(mbox);
                                logDebug(MBOX_UPDATE, mboxes);
                                forEach(function(item) {
                                    var name = item[MBOX];
                                    var params = item[PARAMS];
                                    var selector = item[SELECTOR];
                                    renderMbox(name, assign({}, params, argsParams), selector);
                                }, mboxes);
                            }

                            function mboxCreate(mbox) {
                                var args = slice(arguments, 1);
                                currentExecutingScript.skipStackDepth = 2;
                                executeMboxCreate(currentExecutingScript(), mbox, args);
                            }
                            function mboxDefine(id, mbox) {
                                var args = slice(arguments, 2);
                                executeMboxDefine(id, mbox, args);
                            }
                            function mboxUpdate(mbox) {
                                var args = slice(arguments, 1);
                                executeMboxUpdate(mbox, args);
                            }

                            var LOAD_ERROR = "Unable to load target-vec.js";
                            var LOADING = "Loading target-vec.js";
                            var NAMESPACE = "_AT";
                            var EDITOR = "clickHandlerForExperienceEditor";
                            function initNamespace(win) {
                                win[NAMESPACE] = win[NAMESPACE] || {};
                                win[NAMESPACE].querySelectorAll = select;
                            }
                            function setupClickHandler(win, doc) {
                                doc.addEventListener(
                                    CLICK,
                                    function(event) {
                                        if (isFunction(win[NAMESPACE][EDITOR])) {
                                            win[NAMESPACE][EDITOR](event);
                                        }
                                    },
                                    true
                                );
                            }
                            function initAuthoringCode(win, doc, config) {
                                if (!isAuthoringEnabled()) {
                                    return;
                                }
                                initNamespace(win);
                                var authoringScriptUrl = config[AUTHORING_SCRIPT_URL];
                                var success = function success() {
                                    return setupClickHandler(win, doc);
                                };
                                var error = function error() {
                                    return logWarn(LOAD_ERROR);
                                };
                                logDebug(LOADING);
                                loadScript(authoringScriptUrl)
                                    .then(success)
                                    ["catch"](error);
                            }

                            function getErrorMessage$3(err) {
                                if (isObject(err) && isNotBlank(err[ERROR])) {
                                    return err[ERROR];
                                }
                                if (!isNil(err) && isNotBlank(err[MESSAGE])) {
                                    return err[MESSAGE];
                                }
                                if (isNotBlank(err)) {
                                    return err;
                                }
                                return ERROR_UNKNOWN;
                            }

                            function handleSuccess$2(mbox, selector, response) {
                                var actions = response[ACTIONS];
                                var payload = {};
                                payload[MBOX] = mbox;
                                payload[RESPONSE_TOKENS] = response[RESPONSE_TOKENS];
                                var options = {};
                                options[MBOX] = mbox;
                                options[SELECTOR] = selector;
                                options[OFFER] = actions;
                                logDebug(RENDERING_MBOX, mbox);
                                notifyRequestSucceeded(payload, actions);
                                applyOffer(options);
                            }
                            function handleError$4(mbox, error) {
                                var payload = {};
                                payload[MBOX] = mbox;
                                payload[MESSAGE] = getErrorMessage$3(error);
                                logWarn(RENDERING_MBOX_FAILED, mbox, error);
                                notifyRequestFailed(payload);
                                publish(GLOBAL_MBOX_FAILED_EVENT, mbox);
                            }
                            function createGlobalMbox() {
                                var config = getConfig();
                                var globalMboxName = config[GLOBAL_MBOX_NAME];
                                var request = {};
                                request[MBOX] = globalMboxName;
                                request[PARAMS] = getGlobalMboxParameters();
                                request[TIMEOUT] = config[TIMEOUT];
                                var success = function success(response) {
                                    return handleSuccess$2(globalMboxName, HEAD_TAG, response);
                                };
                                var error = function error(err) {
                                    return handleError$4(globalMboxName, err);
                                };
                                logDebug(RENDERING_MBOX, globalMboxName);
                                var payload = {};
                                payload[MBOX] = globalMboxName;
                                notifyRequestStart(payload);
                                ajax(request)
                                    .then(success)
                                    ["catch"](error);
                            }

                            var GLOBAL_MBOX = "[global mbox]";
                            function handleHidingSnippetRemoval(evt, globalMboxName) {
                                subscribe(evt, function(mbox) {
                                    if (mbox === globalMboxName) {
                                        removeHidingSnippetStyle();
                                        unsubscribe$1(evt);
                                    }
                                });
                            }
                            function initGlobalMbox() {
                                if (!isDeliveryEnabled()) {
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                var config = getConfig();
                                var globalMboxName = config[GLOBAL_MBOX_NAME];
                                var validationResult = validateMbox(globalMboxName);
                                var validationError = validationResult[ERROR];
                                if (!validationResult[VALID]) {
                                    logWarn(GLOBAL_MBOX, validationError);
                                    return;
                                }
                                handleHidingSnippetRemoval(GLOBAL_MBOX_FAILED_EVENT, globalMboxName);
                                handleHidingSnippetRemoval(NO_OFFERS_EVENT, globalMboxName);
                                handleHidingSnippetRemoval(SELECTORS_HIDDEN_EVENT, globalMboxName);
                                injectHidingSnippetStyle();
                                createGlobalMbox();
                            }

                            function overridePublicApi(win) {
                                var noop = function noop() {};
                                win.adobe = win.adobe || {};
                                win.adobe.target = {
                                    VERSION: "",
                                    event: {},
                                    getOffer: noop,
                                    applyOffer: noop,
                                    trackEvent: noop,
                                    registerExtension: noop,
                                    init: noop
                                };
                                win.mboxCreate = noop;
                                win.mboxDefine = noop;
                                win.mboxUpdate = noop;
                            }
                            function init(win, doc, settings) {
                                if (
                                    win.adobe &&
                                    win.adobe.target &&
                                    typeof win.adobe.target.getOffer !== "undefined"
                                ) {
                                    logWarn(ALREADY_INITIALIZED);
                                    return;
                                }
                                initConfig(settings);
                                var config = getConfig();
                                var version = config[VERSION];
                                win.adobe = win.adobe || {};
                                win.adobe.target = win.adobe.target || {};
                                win.adobe.target.VERSION = version;
                                win.adobe.target.event = {
                                    LIBRARY_LOADED: LIBRARY_LOADED,
                                    REQUEST_START: REQUEST_START,
                                    REQUEST_SUCCEEDED: REQUEST_SUCCEEDED,
                                    REQUEST_FAILED: REQUEST_FAILED$1,
                                    CONTENT_RENDERING_START: CONTENT_RENDERING_START,
                                    CONTENT_RENDERING_SUCCEEDED: CONTENT_RENDERING_SUCCEEDED,
                                    CONTENT_RENDERING_FAILED: CONTENT_RENDERING_FAILED,
                                    CONTENT_RENDERING_NO_OFFERS: CONTENT_RENDERING_NO_OFFERS,
                                    CONTENT_RENDERING_REDIRECT: CONTENT_RENDERING_REDIRECT
                                };
                                if (!config[ENABLED]) {
                                    overridePublicApi(win);
                                    logWarn(DELIVERY_DISABLED);
                                    return;
                                }
                                if (isDeliveryEnabled()) {
                                    injectStyles();
                                    initTraces();
                                }
                                initAuthoringCode(win, doc, config);
                                win.adobe.target.init = init;
                                win.adobe.target.getOffer = getOffer;
                                win.adobe.target.trackEvent = trackEvent;
                                win.adobe.target.applyOffer = applyOffer;
                                win.adobe.target.registerExtension = registerExtension;
                                win.mboxCreate = mboxCreate;
                                win.mboxDefine = mboxDefine;
                                win.mboxUpdate = mboxUpdate;
                                notifyLibraryLoaded();
                            }
                            var bootstrap = {
                                init: init,
                                initConfig: initConfig,
                                initGlobalMbox: initGlobalMbox
                            };

                            module.exports = bootstrap;

                        }

                    },
                    "adobe-target/lib/messages.js": {
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            module.exports = {
                                ALREADY_INITIALIZED: "AT: Adobe Target has already been initialized.",
                                DELIVERY_DISABLED: "AT: Adobe Target content delivery is disabled. Update your DOCTYPE to support Standards mode.",
                                NO_GLOBAL_MBOX_REQUEST: "AT: Target library is either not loaded or disabled, global mbox won't fire"
                            };
                        }

                    },
                    "adobe-target/lib/modules/mbox-params-store.js": {
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            var overrideProps = require("./object-override-util");

                            var mboxParams = {};
                            var globalMboxParams = {};

                            function mergeParams(params) {
                                overrideProps(mboxParams, params);
                            }

                            function mergeGlobalParams(params) {
                                overrideProps(globalMboxParams, params);
                            }

                            function getParams() {
                                return mboxParams;
                            }

                            function getGlobalParams() {
                                return globalMboxParams;
                            }

                            module.exports = {
                                mergeParams: mergeParams,
                                mergeGlobalParams: mergeGlobalParams,
                                getParams: getParams,
                                getGlobalParams: getGlobalParams
                            };
                        }

                    },
                    "adobe-target/lib/modules/object-override-util.js": {
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            function overrideProp(overriden, overriding, field, undef) {
                                if (overriding[field] !== undef) {
                                    overriden[field] = overriding[field]; //eslint-disable-line
                                }
                            }

                            function subsetFilter(key) {
                                if (Array.isArray(this.subset)) {
                                    return this.subset.indexOf(key) !== -1;
                                }
                                return true;
                            }

                            module.exports = function (overriden, overriding, subset) {
                                Object.keys(overriding).filter(subsetFilter, { subset: subset }).forEach(function (key) {
                                    overrideProp(overriden, overriding, key);
                                });
                            };
                        }

                    },
                    "adobe-target/lib/modules/global-mbox-common.js": {
                        "script": function(module, exports, require, turbine) {
                            "use strict";

                            /* eslint-disable import/no-extraneous-dependencies */
                            var win = require("@adobe/reactor-window");
                            var overrideProps = require("./object-override-util");

                            var _require = require("./mbox-params-store"),
                                getParams = _require.getParams,
                                getGlobalParams = _require.getGlobalParams;

                            module.exports = function (settings) {
                                var extensionSettings = turbine.getExtensionSettings();
                                var targetSettings = extensionSettings.targetSettings || {};
                                targetSettings.mboxParams = getParams();
                                targetSettings.globalMboxParams = getGlobalParams();

                                overrideProps(targetSettings, settings, ["bodyHidingEnabled", "bodyHiddenStyle"]);

                                overrideProps(targetSettings, win.targetGlobalSettings || {}, ["crossDomain", "enabled", "bodyHidingEnabled", "bodyHiddenStyle"]);

                                return targetSettings;
                            };
                        }

                    }
                },
                "settings": {
                    "targetSettings": {
                        "enabled": true,
                        "timeout": 3000,
                        "version": "1.3.0",
                        "imsOrgId": "68825AEC5A0DC5490A495E5A@AdobeOrg",
                        "clientCode": "agslaunchdemo",
                        "secureOnly": false,
                        "crossDomain": "disabled",
                        "serverDomain": "agslaunchdemo.tt.omtrdc.net",
                        "urlSizeLimit": 2048,
                        "optoutEnabled": false,
                        "globalMboxName": "target-global-mbox",
                        "bodyHiddenStyle": "body {opacity: 0}",
                        "deviceIdLifetime": 63244800000,
                        "bodyHidingEnabled": true,
                        "sessionIdLifetime": 1860000,
                        "visitorApiTimeout": 2000,
                        "authoringScriptUrl": "//cdn.tt.omtrdc.net/cdn/target-vec.js",
                        "overrideMboxEdgeServer": false,
                        "selectorsPollingTimeout": 5000,
                        "defaultContentHiddenStyle": "visibility: hidden;",
                        "defaultContentVisibleStyle": "visibility: visible;",
                        "overrideMboxEdgeServerTimeout": 1860000,
                        "supplementalDataIdParamTimeout": 30
                    }
                },
                "hostedLibFilesBaseUrl": "//assets.adobedtm.com/extensions/EP83a6f7f2a7ba47ac9ed877b5e728843a/"
            },
            "adobe-mcid": {
                "displayName": "Experience Cloud ID Service",
                "modules": {
                    "adobe-mcid/src/lib/sharedModules/mcidInstance.js": {
                        "script": function(module, exports, require, turbine) {
                            /*************************************************************************
                             * ADOBE CONFIDENTIAL
                             * ___________________
                             *
                             *  Copyright 2016 Adobe Systems Incorporated
                             *  All Rights Reserved.
                             *
                             * NOTICE:  All information contained herein is, and remains
                             * the property of Adobe Systems Incorporated and its suppliers,
                             * if any.  The intellectual and technical concepts contained
                             * herein are proprietary to Adobe Systems Incorporated and its
                             * suppliers and are protected by all applicable intellectual property
                             * laws, including trade secret and copyright laws.
                             * Dissemination of this information or reproduction of this material
                             * is strictly forbidden unless prior written permission is obtained
                             * from Adobe Systems Incorporated.
                             **************************************************************************/

                            'use strict';
                            var document = require('@adobe/reactor-document');
                            var extensionSettings = turbine.getExtensionSettings();
                            var VisitorAPI = require('../codeLibrary/VisitorAPI');

                            var transformArrayToObject = function(configs) {
                                var initConfig = configs.reduce(function(obj, config) {
                                    var value = /^(true|false)$/i.test(config.value) ? JSON.parse(config.value) : config.value;

                                    obj[config.name] = value;

                                    return obj;
                                }, {});

                                return initConfig;
                            };

                            var initializeVisitorId = function(Visitor) {
                                if (typeof extensionSettings.orgId !== 'string') {
                                    throw new TypeError('Org ID is not a string.');
                                }

                                var initConfig = transformArrayToObject(extensionSettings.variables || []);
                                var instance = Visitor.getInstance(extensionSettings.orgId, initConfig);

                                turbine.logger.info('Created instance using orgId: "' + extensionSettings.orgId + '"');
                                turbine.logger.info('Set variables: ' + JSON.stringify(initConfig));

                                // getMarketingCloudVisitorID is called automatically when the instance is created, but
                                // we call it here so that we can log the ID once it has been retrieved from the server.
                                // Calling getMarketingCloudVisitorID multiple times will not result in multiple requests
                                // to the server.
                                instance.getMarketingCloudVisitorID(function(id) {
                                    turbine.logger.info('Obtained Marketing Cloud Visitor Id: ' + id);
                                }, true);

                                return instance;
                            };

                            var excludePathsMatched = function(path) {
                                var pathExclusions = extensionSettings.pathExclusions || [];

                                return pathExclusions.some(function(pathExclusion) {
                                    if (pathExclusion.valueIsRegex) {
                                        return new RegExp(pathExclusion.value, 'i').test(path);
                                    } else {
                                        return pathExclusion.value === path;
                                    }
                                });
                            };

                            var visitorIdInstance = null;

// Overwrite the getVisitorId exposed in Turbine. This is largely for backward compatibility
// since DTM supported this method on _satellite.
                            _satellite.getVisitorId = function() { return visitorIdInstance; };

                            if (excludePathsMatched(document.location.pathname)) {
                                turbine.logger.warn('MCID library not loaded. One of the path exclusions matches the ' +
                                    'current path.');
                            } else {
                                visitorIdInstance = initializeVisitorId(VisitorAPI);
                            }

                            module.exports = visitorIdInstance;

                        }
                        ,
                        "name": "mcid-instance",
                        "shared": true
                    },
                    "adobe-mcid/src/lib/codeLibrary/VisitorAPI.js": {
                        "script": function(module, exports, require, turbine) {
                            /* istanbul ignore next */
                            module.exports = function() {

                                var e=function(){"use strict";function e(){return{callbacks:{},add:function(e,t){this.callbacks[e]=this.callbacks[e]||[];var i=this.callbacks[e].push(t)-1;return function(){this.callbacks[e].splice(i,1)}},execute:function(e,t){if(this.callbacks[e]){t=void 0===t?[]:t,t=t instanceof Array?t:[t];try{for(;this.callbacks[e].length;){var i=this.callbacks[e].shift();"function"==typeof i?i.apply(null,t):i instanceof Array&&i[1].apply(i[0],t)}delete this.callbacks[e]}catch(e){}}},executeAll:function(e,t){(t||e&&!v.isObjectEmpty(e))&&Object.keys(this.callbacks).forEach(function(t){var i=void 0!==e[t]?e[t]:"";this.execute(t,i)},this)},hasCallbacks:function(){return Boolean(Object.keys(this.callbacks).length)}}}function t(e){for(var t=/^\d+$/,i=0,n=e.length;i<n;i++)if(!t.test(e[i]))return!1;return!0}function i(e,t){for(;e.length<t.length;)e.push("0");for(;t.length<e.length;)t.push("0")}function n(e,t){for(var i=0;i<e.length;i++){var n=parseInt(e[i],10),r=parseInt(t[i],10);if(n>r)return 1;if(r>n)return-1}return 0}function r(e,r){if(e===r)return 0;var a=e.toString().split("."),s=r.toString().split(".");return t(a.concat(s))?(i(a,s),n(a,s)):NaN}var a="undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:{};Object.assign=Object.assign||function(e){for(var t,i,n=1;n<arguments.length;++n){i=arguments[n];for(t in i)Object.prototype.hasOwnProperty.call(i,t)&&(e[t]=i[t])}return e};var s={HANDSHAKE:"HANDSHAKE",GETSTATE:"GETSTATE",PARENTSTATE:"PARENTSTATE"},o={MCMID:"MCMID",MCAID:"MCAID",MCAAMB:"MCAAMB",MCAAMLH:"MCAAMLH",MCOPTOUT:"MCOPTOUT",CUSTOMERIDS:"CUSTOMERIDS"},l={MCMID:"getMarketingCloudVisitorID",MCAID:"getAnalyticsVisitorID",MCAAMB:"getAudienceManagerBlob",MCAAMLH:"getAudienceManagerLocationHint",MCOPTOUT:"getOptOut"},d={CUSTOMERIDS:"getCustomerIDs"},c={MCMID:"getMarketingCloudVisitorID",MCAAMB:"getAudienceManagerBlob",MCAAMLH:"getAudienceManagerLocationHint",MCOPTOUT:"getOptOut",MCAID:"getAnalyticsVisitorID",CUSTOMERIDS:"getCustomerIDs"},u={MC:"MCMID",A:"MCAID",AAM:"MCAAMB"},f={MCMID:"MCMID",MCOPTOUT:"MCOPTOUT",MCAID:"MCAID",MCAAMLH:"MCAAMLH",MCAAMB:"MCAAMB"},g={UNKNOWN:0,AUTHENTICATED:1,LOGGED_OUT:2},m={GLOBAL:"global"},_={MESSAGES:s,STATE_KEYS_MAP:o,ASYNC_API_MAP:l,SYNC_API_MAP:d,ALL_APIS:c,FIELDGROUP_TO_FIELD:u,FIELDS:f,AUTH_STATE:g,OPT_OUT:m},h=_.STATE_KEYS_MAP,p=function(e){function t(){}function i(t,i){var n=this;return function(){var t=e(0,h.MCMID),r={};return r[h.MCMID]=t,n.setStateAndPublish(r),i(t),t}}this.getMarketingCloudVisitorID=function(e){e=e||t;var n=this.findField(h.MCMID,e),r=i.call(this,h.MCMID,e);return void 0!==n?n:r()}},C=_.MESSAGES,S=_.ASYNC_API_MAP,I=_.SYNC_API_MAP,D=function(){function e(){}function t(e,t){var i=this;return function(){return i.callbackRegistry.add(e,t),i.messageParent(C.GETSTATE),""}}function i(i){this[S[i]]=function(n){n=n||e;var r=this.findField(i,n),a=t.call(this,i,n);return void 0!==r?r:a()}}function n(t){this[I[t]]=function(){return this.findField(t,e)||{}}}Object.keys(S).forEach(i,this),Object.keys(I).forEach(n,this)},A=_.ASYNC_API_MAP,M=function(){Object.keys(A).forEach(function(e){this[A[e]]=function(t){this.callbackRegistry.add(e,t)}},this)},v=function(e,t){return t={exports:{}},e(t,t.exports),t.exports}(function(e,t){t.isObjectEmpty=function(e){return e===Object(e)&&0===Object.keys(e).length},t.isValueEmpty=function(e){return""===e||t.isObjectEmpty(e)},t.getIeVersion=function(){if(document.documentMode)return document.documentMode;for(var e=7;e>4;e--){var t=document.createElement("div");if(t.innerHTML="\x3c!--[if IE "+e+"]><span></span><![endif]--\x3e",t.getElementsByTagName("span").length)return t=null,e;t=null}return null},t.encodeAndBuildRequest=function(e,t){return e.map(encodeURIComponent).join(t)},t.isObject=function(e){return null!==e&&"object"==typeof e&&!1===Array.isArray(e)}}),y=(v.isObjectEmpty,v.isValueEmpty,v.getIeVersion,v.encodeAndBuildRequest,v.isObject,e),b=_.MESSAGES,T={0:"prefix",1:"orgID",2:"state"},k=function(e,t){this.parse=function(e){try{var t={};return e.data.split("|").forEach(function(e,i){if(void 0!==e){t[T[i]]=2!==i?e:JSON.parse(e)}}),t}catch(e){}},this.isInvalid=function(i){var n=this.parse(i);if(!n||Object.keys(n).length<2)return!0;var r=e!==n.orgID,a=!t||i.origin!==t,s=-1===Object.keys(b).indexOf(n.prefix);return r||a||s},this.send=function(i,n,r){var a=n+"|"+e;r&&r===Object(r)&&(a+="|"+JSON.stringify(r));try{i.postMessage(a,t)}catch(e){}}},O=_.MESSAGES,E=function(e,t,i,n){function r(e){Object.assign(m,e)}function s(e){Object.assign(m.state,e),m.callbackRegistry.executeAll(m.state)}function o(e){if(!C.isInvalid(e)){h=!1;var t=C.parse(e);m.setStateAndPublish(t.state)}}function l(e){!h&&_&&(h=!0,C.send(n,e))}function d(){r(new p(i._generateID)),m.getMarketingCloudVisitorID(),m.callbackRegistry.executeAll(m.state,!0),a.removeEventListener("message",c)}function c(e){if(!C.isInvalid(e)){var t=C.parse(e);h=!1,a.clearTimeout(m._handshakeTimeout),a.removeEventListener("message",c),r(new D(m)),a.addEventListener("message",o),m.setStateAndPublish(t.state),m.callbackRegistry.hasCallbacks()&&l(O.GETSTATE)}}function u(){_&&postMessage?(a.addEventListener("message",c),l(O.HANDSHAKE),m._handshakeTimeout=setTimeout(d,250)):d()}function f(){a.s_c_in||(a.s_c_il=[],a.s_c_in=0),m._c="Visitor",m._il=a.s_c_il,m._in=a.s_c_in,m._il[m._in]=m,a.s_c_in++}function g(){function e(e){0!==e.indexOf("_")&&"function"==typeof i[e]&&(m[e]=function(){})}Object.keys(i).forEach(e),m.getSupplementalDataID=i.getSupplementalDataID}var m=this,_=t.whitelistParentDomain;m.state={},m.version=i.version,m.marketingCloudOrgID=e,m.cookieDomain=i.cookieDomain||"",m._instanceType="child";var h=!1,C=new k(e,_);m.callbackRegistry=y(),m.init=function(){f(),g(),r(new M(m)),u()},m.findField=function(e,t){if(m.state[e])return t(m.state[e]),m.state[e]},m.messageParent=l,m.setStateAndPublish=s},L=_.MESSAGES,P=_.ALL_APIS,R=_.ASYNC_API_MAP,F=_.FIELDGROUP_TO_FIELD,w=function(e,t){function i(){var t={};return Object.keys(P).forEach(function(i){var n=P[i],r=e[n]();v.isValueEmpty(r)||(t[i]=r)}),t}function n(){var t=[];return e._loading&&Object.keys(e._loading).forEach(function(i){if(e._loading[i]){var n=F[i];t.push(n)}}),t.length?t:null}function r(t){return function i(r){var a=n();if(a){var s=R[a[0]];e[s](i,!0)}else t()}}function a(e,n){var r=i();t.send(e,n,r)}function s(e){l(e),a(e,L.HANDSHAKE)}function o(e){r(function(){a(e,L.PARENTSTATE)})()}function l(i){function n(n){r.call(e,n),t.send(i,L.PARENTSTATE,{CUSTOMERIDS:e.getCustomerIDs()})}var r=e.setCustomerIDs;e.setCustomerIDs=n}return function(e){if(!t.isInvalid(e)){(t.parse(e).prefix===L.HANDSHAKE?s:o)(e.source)}}},V=function(e,t){function i(e){return function(i){n[e]=i,r++,r===a&&t(n)}}var n={},r=0,a=Object.keys(e).length;Object.keys(e).forEach(function(t){var n=e[t];if(n.fn){var r=n.args||[];r.unshift(i(t)),n.fn.apply(n.context||null,r)}})},N=function(e){var t;if(!e&&a.location&&(e=a.location.hostname),t=e)if(/^[0-9.]+$/.test(t))t="";else{var i=",ac,ad,ae,af,ag,ai,al,am,an,ao,aq,ar,as,at,au,aw,ax,az,ba,bb,be,bf,bg,bh,bi,bj,bm,bo,br,bs,bt,bv,bw,by,bz,ca,cc,cd,cf,cg,ch,ci,cl,cm,cn,co,cr,cu,cv,cw,cx,cz,de,dj,dk,dm,do,dz,ec,ee,eg,es,et,eu,fi,fm,fo,fr,ga,gb,gd,ge,gf,gg,gh,gi,gl,gm,gn,gp,gq,gr,gs,gt,gw,gy,hk,hm,hn,hr,ht,hu,id,ie,im,in,io,iq,ir,is,it,je,jo,jp,kg,ki,km,kn,kp,kr,ky,kz,la,lb,lc,li,lk,lr,ls,lt,lu,lv,ly,ma,mc,md,me,mg,mh,mk,ml,mn,mo,mp,mq,mr,ms,mt,mu,mv,mw,mx,my,na,nc,ne,nf,ng,nl,no,nr,nu,nz,om,pa,pe,pf,ph,pk,pl,pm,pn,pr,ps,pt,pw,py,qa,re,ro,rs,ru,rw,sa,sb,sc,sd,se,sg,sh,si,sj,sk,sl,sm,sn,so,sr,st,su,sv,sx,sy,sz,tc,td,tf,tg,th,tj,tk,tl,tm,tn,to,tp,tr,tt,tv,tw,tz,ua,ug,uk,us,uy,uz,va,vc,ve,vg,vi,vn,vu,wf,ws,yt,",n=t.split("."),r=n.length-1,s=r-1;if(r>1&&n[r].length<=2&&(2===n[r-1].length||i.indexOf(","+n[r]+",")<0)&&s--,s>0)for(t="";r>=s;)t=n[r]+(t?".":"")+t,r--}return t},x={compare:r,isLessThan:function(e,t){return r(e,t)<0},areVersionsDifferent:function(e,t){return 0!==r(e,t)},isGreaterThan:function(e,t){return r(e,t)>0},isEqual:function(e,t){return 0===r(e,t)}},j=!!a.postMessage,U={postMessage:function(e,t,i){var n=1;t&&(j?i.postMessage(e,t.replace(/([^:]+:\/\/[^\/]+).*/,"$1")):t&&(i.location=t.replace(/#.*$/,"")+"#"+ +new Date+n+++"&"+e))},receiveMessage:function(e,t){var i;try{j&&(e&&(i=function(i){if("string"==typeof t&&i.origin!==t||"[object Function]"===Object.prototype.toString.call(t)&&!1===t(i.origin))return!1;e(i)}),a.addEventListener?a[e?"addEventListener":"removeEventListener"]("message",i):a[e?"attachEvent":"detachEvent"]("onmessage",i))}catch(e){}}},H=function(e){var t,i,n="0123456789",r="",a="",s=8,o=10,l=10;if(1==e){for(n+="ABCDEF",t=0;16>t;t++)i=Math.floor(Math.random()*s),r+=n.substring(i,i+1),i=Math.floor(Math.random()*s),a+=n.substring(i,i+1),s=16;return r+"-"+a}for(t=0;19>t;t++)i=Math.floor(Math.random()*o),r+=n.substring(i,i+1),0===t&&9==i?o=3:(1==t||2==t)&&10!=o&&2>i?o=10:2<t&&(o=10),i=Math.floor(Math.random()*l),a+=n.substring(i,i+1),0===t&&9==i?l=3:(1==t||2==t)&&10!=l&&2>i?l=10:2<t&&(l=10);return r+a},B=function(e,t){return{corsMetadata:function(){var e="none",t=!0;return"undefined"!=typeof XMLHttpRequest&&XMLHttpRequest===Object(XMLHttpRequest)&&("withCredentials"in new XMLHttpRequest?e="XMLHttpRequest":"undefined"!=typeof XDomainRequest&&XDomainRequest===Object(XDomainRequest)&&(t=!1),Object.prototype.toString.call(a.HTMLElement).indexOf("Constructor")>0&&(t=!1)),{corsType:e,corsCookiesEnabled:t}}(),getCORSInstance:function(){return"none"===this.corsMetadata.corsType?null:new a[this.corsMetadata.corsType]},fireCORS:function(t,i,n){function r(e){var i;try{if((i=JSON.parse(e))!==Object(i))return void s.handleCORSError(t,null,"Response is not JSON")}catch(e){return void s.handleCORSError(t,e,"Error parsing response as JSON")}try{for(var n=t.callback,r=a,o=0;o<n.length;o++)r=r[n[o]];r(i)}catch(e){s.handleCORSError(t,e,"Error forming callback function")}}var s=this;i&&(t.loadErrorHandler=i);try{var o=this.getCORSInstance();o.open("get",t.corsUrl+"&ts="+(new Date).getTime(),!0),"XMLHttpRequest"===this.corsMetadata.corsType&&(o.withCredentials=!0,o.timeout=e.loadTimeout,o.setRequestHeader("Content-Type","application/x-www-form-urlencoded"),o.onreadystatechange=function(){4===this.readyState&&200===this.status&&r(this.responseText)}),o.onerror=function(e){s.handleCORSError(t,e,"onerror")},o.ontimeout=function(e){s.handleCORSError(t,e,"ontimeout")},o.send(),e._log.requests.push(t.corsUrl)}catch(e){this.handleCORSError(t,e,"try-catch")}},handleCORSError:function(t,i,n){e.CORSErrors.push({corsData:t,error:i,description:n}),t.loadErrorHandler&&("ontimeout"===n?t.loadErrorHandler(!0):t.loadErrorHandler(!1))}}},G={POST_MESSAGE_ENABLED:!!a.postMessage,DAYS_BETWEEN_SYNC_ID_CALLS:1,MILLIS_PER_DAY:864e5,ADOBE_MC:"adobe_mc",ADOBE_MC_SDID:"adobe_mc_sdid",VALID_VISITOR_ID_REGEX:/^[0-9a-fA-F\-]+$/,ADOBE_MC_TTL_IN_MIN:5,VERSION_REGEX:/vVersion\|((\d+\.)?(\d+\.)?(\*|\d+))(?=$|\|)/},q=function(e,t){var i=a.document;return{THROTTLE_START:3e4,MAX_SYNCS_LENGTH:649,throttleTimerSet:!1,id:null,onPagePixels:[],iframeHost:null,getIframeHost:function(e){if("string"==typeof e){var t=e.split("/");return t[0]+"//"+t[2]}},subdomain:null,url:null,getUrl:function(){var t,n="http://fast.",r="?d_nsid="+e.idSyncContainerID+"#"+encodeURIComponent(i.location.origin);return this.subdomain||(this.subdomain="nosubdomainreturned"),e.loadSSL&&(n=e.idSyncSSLUseAkamai?"https://fast.":"https://"),t=n+this.subdomain+".demdex.net/dest5.html"+r,this.iframeHost=this.getIframeHost(t),this.id="destination_publishing_iframe_"+this.subdomain+"_"+e.idSyncContainerID,t},checkDPIframeSrc:function(){var t="?d_nsid="+e.idSyncContainerID+"#"+encodeURIComponent(i.location.href);"string"==typeof e.dpIframeSrc&&e.dpIframeSrc.length&&(this.id="destination_publishing_iframe_"+(e._subdomain||this.subdomain||(new Date).getTime())+"_"+e.idSyncContainerID,this.iframeHost=this.getIframeHost(e.dpIframeSrc),this.url=e.dpIframeSrc+t)},idCallNotProcesssed:null,doAttachIframe:!1,startedAttachingIframe:!1,iframeHasLoaded:null,iframeIdChanged:null,newIframeCreated:null,originalIframeHasLoadedAlready:null,iframeLoadedCallbacks:[],regionChanged:!1,timesRegionChanged:0,sendingMessages:!1,messages:[],messagesPosted:[],messagesReceived:[],messageSendingInterval:G.POST_MESSAGE_ENABLED?null:100,jsonForComparison:[],jsonDuplicates:[],jsonWaiting:[],jsonProcessed:[],canSetThirdPartyCookies:!0,receivedThirdPartyCookiesNotification:!1,readyToAttachIframePreliminary:function(){return!(e.idSyncDisableSyncs||e.disableIdSyncs||e.idSyncDisable3rdPartySyncing||e.disableThirdPartyCookies||e.disableThirdPartyCalls)},readyToAttachIframe:function(){return this.readyToAttachIframePreliminary()&&(this.doAttachIframe||e._doAttachIframe)&&(this.subdomain&&"nosubdomainreturned"!==this.subdomain||e._subdomain)&&this.url&&!this.startedAttachingIframe},attachIframe:function(){function e(){r=i.createElement("iframe"),r.sandbox="allow-scripts allow-same-origin",r.title="Adobe ID Syncing iFrame",r.id=n.id,r.name=n.id+"_name",r.style.cssText="display: none; width: 0; height: 0;",r.src=n.url,n.newIframeCreated=!0,t(),i.body.appendChild(r)}function t(e){r.addEventListener("load",function(){r.className="aamIframeLoaded",n.iframeHasLoaded=!0,n.fireIframeLoadedCallbacks(e),n.requestToProcess()})}this.startedAttachingIframe=!0;var n=this,r=i.getElementById(this.id);r?"IFRAME"!==r.nodeName?(this.id+="_2",this.iframeIdChanged=!0,e()):(this.newIframeCreated=!1,"aamIframeLoaded"!==r.className?(this.originalIframeHasLoadedAlready=!1,t("The destination publishing iframe already exists from a different library, but hadn't loaded yet.")):(this.originalIframeHasLoadedAlready=!0,this.iframeHasLoaded=!0,this.iframe=r,this.fireIframeLoadedCallbacks("The destination publishing iframe already exists from a different library, and had loaded alresady."),this.requestToProcess())):e(),this.iframe=r},fireIframeLoadedCallbacks:function(e){this.iframeLoadedCallbacks.forEach(function(t){"function"==typeof t&&t({message:e||"The destination publishing iframe was attached and loaded successfully."})}),this.iframeLoadedCallbacks=[]},requestToProcess:function(t){function i(){r.jsonForComparison.push(t),r.jsonWaiting.push(t),r.processSyncOnPage(t)}var n,r=this;if(t===Object(t)&&t.ibs)if(n=JSON.stringify(t.ibs||[]),this.jsonForComparison.length){var a,s,o,l=!1;for(a=0,s=this.jsonForComparison.length;a<s;a++)if(o=this.jsonForComparison[a],n===JSON.stringify(o.ibs||[])){l=!0;break}l?this.jsonDuplicates.push(t):i()}else i();if((this.receivedThirdPartyCookiesNotification||!G.POST_MESSAGE_ENABLED||this.iframeHasLoaded)&&this.jsonWaiting.length){var d=this.jsonWaiting.shift();this.process(d),this.requestToProcess()}e.idSyncDisableSyncs||e.disableIdSyncs||!this.iframeHasLoaded||!this.messages.length||this.sendingMessages||(this.throttleTimerSet||(this.throttleTimerSet=!0,setTimeout(function(){r.messageSendingInterval=G.POST_MESSAGE_ENABLED?null:150},this.THROTTLE_START)),this.sendingMessages=!0,this.sendMessages())},getRegionAndCheckIfChanged:function(t,i){var n=e._getField("MCAAMLH"),r=t.d_region||t.dcs_region;return n?r&&(e._setFieldExpire("MCAAMLH",i),e._setField("MCAAMLH",r),parseInt(n,10)!==r&&(this.regionChanged=!0,this.timesRegionChanged++,e._setField("MCSYNCSOP",""),e._setField("MCSYNCS",""),n=r)):(n=r)&&(e._setFieldExpire("MCAAMLH",i),e._setField("MCAAMLH",n)),n||(n=""),n},processSyncOnPage:function(e){var t,i,n,r;if((t=e.ibs)&&t instanceof Array&&(i=t.length))for(n=0;n<i;n++)r=t[n],r.syncOnPage&&this.checkFirstPartyCookie(r,"","syncOnPage")},process:function(e){var t,i,n,r,a,s=encodeURIComponent,o=!1;if((t=e.ibs)&&t instanceof Array&&(i=t.length))for(o=!0,n=0;n<i;n++)r=t[n],a=[s("ibs"),s(r.id||""),s(r.tag||""),v.encodeAndBuildRequest(r.url||[],","),s(r.ttl||""),"","",r.fireURLSync?"true":"false"],r.syncOnPage||(this.canSetThirdPartyCookies?this.addMessage(a.join("|")):r.fireURLSync&&this.checkFirstPartyCookie(r,a.join("|")));o&&this.jsonProcessed.push(e)},checkFirstPartyCookie:function(t,i,n){var r="syncOnPage"===n,a=r?"MCSYNCSOP":"MCSYNCS";e._readVisitor();var s,o,l=e._getField(a),d=!1,c=!1,u=Math.ceil((new Date).getTime()/G.MILLIS_PER_DAY);l?(s=l.split("*"),o=this.pruneSyncData(s,t.id,u),d=o.dataPresent,c=o.dataValid,d&&c||this.fireSync(r,t,i,s,a,u)):(s=[],this.fireSync(r,t,i,s,a,u))},pruneSyncData:function(e,t,i){var n,r,a,s=!1,o=!1;for(r=0;r<e.length;r++)n=e[r],a=parseInt(n.split("-")[1],10),n.match("^"+t+"-")?(s=!0,i<a?o=!0:(e.splice(r,1),r--)):i>=a&&(e.splice(r,1),r--);return{dataPresent:s,dataValid:o}},manageSyncsSize:function(e){if(e.join("*").length>this.MAX_SYNCS_LENGTH)for(e.sort(function(e,t){return parseInt(e.split("-")[1],10)-parseInt(t.split("-")[1],10)});e.join("*").length>this.MAX_SYNCS_LENGTH;)e.shift()},fireSync:function(t,i,n,r,a,s){var o=this;if(t){if("img"===i.tag){var l,d,c,u,f=i.url,g=e.loadSSL?"https:":"http:";for(l=0,d=f.length;l<d;l++){c=f[l],u=/^\/\//.test(c);var m=new Image;m.addEventListener("load",function(t,i,n,r){return function(){o.onPagePixels[t]=null,e._readVisitor();var s,l=e._getField(a),d=[];if(l){s=l.split("*");var c,u,f;for(c=0,u=s.length;c<u;c++)f=s[c],f.match("^"+i.id+"-")||d.push(f)}o.setSyncTrackingData(d,i,n,r)}}(this.onPagePixels.length,i,a,s)),m.src=(u?g:"")+c,this.onPagePixels.push(m)}}}else this.addMessage(n),this.setSyncTrackingData(r,i,a,s)},addMessage:function(t){var i=encodeURIComponent,n=i(e._enableErrorReporting?"---destpub-debug---":"---destpub---");this.messages.push((G.POST_MESSAGE_ENABLED?"":n)+t)},setSyncTrackingData:function(t,i,n,r){t.push(i.id+"-"+(r+Math.ceil(i.ttl/60/24))),this.manageSyncsSize(t),e._setField(n,t.join("*"))},sendMessages:function(){var e,t=this,i="",n=encodeURIComponent;this.regionChanged&&(i=n("---destpub-clear-dextp---"),this.regionChanged=!1),this.messages.length?G.POST_MESSAGE_ENABLED?(e=i+n("---destpub-combined---")+this.messages.join("%01"),this.postMessage(e),this.messages=[],this.sendingMessages=!1):(e=this.messages.shift(),this.postMessage(i+e),setTimeout(function(){t.sendMessages()},this.messageSendingInterval)):this.sendingMessages=!1},postMessage:function(e){U.postMessage(e,this.url,this.iframe.contentWindow),this.messagesPosted.push(e)},receiveMessage:function(e){var t,i=/^---destpub-to-parent---/;"string"==typeof e&&i.test(e)&&(t=e.replace(i,"").split("|"),"canSetThirdPartyCookies"===t[0]&&(this.canSetThirdPartyCookies="true"===t[1],this.receivedThirdPartyCookiesNotification=!0,this.requestToProcess()),this.messagesReceived.push(e))},processIDCallData:function(n){(null==this.url||n.subdomain&&"nosubdomainreturned"===this.subdomain)&&("string"==typeof e._subdomain&&e._subdomain.length?this.subdomain=e._subdomain:this.subdomain=n.subdomain||"",this.url=this.getUrl()),n.ibs instanceof Array&&n.ibs.length&&(this.doAttachIframe=!0),this.readyToAttachIframe()&&(e.idSyncAttachIframeOnWindowLoad?(t.windowLoaded||"complete"===i.readyState||"loaded"===i.readyState)&&this.attachIframe():this.attachIframeASAP()),"function"==typeof e.idSyncIDCallResult?e.idSyncIDCallResult(n):this.requestToProcess(n),"function"==typeof e.idSyncAfterIDCallResult&&e.idSyncAfterIDCallResult(n)},canMakeSyncIDCall:function(t,i){return e._forceSyncIDCall||!t||i-t>G.DAYS_BETWEEN_SYNC_ID_CALLS},attachIframeASAP:function(){function e(){t.startedAttachingIframe||(i.body?t.attachIframe():setTimeout(e,30))}var t=this;e()}}},Y={audienceManagerServer:{},audienceManagerServerSecure:{},cookieDomain:{},cookieLifetime:{},cookieName:{},disableThirdPartyCalls:{},idSyncAfterIDCallResult:{},idSyncAttachIframeOnWindowLoad:{},idSyncContainerID:{},idSyncDisable3rdPartySyncing:{},disableThirdPartyCookies:{},idSyncDisableSyncs:{},disableIdSyncs:{},idSyncIDCallResult:{},idSyncSSLUseAkamai:{},isCoopSafe:{},loadSSL:{},loadTimeout:{},marketingCloudServer:{},marketingCloudServerSecure:{},overwriteCrossDomainMCIDAndAID:{},resetBeforeVersion:{},sdidParamExpiry:{},serverState:{},sessionCookieName:{},secureCookie:{},takeTimeoutMetrics:{},trackingServer:{},trackingServerSecure:{},whitelistIframeDomains:{},whitelistParentDomain:{}},X={getConfigNames:function(){return Object.keys(Y)},getConfigs:function(){return Y}},W=function(e,t,i){function n(e){var t=e;return function(e){var i=e||c.location.href;try{var n=d._extractParamFromUri(i,t);if(n)return y.parsePipeDelimetedKeyValues(n)}catch(e){}}}function r(e){function t(e,t){e&&e.match(G.VALID_VISITOR_ID_REGEX)&&t(e)}t(e[m],d.setMarketingCloudVisitorID),d._setFieldExpire(I,-1),t(e[C],d.setAnalyticsVisitorID)}function s(e){e=e||{},d._supplementalDataIDCurrent=e.supplementalDataIDCurrent||"",d._supplementalDataIDCurrentConsumed=e.supplementalDataIDCurrentConsumed||{},d._supplementalDataIDLast=e.supplementalDataIDLast||"",d._supplementalDataIDLastConsumed=e.supplementalDataIDLastConsumed||{}}function o(e){function t(e,t,i){return i=i?i+="|":i,i+=e+"="+encodeURIComponent(t)}function i(e,i){var n=i[0],r=i[1];return null!=r&&r!==D&&(e=t(n,r,e)),e}var n=e.reduce(i,"");return function(e){var t=y.getTimestampInSeconds();return e=e?e+="|":e,e+="TS="+t}(n)}function l(e){var t=e.minutesToLive,i="";return(d.idSyncDisableSyncs||d.disableIdSyncs)&&(i=i||"Error: id syncs have been disabled"),"string"==typeof e.dpid&&e.dpid.length||(i=i||"Error: config.dpid is empty"),"string"==typeof e.url&&e.url.length||(i=i||"Error: config.url is empty"),void 0===t?t=20160:(t=parseInt(t,10),(isNaN(t)||t<=0)&&(i=i||"Error: config.minutesToLive needs to be a positive number")),{error:i,ttl:t}}if(!i||i.split("").reverse().join("")!==e)throw new Error("Please use `Visitor.getInstance` to instantiate Visitor.");var d=this;d.version="3.3.0";var c=a,u=c.Visitor;u.version=d.version,u.AuthState=_.AUTH_STATE,u.OptOut=_.OPT_OUT,c.s_c_in||(c.s_c_il=[],c.s_c_in=0),d._c="Visitor",d._il=c.s_c_il,d._in=c.s_c_in,d._il[d._in]=d,c.s_c_in++,d._instanceType="regular",d._log={requests:[]},d.marketingCloudOrgID=e,d.cookieName="AMCV_"+e,d.sessionCookieName="AMCVS_"+e,d.cookieDomain=N(),d.cookieDomain===c.location.hostname&&(d.cookieDomain=""),d.loadSSL=c.location.protocol.toLowerCase().indexOf("https")>=0,d.loadTimeout=3e4,d.CORSErrors=[],d.marketingCloudServer=d.audienceManagerServer="dpm.demdex.net",d.sdidParamExpiry=30;var f=c.document,g=null,m="MCMID",h="MCIDTS",p="A",C="MCAID",S="AAM",I="MCAAMB",D="NONE",A=function(e){return!Object.prototype[e]},M=B(d);d.FIELDS=_.FIELDS,d.cookieRead=function(e){e=encodeURIComponent(e);var t=(";"+f.cookie).split(" ").join(";"),i=t.indexOf(";"+e+"="),n=i<0?i:t.indexOf(";",i+1);return i<0?"":decodeURIComponent(t.substring(i+2+e.length,n<0?t.length:n))},d.cookieWrite=function(e,t,i){var n,r=d.cookieLifetime,a="";if(t=""+t,r=r?(""+r).toUpperCase():"",i&&"SESSION"!==r&&"NONE"!==r){if(n=""!==t?parseInt(r||0,10):-60)i=new Date,i.setTime(i.getTime()+1e3*n);else if(1===i){i=new Date;var s=i.getYear();i.setYear(s+2+(s<1900?1900:0))}}else i=0;return e&&"NONE"!==r?(d.configs&&d.configs.secureCookie&&"https:"===location.protocol&&(a="Secure"),f.cookie=encodeURIComponent(e)+"="+encodeURIComponent(t)+"; path=/;"+(i?" expires="+i.toGMTString()+";":"")+(d.cookieDomain?" domain="+d.cookieDomain+";":"")+a,d.cookieRead(e)===t):0},d.resetState=function(e){e?d._mergeServerState(e):s()},d._isAllowedDone=!1,d._isAllowedFlag=!1,d.isAllowed=function(){return d._isAllowedDone||(d._isAllowedDone=!0,(d.cookieRead(d.cookieName)||d.cookieWrite(d.cookieName,"T",1))&&(d._isAllowedFlag=!0)),d._isAllowedFlag},d.setMarketingCloudVisitorID=function(e){d._setMarketingCloudFields(e)},d._use1stPartyMarketingCloudServer=!1,d.getMarketingCloudVisitorID=function(e,t){if(d.isAllowed()){d.marketingCloudServer&&d.marketingCloudServer.indexOf(".demdex.net")<0&&(d._use1stPartyMarketingCloudServer=!0);var i=d._getAudienceManagerURLData("_setMarketingCloudFields"),n=i.url;return d._getRemoteField(m,n,e,t,i)}return""},d.getVisitorValues=function(e,t){var i={MCMID:{fn:d.getMarketingCloudVisitorID,args:[!0],context:d},MCOPTOUT:{fn:d.isOptedOut,args:[void 0,!0],context:d},MCAID:{fn:d.getAnalyticsVisitorID,args:[!0],context:d},MCAAMLH:{fn:d.getAudienceManagerLocationHint,args:[!0],context:d},MCAAMB:{fn:d.getAudienceManagerBlob,args:[!0],context:d}},n=t&&t.length?y.pluck(i,t):i;V(n,e)},d._currentCustomerIDs={},d._customerIDsHashChanged=!1,d._newCustomerIDsHash="",d.setCustomerIDs=function(e){function t(){d._customerIDsHashChanged=!1}if(d.isAllowed()&&e){if(!v.isObject(e)||v.isObjectEmpty(e))return!1;d._readVisitor();var i,n;for(i in e)if(A(i)&&(n=e[i]))if("object"==typeof n){var r={};n.id&&(r.id=n.id),void 0!=n.authState&&(r.authState=n.authState),d._currentCustomerIDs[i]=r}else d._currentCustomerIDs[i]={id:n};var a=d.getCustomerIDs(),s=d._getField("MCCIDH"),o="";s||(s=0);for(i in a)A(i)&&(n=a[i],o+=(o?"|":"")+i+"|"+(n.id?n.id:"")+(n.authState?n.authState:""));d._newCustomerIDsHash=String(d._hash(o)),d._newCustomerIDsHash!==s&&(d._customerIDsHashChanged=!0,d._mapCustomerIDs(t))}},d.getCustomerIDs=function(){d._readVisitor();var e,t,i={};for(e in d._currentCustomerIDs)A(e)&&(t=d._currentCustomerIDs[e],i[e]||(i[e]={}),t.id&&(i[e].id=t.id),void 0!=t.authState?i[e].authState=t.authState:i[e].authState=u.AuthState.UNKNOWN);return i},d.setAnalyticsVisitorID=function(e){d._setAnalyticsFields(e)},d.getAnalyticsVisitorID=function(e,t,i){if(!y.isTrackingServerPopulated()&&!i)return d._callCallback(e,[""]),"";if(d.isAllowed()){var n="";if(i||(n=d.getMarketingCloudVisitorID(function(t){d.getAnalyticsVisitorID(e,!0)})),n||i){var r=i?d.marketingCloudServer:d.trackingServer,a="";d.loadSSL&&(i?d.marketingCloudServerSecure&&(r=d.marketingCloudServerSecure):d.trackingServerSecure&&(r=d.trackingServerSecure));var s={};if(r){var o="http"+(d.loadSSL?"s":"")+"://"+r+"/id",l="d_visid_ver="+d.version+"&mcorgid="+encodeURIComponent(d.marketingCloudOrgID)+(n?"&mid="+encodeURIComponent(n):"")+(d.idSyncDisable3rdPartySyncing||d.disableThirdPartyCookies?"&d_coppa=true":""),c=["s_c_il",d._in,"_set"+(i?"MarketingCloud":"Analytics")+"Fields"];a=o+"?"+l+"&callback=s_c_il%5B"+d._in+"%5D._set"+(i?"MarketingCloud":"Analytics")+"Fields",s.corsUrl=o+"?"+l,s.callback=c}return s.url=a,d._getRemoteField(i?m:C,a,e,t,s)}}return""},d.getAudienceManagerLocationHint=function(e,t){if(d.isAllowed()){if(d.getMarketingCloudVisitorID(function(t){d.getAudienceManagerLocationHint(e,!0)})){var i=d._getField(C);if(!i&&y.isTrackingServerPopulated()&&(i=d.getAnalyticsVisitorID(function(t){d.getAudienceManagerLocationHint(e,!0)})),i||!y.isTrackingServerPopulated()){var n=d._getAudienceManagerURLData(),r=n.url;return d._getRemoteField("MCAAMLH",r,e,t,n)}}}return""},d.getLocationHint=d.getAudienceManagerLocationHint,d.getAudienceManagerBlob=function(e,t){if(d.isAllowed()){if(d.getMarketingCloudVisitorID(function(t){d.getAudienceManagerBlob(e,!0)})){var i=d._getField(C);if(!i&&y.isTrackingServerPopulated()&&(i=d.getAnalyticsVisitorID(function(t){d.getAudienceManagerBlob(e,!0)})),i||!y.isTrackingServerPopulated()){var n=d._getAudienceManagerURLData(),r=n.url;return d._customerIDsHashChanged&&d._setFieldExpire(I,-1),d._getRemoteField(I,r,e,t,n)}}}return""},d._supplementalDataIDCurrent="",d._supplementalDataIDCurrentConsumed={},d._supplementalDataIDLast="",d._supplementalDataIDLastConsumed={},d.getSupplementalDataID=function(e,t){d._supplementalDataIDCurrent||t||(d._supplementalDataIDCurrent=d._generateID(1));var i=d._supplementalDataIDCurrent;return d._supplementalDataIDLast&&!d._supplementalDataIDLastConsumed[e]?(i=d._supplementalDataIDLast,d._supplementalDataIDLastConsumed[e]=!0):i&&(d._supplementalDataIDCurrentConsumed[e]&&(d._supplementalDataIDLast=d._supplementalDataIDCurrent,d._supplementalDataIDLastConsumed=d._supplementalDataIDCurrentConsumed,d._supplementalDataIDCurrent=i=t?"":d._generateID(1),d._supplementalDataIDCurrentConsumed={}),i&&(d._supplementalDataIDCurrentConsumed[e]=!0)),i},d.getOptOut=function(e,t){if(d.isAllowed()){var i=d._getAudienceManagerURLData("_setMarketingCloudFields"),n=i.url;return d._getRemoteField("MCOPTOUT",n,e,t,i)}return""},d.isOptedOut=function(e,t,i){if(d.isAllowed()){t||(t=u.OptOut.GLOBAL);var n=d.getOptOut(function(i){var n=i===u.OptOut.GLOBAL||i.indexOf(t)>=0;d._callCallback(e,[n])},i);return n?n===u.OptOut.GLOBAL||n.indexOf(t)>=0:null}return!1},d._fields=null,d._fieldsExpired=null,d._hash=function(e){var t,i,n=0;if(e)for(t=0;t<e.length;t++)i=e.charCodeAt(t),n=(n<<5)-n+i,n&=n;return n},d._generateID=H,d._generateLocalMID=function(){var e=d._generateID(0);return T.isClientSideMarketingCloudVisitorID=!0,e},d._callbackList=null,d._callCallback=function(e,t){try{"function"==typeof e?e.apply(c,t):e[1].apply(e[0],t)}catch(e){}},d._registerCallback=function(e,t){t&&(null==d._callbackList&&(d._callbackList={}),void 0==d._callbackList[e]&&(d._callbackList[e]=[]),d._callbackList[e].push(t))},d._callAllCallbacks=function(e,t){if(null!=d._callbackList){var i=d._callbackList[e];if(i)for(;i.length>0;)d._callCallback(i.shift(),t)}},d._addQuerystringParam=function(e,t,i,n){var r=encodeURIComponent(t)+"="+encodeURIComponent(i),a=y.parseHash(e),s=y.hashlessUrl(e);if(-1===s.indexOf("?"))return s+"?"+r+a;var o=s.split("?"),l=o[0]+"?",d=o[1];return l+y.addQueryParamAtLocation(d,r,n)+a},d._extractParamFromUri=function(e,t){var i=new RegExp("[\\?&#]"+t+"=([^&#]*)"),n=i.exec(e);if(n&&n.length)return decodeURIComponent(n[1])},d._parseAdobeMcFromUrl=n(G.ADOBE_MC),d._parseAdobeMcSdidFromUrl=n(G.ADOBE_MC_SDID),d._attemptToPopulateSdidFromUrl=function(t){var i=d._parseAdobeMcSdidFromUrl(t),n=1e9;i&&i.TS&&(n=y.getTimestampInSeconds()-i.TS),i&&i.SDID&&i.MCORGID===e&&n<d.sdidParamExpiry&&(d._supplementalDataIDCurrent=i.SDID,d._supplementalDataIDCurrentConsumed.SDID_URL_PARAM=!0)},d._attemptToPopulateIdsFromUrl=function(){var t=d._parseAdobeMcFromUrl();if(t&&t.TS){var i=y.getTimestampInSeconds(),n=i-t.TS;if(Math.floor(n/60)>G.ADOBE_MC_TTL_IN_MIN||t.MCORGID!==e)return;r(t)}},d._mergeServerState=function(e){if(e)try{if(e=function(e){return y.isObject(e)?e:JSON.parse(e)}(e),e[d.marketingCloudOrgID]){var t=e[d.marketingCloudOrgID];!function(e){y.isObject(e)&&d.setCustomerIDs(e)}(t.customerIDs),s(t.sdid)}}catch(e){throw new Error("`serverState` has an invalid format.")}},d._timeout=null,d._loadData=function(e,t,i,n){t=d._addQuerystringParam(t,"d_fieldgroup",e,1),n.url=d._addQuerystringParam(n.url,"d_fieldgroup",e,1),n.corsUrl=d._addQuerystringParam(n.corsUrl,"d_fieldgroup",e,1),T.fieldGroupObj[e]=!0,n===Object(n)&&n.corsUrl&&"XMLHttpRequest"===M.corsMetadata.corsType&&M.fireCORS(n,i,e)},d._clearTimeout=function(e){null!=d._timeout&&d._timeout[e]&&(clearTimeout(d._timeout[e]),d._timeout[e]=0)},d._settingsDigest=0,d._getSettingsDigest=function(){if(!d._settingsDigest){var e=d.version;d.audienceManagerServer&&(e+="|"+d.audienceManagerServer),d.audienceManagerServerSecure&&(e+="|"+d.audienceManagerServerSecure),d._settingsDigest=d._hash(e)}return d._settingsDigest},d._readVisitorDone=!1,d._readVisitor=function(){if(!d._readVisitorDone){d._readVisitorDone=!0;var e,t,i,n,r,a,s=d._getSettingsDigest(),o=!1,l=d.cookieRead(d.cookieName),c=new Date;if(null==d._fields&&(d._fields={}),l&&"T"!==l)for(l=l.split("|"),l[0].match(/^[\-0-9]+$/)&&(parseInt(l[0],10)!==s&&(o=!0),l.shift()),l.length%2==1&&l.pop(),e=0;e<l.length;e+=2)t=l[e].split("-"),i=t[0],n=l[e+1],t.length>1?(r=parseInt(t[1],10),a=t[1].indexOf("s")>0):(r=0,a=!1),o&&("MCCIDH"===i&&(n=""),r>0&&(r=c.getTime()/1e3-60)),i&&n&&(d._setField(i,n,1),r>0&&(d._fields["expire"+i]=r+(a?"s":""),(c.getTime()>=1e3*r||a&&!d.cookieRead(d.sessionCookieName))&&(d._fieldsExpired||(d._fieldsExpired={}),d._fieldsExpired[i]=!0)));!d._getField(C)&&y.isTrackingServerPopulated()&&(l=d.cookieRead("s_vi"))&&(l=l.split("|"),l.length>1&&l[0].indexOf("v1")>=0&&(n=l[1],e=n.indexOf("["),e>=0&&(n=n.substring(0,e)),n&&n.match(G.VALID_VISITOR_ID_REGEX)&&d._setField(C,n)))}},d._appendVersionTo=function(e){var t="vVersion|"+d.version,i=e?d._getCookieVersion(e):null;return i?x.areVersionsDifferent(i,d.version)&&(e=e.replace(G.VERSION_REGEX,t)):e+=(e?"|":"")+t,e},d._writeVisitor=function(){var e,t,i=d._getSettingsDigest()
                                ;for(e in d._fields)A(e)&&d._fields[e]&&"expire"!==e.substring(0,6)&&(t=d._fields[e],i+=(i?"|":"")+e+(d._fields["expire"+e]?"-"+d._fields["expire"+e]:"")+"|"+t);i=d._appendVersionTo(i),d.cookieWrite(d.cookieName,i,1)},d._getField=function(e,t){return null==d._fields||!t&&d._fieldsExpired&&d._fieldsExpired[e]?null:d._fields[e]},d._setField=function(e,t,i){null==d._fields&&(d._fields={}),d._fields[e]=t,i||d._writeVisitor()},d._getFieldList=function(e,t){var i=d._getField(e,t);return i?i.split("*"):null},d._setFieldList=function(e,t,i){d._setField(e,t?t.join("*"):"",i)},d._getFieldMap=function(e,t){var i=d._getFieldList(e,t);if(i){var n,r={};for(n=0;n<i.length;n+=2)r[i[n]]=i[n+1];return r}return null},d._setFieldMap=function(e,t,i){var n,r=null;if(t){r=[];for(n in t)A(n)&&(r.push(n),r.push(t[n]))}d._setFieldList(e,r,i)},d._setFieldExpire=function(e,t,i){var n=new Date;n.setTime(n.getTime()+1e3*t),null==d._fields&&(d._fields={}),d._fields["expire"+e]=Math.floor(n.getTime()/1e3)+(i?"s":""),t<0?(d._fieldsExpired||(d._fieldsExpired={}),d._fieldsExpired[e]=!0):d._fieldsExpired&&(d._fieldsExpired[e]=!1),i&&(d.cookieRead(d.sessionCookieName)||d.cookieWrite(d.sessionCookieName,"1"))},d._findVisitorID=function(e){return e&&("object"==typeof e&&(e=e.d_mid?e.d_mid:e.visitorID?e.visitorID:e.id?e.id:e.uuid?e.uuid:""+e),e&&"NOTARGET"===(e=e.toUpperCase())&&(e=D),e&&(e===D||e.match(G.VALID_VISITOR_ID_REGEX))||(e="")),e},d._setFields=function(e,t){if(d._clearTimeout(e),null!=d._loading&&(d._loading[e]=!1),T.fieldGroupObj[e]&&T.setState(e,!1),"MC"===e){!0!==T.isClientSideMarketingCloudVisitorID&&(T.isClientSideMarketingCloudVisitorID=!1);var i=d._getField(m);if(!i||d.overwriteCrossDomainMCIDAndAID){if(!(i="object"==typeof t&&t.mid?t.mid:d._findVisitorID(t))){if(d._use1stPartyMarketingCloudServer&&!d.tried1stPartyMarketingCloudServer)return d.tried1stPartyMarketingCloudServer=!0,void d.getAnalyticsVisitorID(null,!1,!0);i=d._generateLocalMID()}d._setField(m,i)}i&&i!==D||(i=""),"object"==typeof t&&((t.d_region||t.dcs_region||t.d_blob||t.blob)&&d._setFields(S,t),d._use1stPartyMarketingCloudServer&&t.mid&&d._setFields(p,{id:t.id})),d._callAllCallbacks(m,[i])}if(e===S&&"object"==typeof t){var n=604800;void 0!=t.id_sync_ttl&&t.id_sync_ttl&&(n=parseInt(t.id_sync_ttl,10));var r=b.getRegionAndCheckIfChanged(t,n);d._callAllCallbacks("MCAAMLH",[r]);var a=d._getField(I);(t.d_blob||t.blob)&&(a=t.d_blob,a||(a=t.blob),d._setFieldExpire(I,n),d._setField(I,a)),a||(a=""),d._callAllCallbacks(I,[a]),!t.error_msg&&d._newCustomerIDsHash&&d._setField("MCCIDH",d._newCustomerIDsHash)}if(e===p){var s=d._getField(C);s&&!d.overwriteCrossDomainMCIDAndAID||(s=d._findVisitorID(t),s?s!==D&&d._setFieldExpire(I,-1):s=D,d._setField(C,s)),s&&s!==D||(s=""),d._callAllCallbacks(C,[s])}if(d.idSyncDisableSyncs||d.disableIdSyncs)b.idCallNotProcesssed=!0;else{b.idCallNotProcesssed=!1;var o={};o.ibs=t.ibs,o.subdomain=t.subdomain,b.processIDCallData(o)}if(t===Object(t)){var l,c;d.isAllowed()&&(l=d._getField("MCOPTOUT")),l||(l=D,t.d_optout&&t.d_optout instanceof Array&&(l=t.d_optout.join(",")),c=parseInt(t.d_ottl,10),isNaN(c)&&(c=7200),d._setFieldExpire("MCOPTOUT",c,!0),d._setField("MCOPTOUT",l)),d._callAllCallbacks("MCOPTOUT",[l])}},d._loading=null,d._getRemoteField=function(e,t,i,n,r){var a,s="",o=y.isFirstPartyAnalyticsVisitorIDCall(e),l={MCAAMLH:!0,MCAAMB:!0};if(d.isAllowed()){d._readVisitor(),s=d._getField(e,!0===l[e]);if(function(){return(!s||d._fieldsExpired&&d._fieldsExpired[e])&&(!d.disableThirdPartyCalls||o)}()){if(e===m||"MCOPTOUT"===e?a="MC":"MCAAMLH"===e||e===I?a=S:e===C&&(a=p),a)return!t||null!=d._loading&&d._loading[a]||(null==d._loading&&(d._loading={}),d._loading[a]=!0,d._loadData(a,t,function(t){if(!d._getField(e)){t&&T.setState(a,!0);var i="";e===m?i=d._generateLocalMID():a===S&&(i={error_msg:"timeout"}),d._setFields(a,i)}},r)),d._registerCallback(e,i),s||(t||d._setFields(a,{id:D}),"")}else s||(e===m?(d._registerCallback(e,i),s=d._generateLocalMID(),d.setMarketingCloudVisitorID(s)):e===C?(d._registerCallback(e,i),s="",d.setAnalyticsVisitorID(s)):(s="",n=!0))}return e!==m&&e!==C||s!==D||(s="",n=!0),i&&n&&d._callCallback(i,[s]),s},d._setMarketingCloudFields=function(e){d._readVisitor(),d._setFields("MC",e)},d._mapCustomerIDs=function(e){d.getAudienceManagerBlob(e,!0)},d._setAnalyticsFields=function(e){d._readVisitor(),d._setFields(p,e)},d._setAudienceManagerFields=function(e){d._readVisitor(),d._setFields(S,e)},d._getAudienceManagerURLData=function(e){var t=d.audienceManagerServer,i="",n=d._getField(m),r=d._getField(I,!0),a=d._getField(C),s=a&&a!==D?"&d_cid_ic=AVID%01"+encodeURIComponent(a):"";if(d.loadSSL&&d.audienceManagerServerSecure&&(t=d.audienceManagerServerSecure),t){var o,l,c=d.getCustomerIDs();if(c)for(o in c)A(o)&&(l=c[o],s+="&d_cid_ic="+encodeURIComponent(o)+"%01"+encodeURIComponent(l.id?l.id:"")+(l.authState?"%01"+l.authState:""));e||(e="_setAudienceManagerFields");var u="http"+(d.loadSSL?"s":"")+"://"+t+"/id",f="d_visid_ver="+d.version+"&d_rtbd=json&d_ver=2"+(!n&&d._use1stPartyMarketingCloudServer?"&d_verify=1":"")+"&d_orgid="+encodeURIComponent(d.marketingCloudOrgID)+"&d_nsid="+(d.idSyncContainerID||0)+(n?"&d_mid="+encodeURIComponent(n):"")+(d.idSyncDisable3rdPartySyncing||d.disableThirdPartyCookies?"&d_coppa=true":"")+(!0===g?"&d_coop_safe=1":!1===g?"&d_coop_unsafe=1":"")+(r?"&d_blob="+encodeURIComponent(r):"")+s,_=["s_c_il",d._in,e];return i=u+"?"+f+"&d_cb=s_c_il%5B"+d._in+"%5D."+e,{url:i,corsUrl:u+"?"+f,callback:_}}return{url:i}},d.appendVisitorIDsTo=function(e){try{var t=[[m,d._getField(m)],[C,d._getField(C)],["MCORGID",d.marketingCloudOrgID]];return d._addQuerystringParam(e,G.ADOBE_MC,o(t))}catch(t){return e}},d.appendSupplementalDataIDTo=function(e,t){if(!(t=t||d.getSupplementalDataID(y.generateRandomString(),!0)))return e;try{var i=o([["SDID",t],["MCORGID",d.marketingCloudOrgID]]);return d._addQuerystringParam(e,G.ADOBE_MC_SDID,i)}catch(t){return e}};var y={parseHash:function(e){var t=e.indexOf("#");return t>0?e.substr(t):""},hashlessUrl:function(e){var t=e.indexOf("#");return t>0?e.substr(0,t):e},addQueryParamAtLocation:function(e,t,i){var n=e.split("&");return i=null!=i?i:n.length,n.splice(i,0,t),n.join("&")},isFirstPartyAnalyticsVisitorIDCall:function(e,t,i){if(e!==C)return!1;var n;return t||(t=d.trackingServer),i||(i=d.trackingServerSecure),!("string"!=typeof(n=d.loadSSL?i:t)||!n.length)&&(n.indexOf("2o7.net")<0&&n.indexOf("omtrdc.net")<0)},isObject:function(e){return Boolean(e&&e===Object(e))},removeCookie:function(e){document.cookie=encodeURIComponent(e)+"=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;"+(d.cookieDomain?" domain="+d.cookieDomain+";":"")},isTrackingServerPopulated:function(){return!!d.trackingServer||!!d.trackingServerSecure},getTimestampInSeconds:function(){return Math.round((new Date).getTime()/1e3)},parsePipeDelimetedKeyValues:function(e){return e.split("|").reduce(function(e,t){var i=t.split("=");return e[i[0]]=decodeURIComponent(i[1]),e},{})},generateRandomString:function(e){e=e||5;for(var t="",i="abcdefghijklmnopqrstuvwxyz0123456789";e--;)t+=i[Math.floor(Math.random()*i.length)];return t},parseBoolean:function(e){return"true"===e||"false"!==e&&null},replaceMethodsWithFunction:function(e,t){for(var i in e)e.hasOwnProperty(i)&&"function"==typeof e[i]&&(e[i]=t);return e},pluck:function(e,t){return t.reduce(function(t,i){return e[i]&&(t[i]=e[i]),t},Object.create(null))}};d._helpers=y;var b=q(d,u);d._destinationPublishing=b,d.timeoutMetricsLog=[];var T={isClientSideMarketingCloudVisitorID:null,MCIDCallTimedOut:null,AnalyticsIDCallTimedOut:null,AAMIDCallTimedOut:null,fieldGroupObj:{},setState:function(e,t){switch(e){case"MC":!1===t?!0!==this.MCIDCallTimedOut&&(this.MCIDCallTimedOut=!1):this.MCIDCallTimedOut=t;break;case p:!1===t?!0!==this.AnalyticsIDCallTimedOut&&(this.AnalyticsIDCallTimedOut=!1):this.AnalyticsIDCallTimedOut=t;break;case S:!1===t?!0!==this.AAMIDCallTimedOut&&(this.AAMIDCallTimedOut=!1):this.AAMIDCallTimedOut=t}}};d.isClientSideMarketingCloudVisitorID=function(){return T.isClientSideMarketingCloudVisitorID},d.MCIDCallTimedOut=function(){return T.MCIDCallTimedOut},d.AnalyticsIDCallTimedOut=function(){return T.AnalyticsIDCallTimedOut},d.AAMIDCallTimedOut=function(){return T.AAMIDCallTimedOut},d.idSyncGetOnPageSyncInfo=function(){return d._readVisitor(),d._getField("MCSYNCSOP")},d.idSyncByURL=function(e){var t=l(e||{});if(t.error)return t.error;var i,n,r=e.url,a=encodeURIComponent,s=b;return r=r.replace(/^https:/,"").replace(/^http:/,""),i=v.encodeAndBuildRequest(["",e.dpid,e.dpuuid||""],","),n=["ibs",a(e.dpid),"img",a(r),t.ttl,"",i],s.addMessage(n.join("|")),s.requestToProcess(),"Successfully queued"},d.idSyncByDataSource=function(e){return e===Object(e)&&"string"==typeof e.dpuuid&&e.dpuuid.length?(e.url="//dpm.demdex.net/ibs:dpid="+e.dpid+"&dpuuid="+e.dpuuid,d.idSyncByURL(e)):"Error: config or config.dpuuid is empty"},d.publishDestinations=function(e,t,i){if(i="function"==typeof i?i:function(){},"string"!=typeof e||!e.length)return void i({error:"subdomain is not a populated string."});if(!(t instanceof Array&&t.length))return void i({error:"messages is not a populated array."});var n=b;if(!n.readyToAttachIframePreliminary())return void i({error:"The destination publishing iframe is disabled in the Visitor library."});var r=!1;if(t.forEach(function(e){"string"==typeof e&&e.length&&(n.addMessage(e),r=!0)}),!r)return void i({error:"None of the messages are populated strings."});n.iframe?(i({message:"The destination publishing iframe is already attached and loaded."}),n.requestToProcess()):!d.subdomain&&d._getField(m)?(n.subdomain=e,n.doAttachIframe=!0,n.url=n.getUrl(),n.readyToAttachIframe()?(n.iframeLoadedCallbacks.push(function(e){i({message:"Attempted to attach and load the destination publishing iframe through this API call. Result: "+(e.message||"no result")})}),n.attachIframe()):i({error:"Encountered a problem in attempting to attach and load the destination publishing iframe through this API call."})):n.iframeLoadedCallbacks.push(function(e){i({message:"Attempted to attach and load the destination publishing iframe through normal Visitor API processing. Result: "+(e.message||"no result")})})},d._getCookieVersion=function(e){e=e||d.cookieRead(d.cookieName);var t=G.VERSION_REGEX.exec(e);return t&&t.length>1?t[1]:null},d._resetAmcvCookie=function(e){var t=d._getCookieVersion();t&&!x.isLessThan(t,e)||y.removeCookie(d.cookieName)},d.setAsCoopSafe=function(){g=!0},d.setAsCoopUnsafe=function(){g=!1},d.init=function(){!function(){if(t&&"object"==typeof t){d.configs=Object.create(null);for(var e in t)A(e)&&(d[e]=t[e],d.configs[e]=t[e]);d.idSyncContainerID=d.idSyncContainerID||0,g="boolean"==typeof d.isCoopSafe?d.isCoopSafe:y.parseBoolean(d.isCoopSafe),d.resetBeforeVersion&&d._resetAmcvCookie(d.resetBeforeVersion),d._attemptToPopulateIdsFromUrl(),d._attemptToPopulateSdidFromUrl(),d._readVisitor();var i=d._getField(h),n=Math.ceil((new Date).getTime()/G.MILLIS_PER_DAY);d.idSyncDisableSyncs||d.disableIdSyncs||!b.canMakeSyncIDCall(i,n)||(d._setFieldExpire(I,-1),d._setField(h,n)),d.getMarketingCloudVisitorID(),d.getAudienceManagerLocationHint(),d.getAudienceManagerBlob(),d._mergeServerState(d.serverState)}else d._attemptToPopulateIdsFromUrl(),d._attemptToPopulateSdidFromUrl()}(),function(){if(!d.idSyncDisableSyncs&&!d.disableIdSyncs){b.checkDPIframeSrc();var e=function(){var e=b;e.readyToAttachIframe()&&e.attachIframe()};c.addEventListener("load",function(){u.windowLoaded=!0,e()});try{U.receiveMessage(function(e){b.receiveMessage(e.data)},b.iframeHost)}catch(e){}}}(),function(){d.whitelistIframeDomains&&G.POST_MESSAGE_ENABLED&&(d.whitelistIframeDomains=d.whitelistIframeDomains instanceof Array?d.whitelistIframeDomains:[d.whitelistIframeDomains],d.whitelistIframeDomains.forEach(function(t){var i=new k(e,t),n=w(d,i);U.receiveMessage(n,t)}))}()}};return W.getInstance=function(e,t){if(!e)throw new Error("Visitor requires Adobe Marketing Cloud Org ID.");e.indexOf("@")<0&&(e+="@AdobeOrg");var i=function(){var t=a.s_c_il;if(t)for(var i=0;i<t.length;i++){var n=t[i];if(n&&"Visitor"===n._c&&n.marketingCloudOrgID===e)return n}}();if(i)return i;var n=e,r=n.split("").reverse().join(""),s=new W(e,null,r);t===Object(t)&&t.cookieDomain&&(s.cookieDomain=t.cookieDomain),function(){a.s_c_il.splice(--a.s_c_in,1)}();var o=v.getIeVersion();if("number"==typeof o&&o<10)return s._helpers.replaceMethodsWithFunction(s,function(){});var l=function(){try{return a.self!==a.parent}catch(e){return!0}}()&&!function(e){return e.cookieWrite("TEST_AMCV_COOKIE","T",1),"T"===e.cookieRead("TEST_AMCV_COOKIE")&&(e._helpers.removeCookie("TEST_AMCV_COOKIE"),!0)}(s)&&a.parent?new E(e,t,s,a.parent):new W(e,t,r);return s=null,l.init(),l},function(){function e(){W.windowLoaded=!0}a.addEventListener?a.addEventListener("load",e):a.attachEvent&&a.attachEvent("onload",e),W.codeLoadEnd=(new Date).getTime()}(),W.config=X,a.Visitor=W,W}();
                                return Visitor;
                            }();

                        }

                    }
                },
                "settings": {
                    "orgId": "68825AEC5A0DC5490A495E5A@AdobeOrg",
                    "variables": [
                        {
                            "name": "cookieDomain",
                            "value": "adobe-marketing-cloud.github.io"
                        }
                    ]
                },
                "hostedLibFilesBaseUrl": "//assets.adobedtm.com/extensions/EPeb55b7c3813845458371cc6040fd3032/"
            },
            "core": {
                "displayName": "Core",
                "modules": {
                    "core/src/lib/dataElements/javascriptVariable.js": {
                        "name": "javascript-variable",
                        "displayName": "JavaScript Variable",
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';
                            var window = require('@adobe/reactor-window');

                            var getObjectProperty = require('../helpers/getObjectProperty.js');

                            /**
                             * The variable data element.
                             * @param {Object} settings The data element settings object.
                             * @param {string} settings.path The global path to the variable holding the data element value.
                             * @returns {string}
                             */
                            module.exports = function(settings) {
                                return getObjectProperty(window, settings.path);
                            };

                        }

                    },
                    "core/src/lib/events/pageBottom.js": {
                        "name": "page-bottom",
                        "displayName": "Page Bottom",
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

                            var pageLifecycleEvents = require('./helpers/pageLifecycleEvents');

                            /**
                             * Page bottom event. This event occurs as soon as the user calls _satellite.pageBottom() (which is
                             * supposed to be at the bottom of the page).
                             * @param {Object} settings The event settings object.
                             * @param {ruleTrigger} trigger The trigger callback.
                             */
                            module.exports = function(settings, trigger) {
                                pageLifecycleEvents.registerPageBottomTrigger(trigger);
                            };

                        }

                    },
                    "core/src/lib/events/libraryLoaded.js": {
                        "name": "library-loaded",
                        "displayName": "Library Loaded (Page Top)",
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

                            var pageLifecycleEvents = require('./helpers/pageLifecycleEvents');

                            /**
                             * Library loaded event. This event occurs as soon as the runtime library is loaded.
                             * @param {Object} settings The event settings object.
                             * @param {ruleTrigger} trigger The trigger callback.
                             */
                            module.exports = function(settings, trigger) {
                                pageLifecycleEvents.registerLibraryLoadedTrigger(trigger);
                            };

                        }

                    },
                    "core/src/lib/actions/customCode.js": {
                        "name": "custom-code",
                        "displayName": "Custom Code",
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

                            var document = require('@adobe/reactor-document');
                            var decorateCode = require('./helpers/decorateCode');
                            var loadCodeSequentially = require('./helpers/loadCodeSequentially');
                            var postscribe = require('../../../node_modules/postscribe/dist/postscribe');

                            var postscribeWrite = (function() {
                                var write = function(source) {
                                    postscribe(document.body, source, {
                                        error: function(error) {
                                            turbine.logger.error(error.msg);
                                        }
                                    });
                                };

                                var queue = [];

                                // If the Launch library is loaded asynchronously, it may finish loading before document.body
                                // is available. This means the custom code action may be running before document.body is
                                // available, in which case can't write the custom code to document.body. We could, in this
                                // case, write it to document.head since it will for sure be available, but the user's custom
                                // code may have something like an img tag for sending a beacon (this use case was seen in DTM).
                                // Adding display elements like an img tag to document.head is against HTML spec, though it
                                // does seem like an image request is still made. We opted instead to ensure we comply with
                                // HTML spec and wait until we see that document.body is available before writing.
                                var flushQueue = function() {
                                    if (document.body) {
                                        while (queue.length) {
                                            write(queue.shift());
                                        }
                                    } else {
                                        // 20 is an arbitrarily small amount of time but not too aggressive.
                                        setTimeout(flushQueue, 20);
                                    }
                                };

                                return function(source) {
                                    queue.push(source);
                                    flushQueue();
                                };
                            })();

                            var libraryWasLoadedAsynchronously = (function() {
                                // document.currentScript is not supported by IE
                                if (document.currentScript) {
                                    return document.currentScript.async;
                                } else {
                                    var scripts = document.querySelectorAll('script');
                                    for (var i = 0; i < scripts.length; i++) {
                                        var script = scripts[i];
                                        // Find the script that loaded our library. Take into account embed scripts migrated
                                        // from DTM. We'll also consider that they may have added a querystring for cache-busting
                                        // or whatever.
                                        if (/(launch|satelliteLib)-[^\/]+.js(\?.*)?$/.test(script.src)) {
                                            return script.async;
                                        }
                                    }
                                    // We couldn't find the Launch script, so we'll assume it was loaded asynchronously. This
                                    // is the safer assumption.
                                    return true;
                                }
                            })();

                            /**
                             * The custom code action. This loads and executes custom JavaScript or HTML provided by the user.
                             * @param {Object} settings Action settings.
                             * @param {string} settings.source If <code>settings.language</code> is <code>html</code> and
                             * <code>settings.sequential</code> is <code>true</code>, then this will be the user's code.
                             * Otherwise, it will be a relative path to the file containing the users code.
                             * @param {string} settings.language The language of the user's code. Must be either
                             * @param {Object} event The underlying event object that triggered the rule.
                             * @param {Object} event.element The element that the rule was targeting.
                             * @param {Object} event.target The element on which the event occurred.
                             * <code>javascript</code> or <code>html</code>.
                             */
                            module.exports = function(settings, event) {
                                var action = {
                                    settings: settings,
                                    event: event
                                };

                                var source = action.settings.source;
                                if (!source) {
                                    return;
                                }

                                if (action.settings.isExternal) {
                                    return loadCodeSequentially(source).then(function(source) {
                                        if (source) {
                                            postscribeWrite(decorateCode(action, source));
                                        }
                                    });
                                } else {
                                    // A few things to be aware of here:
                                    // 1. Custom code will be included into the main launch library if it's for a rule that uses the
                                    //    Library Loaded or Page Bottom event. isExternal will be false. However, keep in mind that
                                    //    the same rule may have other events that are not Library Loaded or Page Bottom. This means
                                    //    we could see isExternal = false on the action when the event that fired the rule is
                                    //    a click, for example.
                                    // 2. When users load a library synchronously which has a rule using the Library Loaded
                                    //    or Page Bottom event with a Custom Code action, they expect the custom code to be written
                                    //    to the document in a blocking fashion (prevent the parser from continuing until their
                                    //    custom code is executed). In other words, they expect document.write to be used. When
                                    //    the library is loaded asynchronously, they do not have this expectation.
                                    // 3. Calls to document.write will be ignored by the browser if the Launch library is loaded
                                    //    asynchronously, even if the calls are made before DOMContentLoaded.
                                    // Because of ^^^, we use document.write if the Launch library was loaded synchronously
                                    // and the event that fired the rule is library-loaded or page-bottom. Otherwise, we know we
                                    // can't use document.write and must use postscribe instead.
                                    if (libraryWasLoadedAsynchronously ||
                                        (event.$type !== 'core.library-loaded' && event.$type !== 'core.page-bottom')) {
                                        postscribeWrite(decorateCode(action, source));
                                    } else {
                                        // Document object in XML files is different from the ones in HTML files. Documents served
                                        // with the `application/xhtml+xml` MIME type don't have the `document.write` method.
                                        // More info: https://www.w3.org/MarkUp/2004/xhtml-faq#docwrite or https://developer.mozilla.org/en-US/docs/Archive/Web/Writing_JavaScript_for_HTML
                                        if (document.write) {
                                            document.write(decorateCode(action, source));
                                        } else {
                                            throw new Error('Cannot write HTML to the page. `document.write` is unavailable.');
                                        }
                                    }
                                }
                            };

                        }

                    },
                    "core/src/lib/helpers/getObjectProperty.js": {
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

                            /**
                             * Returns the deep property value of an object.
                             * @param obj The object where the property will be searched.
                             * @param property The property name to be returned. It can contain dots. (eg. prop.subprop1)
                             * @returns {*}
                             */
                            module.exports = function(obj, property) {
                                var propertyChain = property.split('.');
                                var currentValue = obj;

                                for (var i = 0, len = propertyChain.length; i < len; i++) {
                                    if (currentValue == null) {
                                        return undefined;
                                    }

                                    currentValue = currentValue[propertyChain[i]];
                                }

                                return currentValue;
                            };

                        }

                    },
                    "core/src/lib/events/helpers/pageLifecycleEvents.js": {
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2018 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

// We need to be able to fire the rules in a specific order, no matter if the library is loaded
// sync or async. The rules are fired in the following order:
// Library loaded rules -> Page bottom rules -> Dom Ready rules -> Window load rules.

                            var window = require('@adobe/reactor-window');
                            var document = require('@adobe/reactor-document');

                            var isIE10 = window.navigator.appVersion.indexOf('MSIE 10') !== -1;
                            var WINDOW_LOADED = 'WINDOW_LOADED';
                            var DOM_READY = 'DOM_READY';
                            var PAGE_BOTTOM = 'PAGE_BOTTOM';

                            var lifecycleEventsOrder = [PAGE_BOTTOM, DOM_READY, WINDOW_LOADED];

                            var createSyntheticEvent = function(element, nativeEvent) {
                                return {
                                    element: element,
                                    target: element,
                                    nativeEvent: nativeEvent
                                };
                            };

                            var registry = {};
                            lifecycleEventsOrder.forEach(function(event) {
                                registry[event] = [];
                            });

                            var processRegistry = function(lifecycleEvent, nativeEvent) {
                                lifecycleEventsOrder
                                    .slice(0, getLifecycleEventIndex(lifecycleEvent) + 1)
                                    .forEach(function(lifecycleEvent) {
                                        processTriggers(nativeEvent, lifecycleEvent);
                                    });
                            };

                            var detectLifecycleEvent = function() {
                                if (document.readyState === 'complete') {
                                    return WINDOW_LOADED;
                                } else if (document.readyState === 'interactive') {
                                    return !isIE10 ? DOM_READY : null;
                                }
                            };

                            var getLifecycleEventIndex = function(event) {
                                return lifecycleEventsOrder.indexOf(event);
                            };

                            var processTriggers = function(nativeEvent, lifecycleEvent) {
                                registry[lifecycleEvent].forEach(function(triggerData) {
                                    processTrigger(nativeEvent, triggerData);
                                });
                                registry[lifecycleEvent] = [];
                            };

                            var processTrigger = function(nativeEvent, triggerData) {
                                var trigger = triggerData.trigger;
                                var syntheticEventFn = triggerData.syntheticEventFn;

                                trigger(syntheticEventFn ? syntheticEventFn(nativeEvent) : null);
                            };

                            window._satellite = window._satellite || {};
                            window._satellite.pageBottom = processRegistry.bind(null, PAGE_BOTTOM);

                            document.addEventListener(
                                'DOMContentLoaded',
                                processRegistry.bind(null, DOM_READY),
                                true
                            );
                            window.addEventListener(
                                'load',
                                processRegistry.bind(null, WINDOW_LOADED),
                                true
                            );

// Depending on the way the Launch library was loaded, none of the registered listeners that
// execute `processRegistry` may fire . We need to execute the `processRegistry` method at
// least once. If this timeout fires before any of the registered listeners, we auto-detect the
// current lifecycle event and fire all the registered triggers in order. We don't care if the
// `processRegistry` is called multiple times for the same lifecycle event. We fire the registered
// triggers for a lifecycle event only once. We used a `setTimeout` here to make sure all the rules
// using Library Loaded are registered and executed synchronously and before rules using any of the
// other lifecycle event types.
                            window.setTimeout(function() {
                                var lifecycleEvent = detectLifecycleEvent();
                                if (lifecycleEvent) {
                                    processRegistry(lifecycleEvent);
                                }
                            }, 0);

                            module.exports = {
                                registerLibraryLoadedTrigger: function(trigger) {
                                    trigger();
                                },
                                registerPageBottomTrigger: function(trigger) {
                                    registry[PAGE_BOTTOM].push({
                                        trigger: trigger
                                    });
                                },
                                registerDomReadyTrigger: function(trigger) {
                                    registry[DOM_READY].push({
                                        trigger: trigger,
                                        syntheticEventFn: createSyntheticEvent.bind(null, document)
                                    });
                                },
                                registerWindowLoadedTrigger: function(trigger) {
                                    registry[WINDOW_LOADED].push({
                                        trigger: trigger,
                                        syntheticEventFn: createSyntheticEvent.bind(null, window)
                                    });
                                }
                            };

                        }

                    },
                    "core/src/lib/actions/helpers/decorateCode.js": {
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

                            var id = 0;

                            var isSourceLoadedFromFile = function(action) {
                                return action.settings.isExternal;
                            };

                            var decorateGlobalJavaScriptCode = function(action, source) {
                                // The line break after the source is important in case their last line of code is a comment.
                                return '<scr' + 'ipt>\n' + source + '\n</scr' + 'ipt>';
                            };

                            var decorateNonGlobalJavaScriptCode = function(action, source) {
                                var runScriptFnName = '__runScript' + ++id;

                                _satellite[runScriptFnName] = function(fn) {
                                    fn.call(action.event.element, action.event, action.event.target);
                                    delete _satellite[runScriptFnName];
                                };

                                // The line break after the source is important in case their last line of code is a comment.
                                return '<scr' + 'ipt>_satellite["' + runScriptFnName + '"](function(event, target) {\n' +
                                    source +
                                    '\n});</scr' + 'ipt>';
                            };

                            var decorators = {
                                javascript: function(action, source) {
                                    return action.settings.global ?
                                        decorateGlobalJavaScriptCode(action, source) :
                                        decorateNonGlobalJavaScriptCode(action, source);
                                },
                                html: function(action, source) {
                                    // We need to replace tokens only for sources loaded from external files. The sources from
                                    // inside the container are automatically taken care by Turbine.
                                    if (isSourceLoadedFromFile(action)) {
                                        return turbine.replaceTokens(source, action.event);
                                    }

                                    return source;
                                }
                            };

                            module.exports = function(action, source) {
                                return decorators[action.settings.language](action, source);
                            };

                        }

                    },
                    "core/src/lib/actions/helpers/loadCodeSequentially.js": {
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';

                            var Promise = require('@adobe/reactor-promise');
                            var getSourceByUrl = require('./getSourceByUrl');

                            var previousExecuteCodePromise = Promise.resolve();

                            module.exports = function(sourceUrl) {
                                var sequentiallyLoadCodePromise = new Promise(function(resolve) {
                                    var loadCodePromise = getSourceByUrl(sourceUrl);

                                    Promise.all([
                                        loadCodePromise,
                                        previousExecuteCodePromise
                                    ]).then(function(values) {
                                        var source = values[0];
                                        resolve(source);
                                    });
                                });

                                previousExecuteCodePromise = sequentiallyLoadCodePromise;
                                return sequentiallyLoadCodePromise;
                            };

                        }

                    },
                    "core/node_modules/postscribe/dist/postscribe.js": {
                        "script": function(module, exports, require, turbine) {
                            /**
                             * @file postscribe
                             * @description Asynchronously write javascript, even with document.write.
                             * @version v2.0.8
                             * @see {@link https://krux.github.io/postscribe}
                             * @license MIT
                             * @author Derek Brans
                             * @copyright 2016 Krux Digital, Inc
                             */
                            (function webpackUniversalModuleDefinition(root, factory) {
                                if(typeof exports === 'object' && typeof module === 'object')
                                    module.exports = factory();
                                else if(typeof define === 'function' && define.amd)
                                    define([], factory);
                                else if(typeof exports === 'object')
                                    exports["postscribe"] = factory();
                                else
                                    root["postscribe"] = factory();
                            })(this, function() {
                                return /******/ (function(modules) { // webpackBootstrap
                                    /******/ 	// The module cache
                                    /******/ 	var installedModules = {};
                                    /******/
                                    /******/ 	// The require function
                                    /******/ 	function __webpack_require__(moduleId) {
                                        /******/
                                        /******/ 		// Check if module is in cache
                                        /******/ 		if(installedModules[moduleId])
                                        /******/ 			return installedModules[moduleId].exports;
                                        /******/
                                        /******/ 		// Create a new module (and put it into the cache)
                                        /******/ 		var module = installedModules[moduleId] = {
                                            /******/ 			exports: {},
                                            /******/ 			id: moduleId,
                                            /******/ 			loaded: false
                                            /******/ 		};
                                        /******/
                                        /******/ 		// Execute the module function
                                        /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
                                        /******/
                                        /******/ 		// Flag the module as loaded
                                        /******/ 		module.loaded = true;
                                        /******/
                                        /******/ 		// Return the exports of the module
                                        /******/ 		return module.exports;
                                        /******/ 	}
                                    /******/
                                    /******/
                                    /******/ 	// expose the modules object (__webpack_modules__)
                                    /******/ 	__webpack_require__.m = modules;
                                    /******/
                                    /******/ 	// expose the module cache
                                    /******/ 	__webpack_require__.c = installedModules;
                                    /******/
                                    /******/ 	// __webpack_public_path__
                                    /******/ 	__webpack_require__.p = "";
                                    /******/
                                    /******/ 	// Load entry module and return exports
                                    /******/ 	return __webpack_require__(0);
                                    /******/ })
                                /************************************************************************/
                                /******/ ([
                                    /* 0 */
                                    /***/ function(module, exports, __webpack_require__) {

                                        'use strict';

                                        var _postscribe = __webpack_require__(1);

                                        var _postscribe2 = _interopRequireDefault(_postscribe);

                                        function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

                                        module.exports = _postscribe2['default'];

                                        /***/ },
                                    /* 1 */
                                    /***/ function(module, exports, __webpack_require__) {

                                        'use strict';

                                        exports.__esModule = true;

                                        var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

                                        exports['default'] = postscribe;

                                        var _writeStream = __webpack_require__(2);

                                        var _writeStream2 = _interopRequireDefault(_writeStream);

                                        var _utils = __webpack_require__(4);

                                        var utils = _interopRequireWildcard(_utils);

                                        function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

                                        function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

                                        /**
                                         * A function that intentionally does nothing.
                                         */
                                        function doNothing() {}

                                        /**
                                         * Available options and defaults.
                                         *
                                         * @type {Object}
                                         */
                                        var OPTIONS = {
                                            /**
                                             * Called when an async script has loaded.
                                             */
                                            afterAsync: doNothing,

                                            /**
                                             * Called immediately before removing from the write queue.
                                             */
                                            afterDequeue: doNothing,

                                            /**
                                             * Called sync after a stream's first thread release.
                                             */
                                            afterStreamStart: doNothing,

                                            /**
                                             * Called after writing buffered document.write calls.
                                             */
                                            afterWrite: doNothing,

                                            /**
                                             * Allows disabling the autoFix feature of prescribe
                                             */
                                            autoFix: true,

                                            /**
                                             * Called immediately before adding to the write queue.
                                             */
                                            beforeEnqueue: doNothing,

                                            /**
                                             * Called before writing a token.
                                             *
                                             * @param {Object} tok The token
                                             */
                                            beforeWriteToken: function beforeWriteToken(tok) {
                                                return tok;
                                            },

                                            /**
                                             * Called before writing buffered document.write calls.
                                             *
                                             * @param {String} str The string
                                             */
                                            beforeWrite: function beforeWrite(str) {
                                                return str;
                                            },

                                            /**
                                             * Called when evaluation is finished.
                                             */
                                            done: doNothing,

                                            /**
                                             * Called when a write results in an error.
                                             *
                                             * @param {Error} e The error
                                             */
                                            error: function error(e) {
                                                throw new Error(e.msg);
                                            },


                                            /**
                                             * Whether to let scripts w/ async attribute set fall out of the queue.
                                             */
                                            releaseAsync: false
                                        };

                                        var nextId = 0;
                                        var queue = [];
                                        var active = null;

                                        function nextStream() {
                                            var args = queue.shift();
                                            if (args) {
                                                var options = utils.last(args);

                                                options.afterDequeue();
                                                args.stream = runStream.apply(undefined, args);
                                                options.afterStreamStart();
                                            }
                                        }

                                        function runStream(el, html, options) {
                                            active = new _writeStream2['default'](el, options);

                                            // Identify this stream.
                                            active.id = nextId++;
                                            active.name = options.name || active.id;
                                            postscribe.streams[active.name] = active;

                                            // Override document.write.
                                            var doc = el.ownerDocument;

                                            var stash = {
                                                close: doc.close,
                                                open: doc.open,
                                                write: doc.write,
                                                writeln: doc.writeln
                                            };

                                            function _write(str) {
                                                str = options.beforeWrite(str);
                                                active.write(str);
                                                options.afterWrite(str);
                                            }

                                            _extends(doc, {
                                                close: doNothing,
                                                open: doNothing,
                                                write: function write() {
                                                    for (var _len = arguments.length, str = Array(_len), _key = 0; _key < _len; _key++) {
                                                        str[_key] = arguments[_key];
                                                    }

                                                    return _write(str.join(''));
                                                },
                                                writeln: function writeln() {
                                                    for (var _len2 = arguments.length, str = Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                                                        str[_key2] = arguments[_key2];
                                                    }

                                                    return _write(str.join('') + '\n');
                                                }
                                            });

                                            // Override window.onerror
                                            var oldOnError = active.win.onerror || doNothing;

                                            // This works together with the try/catch around WriteStream::insertScript
                                            // In modern browsers, exceptions in tag scripts go directly to top level
                                            active.win.onerror = function (msg, url, line) {
                                                options.error({ msg: msg + ' - ' + url + ': ' + line });
                                                oldOnError.apply(active.win, [msg, url, line]);
                                            };

                                            // Write to the stream
                                            active.write(html, function () {
                                                // restore document.write
                                                _extends(doc, stash);

                                                // restore window.onerror
                                                active.win.onerror = oldOnError;

                                                options.done();
                                                active = null;
                                                nextStream();
                                            });

                                            return active;
                                        }

                                        function postscribe(el, html, options) {
                                            if (utils.isFunction(options)) {
                                                options = { done: options };
                                            } else if (options === 'clear') {
                                                queue = [];
                                                active = null;
                                                nextId = 0;
                                                return;
                                            }

                                            options = utils.defaults(options, OPTIONS);

                                            // id selector
                                            if (/^#/.test(el)) {
                                                el = window.document.getElementById(el.substr(1));
                                            } else {
                                                el = el.jquery ? el[0] : el;
                                            }

                                            var args = [el, html, options];

                                            el.postscribe = {
                                                cancel: function cancel() {
                                                    if (args.stream) {
                                                        args.stream.abort();
                                                    } else {
                                                        args[1] = doNothing;
                                                    }
                                                }
                                            };

                                            options.beforeEnqueue(args);
                                            queue.push(args);

                                            if (!active) {
                                                nextStream();
                                            }

                                            return el.postscribe;
                                        }

                                        _extends(postscribe, {
                                            // Streams by name.
                                            streams: {},
                                            // Queue of streams.
                                            queue: queue,
                                            // Expose internal classes.
                                            WriteStream: _writeStream2['default']
                                        });

                                        /***/ },
                                    /* 2 */
                                    /***/ function(module, exports, __webpack_require__) {

                                        'use strict';

                                        exports.__esModule = true;

                                        var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

                                        var _prescribe = __webpack_require__(3);

                                        var _prescribe2 = _interopRequireDefault(_prescribe);

                                        var _utils = __webpack_require__(4);

                                        var utils = _interopRequireWildcard(_utils);

                                        function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

                                        function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

                                        function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

                                        /**
                                         * Turn on to debug how each chunk affected the DOM.
                                         * @type {boolean}
                                         */
                                        var DEBUG_CHUNK = false;

                                        /**
                                         * Prefix for data attributes on DOM elements.
                                         * @type {string}
                                         */
                                        var BASEATTR = 'data-ps-';

                                        /**
                                         * ID for the style proxy
                                         * @type {string}
                                         */
                                        var PROXY_STYLE = 'ps-style';

                                        /**
                                         * ID for the script proxy
                                         * @type {string}
                                         */
                                        var PROXY_SCRIPT = 'ps-script';

                                        /**
                                         * Get data attributes
                                         *
                                         * @param {Object} el The DOM element.
                                         * @param {String} name The attribute name.
                                         * @returns {String}
                                         */
                                        function getData(el, name) {
                                            var attr = BASEATTR + name;

                                            var val = el.getAttribute(attr);

                                            // IE 8 returns a number if it's a number
                                            return !utils.existy(val) ? val : String(val);
                                        }

                                        /**
                                         * Set data attributes
                                         *
                                         * @param {Object} el The DOM element.
                                         * @param {String} name The attribute name.
                                         * @param {null|*} value The attribute value.
                                         */
                                        function setData(el, name) {
                                            var value = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

                                            var attr = BASEATTR + name;

                                            if (utils.existy(value) && value !== '') {
                                                el.setAttribute(attr, value);
                                            } else {
                                                el.removeAttribute(attr);
                                            }
                                        }

                                        /**
                                         * Stream static html to an element, where "static html" denotes "html
                                         * without scripts".
                                         *
                                         * This class maintains a *history of writes devoid of any attributes* or
                                         * "proxy history".
                                         *
                                         * Injecting the proxy history into a temporary div has no side-effects,
                                         * other than to create proxy elements for previously written elements.
                                         *
                                         * Given the `staticHtml` of a new write, a `tempDiv`'s innerHTML is set to
                                         * `proxy_history + staticHtml`.
                                         * The *structure* of `tempDiv`'s contents, (i.e., the placement of new nodes
                                         * beside or inside of proxy elements), reflects the DOM structure that would
                                         * have resulted if all writes had been squashed into a single write.
                                         *
                                         * For each descendent `node` of `tempDiv` whose parentNode is a *proxy*,
                                         * `node` is appended to the corresponding *real* element within the DOM.
                                         *
                                         * Proxy elements are mapped to *actual* elements in the DOM by injecting a
                                         * `data-id` attribute into each start tag in `staticHtml`.
                                         *
                                         */

                                        var WriteStream = function () {
                                            /**
                                             * Constructor.
                                             *
                                             * @param {Object} root The root element
                                             * @param {?Object} options The options
                                             */
                                            function WriteStream(root) {
                                                var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

                                                _classCallCheck(this, WriteStream);

                                                this.root = root;
                                                this.options = options;
                                                this.doc = root.ownerDocument;
                                                this.win = this.doc.defaultView || this.doc.parentWindow;
                                                this.parser = new _prescribe2['default']('', { autoFix: options.autoFix });

                                                // Actual elements by id.
                                                this.actuals = [root];

                                                // Embodies the "structure" of what's been written so far,
                                                // devoid of attributes.
                                                this.proxyHistory = '';

                                                // Create a proxy of the root element.
                                                this.proxyRoot = this.doc.createElement(root.nodeName);

                                                this.scriptStack = [];
                                                this.writeQueue = [];

                                                setData(this.proxyRoot, 'proxyof', 0);
                                            }

                                            /**
                                             * Writes the given strings.
                                             *
                                             * @param {...String} str The strings to write
                                             */


                                            WriteStream.prototype.write = function write() {
                                                var _writeQueue;

                                                (_writeQueue = this.writeQueue).push.apply(_writeQueue, arguments);

                                                // Process writes
                                                // When new script gets pushed or pending this will stop
                                                // because new writeQueue gets pushed
                                                while (!this.deferredRemote && this.writeQueue.length) {
                                                    var arg = this.writeQueue.shift();

                                                    if (utils.isFunction(arg)) {
                                                        this._callFunction(arg);
                                                    } else {
                                                        this._writeImpl(arg);
                                                    }
                                                }
                                            };

                                            /**
                                             * Calls the given function.
                                             *
                                             * @param {Function} fn The function to call
                                             * @private
                                             */


                                            WriteStream.prototype._callFunction = function _callFunction(fn) {
                                                var tok = { type: 'function', value: fn.name || fn.toString() };
                                                this._onScriptStart(tok);
                                                fn.call(this.win, this.doc);
                                                this._onScriptDone(tok);
                                            };

                                            /**
                                             * The write implementation
                                             *
                                             * @param {String} html The HTML to write.
                                             * @private
                                             */


                                            WriteStream.prototype._writeImpl = function _writeImpl(html) {
                                                this.parser.append(html);

                                                var tok = void 0;
                                                var script = void 0;
                                                var style = void 0;
                                                var tokens = [];

                                                // stop if we see a script token
                                                while ((tok = this.parser.readToken()) && !(script = utils.isScript(tok)) && !(style = utils.isStyle(tok))) {
                                                    tok = this.options.beforeWriteToken(tok);

                                                    if (tok) {
                                                        tokens.push(tok);
                                                    }
                                                }

                                                if (tokens.length > 0) {
                                                    this._writeStaticTokens(tokens);
                                                }

                                                if (script) {
                                                    this._handleScriptToken(tok);
                                                }

                                                if (style) {
                                                    this._handleStyleToken(tok);
                                                }
                                            };

                                            /**
                                             * Write contiguous non-script tokens (a chunk)
                                             *
                                             * @param {Array<Object>} tokens The tokens
                                             * @returns {{tokens, raw, actual, proxy}|null}
                                             * @private
                                             */


                                            WriteStream.prototype._writeStaticTokens = function _writeStaticTokens(tokens) {
                                                var chunk = this._buildChunk(tokens);

                                                if (!chunk.actual) {
                                                    // e.g., no tokens, or a noscript that got ignored
                                                    return null;
                                                }

                                                chunk.html = this.proxyHistory + chunk.actual;
                                                this.proxyHistory += chunk.proxy;
                                                this.proxyRoot.innerHTML = chunk.html;

                                                if (DEBUG_CHUNK) {
                                                    chunk.proxyInnerHTML = this.proxyRoot.innerHTML;
                                                }

                                                this._walkChunk();

                                                if (DEBUG_CHUNK) {
                                                    chunk.actualInnerHTML = this.root.innerHTML;
                                                }

                                                return chunk;
                                            };

                                            /**
                                             * Build a chunk.
                                             *
                                             * @param {Array<Object>} tokens The tokens to use.
                                             * @returns {{tokens: *, raw: string, actual: string, proxy: string}}
                                             * @private
                                             */


                                            WriteStream.prototype._buildChunk = function _buildChunk(tokens) {
                                                var nextId = this.actuals.length;

                                                // The raw html of this chunk.
                                                var raw = [];

                                                // The html to create the nodes in the tokens (with id's injected).
                                                var actual = [];

                                                // Html that can later be used to proxy the nodes in the tokens.
                                                var proxy = [];

                                                var len = tokens.length;
                                                for (var i = 0; i < len; i++) {
                                                    var tok = tokens[i];
                                                    var tokenRaw = tok.toString();

                                                    raw.push(tokenRaw);

                                                    if (tok.attrs) {
                                                        // tok.attrs <==> startTag or atomicTag or cursor
                                                        // Ignore noscript tags. They are atomic, so we don't have to worry about children.
                                                        if (!/^noscript$/i.test(tok.tagName)) {
                                                            var id = nextId++;

                                                            // Actual: inject id attribute: replace '>' at end of start tag with id attribute + '>'
                                                            actual.push(tokenRaw.replace(/(\/?>)/, ' ' + BASEATTR + 'id=' + id + ' $1'));

                                                            // Don't proxy scripts: they have no bearing on DOM structure.
                                                            if (tok.attrs.id !== PROXY_SCRIPT && tok.attrs.id !== PROXY_STYLE) {
                                                                // Proxy: strip all attributes and inject proxyof attribute
                                                                proxy.push(
                                                                    // ignore atomic tags (e.g., style): they have no "structural" effect
                                                                    tok.type === 'atomicTag' ? '' : '<' + tok.tagName + ' ' + BASEATTR + 'proxyof=' + id + (tok.unary ? ' />' : '>'));
                                                            }
                                                        }
                                                    } else {
                                                        // Visit any other type of token
                                                        // Actual: append.
                                                        actual.push(tokenRaw);

                                                        // Proxy: append endTags. Ignore everything else.
                                                        proxy.push(tok.type === 'endTag' ? tokenRaw : '');
                                                    }
                                                }

                                                return {
                                                    tokens: tokens,
                                                    raw: raw.join(''),
                                                    actual: actual.join(''),
                                                    proxy: proxy.join('')
                                                };
                                            };

                                            /**
                                             * Walk the chunks.
                                             *
                                             * @private
                                             */


                                            WriteStream.prototype._walkChunk = function _walkChunk() {
                                                var node = void 0;
                                                var stack = [this.proxyRoot];

                                                // use shift/unshift so that children are walked in document order
                                                while (utils.existy(node = stack.shift())) {
                                                    var isElement = node.nodeType === 1;
                                                    var isProxy = isElement && getData(node, 'proxyof');

                                                    // Ignore proxies
                                                    if (!isProxy) {
                                                        if (isElement) {
                                                            // New actual element: register it and remove the the id attr.
                                                            this.actuals[getData(node, 'id')] = node;
                                                            setData(node, 'id');
                                                        }

                                                        // Is node's parent a proxy?
                                                        var parentIsProxyOf = node.parentNode && getData(node.parentNode, 'proxyof');
                                                        if (parentIsProxyOf) {
                                                            // Move node under actual parent.
                                                            this.actuals[parentIsProxyOf].appendChild(node);
                                                        }
                                                    }

                                                    // prepend childNodes to stack
                                                    stack.unshift.apply(stack, utils.toArray(node.childNodes));
                                                }
                                            };

                                            /**
                                             * Handles Script tokens
                                             *
                                             * @param {Object} tok The token
                                             */


                                            WriteStream.prototype._handleScriptToken = function _handleScriptToken(tok) {
                                                var _this = this;

                                                var remainder = this.parser.clear();

                                                if (remainder) {
                                                    // Write remainder immediately behind this script.
                                                    this.writeQueue.unshift(remainder);
                                                }

                                                tok.src = tok.attrs.src || tok.attrs.SRC;

                                                tok = this.options.beforeWriteToken(tok);
                                                if (!tok) {
                                                    // User has removed this token
                                                    return;
                                                }

                                                if (tok.src && this.scriptStack.length) {
                                                    // Defer this script until scriptStack is empty.
                                                    // Assumption 1: This script will not start executing until
                                                    // scriptStack is empty.
                                                    this.deferredRemote = tok;
                                                } else {
                                                    this._onScriptStart(tok);
                                                }

                                                // Put the script node in the DOM.
                                                this._writeScriptToken(tok, function () {
                                                    _this._onScriptDone(tok);
                                                });
                                            };

                                            /**
                                             * Handles style tokens
                                             *
                                             * @param {Object} tok The token
                                             */


                                            WriteStream.prototype._handleStyleToken = function _handleStyleToken(tok) {
                                                var remainder = this.parser.clear();

                                                if (remainder) {
                                                    // Write remainder immediately behind this style.
                                                    this.writeQueue.unshift(remainder);
                                                }

                                                tok.type = tok.attrs.type || tok.attrs.TYPE || 'text/css';

                                                tok = this.options.beforeWriteToken(tok);

                                                if (tok) {
                                                    // Put the style node in the DOM.
                                                    this._writeStyleToken(tok);
                                                }

                                                if (remainder) {
                                                    this.write();
                                                }
                                            };

                                            /**
                                             * Build a style and insert it into the DOM.
                                             *
                                             * @param {Object} tok The token
                                             */


                                            WriteStream.prototype._writeStyleToken = function _writeStyleToken(tok) {
                                                var el = this._buildStyle(tok);

                                                this._insertCursor(el, PROXY_STYLE);

                                                // Set content
                                                if (tok.content) {
                                                    if (el.styleSheet && !el.sheet) {
                                                        el.styleSheet.cssText = tok.content;
                                                    } else {
                                                        el.appendChild(this.doc.createTextNode(tok.content));
                                                    }
                                                }
                                            };

                                            /**
                                             * Build a style element from an atomic style token.
                                             *
                                             * @param {Object} tok The token
                                             * @returns {Element}
                                             */


                                            WriteStream.prototype._buildStyle = function _buildStyle(tok) {
                                                var el = this.doc.createElement(tok.tagName);

                                                el.setAttribute('type', tok.type);

                                                // Set attributes
                                                utils.eachKey(tok.attrs, function (name, value) {
                                                    el.setAttribute(name, value);
                                                });

                                                return el;
                                            };

                                            /**
                                             * Append a span to the stream. That span will act as a cursor
                                             * (i.e. insertion point) for the element.
                                             *
                                             * @param {Object} el The element
                                             * @param {string} which The type of proxy element
                                             */


                                            WriteStream.prototype._insertCursor = function _insertCursor(el, which) {
                                                this._writeImpl('<span id="' + which + '"/>');

                                                var cursor = this.doc.getElementById(which);

                                                if (cursor) {
                                                    cursor.parentNode.replaceChild(el, cursor);
                                                }
                                            };

                                            /**
                                             * Called when a script is started.
                                             *
                                             * @param {Object} tok The token
                                             * @private
                                             */


                                            WriteStream.prototype._onScriptStart = function _onScriptStart(tok) {
                                                tok.outerWrites = this.writeQueue;
                                                this.writeQueue = [];
                                                this.scriptStack.unshift(tok);
                                            };

                                            /**
                                             * Called when a script is done.
                                             *
                                             * @param {Object} tok The token
                                             * @private
                                             */


                                            WriteStream.prototype._onScriptDone = function _onScriptDone(tok) {
                                                // Pop script and check nesting.
                                                if (tok !== this.scriptStack[0]) {
                                                    this.options.error({ msg: 'Bad script nesting or script finished twice' });
                                                    return;
                                                }

                                                this.scriptStack.shift();

                                                // Append outer writes to queue and process them.
                                                this.write.apply(this, tok.outerWrites);

                                                // Check for pending remote

                                                // Assumption 2: if remote_script1 writes remote_script2 then
                                                // the we notice remote_script1 finishes before remote_script2 starts.
                                                // I think this is equivalent to assumption 1
                                                if (!this.scriptStack.length && this.deferredRemote) {
                                                    this._onScriptStart(this.deferredRemote);
                                                    this.deferredRemote = null;
                                                }
                                            };

                                            /**
                                             * Build a script and insert it into the DOM.
                                             * Done is called once script has executed.
                                             *
                                             * @param {Object} tok The token
                                             * @param {Function} done The callback when complete
                                             */


                                            WriteStream.prototype._writeScriptToken = function _writeScriptToken(tok, done) {
                                                var el = this._buildScript(tok);
                                                var asyncRelease = this._shouldRelease(el);
                                                var afterAsync = this.options.afterAsync;

                                                if (tok.src) {
                                                    // Fix for attribute "SRC" (capitalized). IE does not recognize it.
                                                    el.src = tok.src;
                                                    this._scriptLoadHandler(el, !asyncRelease ? function () {
                                                        done();
                                                        afterAsync();
                                                    } : afterAsync);
                                                }

                                                try {
                                                    this._insertCursor(el, PROXY_SCRIPT);
                                                    if (!el.src || asyncRelease) {
                                                        done();
                                                    }
                                                } catch (e) {
                                                    this.options.error(e);
                                                    done();
                                                }
                                            };

                                            /**
                                             * Build a script element from an atomic script token.
                                             *
                                             * @param {Object} tok The token
                                             * @returns {Element}
                                             */


                                            WriteStream.prototype._buildScript = function _buildScript(tok) {
                                                var el = this.doc.createElement(tok.tagName);

                                                // Set attributes
                                                utils.eachKey(tok.attrs, function (name, value) {
                                                    el.setAttribute(name, value);
                                                });

                                                // Set content
                                                if (tok.content) {
                                                    el.text = tok.content;
                                                }

                                                return el;
                                            };

                                            /**
                                             * Setup the script load handler on an element.
                                             *
                                             * @param {Object} el The element
                                             * @param {Function} done The callback
                                             * @private
                                             */


                                            WriteStream.prototype._scriptLoadHandler = function _scriptLoadHandler(el, done) {
                                                function cleanup() {
                                                    el = el.onload = el.onreadystatechange = el.onerror = null;
                                                }

                                                var error = this.options.error;

                                                function success() {
                                                    cleanup();
                                                    if (done != null) {
                                                        done();
                                                    }
                                                    done = null;
                                                }

                                                function failure(err) {
                                                    cleanup();
                                                    error(err);
                                                    if (done != null) {
                                                        done();
                                                    }
                                                    done = null;
                                                }

                                                function reattachEventListener(el, evt) {
                                                    var handler = el['on' + evt];
                                                    if (handler != null) {
                                                        el['_on' + evt] = handler;
                                                    }
                                                }

                                                reattachEventListener(el, 'load');
                                                reattachEventListener(el, 'error');

                                                _extends(el, {
                                                    onload: function onload() {
                                                        if (el._onload) {
                                                            try {
                                                                el._onload.apply(this, Array.prototype.slice.call(arguments, 0));
                                                            } catch (err) {
                                                                failure({ msg: 'onload handler failed ' + err + ' @ ' + el.src });
                                                            }
                                                        }
                                                        success();
                                                    },
                                                    onerror: function onerror() {
                                                        if (el._onerror) {
                                                            try {
                                                                el._onerror.apply(this, Array.prototype.slice.call(arguments, 0));
                                                            } catch (err) {
                                                                failure({ msg: 'onerror handler failed ' + err + ' @ ' + el.src });
                                                                return;
                                                            }
                                                        }
                                                        failure({ msg: 'remote script failed ' + el.src });
                                                    },
                                                    onreadystatechange: function onreadystatechange() {
                                                        if (/^(loaded|complete)$/.test(el.readyState)) {
                                                            success();
                                                        }
                                                    }
                                                });
                                            };

                                            /**
                                             * Determines whether to release.
                                             *
                                             * @param {Object} el The element
                                             * @returns {boolean}
                                             * @private
                                             */


                                            WriteStream.prototype._shouldRelease = function _shouldRelease(el) {
                                                var isScript = /^script$/i.test(el.nodeName);
                                                return !isScript || !!(this.options.releaseAsync && el.src && el.hasAttribute('async'));
                                            };

                                            return WriteStream;
                                        }();

                                        exports['default'] = WriteStream;

                                        /***/ },
                                    /* 3 */
                                    /***/ function(module, exports, __webpack_require__) {

                                        /**
                                         * @file prescribe
                                         * @description Tiny, forgiving HTML parser
                                         * @version vundefined
                                         * @see {@link https://github.com/krux/prescribe/}
                                         * @license MIT
                                         * @author Derek Brans
                                         * @copyright 2016 Krux Digital, Inc
                                         */
                                        (function webpackUniversalModuleDefinition(root, factory) {
                                            if(true)
                                                module.exports = factory();
                                            else if(typeof define === 'function' && define.amd)
                                                define([], factory);
                                            else if(typeof exports === 'object')
                                                exports["Prescribe"] = factory();
                                            else
                                                root["Prescribe"] = factory();
                                        })(this, function() {
                                            return /******/ (function(modules) { // webpackBootstrap
                                                /******/ 	// The module cache
                                                /******/ 	var installedModules = {};

                                                /******/ 	// The require function
                                                /******/ 	function __webpack_require__(moduleId) {

                                                    /******/ 		// Check if module is in cache
                                                    /******/ 		if(installedModules[moduleId])
                                                    /******/ 			return installedModules[moduleId].exports;

                                                    /******/ 		// Create a new module (and put it into the cache)
                                                    /******/ 		var module = installedModules[moduleId] = {
                                                        /******/ 			exports: {},
                                                        /******/ 			id: moduleId,
                                                        /******/ 			loaded: false
                                                        /******/ 		};

                                                    /******/ 		// Execute the module function
                                                    /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

                                                    /******/ 		// Flag the module as loaded
                                                    /******/ 		module.loaded = true;

                                                    /******/ 		// Return the exports of the module
                                                    /******/ 		return module.exports;
                                                    /******/ 	}


                                                /******/ 	// expose the modules object (__webpack_modules__)
                                                /******/ 	__webpack_require__.m = modules;

                                                /******/ 	// expose the module cache
                                                /******/ 	__webpack_require__.c = installedModules;

                                                /******/ 	// __webpack_public_path__
                                                /******/ 	__webpack_require__.p = "";

                                                /******/ 	// Load entry module and return exports
                                                /******/ 	return __webpack_require__(0);
                                                /******/ })
                                            /************************************************************************/
                                            /******/ ([
                                                /* 0 */
                                                /***/ function(module, exports, __webpack_require__) {

                                                    'use strict';

                                                    var _HtmlParser = __webpack_require__(1);

                                                    var _HtmlParser2 = _interopRequireDefault(_HtmlParser);

                                                    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

                                                    module.exports = _HtmlParser2['default'];

                                                    /***/ },
                                                /* 1 */
                                                /***/ function(module, exports, __webpack_require__) {

                                                    'use strict';

                                                    exports.__esModule = true;

                                                    var _supports = __webpack_require__(2);

                                                    var supports = _interopRequireWildcard(_supports);

                                                    var _streamReaders = __webpack_require__(3);

                                                    var streamReaders = _interopRequireWildcard(_streamReaders);

                                                    var _fixedReadTokenFactory = __webpack_require__(6);

                                                    var _fixedReadTokenFactory2 = _interopRequireDefault(_fixedReadTokenFactory);

                                                    var _utils = __webpack_require__(5);

                                                    function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { 'default': obj }; }

                                                    function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj['default'] = obj; return newObj; } }

                                                    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

                                                    /**
                                                     * Detection regular expressions.
                                                     *
                                                     * Order of detection matters: detection of one can only
                                                     * succeed if detection of previous didn't

                                                     * @type {Object}
                                                     */
                                                    var detect = {
                                                        comment: /^<!--/,
                                                        endTag: /^<\//,
                                                        atomicTag: /^<\s*(script|style|noscript|iframe|textarea)[\s\/>]/i,
                                                        startTag: /^</,
                                                        chars: /^[^<]/
                                                    };

                                                    /**
                                                     * HtmlParser provides the capability to parse HTML and return tokens
                                                     * representing the tags and content.
                                                     */

                                                    var HtmlParser = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} stream The initial parse stream contents.
                                                         * @param {Object} options The options
                                                         * @param {boolean} options.autoFix Set to true to automatically fix errors
                                                         */
                                                        function HtmlParser() {
                                                            var _this = this;

                                                            var stream = arguments.length > 0 && arguments[0] !== undefined ? arguments[0] : '';
                                                            var options = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : {};

                                                            _classCallCheck(this, HtmlParser);

                                                            this.stream = stream;

                                                            var fix = false;
                                                            var fixedTokenOptions = {};

                                                            for (var key in supports) {
                                                                if (supports.hasOwnProperty(key)) {
                                                                    if (options.autoFix) {
                                                                        fixedTokenOptions[key + 'Fix'] = true; // !supports[key];
                                                                    }
                                                                    fix = fix || fixedTokenOptions[key + 'Fix'];
                                                                }
                                                            }

                                                            if (fix) {
                                                                this._readToken = (0, _fixedReadTokenFactory2['default'])(this, fixedTokenOptions, function () {
                                                                    return _this._readTokenImpl();
                                                                });
                                                                this._peekToken = (0, _fixedReadTokenFactory2['default'])(this, fixedTokenOptions, function () {
                                                                    return _this._peekTokenImpl();
                                                                });
                                                            } else {
                                                                this._readToken = this._readTokenImpl;
                                                                this._peekToken = this._peekTokenImpl;
                                                            }
                                                        }

                                                        /**
                                                         * Appends the given string to the parse stream.
                                                         *
                                                         * @param {string} str The string to append
                                                         */


                                                        HtmlParser.prototype.append = function append(str) {
                                                            this.stream += str;
                                                        };

                                                        /**
                                                         * Prepends the given string to the parse stream.
                                                         *
                                                         * @param {string} str The string to prepend
                                                         */


                                                        HtmlParser.prototype.prepend = function prepend(str) {
                                                            this.stream = str + this.stream;
                                                        };

                                                        /**
                                                         * The implementation of the token reading.
                                                         *
                                                         * @private
                                                         * @returns {?Token}
                                                         */


                                                        HtmlParser.prototype._readTokenImpl = function _readTokenImpl() {
                                                            var token = this._peekTokenImpl();
                                                            if (token) {
                                                                this.stream = this.stream.slice(token.length);
                                                                return token;
                                                            }
                                                        };

                                                        /**
                                                         * The implementation of token peeking.
                                                         *
                                                         * @returns {?Token}
                                                         */


                                                        HtmlParser.prototype._peekTokenImpl = function _peekTokenImpl() {
                                                            for (var type in detect) {
                                                                if (detect.hasOwnProperty(type)) {
                                                                    if (detect[type].test(this.stream)) {
                                                                        var token = streamReaders[type](this.stream);

                                                                        if (token) {
                                                                            if (token.type === 'startTag' && /script|style/i.test(token.tagName)) {
                                                                                return null;
                                                                            } else {
                                                                                token.text = this.stream.substr(0, token.length);
                                                                                return token;
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        };

                                                        /**
                                                         * The public token peeking interface.  Delegates to the basic token peeking
                                                         * or a version that performs fixups depending on the `autoFix` setting in
                                                         * options.
                                                         *
                                                         * @returns {object}
                                                         */


                                                        HtmlParser.prototype.peekToken = function peekToken() {
                                                            return this._peekToken();
                                                        };

                                                        /**
                                                         * The public token reading interface.  Delegates to the basic token reading
                                                         * or a version that performs fixups depending on the `autoFix` setting in
                                                         * options.
                                                         *
                                                         * @returns {object}
                                                         */


                                                        HtmlParser.prototype.readToken = function readToken() {
                                                            return this._readToken();
                                                        };

                                                        /**
                                                         * Read tokens and hand to the given handlers.
                                                         *
                                                         * @param {Object} handlers The handlers to use for the different tokens.
                                                         */


                                                        HtmlParser.prototype.readTokens = function readTokens(handlers) {
                                                            var tok = void 0;
                                                            while (tok = this.readToken()) {
                                                                // continue until we get an explicit "false" return
                                                                if (handlers[tok.type] && handlers[tok.type](tok) === false) {
                                                                    return;
                                                                }
                                                            }
                                                        };

                                                        /**
                                                         * Clears the parse stream.
                                                         *
                                                         * @returns {string} The contents of the parse stream before clearing.
                                                         */


                                                        HtmlParser.prototype.clear = function clear() {
                                                            var rest = this.stream;
                                                            this.stream = '';
                                                            return rest;
                                                        };

                                                        /**
                                                         * Returns the rest of the parse stream.
                                                         *
                                                         * @returns {string} The contents of the parse stream.
                                                         */


                                                        HtmlParser.prototype.rest = function rest() {
                                                            return this.stream;
                                                        };

                                                        return HtmlParser;
                                                    }();

                                                    exports['default'] = HtmlParser;


                                                    HtmlParser.tokenToString = function (tok) {
                                                        return tok.toString();
                                                    };

                                                    HtmlParser.escapeAttributes = function (attrs) {
                                                        var escapedAttrs = {};

                                                        for (var name in attrs) {
                                                            if (attrs.hasOwnProperty(name)) {
                                                                escapedAttrs[name] = (0, _utils.escapeQuotes)(attrs[name], null);
                                                            }
                                                        }

                                                        return escapedAttrs;
                                                    };

                                                    HtmlParser.supports = supports;

                                                    for (var key in supports) {
                                                        if (supports.hasOwnProperty(key)) {
                                                            HtmlParser.browserHasFlaw = HtmlParser.browserHasFlaw || !supports[key] && key;
                                                        }
                                                    }

                                                    /***/ },
                                                /* 2 */
                                                /***/ function(module, exports) {

                                                    'use strict';

                                                    exports.__esModule = true;
                                                    var tagSoup = false;
                                                    var selfClose = false;

                                                    var work = window.document.createElement('div');

                                                    try {
                                                        var html = '<P><I></P></I>';
                                                        work.innerHTML = html;
                                                        exports.tagSoup = tagSoup = work.innerHTML !== html;
                                                    } catch (e) {
                                                        exports.tagSoup = tagSoup = false;
                                                    }

                                                    try {
                                                        work.innerHTML = '<P><i><P></P></i></P>';
                                                        exports.selfClose = selfClose = work.childNodes.length === 2;
                                                    } catch (e) {
                                                        exports.selfClose = selfClose = false;
                                                    }

                                                    work = null;

                                                    exports.tagSoup = tagSoup;
                                                    exports.selfClose = selfClose;

                                                    /***/ },
                                                /* 3 */
                                                /***/ function(module, exports, __webpack_require__) {

                                                    'use strict';

                                                    exports.__esModule = true;

                                                    var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

                                                    exports.comment = comment;
                                                    exports.chars = chars;
                                                    exports.startTag = startTag;
                                                    exports.atomicTag = atomicTag;
                                                    exports.endTag = endTag;

                                                    var _tokens = __webpack_require__(4);

                                                    /**
                                                     * Regular Expressions for parsing tags and attributes
                                                     *
                                                     * @type {Object}
                                                     */
                                                    var REGEXES = {
                                                        startTag: /^<([\-A-Za-z0-9_]+)((?:\s+[\w\-]+(?:\s*=?\s*(?:(?:"[^"]*")|(?:'[^']*')|[^>\s]+))?)*)\s*(\/?)>/,
                                                        endTag: /^<\/([\-A-Za-z0-9_]+)[^>]*>/,
                                                        attr: /(?:([\-A-Za-z0-9_]+)\s*=\s*(?:(?:"((?:\\.|[^"])*)")|(?:'((?:\\.|[^'])*)')|([^>\s]+)))|(?:([\-A-Za-z0-9_]+)(\s|$)+)/g,
                                                        fillAttr: /^(checked|compact|declare|defer|disabled|ismap|multiple|nohref|noresize|noshade|nowrap|readonly|selected)$/i
                                                    };

                                                    /**
                                                     * Reads a comment token
                                                     *
                                                     * @param {string} stream The input stream
                                                     * @returns {CommentToken}
                                                     */
                                                    function comment(stream) {
                                                        var index = stream.indexOf('-->');
                                                        if (index >= 0) {
                                                            return new _tokens.CommentToken(stream.substr(4, index - 1), index + 3);
                                                        }
                                                    }

                                                    /**
                                                     * Reads non-tag characters.
                                                     *
                                                     * @param {string} stream The input stream
                                                     * @returns {CharsToken}
                                                     */
                                                    function chars(stream) {
                                                        var index = stream.indexOf('<');
                                                        return new _tokens.CharsToken(index >= 0 ? index : stream.length);
                                                    }

                                                    /**
                                                     * Reads start tag token.
                                                     *
                                                     * @param {string} stream The input stream
                                                     * @returns {StartTagToken}
                                                     */
                                                    function startTag(stream) {
                                                        var endTagIndex = stream.indexOf('>');
                                                        if (endTagIndex !== -1) {
                                                            var match = stream.match(REGEXES.startTag);
                                                            if (match) {
                                                                var _ret = function () {
                                                                    var attrs = {};
                                                                    var booleanAttrs = {};
                                                                    var rest = match[2];

                                                                    match[2].replace(REGEXES.attr, function (match, name) {
                                                                        if (!(arguments[2] || arguments[3] || arguments[4] || arguments[5])) {
                                                                            attrs[name] = '';
                                                                        } else if (arguments[5]) {
                                                                            attrs[arguments[5]] = '';
                                                                            booleanAttrs[arguments[5]] = true;
                                                                        } else {
                                                                            attrs[name] = arguments[2] || arguments[3] || arguments[4] || REGEXES.fillAttr.test(name) && name || '';
                                                                        }

                                                                        rest = rest.replace(match, '');
                                                                    });

                                                                    return {
                                                                        v: new _tokens.StartTagToken(match[1], match[0].length, attrs, booleanAttrs, !!match[3], rest.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, ''))
                                                                    };
                                                                }();

                                                                if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
                                                            }
                                                        }
                                                    }

                                                    /**
                                                     * Reads atomic tag token.
                                                     *
                                                     * @param {string} stream The input stream
                                                     * @returns {AtomicTagToken}
                                                     */
                                                    function atomicTag(stream) {
                                                        var start = startTag(stream);
                                                        if (start) {
                                                            var rest = stream.slice(start.length);
                                                            // for optimization, we check first just for the end tag
                                                            if (rest.match(new RegExp('<\/\\s*' + start.tagName + '\\s*>', 'i'))) {
                                                                // capturing the content is inefficient, so we do it inside the if
                                                                var match = rest.match(new RegExp('([\\s\\S]*?)<\/\\s*' + start.tagName + '\\s*>', 'i'));
                                                                if (match) {
                                                                    return new _tokens.AtomicTagToken(start.tagName, match[0].length + start.length, start.attrs, start.booleanAttrs, match[1]);
                                                                }
                                                            }
                                                        }
                                                    }

                                                    /**
                                                     * Reads an end tag token.
                                                     *
                                                     * @param {string} stream The input stream
                                                     * @returns {EndTagToken}
                                                     */
                                                    function endTag(stream) {
                                                        var match = stream.match(REGEXES.endTag);
                                                        if (match) {
                                                            return new _tokens.EndTagToken(match[1], match[0].length);
                                                        }
                                                    }

                                                    /***/ },
                                                /* 4 */
                                                /***/ function(module, exports, __webpack_require__) {

                                                    'use strict';

                                                    exports.__esModule = true;
                                                    exports.EndTagToken = exports.AtomicTagToken = exports.StartTagToken = exports.TagToken = exports.CharsToken = exports.CommentToken = exports.Token = undefined;

                                                    var _utils = __webpack_require__(5);

                                                    function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

                                                    /**
                                                     * Token is a base class for all token types parsed.  Note we don't actually
                                                     * use intheritance due to IE8's non-existent ES5 support.
                                                     */
                                                    var Token =
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} type The type of the Token.
                                                         * @param {Number} length The length of the Token text.
                                                         */
                                                        exports.Token = function Token(type, length) {
                                                            _classCallCheck(this, Token);

                                                            this.type = type;
                                                            this.length = length;
                                                            this.text = '';
                                                        };

                                                    /**
                                                     * CommentToken represents comment tags.
                                                     */


                                                    var CommentToken = exports.CommentToken = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} content The content of the comment
                                                         * @param {Number} length The length of the Token text.
                                                         */
                                                        function CommentToken(content, length) {
                                                            _classCallCheck(this, CommentToken);

                                                            this.type = 'comment';
                                                            this.length = length || (content ? content.length : 0);
                                                            this.text = '';
                                                            this.content = content;
                                                        }

                                                        CommentToken.prototype.toString = function toString() {
                                                            return '<!--' + this.content;
                                                        };

                                                        return CommentToken;
                                                    }();

                                                    /**
                                                     * CharsToken represents non-tag characters.
                                                     */


                                                    var CharsToken = exports.CharsToken = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {Number} length The length of the Token text.
                                                         */
                                                        function CharsToken(length) {
                                                            _classCallCheck(this, CharsToken);

                                                            this.type = 'chars';
                                                            this.length = length;
                                                            this.text = '';
                                                        }

                                                        CharsToken.prototype.toString = function toString() {
                                                            return this.text;
                                                        };

                                                        return CharsToken;
                                                    }();

                                                    /**
                                                     * TagToken is a base class for all tag-based Tokens.
                                                     */


                                                    var TagToken = exports.TagToken = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} type The type of the token.
                                                         * @param {string} tagName The tag name.
                                                         * @param {Number} length The length of the Token text.
                                                         * @param {Object} attrs The dictionary of attributes and values
                                                         * @param {Object} booleanAttrs If an entry has 'true' then the attribute
                                                         *                              is a boolean attribute
                                                         */
                                                        function TagToken(type, tagName, length, attrs, booleanAttrs) {
                                                            _classCallCheck(this, TagToken);

                                                            this.type = type;
                                                            this.length = length;
                                                            this.text = '';
                                                            this.tagName = tagName;
                                                            this.attrs = attrs;
                                                            this.booleanAttrs = booleanAttrs;
                                                            this.unary = false;
                                                            this.html5Unary = false;
                                                        }

                                                        /**
                                                         * Formats the given token tag.
                                                         *
                                                         * @param {TagToken} tok The TagToken to format.
                                                         * @param {?string} [content=null] The content of the token.
                                                         * @returns {string} The formatted tag.
                                                         */


                                                        TagToken.formatTag = function formatTag(tok) {
                                                            var content = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : null;

                                                            var str = '<' + tok.tagName;
                                                            for (var key in tok.attrs) {
                                                                if (tok.attrs.hasOwnProperty(key)) {
                                                                    str += ' ' + key;

                                                                    var val = tok.attrs[key];
                                                                    if (typeof tok.booleanAttrs === 'undefined' || typeof tok.booleanAttrs[key] === 'undefined') {
                                                                        str += '="' + (0, _utils.escapeQuotes)(val) + '"';
                                                                    }
                                                                }
                                                            }

                                                            if (tok.rest) {
                                                                str += ' ' + tok.rest;
                                                            }

                                                            if (tok.unary && !tok.html5Unary) {
                                                                str += '/>';
                                                            } else {
                                                                str += '>';
                                                            }

                                                            if (content !== undefined && content !== null) {
                                                                str += content + '</' + tok.tagName + '>';
                                                            }

                                                            return str;
                                                        };

                                                        return TagToken;
                                                    }();

                                                    /**
                                                     * StartTagToken represents a start token.
                                                     */


                                                    var StartTagToken = exports.StartTagToken = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} tagName The tag name.
                                                         * @param {Number} length The length of the Token text
                                                         * @param {Object} attrs The dictionary of attributes and values
                                                         * @param {Object} booleanAttrs If an entry has 'true' then the attribute
                                                         *                              is a boolean attribute
                                                         * @param {boolean} unary True if the tag is a unary tag
                                                         * @param {string} rest The rest of the content.
                                                         */
                                                        function StartTagToken(tagName, length, attrs, booleanAttrs, unary, rest) {
                                                            _classCallCheck(this, StartTagToken);

                                                            this.type = 'startTag';
                                                            this.length = length;
                                                            this.text = '';
                                                            this.tagName = tagName;
                                                            this.attrs = attrs;
                                                            this.booleanAttrs = booleanAttrs;
                                                            this.html5Unary = false;
                                                            this.unary = unary;
                                                            this.rest = rest;
                                                        }

                                                        StartTagToken.prototype.toString = function toString() {
                                                            return TagToken.formatTag(this);
                                                        };

                                                        return StartTagToken;
                                                    }();

                                                    /**
                                                     * AtomicTagToken represents an atomic tag.
                                                     */


                                                    var AtomicTagToken = exports.AtomicTagToken = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} tagName The name of the tag.
                                                         * @param {Number} length The length of the tag text.
                                                         * @param {Object} attrs The attributes.
                                                         * @param {Object} booleanAttrs If an entry has 'true' then the attribute
                                                         *                              is a boolean attribute
                                                         * @param {string} content The content of the tag.
                                                         */
                                                        function AtomicTagToken(tagName, length, attrs, booleanAttrs, content) {
                                                            _classCallCheck(this, AtomicTagToken);

                                                            this.type = 'atomicTag';
                                                            this.length = length;
                                                            this.text = '';
                                                            this.tagName = tagName;
                                                            this.attrs = attrs;
                                                            this.booleanAttrs = booleanAttrs;
                                                            this.unary = false;
                                                            this.html5Unary = false;
                                                            this.content = content;
                                                        }

                                                        AtomicTagToken.prototype.toString = function toString() {
                                                            return TagToken.formatTag(this, this.content);
                                                        };

                                                        return AtomicTagToken;
                                                    }();

                                                    /**
                                                     * EndTagToken represents an end tag.
                                                     */


                                                    var EndTagToken = exports.EndTagToken = function () {
                                                        /**
                                                         * Constructor.
                                                         *
                                                         * @param {string} tagName The name of the tag.
                                                         * @param {Number} length The length of the tag text.
                                                         */
                                                        function EndTagToken(tagName, length) {
                                                            _classCallCheck(this, EndTagToken);

                                                            this.type = 'endTag';
                                                            this.length = length;
                                                            this.text = '';
                                                            this.tagName = tagName;
                                                        }

                                                        EndTagToken.prototype.toString = function toString() {
                                                            return '</' + this.tagName + '>';
                                                        };

                                                        return EndTagToken;
                                                    }();

                                                    /***/ },
                                                /* 5 */
                                                /***/ function(module, exports) {

                                                    'use strict';

                                                    exports.__esModule = true;
                                                    exports.escapeQuotes = escapeQuotes;

                                                    /**
                                                     * Escape quotes in the given value.
                                                     *
                                                     * @param {string} value The value to escape.
                                                     * @param {string} [defaultValue=''] The default value to return if value is falsy.
                                                     * @returns {string}
                                                     */
                                                    function escapeQuotes(value) {
                                                        var defaultValue = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

                                                        // There's no lookback in JS, so /(^|[^\\])"/ only matches the first of two `"`s.
                                                        // Instead, just match anything before a double-quote and escape if it's not already escaped.
                                                        return !value ? defaultValue : value.replace(/([^"]*)"/g, function (_, prefix) {
                                                            return (/\\/.test(prefix) ? prefix + '"' : prefix + '\\"'
                                                            );
                                                        });
                                                    }

                                                    /***/ },
                                                /* 6 */
                                                /***/ function(module, exports) {

                                                    'use strict';

                                                    exports.__esModule = true;
                                                    exports['default'] = fixedReadTokenFactory;
                                                    /**
                                                     * Empty Elements - HTML 4.01
                                                     *
                                                     * @type {RegExp}
                                                     */
                                                    var EMPTY = /^(AREA|BASE|BASEFONT|BR|COL|FRAME|HR|IMG|INPUT|ISINDEX|LINK|META|PARAM|EMBED)$/i;

                                                    /**
                                                     * Elements that you can intentionally leave open (and which close themselves)
                                                     *
                                                     * @type {RegExp}
                                                     */
                                                    var CLOSESELF = /^(COLGROUP|DD|DT|LI|OPTIONS|P|TD|TFOOT|TH|THEAD|TR)$/i;

                                                    /**
                                                     * Corrects a token.
                                                     *
                                                     * @param {Token} tok The token to correct
                                                     * @returns {Token} The corrected token
                                                     */
                                                    function correct(tok) {
                                                        if (tok && tok.type === 'startTag') {
                                                            tok.unary = EMPTY.test(tok.tagName) || tok.unary;
                                                            tok.html5Unary = !/\/>$/.test(tok.text);
                                                        }
                                                        return tok;
                                                    }

                                                    /**
                                                     * Peeks at the next token in the parser.
                                                     *
                                                     * @param {HtmlParser} parser The parser
                                                     * @param {Function} readTokenImpl The underlying readToken implementation
                                                     * @returns {Token} The next token
                                                     */
                                                    function peekToken(parser, readTokenImpl) {
                                                        var tmp = parser.stream;
                                                        var tok = correct(readTokenImpl());
                                                        parser.stream = tmp;
                                                        return tok;
                                                    }

                                                    /**
                                                     * Closes the last token.
                                                     *
                                                     * @param {HtmlParser} parser The parser
                                                     * @param {Array<Token>} stack The stack
                                                     */
                                                    function closeLast(parser, stack) {
                                                        var tok = stack.pop();

                                                        // prepend close tag to stream.
                                                        parser.prepend('</' + tok.tagName + '>');
                                                    }

                                                    /**
                                                     * Create a new token stack.
                                                     *
                                                     * @returns {Array<Token>}
                                                     */
                                                    function newStack() {
                                                        var stack = [];

                                                        stack.last = function () {
                                                            return this[this.length - 1];
                                                        };

                                                        stack.lastTagNameEq = function (tagName) {
                                                            var last = this.last();
                                                            return last && last.tagName && last.tagName.toUpperCase() === tagName.toUpperCase();
                                                        };

                                                        stack.containsTagName = function (tagName) {
                                                            for (var i = 0, tok; tok = this[i]; i++) {
                                                                if (tok.tagName === tagName) {
                                                                    return true;
                                                                }
                                                            }
                                                            return false;
                                                        };

                                                        return stack;
                                                    }

                                                    /**
                                                     * Return a readToken implementation that fixes input.
                                                     *
                                                     * @param {HtmlParser} parser The parser
                                                     * @param {Object} options Options for fixing
                                                     * @param {boolean} options.tagSoupFix True to fix tag soup scenarios
                                                     * @param {boolean} options.selfCloseFix True to fix self-closing tags
                                                     * @param {Function} readTokenImpl The underlying readToken implementation
                                                     * @returns {Function}
                                                     */
                                                    function fixedReadTokenFactory(parser, options, readTokenImpl) {
                                                        var stack = newStack();

                                                        var handlers = {
                                                            startTag: function startTag(tok) {
                                                                var tagName = tok.tagName;

                                                                if (tagName.toUpperCase() === 'TR' && stack.lastTagNameEq('TABLE')) {
                                                                    parser.prepend('<TBODY>');
                                                                    prepareNextToken();
                                                                } else if (options.selfCloseFix && CLOSESELF.test(tagName) && stack.containsTagName(tagName)) {
                                                                    if (stack.lastTagNameEq(tagName)) {
                                                                        closeLast(parser, stack);
                                                                    } else {
                                                                        parser.prepend('</' + tok.tagName + '>');
                                                                        prepareNextToken();
                                                                    }
                                                                } else if (!tok.unary) {
                                                                    stack.push(tok);
                                                                }
                                                            },
                                                            endTag: function endTag(tok) {
                                                                var last = stack.last();
                                                                if (last) {
                                                                    if (options.tagSoupFix && !stack.lastTagNameEq(tok.tagName)) {
                                                                        // cleanup tag soup
                                                                        closeLast(parser, stack);
                                                                    } else {
                                                                        stack.pop();
                                                                    }
                                                                } else if (options.tagSoupFix) {
                                                                    // cleanup tag soup part 2: skip this token
                                                                    readTokenImpl();
                                                                    prepareNextToken();
                                                                }
                                                            }
                                                        };

                                                        function prepareNextToken() {
                                                            var tok = peekToken(parser, readTokenImpl);
                                                            if (tok && handlers[tok.type]) {
                                                                handlers[tok.type](tok);
                                                            }
                                                        }

                                                        return function fixedReadToken() {
                                                            prepareNextToken();
                                                            return correct(readTokenImpl());
                                                        };
                                                    }

                                                    /***/ }
                                                /******/ ])
                                        });
                                        ;

                                        /***/ },
                                    /* 4 */
                                    /***/ function(module, exports) {

                                        'use strict';

                                        exports.__esModule = true;

                                        var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

                                        exports.existy = existy;
                                        exports.isFunction = isFunction;
                                        exports.each = each;
                                        exports.eachKey = eachKey;
                                        exports.defaults = defaults;
                                        exports.toArray = toArray;
                                        exports.last = last;
                                        exports.isTag = isTag;
                                        exports.isScript = isScript;
                                        exports.isStyle = isStyle;
                                        /**
                                         * Determine if the thing is not undefined and not null.
                                         *
                                         * @param {*} thing The thing to test
                                         * @returns {boolean} True if the thing is not undefined and not null.
                                         */
                                        function existy(thing) {
                                            return thing !== void 0 && thing !== null;
                                        }

                                        /**
                                         * Is this a function?
                                         *
                                         * @param {*} x The variable to test
                                         * @returns {boolean} True if the variable is a function
                                         */
                                        function isFunction(x) {
                                            return 'function' === typeof x;
                                        }

                                        /**
                                         * Loop over each item in an array-like value.
                                         *
                                         * @param {Array<*>} arr The array to loop over
                                         * @param {Function} fn The function to call
                                         * @param {?Object} target The object to bind to the function
                                         */
                                        function each(arr, fn, target) {
                                            var i = void 0;
                                            var len = arr && arr.length || 0;
                                            for (i = 0; i < len; i++) {
                                                fn.call(target, arr[i], i);
                                            }
                                        }

                                        /**
                                         * Loop over each key/value pair in a hash.
                                         *
                                         * @param {Object} obj The object
                                         * @param {Function} fn The function to call
                                         * @param {?Object} target The object to bind to the function
                                         */
                                        function eachKey(obj, fn, target) {
                                            for (var key in obj) {
                                                if (obj.hasOwnProperty(key)) {
                                                    fn.call(target, key, obj[key]);
                                                }
                                            }
                                        }

                                        /**
                                         * Set default options where some option was not specified.
                                         *
                                         * @param {Object} options The destination
                                         * @param {Object} _defaults The defaults
                                         * @returns {Object}
                                         */
                                        function defaults(options, _defaults) {
                                            options = options || {};
                                            eachKey(_defaults, function (key, val) {
                                                if (!existy(options[key])) {
                                                    options[key] = val;
                                                }
                                            });
                                            return options;
                                        }

                                        /**
                                         * Convert value (e.g., a NodeList) to an array.
                                         *
                                         * @param {*} obj The object
                                         * @returns {Array<*>}
                                         */
                                        function toArray(obj) {
                                            try {
                                                return Array.prototype.slice.call(obj);
                                            } catch (e) {
                                                var _ret = function () {
                                                    var ret = [];
                                                    each(obj, function (val) {
                                                        ret.push(val);
                                                    });
                                                    return {
                                                        v: ret
                                                    };
                                                }();

                                                if ((typeof _ret === 'undefined' ? 'undefined' : _typeof(_ret)) === "object") return _ret.v;
                                            }
                                        }

                                        /**
                                         * Get the last item in an array
                                         *
                                         * @param {Array<*>} array The array
                                         * @returns {*} The last item in the array
                                         */
                                        function last(array) {
                                            return array[array.length - 1];
                                        }

                                        /**
                                         * Test if token is a script tag.
                                         *
                                         * @param {Object} tok The token
                                         * @param {String} tag The tag name
                                         * @returns {boolean} True if the token is a script tag
                                         */
                                        function isTag(tok, tag) {
                                            return !tok || !(tok.type === 'startTag' || tok.type === 'atomicTag') || !('tagName' in tok) ? !1 : !!~tok.tagName.toLowerCase().indexOf(tag);
                                        }

                                        /**
                                         * Test if token is a script tag.
                                         *
                                         * @param {Object} tok The token
                                         * @returns {boolean} True if the token is a script tag
                                         */
                                        function isScript(tok) {
                                            return isTag(tok, 'script');
                                        }

                                        /**
                                         * Test if token is a style tag.
                                         *
                                         * @param {Object} tok The token
                                         * @returns {boolean} True if the token is a style tag
                                         */
                                        function isStyle(tok) {
                                            return isTag(tok, 'style');
                                        }

                                        /***/ }
                                    /******/ ])
                            });
                            ;
//# sourceMappingURL=postscribe.js.map
                        }

                    },
                    "core/src/lib/actions/helpers/getSourceByUrl.js": {
                        "script": function(module, exports, require, turbine) {
                            /***************************************************************************************
                             * (c) 2017 Adobe. All rights reserved.
                             * This file is licensed to you under the Apache License, Version 2.0 (the "License");
                             * you may not use this file except in compliance with the License. You may obtain a copy
                             * of the License at http://www.apache.org/licenses/LICENSE-2.0
                             *
                             * Unless required by applicable law or agreed to in writing, software distributed under
                             * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
                             * OF ANY KIND, either express or implied. See the License for the specific language
                             * governing permissions and limitations under the License.
                             ****************************************************************************************/

                            'use strict';
                            var loadScript = require('@adobe/reactor-load-script');
                            var Promise = require('@adobe/reactor-promise');

                            var codeBySourceUrl = {};
                            var scriptStore = {};

                            var loadScriptOnlyOnce = function(url) {
                                if (!scriptStore[url]) {
                                    scriptStore[url] = loadScript(url);
                                }

                                return scriptStore[url];
                            };

                            _satellite.__registerScript = function(sourceUrl, code) {
                                codeBySourceUrl[sourceUrl] = code;
                            };

                            module.exports = function(sourceUrl) {
                                if (codeBySourceUrl[sourceUrl]) {
                                    return Promise.resolve(codeBySourceUrl[sourceUrl]);
                                } else {
                                    return new Promise(function(resolve) {
                                        loadScriptOnlyOnce(sourceUrl).then(function() {
                                            resolve(codeBySourceUrl[sourceUrl]);
                                        }, function() {
                                            resolve();
                                        });
                                    });
                                }
                            };

                        }

                    }
                },
                "hostedLibFilesBaseUrl": "//assets.adobedtm.com/extensions/EP73d0010a5a1e442fbce7d2b017628ddf/"
            }
        },
        "property": {
            "name": "Basic Setup Guide",
            "settings": {
                "domains": [
                    "adobe-marketing-cloud.github.io"
                ],
                "undefinedVarsReturnEmpty": false
            }
        },
        "rules": [
            {
                "id": "RL968e6d67215b4ef5a30462b006568d22",
                "name": "All Pages - Bottom",
                "events": [
                    {
                        "modulePath": "core/src/lib/events/pageBottom.js",
                        "settings": {
                        },
                        "ruleOrder": 50.0
                    }
                ],
                "conditions": [

                ],
                "actions": [
                    {
                        "modulePath": "adobe-analytics/src/lib/actions/setVariables.js",
                        "settings": {
                            "trackerProperties": {
                                "pageName": "%Page Name%"
                            }
                        }
                    },
                    {
                        "modulePath": "adobe-analytics/src/lib/actions/sendBeacon.js",
                        "settings": {
                            "type": "page"
                        }
                    }
                ]
            },
            {
                "id": "RL2789788baa8e4a1ca97274a4a1271d2e",
                "name": "All Pages - Top",
                "events": [
                    {
                        "modulePath": "core/src/lib/events/libraryLoaded.js",
                        "settings": {
                        },
                        "ruleOrder": 50.0
                    }
                ],
                "conditions": [

                ],
                "actions": [
                    {
                        "modulePath": "core/src/lib/actions/customCode.js",
                        "settings": {
                            "source": "//Special Github cookie handling\n//This code is only here because this demo uses shared github hosting. Since github.io is on the Public Suffix list, cookies need to be set explicitly on the subdomain.\n    window.targetGlobalSettings = { \n        cookieDomain: 'adobe-marketing-cloud.github.io' //set the mbox cookie explicitly on adobe-marketing-cloud.github.io since github.io does not allow cookies on the root domain\n    };\n //Special Github cookie handling--> ",
                            "language": "javascript"
                        }
                    },
                    {
                        "modulePath": "adobe-target/lib/loadTarget.js",
                        "settings": {
                        }
                    },
                    {
                        "modulePath": "adobe-target/lib/addMboxParams.js",
                        "settings": {
                            "mboxParams": {
                                "pageName": "%Page Name%"
                            }
                        }
                    },
                    {
                        "modulePath": "adobe-target/lib/fireGlobalMbox.js",
                        "settings": {
                            "globalMboxName": "target-global-mbox",
                            "bodyHiddenStyle": "body {opacity: 0}",
                            "bodyHidingEnabled": true
                        }
                    }
                ]
            }
        ]
    }
})();

var _satellite = (function () {
    'use strict';

    if (!window.atob) { console.warn('Adobe Launch is unsupported in IE 9 and below.'); return; }

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * Log levels.
     * @readonly
     * @enum {string}
     * @private
     */
    var levels = {
        LOG: 'log',
        INFO: 'info',
        WARN: 'warn',
        ERROR: 'error'
    };

    /**
     * Rocket unicode surrogate pair.
     * @type {string}
     */
    var ROCKET = '\uD83D\uDE80';

    /**
     * The user's internet explorer version. If they're not running internet explorer, then it should
     * be NaN.
     * @type {Number}
     */
    var ieVersion = parseInt((/msie (\d+)/.exec(navigator.userAgent.toLowerCase()) || [])[1]);

    /**
     * Prefix to use on all messages. The rocket unicode doesn't work on IE 10.
     * @type {string}
     */
    var launchPrefix = ieVersion === 10 ? '[Launch]' : ROCKET;

    /**
     * Whether logged messages should be output to the console.
     * @type {boolean}
     */
    var outputEnabled = false;

    /**
     * Processes a log message.
     * @param {string} level The level of message to log.
     * @param {...*} arg Any argument to be logged.
     * @private
     */
    var process = function(level) {
        if (outputEnabled && window.console) {
            var logArguments = Array.prototype.slice.call(arguments, 1);
            logArguments.unshift(launchPrefix);
            window.console[level].apply(window.console, logArguments);
        }
    };

    /**
     * Outputs a message to the web console.
     * @param {...*} arg Any argument to be logged.
     */
    var log = process.bind(null, levels.LOG);

    /**
     * Outputs informational message to the web console. In some browsers a small "i" icon is
     * displayed next to these items in the web console's log.
     * @param {...*} arg Any argument to be logged.
     */
    var info = process.bind(null, levels.INFO);

    /**
     * Outputs a warning message to the web console.
     * @param {...*} arg Any argument to be logged.
     */
    var warn = process.bind(null, levels.WARN);

    /**
     * Outputs an error message to the web console.
     * @param {...*} arg Any argument to be logged.
     */
    var error = process.bind(null, levels.ERROR);

    var logger = {
        log: log,
        info: info,
        warn: warn,
        error: error,
        /**
         * Whether logged messages should be output to the console.
         * @type {boolean}
         */
        get outputEnabled() {
            return outputEnabled;
        },
        set outputEnabled(value) {
            outputEnabled = value;
        },
        /**
         * Creates a logging utility that only exposes logging functionality and prefixes all messages
         * with an identifier.
         */
        createPrefixedLogger: function(identifier) {
            var loggerSpecificPrefix = '[' + identifier + ']';

            return {
                log: log.bind(null, loggerSpecificPrefix),
                info: info.bind(null, loggerSpecificPrefix),
                warn: warn.bind(null, loggerSpecificPrefix),
                error: error.bind(null, loggerSpecificPrefix)
            };
        }
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/



    /**
     * Replacing any variable tokens (%myDataElement%, %this.foo%, etc.) with their associated values.
     * A new string, object, or array will be created; the thing being processed will never be
     * modified.
     * @param {*} thing Thing potentially containing variable tokens. Objects and arrays will be
     * deeply processed.
     * @param {HTMLElement} [element] Associated HTML element. Used for special tokens
     * (%this.something%).
     * @param {Object} [event] Associated event. Used for special tokens (%event.something%,
     * %target.something%)
     * @returns {*} A processed value.
     */
    var createReplaceTokens = function(isVar, getVar, undefinedVarsReturnEmpty) {
        var replaceTokensInString;
        var replaceTokensInObject;
        var replaceTokensInArray;
        var replaceTokens;
        var variablesBeingRetrieved = [];

        var getVarValue = function(token, variableName, syntheticEvent) {
            if (!isVar(variableName)) {
                return token;
            }

            variablesBeingRetrieved.push(variableName);
            var val = getVar(variableName, syntheticEvent);
            variablesBeingRetrieved.pop();
            return val == null && undefinedVarsReturnEmpty ? '' : val;
        };

        /**
         * Perform variable substitutions to a string where tokens are specified in the form %foo%.
         * If the only content of the string is a single data element token, then the raw data element
         * value will be returned instead.
         *
         * @param str {string} The string potentially containing data element tokens.
         * @param element {HTMLElement} The element to use for tokens in the form of %this.property%.
         * @param event {Object} The event object to use for tokens in the form of %target.property%.
         * @returns {*}
         */
        replaceTokensInString = function(str, syntheticEvent) {
            // Is the string a single data element token and nothing else?
            var result = /^%([^%]+)%$/.exec(str);

            if (result) {
                return getVarValue(str, result[1], syntheticEvent);
            } else {
                return str.replace(/%(.+?)%/g, function(token, variableName) {
                    return getVarValue(token, variableName, syntheticEvent);
                });
            }
        };

        replaceTokensInObject = function(obj, syntheticEvent) {
            var ret = {};
            var keys = Object.keys(obj);
            for (var i = 0; i < keys.length; i++) {
                var key = keys[i];
                var value = obj[key];
                ret[key] = replaceTokens(value, syntheticEvent);
            }
            return ret;
        };

        replaceTokensInArray = function(arr, syntheticEvent) {
            var ret = [];
            for (var i = 0, len = arr.length; i < len; i++) {
                ret.push(replaceTokens(arr[i], syntheticEvent));
            }
            return ret;
        };

        replaceTokens = function(thing, syntheticEvent) {
            if (typeof thing === 'string') {
                return replaceTokensInString(thing, syntheticEvent);
            } else if (Array.isArray(thing)) {
                return replaceTokensInArray(thing, syntheticEvent);
            } else if (typeof thing === 'object' && thing !== null) {
                return replaceTokensInObject(thing, syntheticEvent);
            }

            return thing;
        };

        return function(thing, syntheticEvent) {
            // It's possible for a data element to reference another data element. Because of this,
            // we need to prevent circular dependencies from causing an infinite loop.
            if (variablesBeingRetrieved.length > 10) {
                logger.error('Data element circular reference detected: ' +
                    variablesBeingRetrieved.join(' -> '));
                return thing;
            }

            return replaceTokens(thing, syntheticEvent);
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    var createSetCustomVar = function(customVars) {
        return function() {
            if (typeof arguments[0] === 'string') {
                customVars[arguments[0]] = arguments[1];
            } else if (arguments[0]) { // assume an object literal
                var mapping = arguments[0];
                for (var key in mapping) {
                    customVars[key] = mapping[key];
                }
            }
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * "Cleans" text by trimming the string and removing spaces and newlines.
     * @param {string} str The string to clean.
     * @returns {string}
     */
    var cleanText = function(str) {
        return typeof str === 'string' ? str.replace(/\s+/g, ' ').trim() : str;
    };

    var commonjsGlobal = typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};





    function createCommonjsModule(fn, module) {
        return module = { exports: {} }, fn(module, module.exports), module.exports;
    }

    var js_cookie = createCommonjsModule(function (module, exports) {
        /*!
 * JavaScript Cookie v2.1.4
 * https://github.com/js-cookie/js-cookie
 *
 * Copyright 2006, 2015 Klaus Hartl & Fagner Brack
 * Released under the MIT license
 */
        (function (factory) {
            var registeredInModuleLoader = false;
            if (typeof undefined === 'function' && undefined.amd) {
                undefined(factory);
                registeredInModuleLoader = true;
            }
            {
                module.exports = factory();
                registeredInModuleLoader = true;
            }
            if (!registeredInModuleLoader) {
                var OldCookies = window.Cookies;
                var api = window.Cookies = factory();
                api.noConflict = function () {
                    window.Cookies = OldCookies;
                    return api;
                };
            }
        }(function () {
            function extend () {
                var i = 0;
                var result = {};
                for (; i < arguments.length; i++) {
                    var attributes = arguments[ i ];
                    for (var key in attributes) {
                        result[key] = attributes[key];
                    }
                }
                return result;
            }

            function init (converter) {
                function api (key, value, attributes) {
                    var result;
                    if (typeof document === 'undefined') {
                        return;
                    }

                    // Write

                    if (arguments.length > 1) {
                        attributes = extend({
                            path: '/'
                        }, api.defaults, attributes);

                        if (typeof attributes.expires === 'number') {
                            var expires = new Date();
                            expires.setMilliseconds(expires.getMilliseconds() + attributes.expires * 864e+5);
                            attributes.expires = expires;
                        }

                        // We're using "expires" because "max-age" is not supported by IE
                        attributes.expires = attributes.expires ? attributes.expires.toUTCString() : '';

                        try {
                            result = JSON.stringify(value);
                            if (/^[\{\[]/.test(result)) {
                                value = result;
                            }
                        } catch (e) {}

                        if (!converter.write) {
                            value = encodeURIComponent(String(value))
                                .replace(/%(23|24|26|2B|3A|3C|3E|3D|2F|3F|40|5B|5D|5E|60|7B|7D|7C)/g, decodeURIComponent);
                        } else {
                            value = converter.write(value, key);
                        }

                        key = encodeURIComponent(String(key));
                        key = key.replace(/%(23|24|26|2B|5E|60|7C)/g, decodeURIComponent);
                        key = key.replace(/[\(\)]/g, escape);

                        var stringifiedAttributes = '';

                        for (var attributeName in attributes) {
                            if (!attributes[attributeName]) {
                                continue;
                            }
                            stringifiedAttributes += '; ' + attributeName;
                            if (attributes[attributeName] === true) {
                                continue;
                            }
                            stringifiedAttributes += '=' + attributes[attributeName];
                        }
                        return (document.cookie = key + '=' + value + stringifiedAttributes);
                    }

                    // Read

                    if (!key) {
                        result = {};
                    }

                    // To prevent the for loop in the first place assign an empty array
                    // in case there are no cookies at all. Also prevents odd result when
                    // calling "get()"
                    var cookies = document.cookie ? document.cookie.split('; ') : [];
                    var rdecode = /(%[0-9A-Z]{2})+/g;
                    var i = 0;

                    for (; i < cookies.length; i++) {
                        var parts = cookies[i].split('=');
                        var cookie = parts.slice(1).join('=');

                        if (cookie.charAt(0) === '"') {
                            cookie = cookie.slice(1, -1);
                        }

                        try {
                            var name = parts[0].replace(rdecode, decodeURIComponent);
                            cookie = converter.read ?
                                converter.read(cookie, name) : converter(cookie, name) ||
                                cookie.replace(rdecode, decodeURIComponent);

                            if (this.json) {
                                try {
                                    cookie = JSON.parse(cookie);
                                } catch (e) {}
                            }

                            if (key === name) {
                                result = cookie;
                                break;
                            }

                            if (!key) {
                                result[name] = cookie;
                            }
                        } catch (e) {}
                    }

                    return result;
                }

                api.set = api;
                api.get = function (key) {
                    return api.call(api, key);
                };
                api.getJSON = function () {
                    return api.apply({
                        json: true
                    }, [].slice.call(arguments));
                };
                api.defaults = {};

                api.remove = function (key, attributes) {
                    api(key, '', extend(attributes, {
                        expires: -1
                    }));
                };

                api.withConverter = init;

                return api;
            }

            return init(function () {});
        }));
    });

    'use strict';



// js-cookie has other methods that we haven't exposed here. By limiting the exposed API,
// we have a little more flexibility to change the underlying implementation later. If clear
// use cases come up for needing the other methods js-cookie exposes, we can re-evaluate whether
// we want to expose them here.
    var reactorCookie = {
        get: js_cookie.get,
        set: js_cookie.set,
        remove: js_cookie.remove
    };

    'use strict';

    var reactorWindow = window;

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/


    var NAMESPACE = 'com.adobe.reactor.';

    var getNamespacedStorage = function(storageType, additionalNamespace) {
        var finalNamespace = NAMESPACE + (additionalNamespace || '');

        // When storage is disabled on Safari, the mere act of referencing window.localStorage
        // or window.sessionStorage throws an error. For this reason, we wrap in a try-catch.
        return {
            /**
             * Reads a value from storage.
             * @param {string} name The name of the item to be read.
             * @returns {string}
             */
            getItem: function(name) {
                try {
                    return reactorWindow[storageType].getItem(finalNamespace + name);
                } catch (e) {
                    return null;
                }
            },
            /**
             * Saves a value to storage.
             * @param {string} name The name of the item to be saved.
             * @param {string} value The value of the item to be saved.
             * @returns {boolean} Whether the item was successfully saved to storage.
             */
            setItem: function(name, value) {
                try {
                    reactorWindow[storageType].setItem(finalNamespace + name, value);
                    return true;
                } catch (e) {
                    return false;
                }
            }
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/




    var COOKIE_PREFIX = '_sdsat_';

    var DATA_ELEMENTS_NAMESPACE = 'dataElements.';
    var MIGRATED_KEY = 'dataElementCookiesMigrated';

    var reactorLocalStorage = getNamespacedStorage('localStorage');
    var dataElementSessionStorage = getNamespacedStorage('sessionStorage', DATA_ELEMENTS_NAMESPACE);
    var dataElementLocalStorage = getNamespacedStorage('localStorage', DATA_ELEMENTS_NAMESPACE);

    var storageDurations = {
        PAGEVIEW: 'pageview',
        SESSION: 'session',
        VISITOR: 'visitor'
    };

    var pageviewCache = {};

    var serialize = function(value) {
        var serialized;

        try {
            // On some browsers, with some objects, errors will be thrown during serialization. For example,
            // in Chrome with the window object, it will throw "TypeError: Converting circular structure
            // to JSON"
            serialized = JSON.stringify(value);
        } catch (e) {}

        return serialized;
    };

    var setValue = function(key, storageDuration, value) {
        var serializedValue;

        switch (storageDuration) {
            case storageDurations.PAGEVIEW:
                pageviewCache[key] = value;
                return;
            case storageDurations.SESSION:
                serializedValue = serialize(value);
                if (serializedValue) {
                    dataElementSessionStorage.setItem(key, serializedValue);
                }
                return;
            case storageDurations.VISITOR:
                serializedValue = serialize(value);
                if (serializedValue) {
                    dataElementLocalStorage.setItem(key, serializedValue);
                }
                return;
        }
    };

    var getValue = function(key, storageDuration) {
        var value;

        // It should consistently return the same value if no stored item was found. We chose null,
        // though undefined could be a reasonable value as well.
        switch (storageDuration) {
            case storageDurations.PAGEVIEW:
                return pageviewCache.hasOwnProperty(key) ? pageviewCache[key] : null;
            case storageDurations.SESSION:
                value = dataElementSessionStorage.getItem(key);
                return value === null ? value : JSON.parse(value);
            case storageDurations.VISITOR:
                value = dataElementLocalStorage.getItem(key);
                return value === null ? value : JSON.parse(value);
        }
    };

// Remove when migration period has ended. We intentionally leave cookies as they are so that if
// DTM is running on the same domain it can still use the persisted values. Our migration strategy
// is essentially copying data from cookies and then diverging the storage mechanism between
// DTM and Launch (DTM uses cookies and Launch uses session and local storage).
    var migrateDataElement = function(dataElementName, storageDuration) {
        var storedValue = reactorCookie.get(COOKIE_PREFIX + dataElementName);

        if (storedValue !== undefined) {
            setValue(dataElementName, storageDuration, storedValue);
        }
    };

    var migrateCookieData = function(dataElements) {
        if (!reactorLocalStorage.getItem(MIGRATED_KEY)) {
            Object.keys(dataElements).forEach(function(dataElementName) {
                migrateDataElement(dataElementName, dataElements[dataElementName].storageDuration);
            });

            reactorLocalStorage.setItem(MIGRATED_KEY, true);
        }
    };

    var dataElementSafe = {
        setValue: setValue,
        getValue: getValue,
        migrateCookieData: migrateCookieData
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/





    var getErrorMessage = function(dataDef, dataElementName, errorMessage, errorStack) {
        return 'Failed to execute data element module ' + dataDef.modulePath + ' for data element ' +
            dataElementName + '. ' + errorMessage + (errorStack ? '\n' + errorStack : '');
    };

    var isDataElementValuePresent = function(value) {
        return value !== undefined && value !== null;
    };

    var createGetDataElementValue = function(
        moduleProvider,
        getDataElementDefinition,
        replaceTokens,
        undefinedVarsReturnEmpty
    ) {
        return function(name) {
            var dataDef = getDataElementDefinition(name);

            if (!dataDef) {
                return undefinedVarsReturnEmpty ? '' : null;
            }

            var storageDuration = dataDef.storageDuration;
            var moduleExports;

            try {
                moduleExports = moduleProvider.getModuleExports(dataDef.modulePath);
            } catch (e) {
                logger.error(getErrorMessage(dataDef, name, e.message, e.stack));
                return;
            }

            if (typeof moduleExports !== 'function') {
                logger.error(getErrorMessage(dataDef, name, 'Module did not export a function.'));
                return;
            }

            var value;

            try {
                value = moduleExports(replaceTokens(dataDef.settings));
            } catch (e) {
                logger.error(getErrorMessage(dataDef, name, e.message, e.stack));
                return;
            }

            if (storageDuration) {
                if (isDataElementValuePresent(value)) {
                    dataElementSafe.setValue(name, storageDuration, value);
                } else {
                    value = dataElementSafe.getValue(name, storageDuration);
                }
            }

            if (!isDataElementValuePresent(value)) {
                value = dataDef.defaultValue || '';
            }

            if (typeof value === 'string') {
                if (dataDef.cleanText) {
                    value = cleanText(value);
                }

                if (dataDef.forceLowerCase) {
                    value = value.toLowerCase();
                }
            }

            return value;
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    var extractModuleExports = function(script, require, turbine) {
        var module = {
            exports: {}
        };

        script.call(module.exports, module, module.exports, require, turbine);

        return module.exports;
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/




    var createModuleProvider = function() {
        var moduleByReferencePath = {};

        var getModule = function(referencePath) {
            var module = moduleByReferencePath[referencePath];

            if (!module) {
                throw new Error('Module ' + referencePath + ' not found.');
            }

            return module;
        };

        var registerModule = function(referencePath, moduleDefinition, extensionName, require, turbine) {
            var module = {
                definition: moduleDefinition,
                extensionName: extensionName,
                require: require,
                turbine: turbine
            };
            module.require = require;
            moduleByReferencePath[referencePath] = module;
        };

        var hydrateCache = function() {
            Object.keys(moduleByReferencePath).forEach(function(referencePath) {
                try {
                    getModuleExports(referencePath);
                } catch (e) {
                    var errorMessage = 'Error initializing module ' + referencePath + '. ' +
                        e.message + (e.stack ? '\n' + e.stack : '');
                    logger.error(errorMessage);
                }
            });
        };

        var getModuleExports = function(referencePath) {
            var module = getModule(referencePath);

            // Using hasOwnProperty instead of a falsey check because the module could export undefined
            // in which case we don't want to execute the module each time the exports is requested.
            if (!module.hasOwnProperty('exports')) {
                module.exports = extractModuleExports(module.definition.script, module.require,
                    module.turbine);
            }

            return module.exports;
        };

        var getModuleDefinition = function(referencePath) {
            return getModule(referencePath).definition;
        };

        var getModuleExtensionName = function(referencePath) {
            return getModule(referencePath).extensionName;
        };

        return {
            registerModule: registerModule,
            hydrateCache: hydrateCache,
            getModuleExports: getModuleExports,
            getModuleDefinition: getModuleDefinition,
            getModuleExtensionName: getModuleExtensionName
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * Determines if the provided name is a valid variable, where the variable
     * can be a data element, element, event, target, or custom var.
     * @param variableName
     * @returns {boolean}
     */
    var createIsVar = function(customVars, getDataElementDefinition) {
        return function(variableName) {
            var nameBeforeDot = variableName.split('.')[0];

            return Boolean(
                getDataElementDefinition(variableName) ||
                nameBeforeDot === 'this' ||
                nameBeforeDot === 'event' ||
                nameBeforeDot === 'target' ||
                customVars.hasOwnProperty(nameBeforeDot)
            );
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/



    var specialPropertyAccessors = {
        text: function(obj) {
            return obj.textContent;
        },
        cleanText: function(obj) {
            return cleanText(obj.textContent);
        }
    };

    /**
     * This returns the value of a property at a given path. For example, a <code>path<code> of
     * <code>foo.bar</code> will return the value of <code>obj.foo.bar</code>.
     *
     * In addition, if <code>path</code> is <code>foo.bar.getAttribute(unicorn)</code> and
     * <code>obj.foo.bar</code> has a method named <code>getAttribute</code>, the method will be
     * called with a value of <code>"unicorn"</code> and the value will be returned.
     *
     * Also, if <code>path</code> is <code>foo.bar.@text</code> or other supported properties
     * beginning with <code>@</code>, a special accessor will be used.
     *
     * @param host
     * @param path
     * @param supportSpecial
     * @returns {*}
     */
    var getObjectProperty = function(host, propChain, supportSpecial) {
        var value = host;
        var attrMatch;
        for (var i = 0, len = propChain.length; i < len; i++) {
            if (value == null) {
                return undefined;
            }
            var prop = propChain[i];
            if (supportSpecial && prop.charAt(0) === '@') {
                var specialProp = prop.slice(1);
                value = specialPropertyAccessors[specialProp](value);
                continue;
            }
            if (value.getAttribute &&
                (attrMatch = prop.match(/^getAttribute\((.+)\)$/))) {
                var attr = attrMatch[1];
                value = value.getAttribute(attr);
                continue;
            }
            value = value[prop];
        }
        return value;
    };

    /**
     * Returns the value of a variable.
     * @param {string} variable
     * @param {Object} [syntheticEvent] A synthetic event. Only required when using %event... %this...
     * or %target...
     * @returns {*}
     */
    var createGetVar = function(customVars, getDataElementDefinition, getDataElementValue) {
        return function(variable, syntheticEvent) {
            var value;

            if (getDataElementDefinition(variable)) {
                // Accessing nested properties of a data element using dot-notation is unsupported because
                // users can currently create data elements with periods in the name.
                value = getDataElementValue(variable);
            } else {
                var propChain = variable.split('.');
                var variableHostName = propChain.shift();

                if (variableHostName === 'this') {
                    if (syntheticEvent) {
                        // I don't know why this is the only one that supports special properties, but that's the
                        // way it was in Satellite.
                        value = getObjectProperty(syntheticEvent.element, propChain, true);
                    }
                } else if (variableHostName === 'event') {
                    if (syntheticEvent) {
                        value = getObjectProperty(syntheticEvent, propChain);
                    }
                } else if (variableHostName === 'target') {
                    if (syntheticEvent) {
                        value = getObjectProperty(syntheticEvent.target, propChain);
                    }
                } else {
                    value = getObjectProperty(customVars[variableHostName], propChain);
                }
            }

            return value;
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * Creates a function that, when called with an extension name and module name, will return the
     * exports of the respective shared module.
     *
     * @param {Object} extensions
     * @param {Object} moduleProvider
     * @returns {Function}
     */
    var createGetSharedModuleExports = function(extensions, moduleProvider) {
        return function(extensionName, moduleName) {
            var extension = extensions[extensionName];

            if (extension) {
                var modules = extension.modules;
                if (modules) {
                    var referencePaths = Object.keys(modules);
                    for (var i = 0; i < referencePaths.length; i++) {
                        var referencePath = referencePaths[i];
                        var module = modules[referencePath];
                        if (module.shared && module.name === moduleName) {
                            return moduleProvider.getModuleExports(referencePath);
                        }
                    }
                }
            }
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * Creates a function that, when called, will return a configuration object with data element
     * tokens replaced.
     *
     * @param {Object} settings
     * @returns {Function}
     */
    var createGetExtensionSettings = function(replaceTokens, settings) {
        return function() {
            return settings ? replaceTokens(settings) : {};
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * Creates a function that, when called, will return the full hosted lib file URL.
     *
     * @param {string} hostedLibFilesBaseUrl
     * @returns {Function}
     */

    var createGetHostedLibFileUrl = function(hostedLibFilesBaseUrl, minified) {
        return function(file) {
            if (minified) {
                var fileParts = file.split('.');
                fileParts.splice(fileParts.length - 1 || 1, 0, 'min');
                file = fileParts.join('.');
            }

            return hostedLibFilesBaseUrl + file;
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    var JS_EXTENSION = '.js';

    /**
     * @private
     * Returns the directory of a path. A limited version of path.dirname in nodejs.
     *
     * To keep it simple, it makes the following assumptions:
     * path has a least one slash
     * path does not end with a slash
     * path does not have empty segments (e.g., /src/lib//foo.bar)
     *
     * @param {string} path
     * @returns {string}
     */
    var dirname = function(path) {
        return path.substr(0, path.lastIndexOf('/'));
    };

    /**
     * Determines if a string ends with a certain string.
     * @param {string} str The string to test.
     * @param {string} suffix The suffix to look for at the end of str.
     * @returns {boolean} Whether str ends in suffix.
     */
    var endsWith = function(str, suffix) {
        return str.indexOf(suffix, str.length - suffix.length) !== -1;
    };

    /**
     * Given a starting path and a path relative to the starting path, returns the final path. A
     * limited version of path.resolve in nodejs.
     *
     * To keep it simple, it makes the following assumptions:
     * fromPath has at least one slash
     * fromPath does not end with a slash.
     * fromPath does not have empty segments (e.g., /src/lib//foo.bar)
     * relativePath starts with ./ or ../
     *
     * @param {string} fromPath
     * @param {string} relativePath
     * @returns {string}
     */
    var resolveRelativePath = function(fromPath, relativePath) {
        // Handle the case where the relative path does not end in the .js extension. We auto-append it.
        if (!endsWith(relativePath, JS_EXTENSION)) {
            relativePath = relativePath + JS_EXTENSION;
        }

        var relativePathSegments = relativePath.split('/');
        var resolvedPathSegments = dirname(fromPath).split('/');

        relativePathSegments.forEach(function(relativePathSegment) {
            if (!relativePathSegment || relativePathSegment === '.') {
                return;
            } else if (relativePathSegment === '..') {
                if (resolvedPathSegments.length) {
                    resolvedPathSegments.pop();
                }
            } else {
                resolvedPathSegments.push(relativePathSegment);
            }
        });

        return resolvedPathSegments.join('/');
    };

    'use strict';

    var reactorDocument = document;

    var promise = createCommonjsModule(function (module) {
        (function (root) {

            // Store setTimeout reference so promise-polyfill will be unaffected by
            // other code modifying setTimeout (like sinon.useFakeTimers())
            var setTimeoutFunc = setTimeout;

            function noop() {}

            // Polyfill for Function.prototype.bind
            function bind(fn, thisArg) {
                return function () {
                    fn.apply(thisArg, arguments);
                };
            }

            function Promise(fn) {
                if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
                if (typeof fn !== 'function') throw new TypeError('not a function');
                this._state = 0;
                this._handled = false;
                this._value = undefined;
                this._deferreds = [];

                doResolve(fn, this);
            }

            function handle(self, deferred) {
                while (self._state === 3) {
                    self = self._value;
                }
                if (self._state === 0) {
                    self._deferreds.push(deferred);
                    return;
                }
                self._handled = true;
                Promise._immediateFn(function () {
                    var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
                    if (cb === null) {
                        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
                        return;
                    }
                    var ret;
                    try {
                        ret = cb(self._value);
                    } catch (e) {
                        reject(deferred.promise, e);
                        return;
                    }
                    resolve(deferred.promise, ret);
                });
            }

            function resolve(self, newValue) {
                try {
                    // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
                    if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
                    if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
                        var then = newValue.then;
                        if (newValue instanceof Promise) {
                            self._state = 3;
                            self._value = newValue;
                            finale(self);
                            return;
                        } else if (typeof then === 'function') {
                            doResolve(bind(then, newValue), self);
                            return;
                        }
                    }
                    self._state = 1;
                    self._value = newValue;
                    finale(self);
                } catch (e) {
                    reject(self, e);
                }
            }

            function reject(self, newValue) {
                self._state = 2;
                self._value = newValue;
                finale(self);
            }

            function finale(self) {
                if (self._state === 2 && self._deferreds.length === 0) {
                    Promise._immediateFn(function() {
                        if (!self._handled) {
                            Promise._unhandledRejectionFn(self._value);
                        }
                    });
                }

                for (var i = 0, len = self._deferreds.length; i < len; i++) {
                    handle(self, self._deferreds[i]);
                }
                self._deferreds = null;
            }

            function Handler(onFulfilled, onRejected, promise) {
                this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
                this.onRejected = typeof onRejected === 'function' ? onRejected : null;
                this.promise = promise;
            }

            /**
             * Take a potentially misbehaving resolver function and make sure
             * onFulfilled and onRejected are only called once.
             *
             * Makes no guarantees about asynchrony.
             */
            function doResolve(fn, self) {
                var done = false;
                try {
                    fn(function (value) {
                        if (done) return;
                        done = true;
                        resolve(self, value);
                    }, function (reason) {
                        if (done) return;
                        done = true;
                        reject(self, reason);
                    });
                } catch (ex) {
                    if (done) return;
                    done = true;
                    reject(self, ex);
                }
            }

            Promise.prototype['catch'] = function (onRejected) {
                return this.then(null, onRejected);
            };

            Promise.prototype.then = function (onFulfilled, onRejected) {
                var prom = new (this.constructor)(noop);

                handle(this, new Handler(onFulfilled, onRejected, prom));
                return prom;
            };

            Promise.all = function (arr) {
                var args = Array.prototype.slice.call(arr);

                return new Promise(function (resolve, reject) {
                    if (args.length === 0) return resolve([]);
                    var remaining = args.length;

                    function res(i, val) {
                        try {
                            if (val && (typeof val === 'object' || typeof val === 'function')) {
                                var then = val.then;
                                if (typeof then === 'function') {
                                    then.call(val, function (val) {
                                        res(i, val);
                                    }, reject);
                                    return;
                                }
                            }
                            args[i] = val;
                            if (--remaining === 0) {
                                resolve(args);
                            }
                        } catch (ex) {
                            reject(ex);
                        }
                    }

                    for (var i = 0; i < args.length; i++) {
                        res(i, args[i]);
                    }
                });
            };

            Promise.resolve = function (value) {
                if (value && typeof value === 'object' && value.constructor === Promise) {
                    return value;
                }

                return new Promise(function (resolve) {
                    resolve(value);
                });
            };

            Promise.reject = function (value) {
                return new Promise(function (resolve, reject) {
                    reject(value);
                });
            };

            Promise.race = function (values) {
                return new Promise(function (resolve, reject) {
                    for (var i = 0, len = values.length; i < len; i++) {
                        values[i].then(resolve, reject);
                    }
                });
            };

            // Use polyfill for setImmediate for performance gains
            Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
                function (fn) {
                    setTimeoutFunc(fn, 0);
                };

            Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
                if (typeof console !== 'undefined' && console) {
                    console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
                }
            };

            /**
             * Set the immediate function to execute callbacks
             * @param fn {function} Function to execute
             * @deprecated
             */
            Promise._setImmediateFn = function _setImmediateFn(fn) {
                Promise._immediateFn = fn;
            };

            /**
             * Change the function to execute on unhandled rejection
             * @param {function} fn Function to execute on unhandled rejection
             * @deprecated
             */
            Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
                Promise._unhandledRejectionFn = fn;
            };

            if ('object' !== 'undefined' && module.exports) {
                module.exports = Promise;
            } else if (!root.Promise) {
                root.Promise = Promise;
            }

        })(commonjsGlobal);
    });

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/
    'use strict';

    var reactorPromise = window.Promise || promise;

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/
    'use strict';



    var getPromise = function(url, script) {
        return new reactorPromise(function(resolve, reject) {
            if ('onload' in script) {
                script.onload = function() {
                    resolve(script);
                };

                script.onerror = function() {
                    reject(new Error('Failed to load script ' + url));
                };
            } else if ('readyState' in script) {
                script.onreadystatechange = function() {
                    var rs = script.readyState;
                    if (rs === 'loaded' || rs === 'complete') {
                        script.onreadystatechange = null;
                        resolve(script);
                    }
                };
            }
        });
    };

    var reactorLoadScript = function(url) {
        var script = document.createElement('script');
        script.src = url;
        script.async = true;

        var promise = getPromise(url, script);

        document.getElementsByTagName('head')[0].appendChild(script);
        return promise;
    };

    /*
object-assign
(c) Sindre Sorhus
@license MIT
*/

    'use strict';
    /* eslint-disable no-unused-vars */
    var getOwnPropertySymbols = Object.getOwnPropertySymbols;
    var hasOwnProperty = Object.prototype.hasOwnProperty;
    var propIsEnumerable = Object.prototype.propertyIsEnumerable;

    function toObject(val) {
        if (val === null || val === undefined) {
            throw new TypeError('Object.assign cannot be called with null or undefined');
        }

        return Object(val);
    }

    function shouldUseNative() {
        try {
            if (!Object.assign) {
                return false;
            }

            // Detect buggy property enumeration order in older V8 versions.

            // https://bugs.chromium.org/p/v8/issues/detail?id=4118
            var test1 = new String('abc');  // eslint-disable-line no-new-wrappers
            test1[5] = 'de';
            if (Object.getOwnPropertyNames(test1)[0] === '5') {
                return false;
            }

            // https://bugs.chromium.org/p/v8/issues/detail?id=3056
            var test2 = {};
            for (var i = 0; i < 10; i++) {
                test2['_' + String.fromCharCode(i)] = i;
            }
            var order2 = Object.getOwnPropertyNames(test2).map(function (n) {
                return test2[n];
            });
            if (order2.join('') !== '0123456789') {
                return false;
            }

            // https://bugs.chromium.org/p/v8/issues/detail?id=3056
            var test3 = {};
            'abcdefghijklmnopqrst'.split('').forEach(function (letter) {
                test3[letter] = letter;
            });
            if (Object.keys(Object.assign({}, test3)).join('') !==
                'abcdefghijklmnopqrst') {
                return false;
            }

            return true;
        } catch (err) {
            // We don't expect any of the above to throw, but better to be safe.
            return false;
        }
    }

    var objectAssign = shouldUseNative() ? Object.assign : function (target, source) {
        var from;
        var to = toObject(target);
        var symbols;

        for (var s = 1; s < arguments.length; s++) {
            from = Object(arguments[s]);

            for (var key in from) {
                if (hasOwnProperty.call(from, key)) {
                    to[key] = from[key];
                }
            }

            if (getOwnPropertySymbols) {
                symbols = getOwnPropertySymbols(from);
                for (var i = 0; i < symbols.length; i++) {
                    if (propIsEnumerable.call(from, symbols[i])) {
                        to[symbols[i]] = from[symbols[i]];
                    }
                }
            }
        }

        return to;
    };

    'use strict';

    var reactorObjectAssign = objectAssign;

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

    'use strict';

// If obj.hasOwnProperty has been overridden, then calling
// obj.hasOwnProperty(prop) will break.
// See: https://github.com/joyent/node/issues/1707
    function hasOwnProperty$1(obj, prop) {
        return Object.prototype.hasOwnProperty.call(obj, prop);
    }

    var decode = function(qs, sep, eq, options) {
        sep = sep || '&';
        eq = eq || '=';
        var obj = {};

        if (typeof qs !== 'string' || qs.length === 0) {
            return obj;
        }

        var regexp = /\+/g;
        qs = qs.split(sep);

        var maxKeys = 1000;
        if (options && typeof options.maxKeys === 'number') {
            maxKeys = options.maxKeys;
        }

        var len = qs.length;
        // maxKeys <= 0 means that we should not limit keys count
        if (maxKeys > 0 && len > maxKeys) {
            len = maxKeys;
        }

        for (var i = 0; i < len; ++i) {
            var x = qs[i].replace(regexp, '%20'),
                idx = x.indexOf(eq),
                kstr, vstr, k, v;

            if (idx >= 0) {
                kstr = x.substr(0, idx);
                vstr = x.substr(idx + 1);
            } else {
                kstr = x;
                vstr = '';
            }

            k = decodeURIComponent(kstr);
            v = decodeURIComponent(vstr);

            if (!hasOwnProperty$1(obj, k)) {
                obj[k] = v;
            } else if (Array.isArray(obj[k])) {
                obj[k].push(v);
            } else {
                obj[k] = [obj[k], v];
            }
        }

        return obj;
    };

// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

    'use strict';

    var stringifyPrimitive = function(v) {
        switch (typeof v) {
            case 'string':
                return v;

            case 'boolean':
                return v ? 'true' : 'false';

            case 'number':
                return isFinite(v) ? v : '';

            default:
                return '';
        }
    };

    var encode = function(obj, sep, eq, name) {
        sep = sep || '&';
        eq = eq || '=';
        if (obj === null) {
            obj = undefined;
        }

        if (typeof obj === 'object') {
            return Object.keys(obj).map(function(k) {
                var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
                if (Array.isArray(obj[k])) {
                    return obj[k].map(function(v) {
                        return ks + encodeURIComponent(stringifyPrimitive(v));
                    }).join(sep);
                } else {
                    return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
                }
            }).join(sep);

        }

        if (!name) return '';
        return encodeURIComponent(stringifyPrimitive(name)) + eq +
            encodeURIComponent(stringifyPrimitive(obj));
    };

    var querystring = createCommonjsModule(function (module, exports) {
        'use strict';

        exports.decode = exports.parse = decode;
        exports.encode = exports.stringify = encode;
    });

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/
    'use strict';



// We proxy the underlying querystring module so we can limit the API we expose.
// This allows us to more easily make changes to the underlying implementation later without
// having to worry about breaking extensions. If extensions demand additional functionality, we
// can make adjustments as needed.
    var reactorQueryString = {
        parse: function(string) {
            //
            if (typeof string === 'string') {
                // Remove leading ?, #, & for some leniency so you can pass in location.search or
                // location.hash directly.
                string = string.trim().replace(/^[?#&]/, '');
            }
            return querystring.parse(string);
        },
        stringify: function(object) {
            return querystring.stringify(object);
        }
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    var CORE_MODULE_PREFIX = '@adobe/reactor-';

    var modules = {
        'cookie': reactorCookie,
        'document': reactorDocument,
        'load-script': reactorLoadScript,
        'object-assign': reactorObjectAssign,
        'promise': reactorPromise,
        'query-string': reactorQueryString,
        'window': reactorWindow
    };

    /**
     * Creates a function which can be passed as a "require" function to extension modules.
     *
     * @param {Function} getModuleExportsByRelativePath
     * @returns {Function}
     */
    var createPublicRequire = function(getModuleExportsByRelativePath) {
        return function(key) {
            if (key.indexOf(CORE_MODULE_PREFIX) === 0) {
                var keyWithoutScope = key.substr(CORE_MODULE_PREFIX.length);
                var module = modules[keyWithoutScope];

                if (module) {
                    return module;
                }
            }

            if (key.indexOf('./') === 0 || key.indexOf('../') === 0) {
                return getModuleExportsByRelativePath(key);
            }

            throw new Error('Cannot resolve module "' + key + '".');
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/








    var hydrateModuleProvider = function(container, moduleProvider, replaceTokens, getDataElementValue) {
        var extensions = container.extensions;
        var buildInfo = container.buildInfo;
        var propertySettings = container.property.settings;

        if (extensions) {
            var getSharedModuleExports = createGetSharedModuleExports(extensions, moduleProvider);

            Object.keys(extensions).forEach(function(extensionName) {
                var extension = extensions[extensionName];
                var getExtensionSettings = createGetExtensionSettings(replaceTokens, extension.settings);

                if (extension.modules) {
                    var prefixedLogger = logger.createPrefixedLogger(extension.displayName);
                    var getHostedLibFileUrl = createGetHostedLibFileUrl(
                        extension.hostedLibFilesBaseUrl,
                        buildInfo.minified
                    );
                    var turbine = {
                        buildInfo: buildInfo,
                        getDataElementValue: getDataElementValue,
                        getExtensionSettings: getExtensionSettings,
                        getHostedLibFileUrl: getHostedLibFileUrl,
                        getSharedModule: getSharedModuleExports,
                        logger: prefixedLogger,
                        propertySettings: propertySettings,
                        replaceTokens: replaceTokens
                    };

                    Object.keys(extension.modules).forEach(function(referencePath) {
                        var module = extension.modules[referencePath];
                        var getModuleExportsByRelativePath = function(relativePath) {
                            var resolvedReferencePath = resolveRelativePath(referencePath, relativePath);
                            return moduleProvider.getModuleExports(resolvedReferencePath);
                        };
                        var publicRequire = createPublicRequire(getModuleExportsByRelativePath);

                        moduleProvider.registerModule(
                            referencePath,
                            module,
                            extensionName,
                            publicRequire,
                            turbine
                        );
                    });
                }
            });

            // We want to extract the module exports immediately to allow the modules
            // to run some logic immediately.
            // We need to do the extraction here in order for the moduleProvider to
            // have all the modules previously registered. (eg. when moduleA needs moduleB, both modules
            // must exist inside moduleProvider).
            moduleProvider.hydrateCache();
        }
        return moduleProvider;
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/




    var hydrateSatelliteObject = function(_satellite, container, setDebugOutputEnabled, getVar, setCustomVar) {
        var prefixedLogger = logger.createPrefixedLogger('Custom Script');

        // Will get replaced by the directCall event delegate from the Core extension. Exists here in
        // case there are no direct call rules (and therefore the directCall event delegate won't get
        // included) and our customers are still calling the method. In this case, we don't want an error
        // to be thrown. This method existed before Reactor.
        _satellite.track = function() {};

        // Will get replaced by the Marketing Cloud ID extension if installed. Exists here in case
        // the extension is not installed and our customers are still calling the method. In this case,
        // we don't want an error to be thrown. This method existed before Reactor.
        _satellite.getVisitorId = function() { return null; };

        // container.property also has property settings, but it shouldn't concern the user.
        // By limiting our API exposure to necessities, we provide more flexibility in the future.
        _satellite.property = {
            name: container.property.name
        };

        _satellite.buildInfo = container.buildInfo;

        _satellite.logger = prefixedLogger;

        /**
         * Log a message. We keep this due to legacy baggage.
         * @param {string} message The message to log.
         * @param {number} [level] A number that represents the level of logging.
         * 3=info, 4=warn, 5=error, anything else=log
         */
        _satellite.notify = function(message, level) {
            logger.warn('_satellite.notify is deprecated. Please use the `_satellite.logger` API.');

            switch (level) {
                case 3:
                    prefixedLogger.info(message);
                    break;
                case 4:
                    prefixedLogger.warn(message);
                    break;
                case 5:
                    prefixedLogger.error(message);
                    break;
                default:
                    prefixedLogger.log(message);
            }
        };

        _satellite.getVar = getVar;
        _satellite.setVar = setCustomVar;

        /**
         * Writes a cookie.
         * @param {string} name The name of the cookie to save.
         * @param {string} value The value of the cookie to save.
         * @param {number} [days] The number of days to store the cookie. If not specified, the cookie
         * will be stored for the session only.
         */
        _satellite.setCookie = function(name, value, days) {
            var optionsStr = '';
            var options = {};

            if (days) {
                optionsStr = ', { expires: ' + days + ' }';
                options.expires = days;
            }

            var msg = '_satellite.setCookie is deprecated. Please use ' +
                '_satellite.cookie.set("' + name + '", "' + value + '"' + optionsStr + ').';

            logger.warn(msg);
            reactorCookie.set(name, value, options);
        };

        /**
         * Reads a cookie value.
         * @param {string} name The name of the cookie to read.
         * @returns {string}
         */
        _satellite.readCookie = function(name) {
            logger.warn('_satellite.readCookie is deprecated. ' +
                'Please use _satellite.cookie.get("' + name + '").');
            return reactorCookie.get(name);
        };

        /**
         * Removes a cookie value.
         * @param name
         */
        _satellite.removeCookie = function(name) {
            logger.warn('_satellite.removeCookie is deprecated. ' +
                'Please use _satellite.cookie.remove("' + name + '").');
            reactorCookie.remove(name);
        };

        _satellite.cookie = reactorCookie;

        // Will get replaced by the pageBottom event delegate from the Core extension. Exists here in
        // case the customers are not using core (and therefore the pageBottom event delegate won't get
        // included) and they are still calling the method. In this case, we don't want an error
        // to be thrown. This method existed before Reactor.
        _satellite.pageBottom = function() {};

        _satellite.setDebug = setDebugOutputEnabled;

        var warningLogged = false;

        Object.defineProperty(_satellite, '_container', {
            get: function() {
                if (!warningLogged) {
                    logger.warn('_satellite._container may change at any time and should only ' +
                        'be used for debugging.');
                    warningLogged = true;
                }

                return container;
            }
        });
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/




    /**
     * Normalizes a synthetic event so that it exists and has at least meta.
     * @param {Object} syntheticEventMeta
     * @param {Object} [syntheticEvent]
     * @returns {Object}
     */
    var normalizeSyntheticEvent = function(syntheticEventMeta, syntheticEvent) {
        syntheticEvent = syntheticEvent || {};
        reactorObjectAssign(syntheticEvent, syntheticEventMeta);

        // Remove after some arbitrary time period when we think users have had sufficient chance
        // to move away from event.type
        if (!syntheticEvent.hasOwnProperty('type')) {
            Object.defineProperty(syntheticEvent, 'type', {
                get: function() {
                    logger.warn('Accessing event.type in Adobe Launch has been deprecated and will be ' +
                        'removed soon. Please use event.$type instead.');
                    return syntheticEvent.$type;
                }
            });
        }

        return syntheticEvent;
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/

    /**
     * Rules can be ordered by users at the event type level. For example, assume both Rule A and Rule B
     * use the Library Loaded and Window Loaded event types. Rule A can be ordered to come before Rule B
     * on Library Loaded but after Rule B on Window Loaded.
     *
     * Order values are integers and act more as a priority. In other words, multiple rules can have the
     * same order value. If they have the same order value, their order of execution should be
     * considered nondetermistic.
     *
     * @param {Array} rules
     * @returns {Array} An ordered array of rule-event pair objects.
     */
    var buildRuleExecutionOrder = function(rules) {
        var ruleEventPairs = [];

        rules.forEach(function(rule) {
            if (rule.events) {
                rule.events.forEach(function(event) {
                    ruleEventPairs.push({
                        rule: rule,
                        event: event
                    });
                });
            }
        });

        return ruleEventPairs.sort(function(ruleEventPairA, ruleEventPairB) {
            return ruleEventPairA.event.ruleOrder - ruleEventPairB.event.ruleOrder;
        });
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/


    var warningLogged = false;

    var createNotifyMonitors = function(_satellite) {
        return function(type, event) {
            var monitors = _satellite._monitors;

            if (monitors) {
                if (!warningLogged) {
                    logger.warn('The _satellite._monitors API may change at any time and should only ' +
                        'be used for debugging.');
                    warningLogged = true;
                }

                monitors.forEach(function(monitor) {
                    if (monitor[type]) {
                        monitor[type](event);
                    }
                });
            }
        };
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/






    var MODULE_NOT_FUNCTION_ERROR = 'Module did not export a function.';

    var initRules = function(
        _satellite,
        rules,
        moduleProvider,
        replaceTokens,
        getShouldExecuteActions
    ) {
        var notifyMonitors = createNotifyMonitors(_satellite);

        var getModuleDisplayNameByRuleComponent = function(ruleComponent) {
            var moduleDefinition = moduleProvider.getModuleDefinition(ruleComponent.modulePath);
            return (moduleDefinition && moduleDefinition.displayName) || ruleComponent.modulePath;
        };

        var getErrorMessage = function(ruleComponent, rule, errorMessage, errorStack) {
            var moduleDisplayName = getModuleDisplayNameByRuleComponent(ruleComponent);
            return 'Failed to execute ' + moduleDisplayName + ' for ' + rule.name + ' rule. ' +
                errorMessage + (errorStack ? '\n' + errorStack : '');
        };

        var runActions = function(rule, syntheticEvent) {
            if (getShouldExecuteActions() && rule.actions) {
                rule.actions.forEach(function(action) {
                    action.settings = action.settings || {};

                    var moduleExports;

                    try {
                        moduleExports = moduleProvider.getModuleExports(action.modulePath);
                    } catch (e) {
                        logger.error(getErrorMessage(action, rule, e.message, e.stack));
                        return;
                    }

                    if (typeof moduleExports !== 'function') {
                        logger.error(getErrorMessage(action, rule, MODULE_NOT_FUNCTION_ERROR));
                        return;
                    }

                    var settings = replaceTokens(action.settings, syntheticEvent);

                    try {
                        moduleExports(settings, syntheticEvent);
                    } catch (e) {
                        logger.error(getErrorMessage(action, rule, e.message, e.stack));
                        return;
                    }
                });
            }

            logger.log('Rule "' + rule.name + '" fired.');
            notifyMonitors('ruleCompleted', {
                rule: rule
            });
        };

        var checkConditions = function(rule, syntheticEvent) {
            var conditionFailed;
            var condition;

            if (rule.conditions) {
                for (var i = 0; i < rule.conditions.length; i++) {
                    condition = rule.conditions[i];
                    condition.settings = condition.settings || {};

                    var moduleExports;

                    try {
                        moduleExports = moduleProvider.getModuleExports(condition.modulePath);
                    } catch (e) {
                        logger.error(getErrorMessage(condition, rule, e.message, e.stack));
                        conditionFailed = true;
                        break;
                    }

                    if (typeof moduleExports !== 'function') {
                        logger.error(getErrorMessage(condition, rule, MODULE_NOT_FUNCTION_ERROR));
                        conditionFailed = true;
                        break;
                    }

                    var settings = replaceTokens(condition.settings, syntheticEvent);

                    var result;

                    try {
                        result = moduleExports(settings, syntheticEvent);
                    } catch (e) {
                        logger.error(getErrorMessage(condition, rule, e.message, e.stack));
                        conditionFailed = true;
                        break;
                    }

                    if ((!result && !condition.negate) || (result && condition.negate)) {
                        var conditionDisplayName = getModuleDisplayNameByRuleComponent(condition);
                        logger.log('Condition ' + conditionDisplayName + ' for rule ' + rule.name + ' not met.');
                        conditionFailed = true;
                        break;
                    }
                }
            }

            if (conditionFailed) {
                notifyMonitors('ruleConditionFailed', {
                    rule: rule,
                    condition: condition
                });
                return;
            }

            runActions(rule, syntheticEvent);
        };

        var initEventModule = function(ruleEventPair) {
            var rule = ruleEventPair.rule;
            var event = ruleEventPair.event;
            event.settings = event.settings || {};

            var moduleExports;
            var moduleName;
            var extensionName;

            try {
                moduleExports = moduleProvider.getModuleExports(event.modulePath);
                moduleName = moduleProvider.getModuleDefinition(event.modulePath).name;
                extensionName = moduleProvider.getModuleExtensionName(event.modulePath);
            } catch (e) {
                logger.error(getErrorMessage(event, rule, e.message, e.stack));
                return;
            }

            if (typeof moduleExports !== 'function') {
                logger.error(getErrorMessage(event, rule, MODULE_NOT_FUNCTION_ERROR));
                return;
            }

            var settings = replaceTokens(event.settings);

            var syntheticEventMeta = {
                $type: extensionName + '.' + moduleName,
                $rule: {
                    id: rule.id,
                    name: rule.name
                }
            };

            /**
             * This is the callback that executes a particular rule when an event has occurred.
             * @callback ruleTrigger
             * @param {Object} [syntheticEvent] An object that contains detail regarding the event
             * that occurred.
             */
            var trigger = function(syntheticEvent) {
                notifyMonitors('ruleTriggered', {
                    rule: rule
                });
                checkConditions(rule, normalizeSyntheticEvent(syntheticEventMeta, syntheticEvent));
            };

            try {
                moduleExports(settings, trigger);
            } catch (e) {
                logger.error(getErrorMessage(event, rule, e.message, e.stack));
                return;
            }
        };

        buildRuleExecutionOrder(rules).forEach(initEventModule);
    };

    /***************************************************************************************
     * (c) 2017 Adobe. All rights reserved.
     * This file is licensed to you under the Apache License, Version 2.0 (the "License");
     * you may not use this file except in compliance with the License. You may obtain a copy
     * of the License at http://www.apache.org/licenses/LICENSE-2.0
     *
     * Unless required by applicable law or agreed to in writing, software distributed under
     * the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR REPRESENTATIONS
     * OF ANY KIND, either express or implied. See the License for the specific language
     * governing permissions and limitations under the License.
     ****************************************************************************************/













    var HIDE_ACTIVITY_LOCAL_STORAGE_NAME = 'hideActivity';
    var DEBUG_LOCAL_STORAGE_NAME = 'debug';


    var _satellite = window._satellite;

    if (_satellite && !window.__satelliteLoaded) {
        // If a consumer loads the library multiple times, make sure only the first time is effective.
        window.__satelliteLoaded = true;

        var container = _satellite.container;

        // Remove container in public scope ASAP so it can't be manipulated by extension or user code.
        delete _satellite.container;

        var undefinedVarsReturnEmpty = container.property.settings.undefinedVarsReturnEmpty;

        var dataElements = container.dataElements || {};

        // Remove when migration period has ended.
        dataElementSafe.migrateCookieData(dataElements);

        var getDataElementDefinition = function(name) {
            return dataElements[name];
        };

        var moduleProvider = createModuleProvider();

        var replaceTokens;

        // We support data elements referencing other data elements. In order to be able to retrieve a
        // data element value, we need to be able to replace data element tokens inside its settings
        // object (which is what replaceTokens is for). In order to be able to replace data element
        // tokens inside a settings object, we need to be able to retrieve data element
        // values (which is what getDataElementValue is for). This proxy replaceTokens function solves the
        // chicken-or-the-egg problem by allowing us to provide a replaceTokens function to
        // getDataElementValue that will stand in place of the real replaceTokens function until it
        // can be created. This also means that createDataElementValue should not call the proxy
        // replaceTokens function until after the real replaceTokens has been created.
        var proxyReplaceTokens = function() {
            return replaceTokens.apply(null, arguments);
        };

        var getDataElementValue = createGetDataElementValue(
            moduleProvider,
            getDataElementDefinition,
            proxyReplaceTokens,
            undefinedVarsReturnEmpty
        );

        var customVars = {};
        var setCustomVar = createSetCustomVar(
            customVars
        );

        var isVar = createIsVar(
            customVars,
            getDataElementDefinition
        );

        var getVar = createGetVar(
            customVars,
            getDataElementDefinition,
            getDataElementValue
        );

        replaceTokens = createReplaceTokens(
            isVar,
            getVar,
            undefinedVarsReturnEmpty
        );

        var localStorage = getNamespacedStorage('localStorage');

        var getDebugOutputEnabled = function() {
            return localStorage.getItem(DEBUG_LOCAL_STORAGE_NAME) === 'true';
        };

        var setDebugOutputEnabled = function(value) {
            localStorage.setItem(DEBUG_LOCAL_STORAGE_NAME, value);
            logger.outputEnabled = value;
        };

        var getShouldExecuteActions = function() {
            return localStorage.getItem(HIDE_ACTIVITY_LOCAL_STORAGE_NAME) !== 'true';
        };

        logger.outputEnabled = getDebugOutputEnabled();

        // Important to hydrate satellite object before we hydrate the module provider or init rules.
        // When we hydrate module provider, we also execute extension code which may be
        // accessing _satellite.
        hydrateSatelliteObject(
            _satellite,
            container,
            setDebugOutputEnabled,
            getVar,
            setCustomVar
        );

        hydrateModuleProvider(
            container,
            moduleProvider,
            replaceTokens,
            getDataElementValue
        );

        initRules(
            _satellite,
            container.rules || [],
            moduleProvider,
            replaceTokens,
            getShouldExecuteActions
        );
    }

// Rollup's iife option always sets a global with whatever is exported, so we'll set the
// _satellite global with the same object it already is (we've only modified it).
    var src = _satellite;

    return src;

}());

