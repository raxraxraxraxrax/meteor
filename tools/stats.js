var Fiber = require("fibers");
var _ = require("underscore");

var config = require("./config.js");
var files = require("./files.js");
var uniload = require("./uniload.js");
var project = require("./project.js");
var auth = require("./auth.js");
var ServiceConnection = require("./service-connection.js");

// The name of the package that you add to your app to opt out of
// sending stats.
var optOutPackageName = "package-stats-opt-out";

// Return a list of packages used by this app, both directly and
// indirectly. Formatted as a list of objects with 'name', 'version'
// and 'direct', which is how the `recordAppPackages` method on the
// stats server expects to get this list.
var packageList = function () {
  var directDeps = project.project.getConstraints();

  return _.map(
    project.project.getVersions(),
    function (version, name) {
      return {
        name: name,
        version: version,
        direct: _.contains(directDeps, name)
      };
    }
  );
};

var recordPackages = function () {
  // Before doing anything, look at the app's dependencies to see if the
  // opt-out package is there; if present, we don't record any stats.
  var packages = packageList();
  if (_.contains(_.pluck(packages, "name"), optOutPackageName)) {
    return;
  }

  // We do this inside a new fiber to avoid blocking anything on talking
  // to the package stats server. If we can't connect, for example, we
  // don't care; we'll just miss out on recording these packages.
  Fiber(function () {
    try {
      var conn = connectToPackagesStatsServer();

      if (auth.isLoggedIn()) {
        try {
          auth.loginWithTokenOrOAuth(
            conn,
            config.getPackageStatsServerUrl(),
            config.getPackageStatsServerDomain(),
            "package-stats-server"
          );
        } catch (err) {
          logErrorIfRunningMeteorRelease(err);
          // Do nothing. If we can't log in, we should continue and report
          // stats anonymously.
        }
      }

      conn.call("recordAppPackages",
                project.project.getAppIdentifier(),
                packages);
    } catch (err) {
      logErrorIfRunningMeteorRelease(err);
      // Do nothing. A failure to record package stats shouldn't be
      // visible to the end user and shouldn't affect whatever command
      // they are running.
    }
  }).run();
};

var logErrorIfRunningMeteorRelease = function (err) {
  if (files.inCheckout()) {
    process.stderr.write("Failed to record package usage.\n");
    process.stderr.write(err.stack || err);
    process.stderr.write("\n\n");
  }
};

// Used in a test (and can only be used against the testing packages
// server) to fetch one package stats entry for a given application.
var getPackagesForAppIdInTest = function () {
  return connectToPackagesStatsServer().call(
    "getPackagesForAppId",
    project.project.getAppIdentifier());
};

var connectToPackagesStatsServer = function () {
  var Package = uniload.load({
    packages: ["livedata"]
  });
  var conn = new ServiceConnection(
    Package,
    config.getPackageStatsServerUrl(),
    {_dontPrintErrors: true}
  );
  return conn;
};

exports.recordPackages = recordPackages;
exports.packageList = packageList; // for use in the "stats" self-test.
exports.getPackagesForAppIdInTest = getPackagesForAppIdInTest;