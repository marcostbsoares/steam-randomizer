$(".hint").popover();

$(".hint").click(function(){
    $(this).popover();
})

$("#gauntlet_down_arrow").click(toggleAchievDiv);
$("#gauntlet_div").hide(1);

function toggleAchievDiv(){
    $("#gauntlet_div").slideToggle(500, function(obj){
        $("#gauntlet_down_arrow").toggleClass("flip_vertical")
    });
}