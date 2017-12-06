
//////////////////////
// REQUIRED LIBRARIES
//////////////////////
var express = require("express")
,   bodyParser = require("body-parser")
,   request = require("request")
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

app.get("/randomize", function(req, res){
    if (req.query.id === undefined)
    {
        res.send("Empty queries not allowed.")
        return;
    }
    
    var userID = req.query.id;
    userID = utils.validateID(userID);
    var data = {};

    //Request game IDs list 
    request("http://api.steampowered.com/IPlayerService/GetOwnedGames/v0001/?key=A7D0B730D9B110FE11D87D6BD2975589&steamid=" + userID + "&format=json", function(error, code, body){
        if(error)
        {
            console.log("Error on requesting games list from API");
            res.send("Error retrieving games list");
            return;
        }

        var gameNames = [];
        try{
        data = JSON.parse(body);
        
        data.response.games.forEach(function (game) {
            if (game.playtime_forever > 1000)
                return;

            var id = String(game.appid);

            if (namesDB.data[id] !== undefined) {
                var name = namesDB.data[id];
                if (utils.validateName(name)) {
                    gameNames.push(name);
                }
            }
        });
        }
        catch(err){
            res.send("NOPE. Invalid ID or some bullshit");
            return;
        }
        
        //res.send(JSON.stringify(gameNames));
        res.render("randomize", { data: gameNames})
    })
});


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

    validateID: function(userID){

        //Is id64?
        var id64pattern = /^\d{ 16, 18}$/;
        if(id64pattern.test(userID))
            return userID;

        var parsedURL = userID;
        //Probably is custom url. Try fetching data from xml
        //Is full URL?
        var fullURLPattern = /^\S+\/steamcommunity.com\/id\/([^\/]+)\/?\S*/;
        if(fullURLPattern.test(userID))
        {
            var results = fullURLPattern.exec(userID);
            parsedURL = results["1"];
        }


        var xmlProfile = {};
        //Request profile in XML format
        request("http://steamcommunity.com/id/" + parsedURL + "/?xml=1", function(err, response, body){
            if(!err && response.statusCode == 200)
            {
                xmlProfile = xmljs.xml2js(body);
                
                //var steamID64 = xmlProfile.find("steamID64");
                console.log("parsed stuff");
                var steamID64 = xmlProfile.elements["0"].elements["0"].elements["0"].text;
            }
            else{
                return null;
            }
        });
    }
};