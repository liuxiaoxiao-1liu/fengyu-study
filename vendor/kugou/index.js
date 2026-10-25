// 从 Folia 0.7.21 内置的 KuGouMusicApi（MIT）中抽取的最小运行时：
// 只保留 /register/dev 与 /song/url 两个接口，用账号 token 换音频直链。
// 原项目：https://github.com/MakcRe/KuGouMusicApi （MIT）
const registerDevModule = require('./module/register_dev');
const songUrlModule = require('./module/song_url');
const userPlaylistModule = require('./module/user_playlist');
const playlistTracksModule = require('./module/playlist_track_all');
const playlistTracksAddModule = require('./module/playlist_tracks_add');
const playlistTracksDelModule = require('./module/playlist_tracks_del');
const { createRequest } = require('./util/request');
const { cookieToJson } = require('./util');

function call(moduleFn, params) {
  const cookie = typeof params.cookie === 'string' ? cookieToJson(params.cookie) : params.cookie || {};
  return moduleFn({ ...params, cookie }, createRequest);
}

module.exports = {
  registerDev: (params) => call(registerDevModule, params),
  songUrl: (params) => call(songUrlModule, params),
  userPlaylist: (params) => call(userPlaylistModule, params),
  playlistTracks: (params) => call(playlistTracksModule, params),
  playlistTracksAdd: (params) => call(playlistTracksAddModule, params),
  playlistTracksDel: (params) => call(playlistTracksDelModule, params),
};
