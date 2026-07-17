/**
 * War Roguelike — shared app context (mutable session state).
 */
(function (global) {
    "use strict";

    global.WarCtx = {
        state: null,
        battle: null,
        battleRaf: null,
        lastFrame: 0,
        logAccum: 0,
        battleSpeed: 1,
        pendingEncounter: null,
        pendingRewardType: "artifact",
        pendingRewardSource: null,
        rewardRefreshLeft: 0,
        currentRewardOffers: [],
        currentEvent: null,
        battleEnded: false,
        prepDragIndex: -1,
        prepPointerId: null,
        contractTickedForNode: null,
        combatContractPending: false,
        $(id) {
            return document.getElementById(id);
        }
    };
})(typeof window !== "undefined" ? window : globalThis);
