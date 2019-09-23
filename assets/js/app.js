var dataLayer = dataLayer || [];

jQuery.event.special.touchstart = {
  setup: function( _, ns, handle ){
    if ( ns.includes("noPreventDefault") ) {
      this.addEventListener("touchstart", handle, { passive: false });
    } else {
      this.addEventListener("touchstart", handle, { passive: true });
    }
  }
};

//global jQuery
window.btoa = window.btoa || function () {
  var object = typeof exports != 'undefined' ? exports : this; // #8: web workers
  var chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

  function InvalidCharacterError(message) {
    this.message = message;
  }
  InvalidCharacterError.prototype = new Error;
  InvalidCharacterError.prototype.name = 'InvalidCharacterError';

  // encoder
  // [https://gist.github.com/999166] by [https://github.com/nignag]
  object.btoa || (
    object.btoa = function (input) {
      var str = String(input);
      for (
        // initialize result and counter
        var block, charCode, idx = 0, map = chars, output = '';
        // if the next str index does not exist:
        //   change the mapping table to "="
        //   check if d has no fractional digits
        str.charAt(idx | 0) || (map = '=', idx % 1);
        // "8 - idx % 1 * 8" generates the sequence 2, 4, 6, 8
        output += map.charAt(63 & block >> 8 - idx % 1 * 8)
        ) {
        charCode = str.charCodeAt(idx += 3/4);
        if (charCode > 0xFF) {
          throw new InvalidCharacterError("'btoa' failed: The string to be encoded contains characters outside of the Latin1 range.");
        }
        block = block << 8 | charCode;
      }
      return output;
    });
};

/**
 * Fancy ID generator that creates 20-character string identifiers with the following properties:
 *
 * 1. They're based on timestamp so that they sort *after* any existing ids.
 * 2. They contain 72-bits of random data after the timestamp so that IDs won't collide with other clients' IDs.
 * 3. They sort *lexicographically* (so the timestamp is converted to characters that will sort properly).
 * 4. They're monotonically increasing.  Even if you generate more than one in the same timestamp, the
 *    latter ones will sort after the former ones.  We do this by using the previous random bits
 *    but "incrementing" them by 1 (only in the case of a timestamp collision).
 */
generatePushID = (function() {
  // Modeled after base64 web-safe chars, but ordered by ASCII.
  var PUSH_CHARS = '-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz';

  // Timestamp of last push, used to prevent local collisions if you push twice in one ms.
  var lastPushTime = 0;

  // We generate 72-bits of randomness which get turned into 12 characters and appended to the
  // timestamp to prevent collisions with other clients.  We store the last characters we
  // generated because in the event of a collision, we'll use those same characters except
  // "incremented" by one.
  var lastRandChars = [];

  return function() {
    var now = new Date().getTime();
    var duplicateTime = (now === lastPushTime);
    lastPushTime = now;

    var timeStampChars = new Array(8);
    for (var i = 7; i >= 0; i--) {
      timeStampChars[i] = PUSH_CHARS.charAt(now % 64);
      // NOTE: Can't use << here because javascript will convert to int and lose the upper bits.
      now = Math.floor(now / 64);
    }
    if (now !== 0) throw new Error('We should have converted the entire timestamp.');

    var id = timeStampChars.join('');

    if (!duplicateTime) {
      for (i = 0; i < 12; i++) {
        lastRandChars[i] = Math.floor(Math.random() * 64);
      }
    } else {
      // If the timestamp hasn't changed since last push, use the same random number, except incremented by 1.
      for (i = 11; i >= 0 && lastRandChars[i] === 63; i--) {
        lastRandChars[i] = 0;
      }
      lastRandChars[i]++;
    }
    for (i = 0; i < 12; i++) {
      id += PUSH_CHARS.charAt(lastRandChars[i]);
    }
    if(id.length != 20) throw new Error('Length should be 20.');

    return id;
  };
})();

