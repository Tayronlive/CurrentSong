const {Cu} = require("chrome");
const {TextDecoder, TextEncoder, OS} = Cu.import("resource://gre/modules/osfile.jsm", {});

var pageMod = require("sdk/page-mod");
var self = require("sdk/self");
var preferences = require("sdk/simple-prefs").prefs;
var notifications = require("sdk/notifications");

var worker;


pageMod.PageMod({
    include: [
        "*.pandora.com",
        "*.grooveshark.com",
        "*.play.spotify.com"],
    contentScriptFile: self.data.url("script.js"),
    contentScriptWhen: "ready",
    contentScriptOptions: {
        preferences: preferences
    },
    onAttach: link
});

function link(w) {
    worker = w;
    worker.port.on("songUpdate", function(songInfo) {
        console.log("EVENT RECEIVED: songUpdate");
        saveData(songInfo);

        if (preferences.notify) {
            notifySong(songInfo);
        }
    });
}

function saveData(songInfo) {
    // stop if preferences.saveFolder is not set
    if (!preferences.saveFolder) {
        worker.port.emit("alert", "CurrentSong error: 'Folder' option is not set.\n\n" +
                                    "Go to the Add-ons Manager, find CurrentSong in the extensions list,\n" +
                                    "click the Preferences button and set the 'Folder' option.");
        return;
    }

    let textFile = preferences.saveFolder + "/song.txt";
    let xmlFile = preferences.saveFolder + "/song.xml";

    let song   = songInfo[0] != null ? songInfo[0] : "";
    let artist = songInfo[1] != null ? songInfo[1] : "";
    let album  = songInfo[2] != null ? songInfo[2] : "";

    let text = preferences.infoFormat;
    if (song.length != 0 || artist.length != 0 || album.length != 0) {
        // text file
        text = text.replace("%song%", song);
        text = text.replace("%artist%", artist);
        text = text.replace("%album%", album);

        let encoder = new TextEncoder();
        let array = encoder.encode(text);
        let promise = OS.File.writeAtomic(textFile, array);

        // xml file
        text = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n\n" +
            "<event>\n" +
                "    <song>" + song + "</song>\n" +
                "    <artist>" + artist + "</artist>\n" +
                "    <album>" + album + "</album>\n" +
            "</event>\n";

        encoder = new TextEncoder();
        array = encoder.encode(text);
        promise = OS.File.writeAtomic(xmlFile, array);
    }
}

function notifySong(songInfo) {
    let song   = songInfo[0] != null ? songInfo[0] : "";
    let artist = songInfo[1] != null ? songInfo[1] : "";
    let album  = songInfo[2] != null ? songInfo[2] : "";

    let text = "";
    if (artist.length > 0) text += "by " + artist + "\n";
    if (album.length > 0) text += "in " + album;

    notifications.notify({
        title: song,
        text: text
    });
}

function endsWith(str, suffix) {
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}