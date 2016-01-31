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
    if (typeof Storage === 'object') {
      var url = localStorage.getItem('url');
      if (typeof url !== 'string') {
        var url = getFromApi();
        localStorage.setItem('url', url);
        return url;
      } else {
        return url;
      }
    } else {
      return getRemoteUrl();
    }
  };

  // Get details from API server
  var getRemoteUrl = function() {
    return JSON.parse($.ajax({
      url: 'https://droidconro.eu-gb.mybluemix.net?user=katytest',
      async: false,
    }).responseText).url;
  };

  // Database
  var dbConfig = getCredentials();

  // Local Pouch
  var db = PouchDB(dbConfig.local);

  // Sync to Cloudant
  db.sync(dbConfig.remote, {
    live: true,
    retry: true,
  });

  // Save new doc
  $('#chat').on('submit', function(e) {

    e.preventDefault();

    var doc = {
      user: $('#user').val(),
      message: $('#message').val(),
      timestamp: (new Date).toISOString(),
    };

    db.post(doc, function(err, body) {
      if (err) console.log(err);
      console.log(body);
    });

    return false;
  });

  // Display all IM's
  db.allDocs({include_docs: true},function(err, resp){
    for (var i = 0; i < resp.rows.length; i++) {
      var data = resp.rows[i];
      addMention(data);
      if(i==resp.rows.length-2) {
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
    html += '<div class=\"\" ><a class=\"btn btn-default open\" ><i class=\"fa fa-search-plus\" ></i></a>';
    html += '<pre class=\"hide\" ><code>';
    html += JSON.stringify(data.doc.insights, null, ' ');
    html += '</code></pre>';
    html += '</div>';

    if (typeof $('#' + data.doc._id).html() == 'undefined') {
      $('#messageOutput').prepend(html);
    } else {
      $('#' + data.doc._id).html(html);
    }

    // View the extra data
    $('.open').on('click', function() {
      $(this).parent().children('pre').removeClass('hide');
    });

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
  };

  var santise = function(str) {
    return str.replace(/(<([^>]+)>)/ig,"")
  };

});