(function($) {
  var loggedInUser;
  $.fn.serializeObject = function() {
    var myObject = {};
    var a = this.serializeArray();
    $.each(a, function() {
      if (myObject[this.name] !== undefined) {
        if (!myObject[this.name].push) {
          myObject[this.name] = [myObject[this.name]];
        }
        myObject[this.name].push(this.value || '');
      } else {
        myObject[this.name] = this.value || '';
      }
    });
    return myObject;
  };

  // Init
  function init() {
    // Determine Logged In User
    loggedInUser = store.get("loggedInUser");
    if (typeof loggedInUser !== "undefined") {
      login(loggedInUser);
    } else {
      $("#loginForm").show();
    }
  }

  // Login
  function login(loggedInUser) {
    var $loginForm,
        eventData;

    $loginForm = $("#loginForm");
    $loginForm.after("<span id=\"loggedInUser\" class=\"navbar-text navbar-right\">Logged in as: <strong>" + loggedInUser + "</strong></span>");
    $loginForm.hide();
    $("#loggedInUser").append(" <a id=\"logoutLink\" href=\"javascript:void(0);\">Logout</a>");
    $("#logoutLink").on("click", logout);
  }

  // Logout
  function logout() {
    var eventData;

    store.remove("loggedInUser");
    $("#loggedInUser").remove();

    eventData = {event: "logout"};

    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);

    setTimeout(function() {
      location.reload();
    }, 500);
  }

  init();

  // Demo itself features
  $("#loginForm").on("submit", function(event) {
    var eventData;

    event.preventDefault();

    eventData = $(this).serializeObject();
    store.set("loggedInUser", eventData.username);
    login(eventData.username);
    delete eventData.password;
    eventData.user_id = getUserId(eventData.username);
    delete eventData.username;
    eventData.method = "Username/Password";
    eventData.event = "login";

    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
    this.reset();
  });

  $('#transaction_id').val(generatePushID());
  $("#leadForm").on("submit", function(event) {
    var eventData;

    event.preventDefault();

    eventData = $(this).serializeObject();
    delete eventData._method;
    delete eventData.contact;
    eventData.event = "generate_lead";
    eventData.currency = "CZK";
    eventData.value = "0";

    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
    this.reset();
    $("#leadForm").hide();
    $('#thankYou').show();
  });

  $("#searchForm").on("submit", function(event) {
    var eventData;

    event.preventDefault();

    eventData = $(this).serializeObject();
    eventData.event = "search";

    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
    this.reset();
    $('#searchResults').show();
  });

  $(".download").on("click", function(event) {
    var $target,
      linkHref,
      fileType,
      eventData;

    event.preventDefault();

    $target = $(event.target);
    linkHref = $target.attr("href");
    fileType = linkHref.split(".").pop().toUpperCase();

    eventData = {event: "file_download", file_name: linkHref, file_extension: fileType}

    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);

    event.preventDefault();

    $target = $(event.target);
    linkHref = $target.attr("href");
    fileType = linkHref.split(".").pop().toUpperCase();

    setTimeout(function() {
      window.location = linkHref;
    }, 500);
  });

  var $dateFields;
  $dateFields = $('.date');

  if ($dateFields.length > 0) {
    $dateFields.datetimepicker({
      locale: 'cs',
      format: 'DD.MM.YYYY'
    });
  }

  // Fetch all the forms we want to apply custom Bootstrap validation styles to
  var forms = document.getElementsByClassName('needs-validation');
  // Loop over them and prevent submission
  var validation = Array.prototype.filter.call(forms, function(form) {
    form.addEventListener('submit', function(event) {
      var currentStep,
          $currentStepTabLink,
          nextStep,
          $nextStepTabLink,
          invalidFields,
          invalidFieldsMessage,
          eventData;
      
      event.preventDefault();
      event.stopPropagation();

      if (form.checkValidity() === true) {
        currentStep = parseInt($(form).find('.form-step').val());
        $currentStepTabLink = $('#step' + currentStep + 'tab a');
        nextStep = currentStep + 1;
        $nextStepTabLink = $('#step' + nextStep + 'tab a');
        $nextStepTabLink.removeClass('disabled');
        $currentStepTabLink.addClass('disabled');
        $nextStepTabLink.tab('show');

        eventData = {
          event: 'wizard' + ((nextStep === 3) ? 'Success' : 'Step' + nextStep) + 'Loaded'
        };

        console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
        dataLayer.push(eventData);  
      } else {
        invalidFields = $(event.target).find(':invalid');
  
        invalidFieldsMessage = invalidFields.toArray().filter(function(field) {
          return field.id !== '';
        }).map(function (field) {
          var errorMessage,
              eventData;

          if (field.validity.valueMissing) {
            errorMessage = 'empty';
          }
          if (field.validity.typeMismatch) {
            errorMessage = 'invalid';
          }
          if (field.validity.patternMismatch) {
            errorMessage = 'invalid';
          }
          if (field.validity.tooShort) {
            errorMessage = 'short';
          }
          if (field.validity.tooLong) {
            errorMessage = 'long';
          }
          return field.id + ':' + errorMessage;
        });
        eventData = {
          event: 'validation_fail',
          invalid_fields: invalidFieldsMessage
        };

        console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
        dataLayer.push(eventData);  
      }
      form.classList.add('was-validated');
    }, false);
  });

  $("#wizardStep1 :input").change(function(event) {
    var $target,
        eventData;

    $target = $(event.target);
    eventData = {
      event: "input_change",
      field_name: $("label[for=" + $target.attr("id") + "]").text(),
      field_value: $target.val()
    };

    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
  });

  $('#interactions a[data-toggle="tab"]').on('shown.bs.tab', function (e) {
    var eventData;

    eventData = {
      event: "content_view",
      content_id: $(e.target).text().trim()
    };
    
    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
  });

  $('.collapse').on('shown.bs.collapse', function (e) {
    var eventData;

    eventData = {
      event: "content_view",
      content_id: $($(e.target).data('title')).text().trim()
    };
    
    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
  });

})(jQuery);

