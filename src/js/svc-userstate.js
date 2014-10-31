(function (angular) {
  "use strict";


  // var pendingAccessToken, pendingState;

  var stripLeadingSlash = function (str) {
    if(str[0] === "/") { str = str.slice(1); }
    return str;
  };

  var parseParams = function (str) {
    var params = {};
    str.split("&").forEach(function (fragment) {
      var fragmentArray = fragment.split("=");
      params[fragmentArray[0]] = fragmentArray[1];
    });
    return params;
  };

  angular.module("risevision.common.userstate",
    ["risevision.common.gapi", "risevision.common.localstorage",
    "risevision.common.config", "risevision.core.cache",
    "risevision.core.oauth2", "ngBiscuit",
    "risevision.core.util", "risevision.core.userprofile",
    "risevision.core.company", "risevision.common.loading"
  ])

  // constants (you can override them in your app as needed)
  .value("DEFAULT_PROFILE_PICTURE", "http://api.randomuser.me/portraits/med/men/33.jpg")
  .value("OAUTH2_SCOPES", "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile")
  .value("GOOGLE_OAUTH2_URL", "https://accounts.google.com/o/oauth2/auth")

    .run(["$location", "userState", "$log", "gapiLoader",
      function ($location, userState, $log, gapiLoader) {
      var path = $location.path();
      var params = parseParams(stripLeadingSlash(path));
      $log.debug("URL params", params);
      if(params.access_token) {
        gapiLoader().then(function (gApi) {
          $log.debug("Setting token", params.access_token);
          gApi.auth.setToken( {access_token: params.access_token});
          userState.authenticate();
        });
      }
      if (params.state) {
        var state = JSON.parse(params.state);
        if(state.s) {
          userState._restoreState(state.s);
        }
        if(state.u) {
          $location.path(state.u);
        }
      }
    }])

  .factory("userState", [
    "$injector", "$q", "$log", "oauth2APILoader", "$location", "CLIENT_ID",
    "gapiLoader", "pick", "cookieStore", "OAUTH2_SCOPES", "userInfoCache",
    "getOAuthUserInfo", "getUserProfile", "getCompany", "$rootScope",
    "$interval", "$loading", "rvStorage", "$window", "GOOGLE_OAUTH2_URL",
    function ($injector, $q, $log, oauth2APILoader, $location, CLIENT_ID,
    gapiLoader, pick, cookieStore, OAUTH2_SCOPES, userInfoCache,
    getOAuthUserInfo, getUserProfile, getCompany, $rootScope,
    $interval, $loading, rvStorage, $window, GOOGLE_OAUTH2_URL) {
    //singleton factory that represents userState throughout application

    var _state = {
      profile: {}, //Rise vision profile
      user: {}, //Google user
      userCompany: {},
      selectedCompany: {},
      roleMap: {},
      userToken: cookieStore.get("rv-token"),
      inRVAFrame: angular.isDefined($location.search().inRVA)
    };

    var _accessTokenRefreshHandler = null;

      //
    var _follow = function(source) {
      var Follower = function(){};
      Follower.prototype = source;
      return new Follower();
    };

    var _getUserId = function () {
      return _state.user ? _state.user.userId : null;
    };

    var _setUserToken = function () {
      _state.userToken = _getUserId();
      cookieStore.put(
        "rv-token", _state.userToken, {domain: _getBaseDomain()});
      cookieStore.put(
        "rv-token", _state.userToken);
    };

    var _clearUserToken = function () {
      $log.debug("Clearing user token...");
      _cancelAccessTokenAutoRefresh();
      _state.userToken = null;
      cookieStore.remove("rv-token",
        {domain: "." + _getBaseDomain()});
      cookieStore.remove("rv-token");
      return gapiLoader().then(function (gApi) {
        gApi.auth.setToken();
      });
    };

    var _scheduleAccessTokenAutoRefresh = function () {
      //cancel any existing $interval(s)
      $interval.cancel(_accessTokenRefreshHandler);
      _accessTokenRefreshHandler = $interval(function(){
        //cancel current $interval. It will be re-sheduled if authentication succeeds
        $interval.cancel(_accessTokenRefreshHandler);
        //refresh Access Token
        _authorize(true);
      }, 55 * 60 * 1000); //refresh every 55 minutes
    };

    var _cancelAccessTokenAutoRefresh = function () {
      $interval.cancel(_accessTokenRefreshHandler);
      _accessTokenRefreshHandler = null;
    };

    var _looksLikeIp = function (addr)
    {
     if (/^([0-9])+\.([0-9])+\.([0-9])+\.([0-9])+$/.test(addr))
      {
        return (true);
      }
      return (false);
    };

    var _getBaseDomain = function () {
      var result;
      if(!result) {
        var hostname = $location.host();
        var port = $location.port() ? ":" + $location.port() : "";

        if(_looksLikeIp(hostname)) {
          result = hostname + port;
        }
        else {
          var parts = hostname.split(".");
          if(parts.length > 1) {
            //localhost
            result = parts.slice(parts.length -2).join(".") + port;
          }
          else {
            result = hostname + port;
          }
        }

        $log.debug("baseDomain", result);
      }
      return result;
    };

    var _clearObj = function (obj) {
      for (var member in obj) {
        delete obj[member];
      }
    };

    var _clearAndCopy = function (src, dest) {
      _clearObj(dest);
      angular.extend(dest, src);
    };

    // var _persist = function () {
    //   rvStorage.setItem("risevision.userState", JSON.stringify(_state));
    //   $log.debug("userState persisted", _state);
    // };

    var _resetUserState = function () {
       _clearObj(_state.user);
       _clearObj(_state.selectedCompany);
       _clearObj(_state.profile);
       _clearObj(_state.userCompany);
       _state.roleMap = {};
       $log.debug("User state has been reset.");
     };

     var refreshProfile = function () {
       var deferred = $q.defer();
         getOAuthUserInfo().then(function (oauthUserInfo) {
         //populate profile if the current user is a rise vision user
         getUserProfile(_state.user.username, true).then(
           function (profile) {
             _clearAndCopy(angular.extend({
               username: oauthUserInfo.email
             }, profile), _state.profile);

             //set role map
             _state.roleMap = {};
             if(_state.profile.roles) {
                _state.profile.roles.forEach(function (val){
                  _state.roleMap[val] = true;
                });
             }
             deferred.resolve();
           }, deferred.reject);
       }, deferred.reject);
       return deferred.promise;
     };

     /*
     * Responsible for triggering the Google OAuth process.
     *
     */
     var _authorize = function(attemptImmediate) {
       var authorizeDeferred = $q.defer();

       var opts = {
         client_id: CLIENT_ID,
         scope: OAUTH2_SCOPES,
         cookie_policy: $location.protocol() + "://" +
           _getBaseDomain()
       };

       if (attemptImmediate) {
         opts.immediate = true;
       }
       else {
         opts.prompt = "select_account";
       }
       gapiLoader().then(function (gApi) {
           gApi.auth.authorize(opts, function (authResult) {
             $log.debug("authResult", authResult);
             if (authResult && !authResult.error) {
               _scheduleAccessTokenAutoRefresh();
                 getOAuthUserInfo().then(function (oauthUserInfo) {
                   if(!_state.user.username || !_state.profile.username ||
                     _state.user.username !== oauthUserInfo.email) {

                     //populate user
                     _clearAndCopy({
                       userId: oauthUserInfo.id, //TODO: ideally we should not use real user ID or email, but use hash value instead
                       username: oauthUserInfo.email,
                       picture: oauthUserInfo.picture
                     }, _state.user);

                     _setUserToken();
                     refreshProfile().then(function () {
                       //populate userCompany
                       return getCompany().then(function(company) {
                         _clearAndCopy(company, _state.userCompany);
                         _clearAndCopy(company, _state.selectedCompany);

                       }, function () { _clearObj(_state.userCompany);
                       }).finally(function () {
                        authorizeDeferred.resolve(authResult);
                        $rootScope.$broadcast("risevision.user.authorized");
                        if(!attemptImmediate) {
                          $rootScope.$broadcast("risevision.user.userSignedIn");
                        }
                       });
                     },
                     function () {
                       authorizeDeferred.resolve(authResult);
                       $rootScope.$broadcast("risevision.user.authorized");
                       if(!attemptImmediate) {
                         $rootScope.$broadcast("risevision.user.userSignedIn");
                       }
                     });
                   }
                   else {authorizeDeferred.resolve(authResult); }
                 }, function(err){
                   _clearObj(_state.user);
                 authorizeDeferred.reject(err); });
             }
             else {
               _clearObj(_state.user);
               authorizeDeferred.reject("not authorized");
             }
           });
       }, authorizeDeferred.reject); //gapiLoader

       return authorizeDeferred.promise;
     };

     var redirect = true;

     var authenticateRedirect = function(forceAuth) {

       if(!forceAuth) {
         return authenticate(forceAuth);
       }

       else {
        // _persist();

        var loc = $window.location.href.substr(0, $window.location.href.indexOf("#")) || $window.location.href;

        $window.location = GOOGLE_OAUTH2_URL +
          "?response_type=token" +
          "&scope=" + encodeURIComponent(OAUTH2_SCOPES) +
          "&client_id=" + CLIENT_ID +
          "&redirect_uri=" + encodeURIComponent(loc) +
          "&state=" + encodeURIComponent(JSON.stringify({s: _state, u: $location.path()}));

        var deferred = $q.defer();
        // returns a promise that never get fulfilled since we are redirecting
        // to that google oauth2 page
        return deferred.promise;
       }
     };

     var authenticate = function(forceAuth) {
       var authenticateDeferred = $q.defer();
       $log.debug("authentication called");

       var _proceed = function () {
         if(forceAuth) {
           _resetUserState();
           userInfoCache.removeAll();
         }
         // This flag indicates a potentially authenticated user.
         gapiLoader().then(function (gApi) {
          var userAuthed = gApi.auth.getToken() !== null;
          $log.debug("userAuthed", userAuthed);

          if (forceAuth || userAuthed === true) {
            _authorize(!forceAuth)
            .then(function(authResult) {
              if (authResult && ! authResult.error) {
                authenticateDeferred.resolve();
              }
              else {
                _clearUserToken();
                $log.debug("Authentication Error: " + authResult.error);
                authenticateDeferred.reject("Authentication Error: " + authResult.error);
              }
            }, function () {
              _clearUserToken();
              authenticateDeferred.reject();}).finally(function (){
                $loading.stopGlobal("risevision.user.authenticate");
              });
          }
          else {
            var msg = "user is not authenticated";
            $log.debug(msg);
           //  _clearUserToken();
            authenticateDeferred.reject(msg);
            _clearObj(_state.user);
            $loading.stopGlobal("risevision.user.authenticate");
          }
         });
       };
       _proceed();

       if(forceAuth) {
         $loading.startGlobal("risevision.user.authenticate");
       }

       return authenticateDeferred.promise;
     };

     var signOut = function(signOutGoogle) {
       var deferred = $q.defer();
       userInfoCache.removeAll();
       gapiLoader().then(function (gApi) {
         if (signOutGoogle) {
           $window.logoutFrame.location = "https://accounts.google.com/Logout";
         }
         gApi.auth.signOut();
         // The flag the indicates a user is potentially
         // authenticated already, must be destroyed.
         _clearUserToken().then(function () {
           //clear auth token
           // The majority of state is in here
           _resetUserState();
           _clearObj(_state.user);
           //call google api to sign out
           $rootScope.$broadcast("risevision.user.signedOut");
           $log.debug("User is signed out.");
           deferred.resolve();
         }, function () {
           deferred.reject();
         });
       });
       return deferred.promise;
     };

    var isLoggedIn = function () {
      if(!_state.user.username) {return false; }
      else { return true; }
    };

    var isRiseVisionUser = function () {
      return _state.profile.username !== null &&
        _state.profile.username !== undefined;
    };

    var hasRole = function (role) {
      return angular.isDefined(_state.roleMap[role]);
    };

    var getAccessToken = function () {
      return $window.gapi ? $window.gapi.auth.getToken() : null;
    };

    var userState = {
      getUserCompanyId: function () {
        return (_state.userCompany && _state.userCompany.id) || null; },
      getSelectedCompanyId: function () {
        return (_state.selectedCompany && _state.selectedCompany.id) || null; },
      getSelectedCompanyName: function () {
        return (_state.selectedCompany && _state.selectedCompany.name) || null;},
      updateCompanySettings: function (company) {
        if (company && _state.selectedCompany) {
          _clearAndCopy(company, _state.selectedCompany);
          if (_state.userCompany.id === _state.selectedCompany.id) {
            _clearAndCopy(company, _state.userCompany);
          }
        }
      },
      getSelectedCompanyCountry: function () {
          return (_state.selectedCompany && _state.selectedCompany.country) || null;},
      getUsername: function () {
        return (_state.user && _state.user.username) || null; },
      getCopyOfProfile: function () { return _follow(_state.profile); },
      resetCompany: function () { _clearAndCopy(_state.userCompany, _state.selectedCompany); },
      getCopyOfUserCompany: function () { return _follow(_state.userCompany); },
      getCopyOfSelectedCompany: function () { return _follow(_state.selectedCompany); },
      switchCompany: function (company) { _clearAndCopy(company, _state.selectedCompany); },
      isSubcompanySelected: function () {
        return _state.selectedCompany && _state.selectedCompany.id !== (_state.userCompany && _state.userCompany.id); },
      getUserPicture: function () { return _state.user.picture; },
      hasRole: hasRole,
      inRVAFrame: function () {return _state.inRVAFrame; },
      isRiseAdmin: function () {return hasRole("sa"); },
      isRiseStoreAdmin: function () {return hasRole("ba"); },
      isUserAdmin: function () {return hasRole("ua"); },
      isPurchaser: function () {return hasRole("pu"); },
      isSeller: function () {return (_state.selectedCompany && _state.selectedCompany.sellerId) ? true : false; },
      isRiseVisionUser: isRiseVisionUser,
      isLoggedIn: isLoggedIn,
      authenticate: redirect? authenticateRedirect : authenticate,
      signOut: signOut,
      refreshProfile: refreshProfile,
      getAccessToken: getAccessToken,
      _restoreState: function (s) {
        angular.extend(_state, s);
        $log.debug("userState restored with", s); }
    };

    window.userState = userState;
    return userState;
  }]);

})(angular);
