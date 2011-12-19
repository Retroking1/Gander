$(function() {
	$.extend({ gander: {
		/**
		* Gander configuration options
		* @var array
		*/
		options: {
			gander_server: 'gander.php',
			zoom_thumb_normal: 150,
			zoom_thumb_adjust: 20,
			zoom_thumb_min: 50,
			zoom_thumb_max: 150,
			zoom_adjust: 10,
			zoom_min: 10,
			zoom_max: 1000,
			zoom_on_open: 'fit', // How to zoom when the image changes. See $.gander.zoom for options. e.g. 'reset', 'fit'
			zoom_stretch_smaller: 1, // 1 - Stretch smaller images bigger to fit, 0 - Zoom smaller images to 100%
			thumbs_max_get_first: 0, // Maximum number of thumbs to request on first sweep, set to 0 for all
			thumbs_max_get: 10, // Subsequent number of thumbs per request
			fullscreen: 1, // 0 - Just display, 1 - Also try for fullscreen layout
			throb_from_fullscreen: 1, // Display the throbber when coming from the browser to fullscreen
			jGrowl: {position: 'bottom-right'}, // Options passed to jquery.jGrowl
			menu: {theme:'human'} // Options passed to jquery.contextmenu
		},
		/**
		* Details on the currently viewed image
		* @var array
		*/
		current: {
			offset: 0,
			thumbzoom: 150, // Inherited from zoom_thumb_normal during init()
			zoom: 100,
			width: 0,
			height: 0,
			path: '',
		},
		/**
		* The active navigation path
		* @var string
		* @see cd()
		*/
		path: '/',
		/**
		* Array of cached images. Each image path is specified as the key
		* @var array
		*/
		cache: {},

		/**
		* Initialization function
		* Should be called once on startup
		*/
		init: function() {
			// Navigation
			shortcut.add('a', function() { alert('A'); $.gander.select('previous'); });
			shortcut.add('s', function() { $.gander.select('next'); });
			shortcut.add('z', function() { $.gander.select('first'); });
			shortcut.add('x', function() { $.gander.select('last'); });
			shortcut.add('home', function() { $.gander.select('first'); });
			shortcut.add('end', function() { $.gander.select('last'); });
			shortcut.add('pageup', function() { $.gander.select('first'); });
			shortcut.add('pagedown', function() { $.gander.select('last'); });
			shortcut.add('left', function() { $.gander.select('previous'); });
			shortcut.add('right', function() { $.gander.select('next'); });

			// Zooms
			/*shortcut.add('Ctrl+q', function() { $.gander.thumbzoom('in'); });
			shortcut.add('Ctrl+w', function() { $.gander.thumbzoom('out'); });
			shortcut.add('Ctrl+e', function() { $.gander.thumbzoom('fit'); });
			shortcut.add('Ctrl+r', function() { $.gander.thumbzoom('reset'); }); */
			shortcut.add('q', function() { $.gander.zoom('in'); });
			shortcut.add('w', function() { $.gander.zoom('out'); });
			shortcut.add('e', function() { $.gander.zoom('fit'); });
			shortcut.add('r', function() { $.gander.zoom('reset'); });
			shortcut.add('+', function() { $.gander.zoom('in'); });
			shortcut.add('-', function() { $.gander.zoom('out'); });
			shortcut.add('shift+up', function() { $.gander.zoom('in'); });
			shortcut.add('shift+down', function() { $.gander.zoom('out'); });
			shortcut.add('ctrl+up', function() { $.gander.zoom('in'); });
			shortcut.add('ctrl+down', function() { $.gander.zoom('out'); });

			// Viewer
			shortcut.add('f', function() { $.gander.viewer('toggle'); });
			shortcut.add('escape', function() { $.gander.viewer('hide'); });

			// Menus
			// See http://www.javascripttoolbox.com/lib/contextmenu/ for syntax
			$.gander.options['menu.item'] = [
				{'Open':{icon: 'images/menus/open.png', onclick: function() { $.gander.viewer('open', $(this).attr('rel')); }}},
				{'Fullscreen':{icon: 'images/menus/fullscreen.png', onclick: function() { $.gander.viewer('open', $(this).attr('rel')); }}},
				$.contextMenu.separator,
				{'XXX':function() { $.gander.viewer('open'); } },
			];
			$.gander.options['menu.list'] = [
				{'Refresh':{icon: 'images/menus/refresh.png', onclick: function() { $.gander.refresh(); }}},
			];
			$.gander.options['menu.tree'] = [
				{'Home':{icon: 'images/menus/home.png', onclick: function() { $.gander.cd('/'); }}},
			];
			$.gander.options['menu.image'] = [
				{'Close':{icon: 'images/menus/list.png', onclick: function() { $.gander.viewer('hide'); }}},
			];


			// NO CONFIG BEYOND THIS LINE


			$(document).bind('mousewheel', function(event, delta) {
				if (window.fullScreenApi.isFullScreen()) { // Only capture if we are fullscreen
					$.gander.select(delta > 0 ? 'previous' : 'next');
					return false;
				}
			});
			$('#window-list').contextMenu($.gander.options['menu.list'],$.gander.options['menu'])
			$('#window-dir').contextMenu($.gander.options['menu.tree'],$.gander.options['menu'])
			$('#window-display').contextMenu($.gander.options['menu.image'],$.gander.options['menu'])

			// Default values
			$.gander.current['thumbzoom'] = $.gander.options['zoom_thumb_normal'];

			// Window setup
			//$('#window-display, #window-list').dialog();
			$('#window-display').hide();
			$('#window-display #display, #window-display').click(function() { $.gander.viewer('hide'); });

			// Filetree setup
			$('#dirlist').dynatree({
				imagePath: '/js/jquery.dynatree.skin/',
				selectMode: 1,
				fx: { height: 'toggle', duration: 200 },
				initAjax: {
					url: $.gander.options['gander_server'] + '?cmd=tree',
				},
				onLazyRead: function(node) {
					node.appendAjax({
						url: $.gander.options['gander_server'] + '?cmd=tree',
						data: { path: node.data.key }
					});
				},
				onClick: function(node) {
					$.gander.cd(node.data.key);
				},
				strings: {
					loading: "Loading directory contents...",
					loadError: "Load error!"
				}
			});

			// MC - Fix to pickup keypress events when in fullscreen and relay them to the correct callback
			/*$(window).delegate('*', 'keypress', function(e) {
				console.log('DETECT ' + e.keyCode);
				if (window.fullScreenApi.isFullScreen()) { // We only care if we are in fullscreen mode
					var key = String.fromCharCode(e.keyCode);
					if (key in shortcut.all_shortcuts) {
						shortcut.all_shortcuts[key].callback();
						e.preventDefault();
						return false;
					}
				}
			});*/
		},
		/**
		* Simple, idiot proof command runner.
		* This stub is intended to execute simple verbs (open, close, zoom/in, zoom/out etc)
		*/
		exec: function(cmd, cmd2) {
			switch(cmd) {
				case 'zoom': // see $.gander.zoom
					alert('FIXME: Feature missing');
					break;
				case 'thumbzoom': // see $.gander.thumbzoom
					$.gander.thumbzoom(cmd2);
					break;
				case 'viewer': // see $.gander.viewer
					$.gander.viewer(cmd2);
					break;
				default:
					alert('Unknown command: ' + cmd);
			}
		},
		/**
		* Simple function to display a message to the user
		* @param string type The type of the message. Values: notice, error
		* @param string text The actual text of the message
		*/
		growl: function(type, text) {
			// FIXME: type is currently ignored
			$.jGrowl(text, $.gander.options['jGrowl']);
		},
		/**
		* Change the file list to a given path
		* This also refreshes the file list contents as loads thumbnails as needed
		* @param string path The new path to change the file list to
		*/
		cd: function(path) {
			$.getJSON($.gander.options['gander_server'], {cmd: 'list', path: path, thumbs: 1, max_thumbs: $.gander.options['thumbs_max_get_first']}, function(json) {
				var list = $('#list');
				var makethumb = 0;
				$.gander.path = path;
				window.location.hash = path;
				// FIXME: Need to select down the tree to this point
				$('#dirlist').dynatree('getTree').getNodeByKey(path);
				list.empty();
				$.each(json.list, function(file, data) {
					if (data.makethumb)
						makethumb++;
					var newchild = $('<li rel="' + file + '"><div><div class="imgframe"><img src="' + data.thumb + '"/></div></div><strong>' + data.title + '</strong></li>');
					newchild.click($.gander._itemclick).contextMenu($.gander.options['menu.item'],$.gander.options['menu']);
					list.append(newchild);
				});
				$.gander.current['offset'] = 0;
				$.gander.thumbzoom('refresh');
				if (makethumb > 0) // Still more work to do
					$.gander.refresh();
			});
		},
		/**
		* Similar to 'cd' except this funciton tries to redraw an existing file store
		* Usually used when refreshing thumbnails
		*/
		refresh: function() {
			$.getJSON($.gander.options['gander_server'], {cmd: 'list', path: $.gander.path, thumbs: 1, mkthumbs: 1, max_thumbs: $.gander.options['thumbs_max_get_first']}, function(json) {
				var list = $('#list');
				var makethumb = 0;
				$.each(json.list, function(file, data) {
					var existing = $('#list li[rel="' + file + '"]');
					if (existing.length > 0) { // Item already exists
						existing.find('img').attr('src', data.thumb);
					} else { // New item
						console.log('FIXME: ADDED NEW FILE ' + file);
						var newchild = $('<li rel="' + file + '"><div><div class="imgframe"><img src="' + data.thumb + '"/></div></div><strong>' + data.title + '</strong></li>');
						newchild.click($.gander._itemclick);
						list.append(newchild);
						// FIXME: new icons will not be in their correctly sorted place
					}
				});
				if (makethumb > 0) { // Still more work to do
					console.log('REFRESH. Still ' + makethumb + ' items to do. Re-refresh');
					$.gander.refresh();
				}
			});
		},
		/**
		* Internal function triggered when clicking on an icon
		* This funciton is used by 'cd' and 'refresh' to bind the click event of indidivual items
		*/
		_itemclick: function() {
			$.gander.current['offset'] = $(this).index();
			var path = $(this).attr('rel');
			if (path.substr(-1) == '/') { // Is a directory
				$.gander.cd(path.substr(0,path.length-1));
			} else { // Is a file
				$.gander.viewer('open', path);
			}
		},
		/**
		* Internal function to adjust a numerical value whilst constraining it within a minimum and maximum
		* @param int|float value The value as it currently stands
		* @param int|float adjust The adjustment value to apply
		* @param int|float min The minimum value that the returned value can be
		* @param int|float max The maximum value that the returned value can be
		* @return int|float The initial value with the adjustment applied within the min/max constraints
		*/
		adjust: function(value, adjust, min, max) {
			if (value + adjust > max) {
				return max;
			} else if (value + adjust < min) {
				return min;
			} else {
				return value + adjust;
			}
		},
		/**
		* File selection interface
		* This is primerilly aimed at the main file list navigation
		* @param string direction Optional command to give the file handler. See the functions switch statement for further details
		*/
		select: function(direction) {
			var offset = $.gander.current['offset'];
			var list = $('#list').children();
			switch(direction) {
				case 'next':
					offset = $.gander.adjust(offset, 1, 0, list.length -1);
					break;
				case 'previous':
					offset = $.gander.adjust(offset, -1, 0, list.length -1);
					break;
				case 'first':
					offset = 0;
					break;
				case 'last':
					offset = list.length -1;
			}
			if (offset == $.gander.offset)
				return;
			$.gander.current['offset'] = offset;
			if ($.gander.viewer('isopen'))
				$.gander.viewer('open', $(list[offset]).attr('rel'));
		},
		/**
		* Thumbnail functionality interface
		* @param string direction Optional command to give the thumbnail interface handler. See the functions switch statement for further details
		*/
		thumbzoom: function(direction) {
			var zoom = $.gander.current['thumbzoom'];
			switch(direction) {
				case 'in':
					zoom = $.gander.adjust(zoom, $.gander.options['zoom_thumb_adjust'], $.gander.options['zoom_thumb_min'], $.gander.options['zoom_thumb_max']);
					break;
				case 'out':
					zoom = $.gander.adjust(zoom, 0 - $.gander.options['zoom_thumb_adjust'], $.gander.options['zoom_thumb_min'], $.gander.options['zoom_thumb_max']);
					break;
				case 'refresh':
					break;
				case 'reset':
				case 'normal':
					zoom = $.gander.options['zoom_thumb_normal'];	
				default: // Accept incomming value as the amount
					zoom = direction;
					zoom = $.gander.adjust(direction, 0, $.gander.options['zoom_thumb_min'], $.gander.options['zoom_thumb_max']);
			}
			if (direction != 'refresh' && zoom == $.gander.current['thumbzoom']) return;
			$.gander.current['thumbzoom'] = zoom;
			$('#list li img').each(function() {
				var item = $(this);
				item.attr((this.naturalHeight > this.naturalWidth) ? 'height' : 'width', zoom + 'px');
			});
		},
		/**
		* Image zoom functionality interface
		* @param string direction Optional command to give the zoom interface handler. See the functions switch statement for further details
		*/
		zoom: function(direction) {
			var zoom = $.gander.current['zoom'];
			switch(direction) {
				case 'in':
					zoom = $.gander.adjust(zoom, 0 - $.gander.options['zoom_adjust'], $.gander.options['zoom_min'], $.gander.options['zoom_max']);
					break;
				case 'out':
					zoom = $.gander.adjust(zoom, $.gander.options['zoom_adjust'], $.gander.options['zoom_min'], $.gander.options['zoom_max']);
					break;
				case 'fit-width':
				case 'fitwidth':
					zoom = ($('#window-display').width() / $.gander.current['width']) * 100;
					break;
				case 'fit-height':
				case 'fitheight':
					zoom = ($('#window-display').height() / $.gander.current['height']) * 100;
					break;
				case 'fit-both':
				case 'fitboth':
				case 'fit':
					if ($.gander.current['width'] > $.gander.current['height']) { // Wider width
						zoom = ($('#window-display').width() / $.gander.current['width']) * 100;
					} else {
						zoom = ($('#window-display').height() / $.gander.current['height']) * 100;
					}
					break;
				case '100':
				case 'reset':
				case 'normal':
					direction = 100;
				default: // Accept incomming value as the amount
					zoom = $.gander.adjust(direction, 0, $.gander.options['zoom_thumb_min'], $.gander.options['zoom_thumb_max']);
			}
			if (!$.gander.options['zoom_stretch_smaller'] && zoom > 100)
				zoom = 100;

			if (zoom == $.gander.current['zoom']) return;
			$.gander.current['zoom'] = zoom;
			console.log("Z: " + $.gander.current['zoom'] + ", W: " + ($.gander.current['width'] * (zoom/100)) + ", H: " + ($.gander.current['height'] * (zoom/100)));
			$('#window-display #display').width($.gander.current['width'] * (zoom/100));
		},
		/**
		* Image viewing area interface
		* @param string cmd Optional command to give the image viewer interface handler. See the functions switch statement for further details
		* @param string path Optional file path used in the 'open' command to open a specific image
		*/
		viewer: function(cmd, path) {
			switch (cmd) {
				case 'hide':
					if ($.gander.options['fullscreen'] == 1 && window.fullScreenApi.supportsFullScreen)
						window.fullScreenApi.cancelFullScreen();
					$('#window-display').hide();
					break;
				case 'toggle':
					$.gander.viewer(($('#window-display').css('display') == 'none') ? 'show' : 'hide');
					break;
				case 'show':
				case 'open': // Open a specific file
					if (!path) // No path specified - figure out the item that should show
						path = $('#list li').eq($.gander.current['offset']).attr('rel');
					if (path != $.gander.current['path']) { // Opening a differnt file from previously
						$('#list li').removeClass('image-viewing');
						if (path in $.gander.cache) { // In cache
							$('#display').load($.gander._displayloaded).attr('src', $.gander.cache[path]);
						} else { // Fill cache request
							if ( $.gander.options['throb_from_fullscreen'] && ($('#window-display').css('display') == 'none') ) // Hidden already - display throb, otherwise keep previous image
								$.gander.throbber('on');
							$.getJSON($.gander.options['gander_server'], {cmd: 'get', path: path}, function(data) {
								$('#display').load($.gander._displayloaded).attr('src', data.data);
							});
						}
						$('#list li[rel="' + path + '"]').addClass('image-viewing');
						$.gander.current['path'] = path;
					}
					$('#window-display').show();
					if ($.gander.options['fullscreen'] == 1 && !window.fullScreenApi.isFullScreen()) {
						if (window.fullScreenApi.supportsFullScreen) {
							window.fullScreenApi.requestFullScreen(document.body);
						} else {
							$.gander.growl('error', 'Your browser does not support fullscreen mode');
						}
					}
					break;
				case 'isopen': // Internal function to query if the viewer is open
					return ($('#window-display').css('display') != 'none');
				default:
					alert('Unknown viewer command: ' + cmd);
				}
		},
		/**
		* Trobber interface
		* @param string cmd Optional command to give the throbber interface handler. See the functions switch statement for further details
		*/
		throbber: function(cmd) {
			switch(cmd) {
				case 'on':
					$('#window-throbber').show();
					break;
				case 'off':
					$('#window-throbber').hide();
					break;
			}
		},
		/**
		* Internal function attached to the onLoad event of the #display picture viewer
		*/
		_displayloaded: function() {
			$.gander.current['width'] = this.naturalWidth;
			$.gander.current['height'] = this.naturalHeight;
			$.gander.zoom($.gander.options['zoom_on_open']);
			$.gander.throbber('off');
		}
	}});
	$.gander.init();
	$.gander.cd(window.location.hash ? window.location.hash.substr(1) : '/');
});
