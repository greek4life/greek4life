const window_hash = window.location.hash
.substring(1)
.split('&')
.reduce(function (initial, item) {
  if (item) {
    let parts = item.split('=');
    initial[parts[0]] = decodeURIComponent(parts[1]);
  }
  return initial;
}, {});
window.location.hash = '';

let _token = window_hash.access_token;
const authEndpoint = 'https://accounts.spotify.com/authorize';

// Our app's client ID, redirect URI and desired scopes
const clientId = '0244dbc6e09c4ca1b3d6f7f6f80497ab'; // Your client id
const redirectUri = 'http://localhost:3000/search_by_bpm.html'; // Your redirect uri
const scopes = [
  'streaming',
  'user-read-birthdate',
  'user-read-email',
  'user-read-private',
  'playlist-modify-public',
  'user-modify-playback-state'
];

if (!_token) {
  window.location = `${authEndpoint}?client_id=${clientId}&redirect_uri=${redirectUri}&scope=${scopes.join('%20')}&response_type=token`;
}

// Page setup
let deviceId;
let playbackSetting;
setPlaybackSetting(1);
genreLimitAlert("off");

// Initialise Web Playback SDK
function onSpotifyPlayerAPIReady() {

  let player = new Spotify.Player({
    name: 'User',
    getOAuthToken: function(cb) {
      cb(_token)
    },
    volume: 0.8
  });

  player.on('ready', function(data) {
    deviceId = data.device_id;
    localStorage.setItem('browserDeviceID', data.device_id);
  });

  player.on('player_state_changed', function(data) {
    console.log('entered player_state_changed');
    if(data) {
      console.log('about to update currently playing song');
      let currentTrack = data.track_window.current_track.uri;
      updateCurrentlyPlaying(currentTrack);
    }
  });

  console.log('connecting player');
  player.connect();
}

function setPlaybackSetting(setting) {
  playbackSetting = setting;

  if (setting == 0) {
    deviceId = null;
    pause();
    $('#current-playback').text('None');
    $('.track-element').removeClass('current-track');
  } else if (setting == 1) {
    setDevice(localStorage.getItem('browserDeviceID'));
    $('#current-playback').text('In Browser');
  }
}

function setDevice(id, name) {
  deviceId = id;
  $('#current-playback').text(name);
  $.post('/transfer?device_id=' + deviceId + '&token=' + _token);
}

function genreLimitAlert(state) {
  if(state == "on") {
    $('#genreLimitAlert').show();
  } else {
    $('#genreLimitAlert').hide();
  }
}

function getGenresList() {
  const genresToDisplay = [
    'chicago-house',
    'chill',
    'club',
    'dance',
    'deep-house',
    'detroit-techno',
    'disco',
    'drum-and-bass',
    'dub',
    'dubstep',
    'edm',
    'electro',
    'electronic',
    'hardcore',
    'hardstyle',
    'house',
    'minimal-techno',
    'party',
    'techno',
    'trance'
  ];

  $('#genres-list').empty();
  $.get('/genres?token=' + _token, function(genres) {
    genres.forEach(function(genre) {
      if ($.inArray(genre, genresToDisplay) !== -1) {
        let genreButtonElement = '<label class="btn btn-salmon btn-sm" id="genre-button"><input type="checkbox" value="' + genre + '">' + genre + '</label>';
        $('#genres-list').append(genreButtonElement);
      }
    });
  });

  $('#genres-list').on('change', 'input', function() {
    if($('#genres-list input:checked').length > 5) {
      $(this).parent().removeClass("active");
      this.checked = false;
      genreLimitAlert("on");
    }
    else {
      genreLimitAlert("off");
    }
  });
}

function updateGenres() {
  // Get selected genres
  let genres = [];
  $('#genres-list input:checked').each(function() {
    genres.push($(this).val());
  });

  $('#current-genres').empty();
  genres.forEach((genre) => {
    let genreElement = '<p id="curGenre">' + genre + '</p>';
    $('#current-genres').append(genreElement);
    console.log('genreElement: ');
    console.log(genreElement);
  });

  let genresString = genres.join();
  localStorage.setItem('currentGenres', genresString);

  const genresId = document.getElementById('genres');
  const currentGenres = genresId.getElementsByTagName('span');
  console.log('currentGenres: ' + currentGenres[0].innerHTML);

  $('#tracks').empty();
  $('#hoverDirections').empty();
  if (targetTempo.value === '') {
    $('#tracks').append('<h2>Please enter a BPM value. Then, click Search.</h2>')
  } else if ((currentGenres[0].innerHTML !== '') && (targetTempo.value >= 40 && targetTempo.value <= 200)) {
    $('#tracks').append('<h2>Now, click Search.</h2>')
  }
}

