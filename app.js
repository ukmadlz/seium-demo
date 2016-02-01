$(document).ready(function() {

  // Get the credentials for use with PouchDB and Cloudant
  var getCredentials = function() {
    var url = getLocalUrl();
    return {
      remote: url,
      local: $('<a>', { href: url })[0].pathname.substr(1),
    };
  };

  // Get details from lcoalStorage
  var getLocalUrl = function() {
    if (typeof Storage !== 'undefined') {
      var url = localStorage.getItem('url');
      if (typeof url !== 'string') {
        var url = getRemoteUrl();
        localStorage.setItem('url', url);
        return url;
      } else {
        return url;
      }
    }
  };

  // Get details from API server
  var getRemoteUrl = function() {
    console.log('Credentials - getting');
    var api = 'https://droidconro.eu-gb.mybluemix.net?user=katytest';
    $.get(api, function(data) {
      localStorage.setItem('url', data.url);
      console.log('Credentials saved');
      $(document).trigger('credentials-loaded');
    });
  };

  // Preload Creds
  var preloadCreds = function() {
    if (typeof localStorage.getItem('url') !== 'string') {
      getRemoteUrl();
    } else {
      console.log('Credentials retrieved');
      $(document).trigger('credentials-loaded');
    }
  };

  $(document).on('credentials-loaded', function() {

    // Database
    var dbConfig = getCredentials();

    // Local Pouch
    var db = PouchDB(dbConfig.local);

    // Sync to Cloudant
    db.sync(dbConfig.remote, {
      live: true,
      retry: true,
    });

    // Remove the spinner
    $('#messageOutput #spinner').remove();

    // Save new doc
    $('#chat').on('submit', function(e) {

      e.preventDefault();

      var doc = {
        user: $('#user').val(),
        message: $('#message').val(),
        timestamp: (new Date).toISOString(),
      };

      db.post(doc, function(err, body) {
        if (err) {
          console.log(err);
        } else {
          $('#message').val('');
        }
      });

      return false;
    });

    // Display all IM's
    db.allDocs({ include_docs: true }, function(err, resp) {
      for (var i = 0; i < resp.rows.length; i++) {
        var data = resp.rows[i];
        addMention(data);
        if (i == resp.rows.length - 2) {
          sortMessage();
        }
      }
    });

    // See changes
    db.changes({
      since: 'now',
      live: true,
      include_docs: true,
    }).on('change', function(change) {
      // handle change
      if (change.deleted) {
        $('#' + change.doc._id).remove();
      } else {
        addMention(change);
        sortMessage();
      }
    }).on('complete', function(info) {
      // changes() was canceled
    }).on('error', function(err) {
      console.log(err);
    });

    // Template
    var addMention = function(data) {
      var dateObj = new Date(data.doc.timestamp);
      var html = '<div class=\"row\" id=\"' + data.doc._id + '\" data-timestamp=\"' + dateObj.getTime() + '\">';
      html += '<p><strong>' + santise(data.doc.user) + ': ' + dateObj.toString() + '</strong></p>';
      html += marked(data.doc.message);
      html += '<div class=\"\" >';

      // Controls
      if ($('#user').val() === data.doc.user) {
        html += '<a class=\"btn btn-default delete\" ><i class=\"fa fa-trash\" ></i></a>';
      }

      // html += '<a class=\"btn btn-default open\" ><i class=\"fa fa-search-plus\" ></i></a>';

      html += '<pre class=\"hide\" ><code>';
      html += JSON.stringify(data.doc.insights, null, ' ');
      html += '</code></pre>';
      html += '</div>';

      if (typeof $('#' + data.doc._id).html() == 'undefined') {
        $('#messageOutput').prepend(html);
      } else {
        $('#' + data.doc._id).html(html);
      }

      applyEvents();

    };

    var sortMessage = function() {
      var ul = $('#messageOutput');
      var arr = $.makeArray(ul.children('div.row'));

      arr.sort(function(a, b) {
        var textA = +$(a).attr('data-timestamp');
        var textB = +$(b).attr('data-timestamp');

        if (textA < textB) return 1;
        if (textA > textB) return -1;

        return 0;
      });

      ul.empty();

      $.each(arr, function() {
        ul.append(this);
      });

      applyEvents();
    };

    var santise = function(str) {
      return str.replace(/(<([^>]+)>)/ig, '');
    };

    var applyEvents = function() {

      // Delete Message
      $('.delete').on('click', function() {
        db.get($(this).parent().parent().attr('id'), function(err, doc) {
          if (err) {
            return console.log(err);
          }

          db.remove(doc, function(err, response) {
            if (err) {
              addAlerts('warning', 'Unable to delete message, please try again.');
              return console.log(err);
            } else {
              addAlerts('success', 'Message successfully deleted.');
            }
          });
        });
      });

      // View the extra data
      $('.open').on('click', function() {
        $(this).parent().children('pre').removeClass('hide');
      });

    };

  });

  // Deal with alerts
  var addAlerts = function(alert, message) {
    var html = '<div class=\"alert alert-' + alert + ' alert-dismissible\" role=\"alert\">';
    html += '<button type=\"button\" class=\"close\" data-dismiss=\"alert\" aria-label=\"Close\"><span aria-hidden=\"true\">&times;</span></button>';
    html += '<strong>Warning!</strong> ' + message;
    html += '</div>';
    $('#alerts').append(html);
  };

  // Load credentials
  preloadCreds();

});
