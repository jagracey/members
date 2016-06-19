'use strict';

var config = {
  organization_handle: 'lighthouse-labs',
  //  Number of pages to paginate through. Perhaps one day it'll detect the number of pages...
  pages: 60

  // There are just shy of 1K members.
  // Many of the members have made ZERO attempt at building their profile.
  // As such, a very low bar (by default) must be met for inclusion:
  criteria: {
    min_public_repos: 3,
    // Minimum number of people the user must be following.
    min_following_users: 5,
    set_location: true,
    set_name: true,
    // Very few profiles have a bio set... sad.
    set_bio: false
  }
};

var async = require('async');
var chalk = require('chalk');
var request = require('request');

var github_username = process.argv[2];
var github_token = process.argv[3]
var qualifiedMembers = [];
var github = githubAPI();


if (process.argv.length !== 4){
  console.error( errFormat`Follower script requires two parameters:  "github_username" & "github_token".` );
  process.exit(1);
}


var checkUserCriteria = function(user){
  // Including the criteria of having set user.bio SHOULD be included,
  // but only 15 profiles have set this field vs 163 that meet the other requirements.
  return user.public_repos >= 3 && user.following >= 5 && user.location && user.name;
};


// Splitting up the JSON parser logic is both neater, and more performant,
// as the V8 engine can cannot optimize functions that include try/catch statements.
var safeJSONParse = function safeJSONParse(str){
  try { return JSON.parse(str); }
  catch (e){ return null; };
};



// Generates the list of github URLs to GET.
// Currently memebership reaches 43 pages, but room is left for growth.
var pages = Array
  .apply(null, {length: config.pages})
  .map(Number.call, Number)
  .map(page=>`https://api.github.com/orgs/${ config.organization_handle }/members?page=${page}`);



async.eachLimit(pages, 5, function(page, callback){
  github.get(page, function(err, users, url){
    console.log( chalk.blue.bold('\tProcessing Page:',page) );

    // Send another GET request to check if the user meets basic profile requirements.
    var handles = users.map(user => user.login)  // NOTE: Github Handle is the "login" property.

    async.eachLimit( handles, 50, function(handle, cb){

      github.get(`https://api.github.com/users/${handle}`,function(error, user){
        if ( checkUserCriteria( user ) ){
          qualifiedMembers.push(handle)
          console.log( chalk.green.bold('Including:'), chalk.green(handle) );
        }
        else
          console.log( chalk.red.bold('Excluding:'), chalk.green(handle) );
        cb();
      });

    },function(){
      // Finished processing page.
      callback();
    });

  });
},
function(){
  // Now we've got a list of all the members in the organization that meet our criteria.

  console.log(
    SPACER,
    chalk.white.bold('\n\tQualified Members:') +
      chalk.magenta(
        JSON.stringify(qualifiedMembers,null,2)
        .replace(/^|\n/g,'\n\t')
      ),
    chalk.white.bold('\n\tQualified Members Length: ') +
      chalk.magenta( qualifiedMembers.length ),
    SPACER,
    chalk.gray.bold('\tStarting to follow members.....\n')
  );

  // Time to follow each member.
  async.eachLimit(qualifiedMembers, 200, function(user, callback){
    var url = 'https://api.github.com/user/following/'+user;
    github.put( url,
    function(err, res, url) {
      console.log( chalk.blue(url) );
      setTimeout(callback,1000);
      //callback();
    });
  },
  function(){
  	console.log( SPACER, chalk.bold.yellow( '\tDone following '+qualifiedMembers.length+' organization members!\n\n\n'));
  });

});




// Github API Request Methods
function githubAPI(){
  var reqOpts = {
    headers: {
      'User-Agent': 'request'
    },
    'auth': {
      'user': github_username,
      'pass': github_token
    }
  };

  var reqHandler = function(url, callback){
    return function(error, response, body) {
      if (error || (response && (response.statusCode/100|0) !== 2) )
        console.error( errFormat(error), body ); // Super basic error reporting.
      if (callback)
        callback(error, safeJSONParse(body), url );
    };
  };

  return {
    get:  function githubGet (url, callback){
      request.get(url, reqOpts, reqHandler(url, callback) );
    },
    put: function githubPost(url, callback){
      request.put(url, reqOpts, reqHandler(url, callback) );
    }
  };
};


// Output Coloring
function errFormat(msg){
  return '\n\t' +
    chalk.white.bgRed.bold(' ERROR: ') +
    chalk.red('', msg);
};

const SPACER = chalk.gray('\n\n' + '='.repeat(80) + '\n\n');