function getRecommendations() {
  // Get selected genres
  let genresString = localStorage.getItem('currentGenres');
  
  requestURL = '/recommendations?seed_genres=' + genresString + '&target_tempo=' + $('#targetTempo').val() + '&token=' + _token;
  console.log('requestURL: ' + requestURL);

  $.ajax({
    url: requestURL,
    type: 'GET',
    dataType: 'json',
    success: (data) => {
      console.log('You received some data!', data);
      const genres = document.getElementById('genres');
      const currentGenres = genres.getElementsByTagName('span');
      const targetTempo = document.getElementById('targetTempo');
      console.log('currentGenres: ' + currentGenres[0].innerHTML);
      console.log('targetTempo: ' + targetTempo.value);

      $('#tracks').empty();
      $('#hoverDirections').empty();
      let trackIds = [];
      let trackUris = [];
      if(data.tracks && (currentGenres[0].innerHTML !== '') && (targetTempo.value >= 40 && targetTempo.value <= 200)) {
        if(data.tracks.length > 0) {
          $('#hoverDirections').text("Here are some song recommendations. Hover over a song's album art to see its audio features.");
          data.tracks.forEach(function(track) {
            trackIds.push(track.id);
            trackUris.push(track.uri);
          });
          localStorage.setItem('currentTracks', trackUris.join());
          renderTracks(trackIds);
        } else {
          $('#tracks').append('<h2>No results. Try a broader search.</h2>')
        }
      } else if (currentGenres[0].innerHTML === '' && (targetTempo.value >= 40 && targetTempo.value <= 200)) {
        $('#tracks').append('<h2>No results. Please enter genres first.</h2>')
      } else if (targetTempo.value !== '' && (targetTempo.value < 40 || targetTempo.value > 200)) {
        $('#tracks').append('<h2>No results. Please enter a valid BPM value first.</h2>')
      } else {
        $('#tracks').append('<h2>No results. Please enter a BPM value first.</h2>')
      }
    },
  });
}

//updated code in client_search_by_bpm.js
function renderTracks(ids) {
  $.get('/tracks?ids=' + ids.join() + '&token=' + _token, function(tracks) {
    tracks.forEach(function(track) {
      $.get('/track?trackID=' + track.uri.substring(14) + '&token=' + _token, function(trackDetails) {
        let image = track.album.images ? track.album.images[0].url : 'https://upload.wikimedia.org/wikipedia/commons/3/3c/No-album-art.png';
        let trackElement = '<div class="track-element" id="' + track.uri + '"><div><img class="remove-icon" src="../images/remove-icon.png" onclick="remove(\'' + track.uri + '\');"/><div class="img_wrap"><img class="album-art" src="' + image + '"/><ul class="img_description"><p id="tempo_hidden">BPM: ' + trackDetails.tempo + '</p><p id="key_hidden">Key: ' + trackDetails.key + '</p><p id="energy_hidden">Energy: ' + trackDetails.energy + '</p><p id="danceability_hidden">Danceability: ' + trackDetails.danceability + '</p></ul></div><div><p id="track-name">' + track.name + '</p><p id="artist-name">' + track.artists[0].name + '</p></div></div><ul style="list-style: none;"><li><div class="icon_wrap"><img class="play-icon" src="images/play.png" onclick="play(\'' + track.uri + '\');"/><ul class="icon_description" onclick="play(\'' + track.uri + '\');"><p id="play_hidden">Play</p></ul></div></li><li><div class="icon_wrap"><img class="save-song-icon" src="images/save-song.png" onclick="saveSong(\'' + track.uri + '\');"/><ul class="icon_description" onclick="saveSong(\'' + track.uri + '\');"><p id="save_hidden">Save</p></ul></div></li></ul></div></div>';
        $('#tracks').append(trackElement);
        console.log('track.uri: ' + track.uri);
        console.log('trackDetails: ');
        console.log(trackDetails);
      });
    });
  });
}

function saveSong(track) {
  const savedSongsList = localStorage.getItem('savedSongs') ? localStorage.getItem('savedSongs').split(',') : [];
  console.log('savedSongs before addition: ' + savedSongsList);
  console.log(typeof savedSongsList);
  console.log('track: ' + track);

  let trackID = track.substring(14);
  console.log('trackID: ' + trackID);

  let alreadySaved = false;

  for (index in savedSongsList) {
    if (trackID == savedSongsList[index]) {
      alreadySaved = true;
    }
  }

  if (alreadySaved) {
    alert("This song has already been saved to your profile.");
  } else {
    savedSongsList.push(trackID);
    alert("Song added to your profile!");
    localStorage.setItem('savedSongs', savedSongsList);
  }

  console.log('savedSongs after addition: ' + savedSongsList);
}

function hasClass(element, cls) {
    return (' ' + element.className + ' ').indexOf(' ' + cls + ' ') > -1;
}

function updateCurrentlyPlaying(track) {
  let trackElement = document.getElementById(track);
  $('.track-element').removeClass('current-track');
  if(trackElement) {
    trackElement.className += " current-track";
  }
}

function play(track) {
  console.log('Current track playing: ' + track);
  if(playbackSetting != 0) {
    console.log('play requestURL: ' + '/play?tracks=' + track + '&device_id=' + deviceId + '&token=' + _token);
    $.post('/play?tracks=' + track + '&device_id=' + deviceId + '&token=' + _token);
  }
}

function pause() {
  $.post('/pause?token=' + _token);
}

function remove(track) {
  let trackList = localStorage.getItem('currentTracks').split(',');
  trackList = trackList.filter(item => item != track);
  localStorage.setItem('currentTracks', trackList.join());
  let elementId = '#' + track;
  let element = document.getElementById(track);
  element.outerHTML = "";
  delete element;
  alert("This song has been removed from the list of recommendations.");
}
