// ==UserScript==
// @name        yt-playlist-reverse
// @namespace   https://github.com/mkalinski
// @version     1.1.1
// @description Reverses the order of youtube playlist traversal.
// @match       https://www.youtube.com/*
// @grant       GM_getValue
// @grant       GM_setValue
// @grant       GM_deleteValue
// @grant       GM_addValueChangeListener
// @grant       GM_registerMenuCommand
// @grant       GM_unregisterMenuCommand
// @run-at      document-end
// @inject-into auto
// @noframes
// @homepageURL https://github.com/mkalinski/userscript-yt-playlist-reverse
// ==/UserScript==
(() => {
    "use strict";

    const ACTIVATE_CAPTION = "Activate reverse playlist traversal";
    const DEACTIVATE_CAPTION = "Deactivate reverse playlist traversal";
    const AUTO_LISTS_STORAGE_KEY = "autoReversePlaylists";
    const AUTO_LISTS_ADD_CAPTION = "Enable auto reversal of this playlist";
    const AUTO_LISTS_REMOVE_CAPTION = "Disable auto reversal of this playlist";
    const AUTO_LISTS_CLEAR_CAPTION = "Clear remembered auto reversals";
    const VIDEO_ENDING_THRESHOLD_SEC = 1;

    let carryOverActivation = false;
    let currentVideoElement = null;
    let currentVideoId = "";
    let currentPlaylist = "";
    let currentIndex = 0;  // youtube playlist index is 1-based
    let currentActivationCaption = "";
    let currentAutoListCaption = "";
    let currentClearCaption = "";

    let autoReversePlaylists = new Set(
        GM_getValue(AUTO_LISTS_STORAGE_KEY, [])
    );

    function resetClearMenu() {
        if (currentClearCaption) {
            GM_unregisterMenuCommand(AUTO_LISTS_CLEAR_CAPTION);
            currentClearCaption = "";
        }
    }

    function setClearMenu() {
        GM_registerMenuCommand(AUTO_LISTS_CLEAR_CAPTION, clearAutoReverse);
        currentClearCaption = AUTO_LISTS_CLEAR_CAPTION;
    }

    function clearAutoReverse() {
        autoReversePlaylists = new Set();
        setAutoListMenuAdd();
        resetClearMenu();
        GM_deleteValue(AUTO_LISTS_STORAGE_KEY);
    }

    if (autoReversePlaylists.size) {
        setClearMenu();
    }

    function setUp() {
        const urlParams = new URLSearchParams(window.location.search);
        currentVideoElement = document.querySelector("video");
        currentVideoId = urlParams.get("v") || "";
        currentPlaylist = urlParams.get("list") || "";

        if (!(currentVideoId && currentVideoElement && currentPlaylist)) {
            // If current video is empty, then it has to be some invalid page.
            setVideoNotInPlaylist();
            return;
        }

        const newIndexString = urlParams.get("index") || "0";
        const newIndex = Number.parseInt(newIndexString, 10);
        currentIndex = !Number.isNaN(newIndex) ? newIndex : 0;
        setVideoInPlaylist();
    }

    function resetActivationMenu() {
        if (currentActivationCaption) {
            GM_unregisterMenuCommand(currentActivationCaption);
            currentActivationCaption = "";
        }
    }

    function setActivationMenuActivate() {
        resetActivationMenu();
        GM_registerMenuCommand(ACTIVATE_CAPTION, activateReverse);
        currentActivationCaption = ACTIVATE_CAPTION;
    }

    function setActivationMenuDeactivate() {
        resetActivationMenu();
        GM_registerMenuCommand(DEACTIVATE_CAPTION, deactivateReverse);
        currentActivationCaption = DEACTIVATE_CAPTION;
    }

    function resetAutoListMenu() {
        if (currentAutoListCaption) {
            GM_unregisterMenuCommand(currentAutoListCaption);
            currentAutoListCaption = "";
        }
    }

    function setAutoListMenuAdd() {
        resetAutoListMenu();
        GM_registerMenuCommand(AUTO_LISTS_ADD_CAPTION, autoReverse);
        currentAutoListCaption = AUTO_LISTS_ADD_CAPTION;
    }

    function setAutoListMenuRemove() {
        resetAutoListMenu();
        GM_registerMenuCommand(AUTO_LISTS_REMOVE_CAPTION, unAutoReverse);
        currentAutoListCaption = AUTO_LISTS_REMOVE_CAPTION;
    }

    function setVideoNotInPlaylist() {
        currentVideoId = "";
        currentVideoElement = null;
        currentPlaylist = "";
        currentIndex = 0;
        carryOverActivation = false;
        resetActivationMenu();
        resetAutoListMenu();
    }

    function setVideoInPlaylist() {
        if (autoReversePlaylists.has(currentPlaylist)) {
            setAutoListMenuRemove();
            activateReverse();
        } else if (carryOverActivation) {
            setAutoListMenuAdd();
            activateReverse();
            carryOverActivation = false;
        } else {
            setAutoListMenuAdd();
            setActivationMenuActivate();
        }
    }

    function activateReverse() {
        addReverserListener();
        setActivationMenuDeactivate();
    }

    function deactivateReverse() {
        removeReverserListener();
        setActivationMenuActivate();
    }

    function addReverserListener() {
        currentVideoElement.addEventListener("timeupdate", reverser);
    }

    function removeReverserListener() {
        currentVideoElement.removeEventListener("timeupdate", reverser);
    }

    function reverser() {
        if (!isVideoEnding()) {
            return;
        }

        currentVideoElement.pause();
        deactivateReverse();

        if (currentIndex === 0) {
            // Try to find current video in the playlist to get index
            findCurrentIndexByLink();

            if (currentIndex === 0) {
                // This is some error
                return;
            }
        }

        if (currentIndex === 1) {
            // Nowhere to go earlier
            return;
        }

        const previousVideoLink = document.querySelector(
            `a[href*="index=${currentIndex - 1}"]`
        );

        if (!previousVideoLink) {
            // This is some error
            return;
        }

        carryOverActivation = true;
        previousVideoLink.click();
    }

    function isVideoEnding() {
        return currentVideoElement.duration - currentVideoElement.currentTime
            <= VIDEO_ENDING_THRESHOLD_SEC;
    }

    function findCurrentIndexByLink() {
        const currentVideoLinkInPlaylist = document.querySelector(
            `a[href*="v=${currentVideoId}"][href*="list=${currentPlaylist}"]`
        );

        if (!currentVideoLinkInPlaylist) {
            return;
        }

        const currentVideoURL = new URL(currentVideoLinkInPlaylist.href);
        const currentVideoIndex = Number.parseInt(
            currentVideoURL.searchParams.get("index"),
            10
        );

        if (!Number.isNaN(currentVideoIndex)) {
            currentIndex = currentVideoIndex;
        }
    }

    function autoReverse() {
        autoReversePlaylists.add(currentPlaylist);
        setAutoListMenuRemove();
        updateAutoReversePlaylists();
    }

    function unAutoReverse() {
        autoReversePlaylists.delete(currentPlaylist);
        setAutoListMenuAdd();
        updateAutoReversePlaylists();
    }

    function updateAutoReversePlaylists() {
        if (autoReversePlaylists.size) {
            const orderedDump = Array.from(autoReversePlaylists).sort();
            setClearMenu();
            GM_setValue(AUTO_LISTS_STORAGE_KEY, orderedDump);
        } else {
            resetClearMenu();
            GM_deleteValue(AUTO_LISTS_STORAGE_KEY);
        }
    }

    function autoReversePlaylistsChanged(name, oldValue, newValue, remote) {
        if (!remote) {
            return;
        }

        autoReversePlaylists = new Set(newValue || []);

        if (!autoReversePlaylists.size) {
            setAutoListMenuAdd();
            resetClearMenu();
            return;
        }

        setClearMenu();

        if (autoReversePlaylists.has(currentPlaylist)) {
            setAutoListMenuRemove();
        } else {
            setAutoListMenuAdd();
        }
    }

    GM_addValueChangeListener(
        AUTO_LISTS_STORAGE_KEY,
        autoReversePlaylistsChanged
    );
    window.addEventListener("yt-navigate-finish", setUp);
})();
