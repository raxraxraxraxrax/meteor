// 'url' is assigned to in a statement before this.
var page = require('webpage').create();
 
page.open(url, function(status) {
    if (status == 'fail')
        phantom.exit();
 
    var lastOut = '';
    setInterval(function() {
      var ready = page.evaluate(function () {
        if (typeof Meteor !== 'undefined'
            && typeof(Meteor.status) !== 'undefined'
            && Meteor.status().connected) {
          Deps.flush();
          return DDP._allSubscriptionsReady();
        }
        //console.log("ready function ran");
        return false;
      });
      if (ready) {
        var out = page.content;
        out = out.replace(/<script[^>]+>(.|\n|\r)*?<\/script\s*>/ig, '');
        out = out.replace('<meta name=\"fragment\" content=\"!\">', '');
        //console.log('ready');
        console.log(out);
        phantom.exit();
      } else {
        var out = 'not ready';
        if (typeof Meteor !== 'undefined') {
            if (typeof(Meteor.status) !== 'undefined') {
                if (Meteor.status().connected) {
                    out += ', all subs ready: ' + DDP._allSubscriptionsReady();
                } else {
                    out += ', Meteor not connected';
                }
            } else {
                out += ', Meteor.status undefined';
            }
        } else {
            out += ', Meteor undefined';
        }
        if (lastOut !== out) {
            //console.log('lastout is not out');
            //console.log(page.content);
            //console.log(out);
            lastOut = out;
        }
      }
    }, 100);
 
});
