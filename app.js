
//////////////////////
// REQUIRED LIBRARIES
//////////////////////
var express = require("express")
,   bodyParser = require("body-parser")
,   request = require("request-promise")
,   fs = require("fs")
,   xmljs = require("xml-js");

var namesDB = JSON.parse(fs.readFileSync("private/steamdb.json", { encoding: "utf-8"}));

///////////////////////
// INITIALIZE SETTINGS
///////////////////////
var app = express();
app.set("view engine", "ejs");
app.use(bodyParser({ extended: true}));
app.use(express.static("public"));

///////////////////////
// DATABASE CONNECTION
///////////////////////



//////////
// ROUTES
//////////

app.get("/", function(req, res){
    res.render("home")
})

app.get("/randomize", getRandomize);


////////////////
// START SERVER
////////////////
app.listen(3000, function(){
    console.log("Steam Randomizer is UP and RUNNING!")
});


///////////////
// UTILITIES
///////////////

var utils = {

    ignoreWords: [" beta", " test", " obsolete", " trial", " demo", " free"],
    
    validateName: function(name){
        name = name.toLowerCase();
        this.ignoreWords.forEach(function(word){
            if(name.includes(word))
                return false;
        });

        return true;
    },
};

///////////////////////////
///Randomize Page Functions
///////////////////////////
function getRandomize(req, res){
    getRandomizeAsync(req,res);
}

async function getRandomizeAsync(req, res)
{
    if (req.query.id === undefined) {
        res.send("Empty queries not allowed.")
        return;
    }

    var userID = req.query.id;

    //Validate ID 
    //then, Request game list from steamAPI
    //then, render page

    try
    {
        let ID = await validateID(userID);
        if(ID !== null)
        {
            let gameList = await requestGamesList(ID);
            res.render("randomize", { data: gameList });    
        }
        else
        {
            res.send("<h1>Invalid ID or URL. Please check your input and try again</h1>");
        }
    }
    catch(err)
    {
        res.send("<h1>Error<h1><br>" + err);
    }
}

async function validateID(userID) {

    //Is URL with ID64 in it
    var id64UrlPattern = /^\S*steamcommunity.com?\/profiles\/(\d{16,18})\/?.*$/;
    if(id64UrlPattern.test(userID))
        return id64UrlPattern.exec(userID)["1"];

    //Is id64?
    var id64Pattern = /^\d{ 16, 18}$/;
    if (id64Pattern.test(userID))
        return userID;

    //Probably is custom URL. Try fetching data from xml
    //Is full URL? Extract username from it. If not, assume it's already the username by itself.
    var parsedURL = userID;
    var fullUrlPattern = /^\S+\/steamcommunity.com\/id\/([^\/]+)\/?\S*/;
    if (fullUrlPattern.test(userID)) {
        var results = fullUrlPattern.exec(userID);
        parsedURL = results["1"];
    }

    var xmlProfile = {};

    //Try requesting profile in XML format
    try{
        let finalID = await getIdFromURL(parsedURL);
        return finalID;
    }
    catch(err){
        return null;
    }

    return null;
}

//Obtains a SteamID64 from a custom URL xml
async function getIdFromURL(parsedURL){
    
    var finalURL;
    try{
    await request("http://steamcommunity.com/id/" + parsedURL + "/?xml=1", function (err, response, body) {
        if (!err && response.statusCode == 200) {
            xmlProfile = xmljs.xml2js(body, { compact: true});

            //var steamID64 = xmlProfile.find("steamID64");
            console.log("parsed url: " + parsedURL);
            if(xmlProfile === undefined && xmlProfile.steamID64 === undefined){
                finalURL = null;
                return null;
            }
            else{
                finalURL = xmlProfile.profile.steamID64._text;
                return finalURL;
            }
        }
        else {
            finalURL = null;
            return null;
        }
    });
    }
    catch(err){
        finalURL = null;
        return null;
    }

    return finalURL;
    
}

async function requestGamesList(finalID){
    var gameNames = [];
    await(request("http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=A7D0B730D9B110FE11D87D6BD2975589&steamid=" + finalID + "&format=json", function (error, code, body) 
    {
        if (error) 
        {
            console.log("Error on requesting games list from API");
            return null;
        }  
        try 
        {
            data = JSON.parse(body);

            data.response.games.forEach(function (game)
             {
                if (game.playtime_forever > 1000)
                    return;

                var id = String(game.appid);

                if (namesDB.data[id] !== undefined) 
                {
                    var name = namesDB.data[id];
                    if (utils.validateName(name)) 
                    {
                        gameNames.push(name);
                    }
                }
            });
        }
        catch(err)
        {
            return null;
        }
        return gameNames;
    }));

    gameNames.sort();
    return gameNames;
}