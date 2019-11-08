import Vue from 'vue'
import Vuex from 'vuex'
import peaks from "peaks.js";
import firebase from "firebase/app";
import "firebase/firestore";
import Dexie from "dexie";

Vue.use(Vuex)
export default new Vuex.Store({
    state: {
        user: {},
        status: false,
        audioContext: new AudioContext(),
        sourceNode: Object,
        gainNode: Object,
        leftGainNode: Object,
        rightGainNode: Object,
        channelSplitterNode: Object,
        mergerNode: Object,
        audioElement: Object,
        currentSong: Object,
        p: Object,
        pointATime: 0,
        pointBTime: 0,
        markedPointA: false,
        markedPointB: false,
        drawer: false,
        editMode: false,
        ABLoops: [],
        isLoading: false,
        showSongList: false,
        songSelected: false
    },
    getters: {
        user(state) { return state.user },
        isSignedIn(state) { return state.status },
        audioElement(state) { return state.audioElement },
        audioContext(state) { return state.audioContext },
        currentSong(state) { return state.currentSong },
        p(state) { return state.p },
        pointATime(state) { return state.pointATime },
        pointBTime(state) { return state.pointBTime },
        markedPointA(state) { return state.markedPointA },
        markedPointB(state) { return state.markedPointB },
        drawer(state) { return state.drawer },
        editMode(state) { return state.editMode },
        ABLoops(state) { return state.ABLoops },
        isLoading(state) { return state.isLoading },
        showSongList(state) { return state.showSongList },
        songSelected(state) { return state.songSelected },
        sourceNode(state) { return state.sourceNode },
    },
    mutations: {
        onAuthStateChanged(state, user) {
            state.user = user; //firebaseが返したユーザー情報
        },
        onUserStatusChanged(state, status) {
            state.status = status; //ログインしてるかどうか true or false
        },
        setPointATime(state, time) {
            state.pointATime = time;
        },
        setPointBTime(state, time) {
            state.pointBTime = time;
        },
        toggleMarkedPointA(state) {
            state.markedPointA = !state.markedPointA;
        },
        toggleMarkedPointB(state) {
            state.markedPointB = !state.markedPointB;
        },
        changeEditMode(state, mode) {
            state.editMode = mode;
        },
        toggleDrawer(state) {
            state.drawer = !state.drawer;
        },
        setAudioElement(state, audioElement) {
            state.audioElement = audioElement;
        },
        toggleLoading(state, bool) {
            state.isLoading = bool;
        },
        toggleSongList(state, bool) {
            state.showSongList = bool;
        },
        toggleSongSelected(state, bool) {
            state.songSelected = bool;
        },
        setCurrentSong(state, song) {
            state.currentSong = song;
        },
        setAudioContext(state, audioContext) {
            state.audioContext = audioContext;
        },
        setSourceNode(state, sourceNode) {
            state.sourceNode = sourceNode;
        },
        setGainNode(state, { gainNode, type }) {
            switch (type) {
                case 'center':
                    state.gainNode = gainNode;
                    break;
                case 'right':
                    state.rightGainNode = gainNode;
                    break;
                case 'left':
                    state.leftGainNode = gainNode;
                    break;
            }
        },
        setGainValue(state, { val, type }) {
            switch (type) {
                case 'center':
                    state.gainNode.gain.value = val;
                    break;
                case 'right':
                    state.rightGainNode.gain.value = val;
                    break;
                case 'left':
                    state.leftGainNode.gain.value = val;
                    break;
            }
        },
        setSplitterNode(state, splitterNode) {
            state.channelSplitterNode = splitterNode;
        },
        setMergerNode(state, mergerNode) {
            state.mergerNode = mergerNode;
        },
        setP(state, p) {
            state.p = p;
        }
    },
    actions: {
        initializeP(context, options) {
            context.commit("setP", peaks.init(options));
            var p = context.state.p;
            p.zoom.setZoom(2)
            var audioContext = context.state.audioContext;
            var source = audioContext.createMediaElementSource(p.player._mediaElement)
            var gainNode = audioContext.createGain();
            var leftGainNode = audioContext.createGain();
            var rightGainNode = audioContext.createGain();
            var splitterNode = audioContext.createChannelSplitter(2);
            var mergerNode = audioContext.createChannelMerger(2);

            context.commit("setSourceNode", source);
            context.commit("setGainNode", { gainNode: gainNode, type: 'center' });
            context.commit("setGainNode", { gainNode: leftGainNode, type: 'left' });
            context.commit("setGainNode", { gainNode: rightGainNode, type: 'right' });
            context.commit("setSplitterNode", splitterNode);
            context.commit("setMergerNode", mergerNode);

            source.connect(gainNode);
            gainNode.connect(splitterNode);
            splitterNode.connect(leftGainNode, 0);
            splitterNode.connect(rightGainNode, 1);
            leftGainNode.connect(mergerNode, 0, 0);
            rightGainNode.connect(mergerNode, 0, 1);
            mergerNode.connect(audioContext.destination);
        },
        playLoop(context, loop) {
            const p = context.state.p;
            const segment = p.segments.getSegment(loop.id);
            context.commit("setPointATime", segment.startTime);
            context.commit("setPointBTime", segment.endTime);
            p.player.seek(segment.startTime);
        },
        deleteABLoop(context, loop) {
            const p = context.state.p;
            p.segments.removeById(loop.id);
            context.state.ABLoops = p.segments.getSegments();
            context.commit("setPointATime", 0);
            context.commit("setPointBTime", 0);
        },
        addABLoop(context, labelText) {
            const segment = {
                startTime: context.state.pointATime,
                endTime: context.state.pointBTime,
                labelText: labelText,
                editable: true
            };
            const p = context.state.p;
            p.segments.add(segment);
            context.state.ABLoops = p.segments.getSegments();
            p.points.removeAll();
        },
        setSource(context, path) {
            context.commit("toggleLoading", true);
            var audioContext = context.state.audioContext;
            var storageRef = firebase.storage().ref();
            storageRef.child(path).getDownloadURL().then(function (url) {
                var request = new XMLHttpRequest();
                request.open('GET', url, true);
                request.responseType = 'blob';
                request.onload = function () {
                    var reader = new FileReader();
                    reader.readAsDataURL(request.response);
                    reader.onload = function (e) {
                        var dataURL = e.target.result;
                        var options = {
                            mediaUrl: dataURL,
                            webAudio: {
                                audioContext: audioContext
                            },
                        };
                        context.state.p.setSource(options, async function (error) {
                            context.commit("toggleLoading", false)
                            if (!context.state.songSelected) {
                                context.commit("toggleSongSelected", true);
                            }
                            const indexedDB = new Dexie('audioDB');
                            indexedDB.version(1).stores({
                                audioFiles: 'id, dataURL'
                            });
                            indexedDB.audioFiles.delete(0).then(async function () {
                                await indexedDB.audioFiles.add({
                                    id: 0,
                                    dataURL: dataURL
                                });
                            });
                        });
                    };
                };
                request.send();
            });
        },
        changePlaybackRate(context, rate) {
            context.state.p.player._mediaElement.playbackRate = rate;
        },
    }
});