var randomPhrases = [
    "Spinning the Wheel of Fish",
    "Choosing your destiny",
    "Determining your fate",
    "Deciding your future",
    "Calculating optimal fun factor",
    "Selecting a special surprise",
    "Picking a perfect passtime",
]


setTimeout(function(){
    var storedGameName = $("#gameName").text();
    var randomPhrase = randomPhrases[Math.floor(Math.random() * randomPhrases.length)];
    
    $("#gameName").text("..." + randomPhrase + "...");
    $("#gameName").addClass("show");

    setTimeout(function () {
        $("#gameName").removeClass("show");

        setTimeout(function () {
            $("#gameName").text(storedGameName);
            $("#gameName").addClass("show");
        }, 1000);
    }, 1000);

}, 1000);

