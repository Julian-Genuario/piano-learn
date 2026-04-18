import pytest
from pianolearn.song_library import SongLibrary


@pytest.fixture
def library(tmp_path):
    lib = SongLibrary(songs_dir=str(tmp_path))
    midi_file = tmp_path / "test_song.mid"
    midi_file.write_bytes(b"MThd" + b"\x00" * 50)
    return lib


def test_list_songs(library):
    songs = library.list_songs()
    assert len(songs) == 1
    assert songs[0]["name"] == "test_song"
    assert songs[0]["filename"] == "test_song.mid"


def test_get_song(library):
    song = library.get_song("test_song")
    assert song is not None
    assert song["name"] == "test_song"


def test_get_song_not_found(library):
    assert library.get_song("nonexistent") is None


def test_delete_song(library):
    assert library.delete_song("test_song") is True
    assert library.list_songs() == []


def test_save_song(library):
    library.save_song("new_song.mid", b"MThd" + b"\x00" * 50)
    songs = library.list_songs()
    names = [s["name"] for s in songs]
    assert "new_song" in names