/*
 * Global Variable for available Youtube players
 */
var youtubePlayers = [],
  youtubePlayerIframes = [];

/*
 * Init Youtube Iframe API
 */
(function() {
  var tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  var firstScriptTag = document.getElementsByTagName("script")[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
})();

function onYouTubeIframeAPIReady() {
  var player1 = new YT.Player("player-1", {
    height: "304",
    width: "540",
    videoId: "wofkHuZm4Kg",
    playerVars: {
      origin: document.location.protocol + "//" + document.location.hostname,
    },
    events: {
      "onStateChange": onPlayerStateChange
    }
  });
  var player2 = new YT.Player("player-2", {
    height: "304",
    width: "540",
    videoId: "AMBWY7o9RtE",
    playerVars: {
      origin: document.location.protocol + "//" + document.location.hostname,
    },
    events: {
      "onStateChange": onPlayerStateChange
    }
  });
}

function onPlayerStateChange(event) {
  var videoData,
      eventData;
  
  videoData = event.target.getVideoData();
  switch (event.data) {
  case YT.PlayerState.PLAYING:
    eventData = {event: "video_start", video_id: videoData.video_id, video_title: videoData.title};
    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
    break;
  case YT.PlayerState.PAUSED:
    eventData = {event: "video_pause", video_id: videoData.video_id, video_title: videoData.title, video_duration: event.target.getCurrentTime()};
    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
    break;
  case YT.PlayerState.ENDED:
    eventData = {event: "video_end", video_id: videoData.video_id, video_title: videoData.title, video_duration: event.target.getCurrentTime()};
    console.log("Pushing to Data Layer: " + JSON.stringify(eventData, null, 2));
    dataLayer.push(eventData);
    break;
  }
}

