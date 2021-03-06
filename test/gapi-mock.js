(function (_, $, window, gapiMockData, Mustache, document) {
  "use strict";

  /*global _,gapi,Mustache: false */

  var kvp = document.location.search.substr(1).split("&");
  var real = false;
  var i=kvp.length; var x; while(i--)
  {
      x = kvp[i].split("=");
      if (x[0]==="realGapi" && x[1])
      {
        real = true;
      }
  }

  function setCookie(cname, cvalue, exdays) {
    if(!exdays) {
      exdays = 999;
    }
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + "; " + expires;
  }

  function getCookie(cname) {
    var name = cname + "=";
    var ca = document.cookie.split(";");
    for(var i=0; i<ca.length; i++) {
        var c = ca[i];
        while (c.charAt(0) === " ") { c = c.substring(1); }
        if (c.indexOf(name) !== -1) {
          return c.substring(name.length,c.length);
        }
    }
    return "";
  }


  if(real) {

    //mark as real GAPI (actual GAPI is loaded by common header)

    window.realGapiLoaded = true;
  }
  else {

    window.gapiLoadingStatus = "loaded"; //surpress the loading of real gapi
    window.gapi = {};

    var delayed = function () {
      if(arguments) {
        var cb = arguments[0];
        var restArgs = Array.prototype.slice.call(arguments, 1);
        if(!window.gapi._fakeDb.serverDelay) {
          cb.apply(null, restArgs);
        }
        else {
          setTimeout(function (){
            cb.apply(null, restArgs);
          }, window.gapi._fakeDb.serverDelay);
        }
      }
    };

    var guid = (function() {
      function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
      }
      return function() {
        return s4() + s4() + "-" + s4() + "-" + s4() + "-" +
               s4() + "-" + s4() + s4() + s4();
      };
    })();

    var getCurrentUsername = function () {
      if(gapi.auth.getToken()) {
        return fakeDb.tokenMap[gapi.auth.getToken().access_token];
      }
      else {
        return null;
      }
    };

    var getCurrentUser = function () {
      var currentUsername = getCurrentUsername();

      if(currentUsername) {
        return _.find(fakeDb.users, function (user) {
          return currentUsername === user.username;
        });
      }
      else {
        return null;
      }

    };

    var fakeDb;

    window.gapi.resetDb = function () {
      if(!window.gapi._fakeDb) {
        fakeDb = window.gapi._fakeDb = {serverDelay: 0};
      }
      fakeDb.companies = _.cloneDeep(gapiMockData.companies);
      fakeDb.accounts = _.cloneDeep(gapiMockData.accounts);
      fakeDb.oauthAccounts = _.cloneDeep(gapiMockData.oauthAccounts);

      fakeDb.users = _.cloneDeep(gapiMockData.users);
      fakeDb.systemMessages = _.cloneDeep(systemMessages);
      fakeDb.tokenMap = {};
    };

    window.gapi.resetUsers = function () {
      window.gapi._fakeDb.users = _.cloneDeep(gapiMockData.users);
    };

    window.gapi.resetAccounts = function () {
      fakeDb.accounts = _.cloneDeep(gapiMockData.accounts);
    };

    window.gapi.clearAccounts = function () {
      fakeDb.accounts = [];
    };

    window.gapi.resetCompanies = function () {
      window.gapi._fakeDb.companies = _.cloneDeep(gapiMockData.companies);
    };

    window.gapi.clearCompanies = function () {
      while(fakeDb.companies.length > 0) {
        fakeDb.companies.pop();
      }
    };

    window.gapi.clearUsers = function () {
      window.gapi._fakeDb.users = [];
    };

    window.gapi.resetSystemMessages = function () {
      window.gapi._fakeDb.systemMessages = _.cloneDeep(systemMessages);
    };

    window.gapi.clearSystemMessages = function () {
      window.gapi._fakeDb.systemMessages = [];
    };

    window.gapi.setPendingSignInUser = function (username) {
      window.gapi._pendingUser = username;
    };

    var resp = function (item) {
      var copyOfitem = _.cloneDeep(item);
      return {
        "result": {item: copyOfitem},
        "code": 200,
        "message": "OK",
        "item": copyOfitem,
        "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/-QiBW2KeCQy_zrNjQ2_iN6pdhkg\""
      };
    };

    var respList = function (items) {
      var copyOfItems = _.cloneDeep(items);
      return {
        "result": {items: copyOfItems},
        "code": 200,
        "message": "OK",
        "items": copyOfItems,
        "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/-QiBW2KeCQy_zrNjQ2_iN6pdhkg\""
      };
    };

    var systemMessages = gapiMockData.systemMessages;

   if(localStorage.getItem("fakeGoogleDb")) {
     fakeDb = window.gapi._fakeDb = JSON.parse(localStorage.getItem("fakeGoogleDb"));
   }
   else {
     window.gapi.resetDb();
   }

    gapi.client = {
      load: function(path, version, cb) {
        delayed(cb);
      },
      rise: {
        account: {
          add: function () {
            return {
              execute: function (cb) {
                var username = getCurrentUsername();
                var existingAccount = _.findWhere(fakeDb.accounts, {username: username});
                if(!existingAccount) {
                  //200 success
                  fakeDb.accounts.push({
                    username: username,
                    changeDate: new Date().toISOString(),
                    changedBy: "bloosbrock@gmail.com"
                  });

                  var companyId = guid();
                  fakeDb.companies.push({
                    name: username + "'s Company'",
                    id: companyId,
                    changeDate: new Date().toISOString(),
                    changedBy: "bloosbrock@gmail.com"
                  });

                  var existingUser = _.findWhere(fakeDb.users, {username: username});
                  if(!existingUser) {
                    fakeDb.users.push({
                      username: username,
                      changeDate: new Date().toISOString(),
                      changedBy: "bloosbrock@gmail.com",
                      companyId: companyId
                    });
                  }

                  //200 success
                  delayed(cb, resp({}));
                }
                else {
                  delayed(cb, {
                   "error": {
                    "errors": [
                     {
                      "domain": "global",
                      "reason": "conflict",
                      "message": "User already has an account"
                     }
                    ],
                    "code": 409,
                    "message": "User already has an account"
                   }
                  });
                }
              }
            };
          },
          agreeToTerms: function () {
            return {
              execute: function (cb) {
                var username = getCurrentUsername();
                var user = _.findWhere(fakeDb.users, {username: username});
                if(!user.termsAcceptanceDate) {
                  user.termsAcceptanceDate = new Date().toISOString();
                  delayed(cb, resp({}));
                }
                else {
                  delayed(cb, {
                   "error": {
                    "errors": [
                     {
                      "domain": "global",
                      "reason": "conflict",
                      "message": "User has already accepted the terms"
                     }
                    ],
                    "code": 409,
                    "message": "User has already accepted the terms"
                   }
                 });
                }
              }
            };
          }
        },
        company: {
          get: function (obj) {
            return {
              execute: function (cb) {
                var company;
                obj = obj || {};
                if(gapi.auth.getToken()) {
                  if(obj.id) {
                    company = _.findWhere(fakeDb.companies, obj);
                  }
                  else if (getCurrentUser().companyId){
                    company =
                    _.findWhere(fakeDb.companies, {id: getCurrentUser().companyId});
                  }
                  if(!company){
                    delayed(cb, {
                      "result": false,
                      "code": 404,
                      "message": "NOT FOUND"
                    });
                  } else {
                    delayed(cb, {
                      "result": true,
                      "code": 200,
                      "message": "OK",
                      "item": _.extend(_.cloneDeep(gapiMockData.companyRespSkeleton), company),
                    "kind": "core#companyItem",
                    "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/B1RYG_QUBrbTcuW6r700m7wrgBU\""
                    });
                  }
                }
                else {
                  delayed(cb, {
                    "result": false,
                    "code": 401,
                    "message": "NOT LOGGED IN"
                  });
                }
              }
            };
          }
        }
      },
      core: {
        systemmessage: {
          list: function (obj) {
            obj = obj || {};
            return {
              execute : function (cb) {
                if(obj.companyId) {
                  delayed(cb, _.cloneDeep(window.gapi._fakeDb.systemMessages));
                }
              }
            };
          }
        },
        company: {
          get: function (obj) {
            return {
              execute: function (cb) {
                var company;
                obj = obj || {};
                if(gapi.auth.getToken()) {
                  if(obj.id) {
                    company = _.findWhere(fakeDb.companies, obj);
                  }
                  else if (getCurrentUser().companyId){
                    company =
                    _.findWhere(fakeDb.companies, {id: getCurrentUser().companyId});
                  }
                  if(!company){
                    delayed(cb, {
                      "result": false,
                      "code": 404,
                      "message": "NOT FOUND"
                    });
                  } else {
                    delayed(cb, {
                      "result": true,
                      "code": 200,
                      "message": "OK",
                      "item": _.extend(_.cloneDeep(gapiMockData.companyRespSkeleton), company),
                    "kind": "core#companyItem",
                    "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/B1RYG_QUBrbTcuW6r700m7wrgBU\""
                    });
                  }
                }
                else {
                  delayed(cb, {
                    "result": false,
                    "code": 401,
                    "message": "NOT LOGGED IN"
                  });
                }
            }
          };
        },
         lookup: function (obj) {
           return {
             execute: function (cb) {
               var company;
               obj = obj || {};
               if(gapi.auth.getToken()) {
                 if(obj.authKey) {
                   company = _.findWhere(fakeDb.companies, obj);
                 }
                 else if (getCurrentUser().companyId){
                   company =
                   _.findWhere(fakeDb.companies, {id: getCurrentUser().companyId});
                 }
                 if(!company){
                   delayed(cb, {
                     "result": false,
                     "code": 404,
                     "message": "NOT FOUND"
                   });
                 } else {
                   delayed(cb, {
                     "result": true,
                     "code": 200,
                     "message": "OK",
                     "item": _.extend(_.cloneDeep(gapiMockData.companyRespSkeleton), company),
                   "kind": "core#companyItem",
                   "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/B1RYG_QUBrbTcuW6r700m7wrgBU\""
                   });
                 }
               }
               else {
                 delayed(cb, {
                   "result": false,
                   "code": 401,
                   "message": "NOT LOGGED IN"
                 });
               }
           }
         };
       },
        move: function (obj) {
          return {
            execute: function (cb) {
              var company;
              obj = obj || {};
              if(gapi.auth.getToken()) {
                if(obj.authKey) {
                  if(obj.id || obj.authKey) {
                    company = _.findWhere(window.gapi._fakeDb.companies, {authKey: obj.authKey});
                    company.parentId = getCurrentUser().companyId;
                  }
                  if(!company){
                    delayed(cb, {
                      "result": false,
                      "code": 404,
                      "message": "NOT FOUND"
                    });
                  } else {
                    delayed(cb, {
                      "result": true,
                      "code": 200,
                      "message": "OK",
                      "item": _.extend(_.cloneDeep(gapiMockData.companyRespSkeleton), company),
                    "kind": "core#companyItem",
                    "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/B1RYG_QUBrbTcuW6r700m7wrgBU\""
                    });
                  }
                }
                else {
                  delayed(cb, {
                   "error": {
                    "errors": [
                     {
                      "domain": "global",
                      "reason": "required",
                      "message": "Required parameter: authKey",
                      "locationType": "parameter",
                      "location": "authKey"
                     }
                    ],
                    "code": 400,
                    "message": "Required parameter: authKey"
                   }
                 });
                }
              }
              else {
                delayed(cb, {
                  "result": false,
                  "code": 401,
                  "message": "NOT LOGGED IN"
                });
              }
          }
        };
      },
        add: function (fields) {
          return {
            execute: function (cb) {
              var company;
              company = _.cloneDeep(fields);
              company.id = guid();
              window.gapi._fakeDb.companies.push(company);
              console.log("company created", company);
              delayed(cb, {
                "result": true,
                "code": 200,
                "message": "OK",
                "item": company,
              "kind": "core#companyItem",
              "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/B1RYG_QUBrbTcuW6r700m7wrgBU\""
            });
            }
          };
        },
        update: function (obj) {
          return {
            execute: function (cb) {
              var company;
              if(obj.id) {
                company = _.find(window.gapi._fakeDb.companies, function (company) {
                  return company.id === obj.id;
                });
                _.extend(company, obj.data);
              }
              else {
                company = _.cloneDeep(obj.data);
                company.id = guid();
                window.gapi._fakeDb.companies.push(company);
              }
              console.log("company created", company);
              delayed(cb, {
                "result": true,
                "code": 200,
                "message": "OK",
                "item": company,
              "kind": "core#companyItem",
              "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/B1RYG_QUBrbTcuW6r700m7wrgBU\""
            });
            }
          };
        },
        list: function (opt) {
          opt = _.extend({count: 20, cursor: 0}, opt);
          return {
            execute: function (cb) {
              var currentUser = getCurrentUser();
              var parentCompany = _.findWhere(window.gapi._fakeDb.companies, {id: currentUser.companyId});
              var subcompanies = _.where(window.gapi._fakeDb.companies, {parentId: currentUser.companyId});
              var companies = [parentCompany].concat(subcompanies);
              if(opt.search) {
                companies = _.filter(window.gapi._fakeDb.companies,
                  function (company) {
                    return company.name.toLowerCase().indexOf(opt.search.toLowerCase()) >= 0;
                  });
              }

              if(opt.cursor) {
                companies = companies.slice(opt.cursor);
              }
              if(opt.count) {
                companies = companies.slice(0, opt.count);
              }

              return delayed(cb, {
               "result": true,
               "code": 200,
               "message": "OK",
               "cursor": 0,
               "items": companies,
               "kind": "core#company",
               "etag": "\"MH7KOPL7ADNdruowVC6-7YuLjZw/aU3KWpXBGvssoqWVjsHR5ngSZlU\""
              });
            }
          };
        },
        delete: function (obj) {
          return {
            execute: function (cb) {
              if(!obj || !obj.id) {
                delayed(cb, {
                 "error": {
                  "errors": [
                   {
                    "domain": "global",
                    "reason": "required",
                    "message": "Required parameter: id",
                    "locationType": "parameter",
                    "location": "id"
                   }
                  ],
                  "code": 400,
                  "message": "Required parameter: id"
                 }
                });
              }
              else{
                var company = _.findWhere(fakeDb.companies, {id: obj.id});
                if(!company) {
                  delayed(cb, {
                   "error": {
                    "errors": [
                     {
                      "domain": "global",
                      "reason": "notFound",
                      "message": "Company not found."
                     }
                    ],
                    "code": 404,
                    "message": "Company not found."
                   }
                 });
                }
                else {
                  fakeDb.companies = _.without(fakeDb.companies, company);
                  delayed(cb, resp({}));
                }
              }
            }
          };
        }
      },
      user: {
        get: function (obj) {
          return {
            execute: function (cb) {
              obj = obj || {};
              if(gapi.auth.getToken()){
                var user;
                if(obj.username) {
                  user = _.findWhere(fakeDb.users, {username: obj.username});
                }
                else {
                  user =  getCurrentUser();
                }
                if(user) {
                  delayed(cb, resp(user));
                }
                else {
                  delayed(cb, {
                    "result": false,
                    "code": 404,
                    "message": "NOT FOUND"
                  });
                }
              }
              else {
                delayed(cb, {
                  "result": false,
                  "code": 401,
                  "message": "NOT LOGGED IN"
                });
              }
            }
          };
        },
        update: function (obj) {
          return {
            execute: function (cb) {
              if (!obj) {obj = {}; }
              var user;
              if (obj.username) {
                user = _.find(fakeDb.users,
                  function (u) {return obj.username === u.username; });
              }
              else {
                user = getCurrentUser();
              }
              if (user) {
                _.extend(user, JSON.parse(obj.data));
                delayed(cb, resp(user));
              }
              else {
                delayed(cb, {
                  "result": false,
                  "code": 404,
                  "message": "NOT FOUND"
                });
              }
            }
          };
        },
        delete: function (obj) {
          return {
            execute: function (cb) {
              if(!obj || !obj.username) {
                delayed(cb, {
                 "error": {
                  "errors": [
                   {
                    "domain": "global",
                    "reason": "required",
                    "message": "Required parameter: username",
                    "locationType": "parameter",
                    "location": "username"
                   }
                  ],
                  "code": 400,
                  "message": "Required parameter: username"
                 }
                });
              }
              else{
                var user = _.findWhere(fakeDb.users, {username: obj.username});
                if(!user) {
                  delayed(cb, {
                   "error": {
                    "errors": [
                     {
                      "domain": "global",
                      "reason": "notFound",
                      "message": "User not found."
                     }
                    ],
                    "code": 404,
                    "message": "User not found."
                   }
                 });
                }
                else {
                  fakeDb.users = _.without(fakeDb.users, user);
                  delayed(cb, resp({}));
                }
              }
            }
          };
        },
        add: function (obj) {
          return {
            execute: function (cb) {
              if(obj && obj.username || obj.companyId) {
                var existingUser = _.findWhere(fakeDb.users, {username: obj.username});
                if(existingUser) {
                  delayed(cb, {
                    "result": false,
                    "code": 400,
                    "message": "USER ALREADY EXISTS"
                  });
                }
                else {
                  var user = _.extend({
                    username: obj.username,
                    companyId: obj.companyId
                  }, JSON.parse(obj.data));
                  fakeDb.users.push(user);
                  delayed(cb, resp(user));
                }
              }
              else {
                delayed(cb, {
                  "result": false,
                  "code": 400,
                  "message": "USERNAME OR COMPANY ID MISSING"
                });
              }
            }
          };
        },
        list: function (obj) {
          return {
            execute: function (cb) {
              if(!obj) {obj = {}; }
              var users = fakeDb.users;
              if(obj.companyId) {
                users = _.where(users, {companyId: obj.companyId});
              }
              if(obj.search) {
                users = _.filter(users,
                  function (user) {
                    return (user.firstName || "").toLowerCase().indexOf(obj.search.toLowerCase()) >= 0 ||
                    (user.lastName || "").toLowerCase().indexOf(obj.search.toLowerCase()) >= 0 ||
                    user.email.toLowerCase().indexOf(obj.search.toLowerCase()) >= 0;
                  });
              }
              if(obj.count) {
                users = users.slice(0, obj.count);
              }
              delayed(cb, respList(users));
            }
          };
        }
      }
    },
    oauth2: {
      userinfo: {
        get: function() {
          return {
            execute: function(cb) {
              if(gapi.auth.getToken()) {
                var username = getCurrentUsername();
                var oauthAccount = _.findWhere(fakeDb.oauthAccounts, {email: username});
                delayed(cb, oauthAccount);
              }
              else {
                delayed(cb, {
                  "code": 401,
                  "message": "Invalid Credentials",
                  "data": [
                    {
                      "domain": "global",
                      "reason": "authError",
                      "message": "Invalid Credentials",
                      "locationType": "header",
                      "location": "Authorization"
                    }
                  ],
                  "error": {
                    "code": 401,
                    "message": "Invalid Credentials",
                    "data": [
                      {
                        "domain": "global",
                        "reason": "authError",
                        "message": "Invalid Credentials",
                        "locationType": "header",
                        "location": "Authorization"
                      }
                    ]
                  }
                });
              }
            }
          };
        }
      }
    },
    setApiKey: function() {
    },
    tasks: {
      tasks: {
        update: function() {
          return {
            execute: function(cb) {
              delayed(cb, {});
            }
          };
        },
        delete: function() {
          return {
            execute: function(cb) {
              delayed(cb);
            }
          };
        },
        insert: function() {
          return {
            execute: function() {
            }
          };
        },
        list: function() {
          return {
            execute: function(cb) {
              return delayed(cb, {
                "kind": "tasks#tasks",
                "items": [
                {
                  "kind": "tasks#task",
                  "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6Njk1MzUzOTY2OjQ3NTg4MjQyMg",
                  "title": "x1",
                  "updated": "2012-08-10T22:07:22.000Z",
                  "position": "00000000000000410311",
                  "status": "needsAction"
                },
                {
                  "kind": "tasks#task",
                  "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6Njk1MzUzOTY2OjE0ODU0NTE1NDc",
                  "title": "x2",
                  "updated": "2012-08-10T22:07:25.000Z",
                  "position": "00000000000000615467",
                  "status": "needsAction"
                },
                {
                  "kind": "tasks#task",
                  "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6Njk1MzUzOTY2OjgxNTQ5MTA3Nw",
                  "title": "x3",
                  "updated": "2012-08-12T14:30:49.000Z",
                  "position": "00000000000000820623",
                  "status": "completed",
                  "completed": "2012-08-12T14:30:49.000Z"
                }
                ],
                "result": {
                  "kind": "tasks#tasks",
                  "items": [
                  {
                    "kind": "tasks#task",
                    "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6Njk1MzUzOTY2OjQ3NTg4MjQyMg",
                    "title": "x1",
                    "updated": "2012-08-10T22:07:22.000Z",
                    "position": "00000000000000410311",
                    "status": "needsAction"
                  },
                  {
                    "kind": "tasks#task",
                    "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6Njk1MzUzOTY2OjE0ODU0NTE1NDc",
                    "title": "x2",
                    "updated": "2012-08-10T22:07:25.000Z",
                    "position": "00000000000000615467",
                    "status": "needsAction"
                  },
                  {
                    "kind": "tasks#task",
                    "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6Njk1MzUzOTY2OjgxNTQ5MTA3Nw",
                    "title": "x3",
                    "updated": "2012-08-12T14:30:49.000Z",
                    "position": "00000000000000820623",
                    "status": "completed",
                    "completed": "2012-08-12T14:30:49.000Z"
                  }
                  ]
                }
              });
            }
          };
        }
      },
      tasklists: {
        update: function() {
          return {
            execute: function(cb) {
              delayed(cb, {});
            }
          };
        },
        delete: function() {
          return {
            execute: function(cb) {
              delayed(cb, {});
            }
          };
        },
        insert: function() {
          return {
            execute: function(cb) {
              // Used for the 'Creating a list' test
              delayed(cb, {
                "id": "1",
                "kind": "tasks#taskList",
                "title": "Example list",
                "updated": "2013-01-14T13:58:48.000Z"
              });
            }
          };
        },
        list: function(options) {

          options = options || {};


          return {
            execute: function(cb) {
              delayed(cb, {
                "kind": "tasks#taskLists",
                "items": [
                {
                  "kind": "tasks#taskList",
                  "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6MDow",
                  "title": "Default List",
                  "updated": "2012-08-14T13:58:48.000Z",
                },
                {
                  "kind": "tasks#taskList",
                  "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6NDg3ODA5MzA2OjA",
                  "title": "Writing",
                  "updated": "2012-07-22T17:58:19.000Z",
                }
                ],
                "result": {
                  "kind": "tasks#taskLists",
                  "items": [
                  {
                    "kind": "tasks#taskList",
                    "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6MDow",
                    "title": "Default List",
                    "updated": "2012-08-14T13:58:48.000Z",
                  },
                  {
                    "kind": "tasks#taskList",
                    "id": "MDE5MzU2Njg4NDcyNjMxOTE4MzE6NDg3ODA5MzA2OjA",
                    "title": "Writing",
                    "updated": "2012-07-22T17:58:19.000Z",
                  }
                  ]
                }
              });
            }
          };
        }
      }
    }
  };

  var googleAuthDialogTemplate = "<div class=\"modal\">" +
    "<div class=\"modal-dialog\">" +
    "  <div class=\"modal-content\">" +
    "    <div class=\"modal-header\">" +
    "      <button type=\"button\" class=\"close\" data-dismiss=\"modal\">" +
    "<span aria-hidden=\"true\">&times;</span><span class=\"sr-only\">Close</span></button>" +
    "      <h4 class=\"modal-title\">Fake Google Cloud Login</h4>" +
    "    </div>" +
    "    <div class=\"modal-body\">" + "<p>Click one to Sign In, or cancel.</p>" +
    "<ul>{{#accounts}}" + "<li><img src=\"{{picture}}\" style=\"width: 30px; height: 30px; \" />" +
    "<button class=\"login-account-button\" data-username=\"{{email}}\">{{email}}</button></li>" + "{{/accounts}}</ul>" +
    "    </div>" +
    "    <div class=\"modal-footer\">" +
    "      <button type=\"button\" class=\"btn btn-default\" data-dismiss=\"modal\">Cancel</button>" +
    "    </div>" +
    "  </div>" +
    "</div>" +
    "</div>";

  gapi.auth = {
    authorize: function(options, cb) {
      options = options || {};

      var generateToken = function (username) {
        var accessToken = guid();

        //clear existing token from db
        var existingToken;
        _.each(fakeDb.tokenMap, function (v, k) {if (v === username) {existingToken = k; }});
        if(existingToken) {
          delete fakeDb.tokenMap[existingToken];
        }

        fakeDb.tokenMap[accessToken] = username;
        return {
          "state": "",
          "access_token": accessToken,
          "token_type": "Bearer",
          "expires_in": "3600",
          "scope": "https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile",
          "client_id": "614513768474.apps.googleusercontent.com",
          "g_user_cookie_policy": "http://localhost:8099",
          "cookie_policy": "http://localhost:8099",
          "response_type": "token",
          "issued_at": "1408530459",
          "expires_at": "1408534059",
          "g-oauth-window": {},
          "status": {
            "google_logged_in": true,
            "signed_in": true,
            "method": "PROMPT"
          }
        };
      };

      if(!options.immediate) {
        var modalStr = Mustache.render(googleAuthDialogTemplate, {accounts: fakeDb.oauthAccounts});

        var tokenResult;

          var signInAs = function (username, next) {
            tokenResult = generateToken(username);
            next(function () {
              if(!tokenResult) {
                delayed(cb, {error: "User cancelled login."});
              }
              else {
                gapi.auth.setToken(tokenResult);
                delayed(cb, tokenResult);
              }
            });
          };

          if(window.gapi._pendingUser) {
            signInAs(window.gapi._pendingUser, function(cb1) {
              cb1();
            });
            delete window.gapi._pendingUser;
          }
          else {
            var modal = $(modalStr).modal({
              show: false, backdrop: "static"});
            var returnResultCb;
            modal.find(".login-account-button").on("click", function (e) {
              var username = $(e.target).data("username");
              signInAs(username, function (fn) {
                returnResultCb = fn;
              });

              modal.modal("hide");
            });
            modal.on("hidden.bs.modal", function () {
              //destroy modal
              $(this).data("bs.modal", null);
              modal.remove();
              returnResultCb();
            });
            modal.modal("show");
          }


      }
      else {
        delayed(cb, gapi.auth.getToken());
      }
    },
    signOut: function (cb) {
      this.setToken(null);
      if(cb) {
        delayed(cb);
      }
    },
    setToken: function (token) {
      if(token) {
        setCookie("gapi-mock-auth-token", JSON.stringify(token));
      }
    },
    getToken: function () {
      var tokenStr = getCookie("gapi-mock-auth-token");
      if(tokenStr) {
        return JSON.parse(tokenStr);
      }
      else {
        return null;
      }
    }
  };

  window.handleClientJSLoad();
  }


})(_, $, window, window.gapiMockData, Mustache, document);
