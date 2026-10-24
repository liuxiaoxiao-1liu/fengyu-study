import { kugouPlaylists, type KugouPlaylistTrack } from './kugou-playlists';
import { tracks } from './music';

export type PlaylistTrack = KugouPlaylistTrack;
export type Playlist = {
  slug: string;
  name: string;
  count: number;
  tracks: PlaylistTrack[];
};

const featured: PlaylistTrack[] = tracks
  .filter((track) => track.kugou)
  .map((track) => ({
    hash: track.kugou!.hash,
    albumId: track.kugou!.albumId,
    albumAudioId: track.kugou!.albumAudioId,
    title: track.title,
    artist: track.artist,
    duration: track.duration,
  }));

export const playlists: Playlist[] = [
  { slug: 'featured', name: '编辑精选', count: featured.length, tracks: featured },
  ...kugouPlaylists,
];

export function playlistBySlug(slug: string): Playlist | undefined {
  return playlists.find((playlist) => playlist.slug === slug);
}

const trackMap = new Map<string, PlaylistTrack>();
for (const playlist of playlists) {
  for (const track of playlist.tracks) {
    if (!trackMap.has(track.hash)) trackMap.set(track.hash, track);
  }
}

export function trackByHash(hash: string): PlaylistTrack | undefined {
  return trackMap.get(hash);
}
