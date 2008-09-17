// ==UserScript==
// @name           Nicomonkey
// @namespace      http://www.nicovideo.jp/fox
// @include        http://www.nicovideo.jp/*
// @include        http://tw.nicovideo.jp/*
// @include        http://de.nicovideo.jp/*
// @include        http://es.nicovideo.jp/*
// ==/UserScript==

/* Greasemonkey compatibility */
/*
	var NM_getString = function(str) { return str; };
*/

/* To let it be a light script, we won't use something like jQuery */
function $$(xpath,root) { 
  xpath=xpath.replace(/((^|\|)\s*)([^/|\s]+)/g,'$2.//$3').
             replace(/\.([\w-]+)(?!([^\]]*]))/g,'[@class="$1" or @class$=" $1" or @class^="$1 " or @class~=" $1 "]').
              replace(/#([\w-]+)/g,'[@id="$1"]').
              replace(/\/\[/g,'/*[');/**/
  str='(@\\w+|"[^"]*"|\'[^\']*\')'
  xpath=xpath.replace(new RegExp(str+'\\s*~=\\s*'+str,'g'),'contains($1,$2)').
              replace(new RegExp(str+'\\s*\\^=\\s*'+str,'g'),'starts-with($1,$2)').
              replace(new RegExp(str+'\\s*\\$=\\s*'+str,'g'),'substring($1,string-length($1)-string-length($2)+1)=$2');
  var got=document.evaluate(xpath,root||document,null,null,null), result=[];
  while(next=got.iterateNext()) result.push(next);
  return result;
}

function injectCSS(text)
{
	css = document.createElement('style');
	css.type = 'text/css';
	css.textContent = text;
	return css;
}

function start()
{
	if (document.getElementById('flvplayer_container') && document.getElementById('deleted_message_default') && GM_getValue('player_killer')) /* Video is deleted for copyright issue */
	{
		killPlayer();
	}

	/* Inject CSS */
		GM_addStyle('.fox-dl-link:link, .fox-dl-link:visited, .fox-dl-link:hover {color: #FFFFFF; background: #BBBBFF; margin-left: 0.2em;}'+"\r\n"+
		   '#video_utilities { position:relative; font-size: 12px; height:2em; background: #FCFCFC; border: 1px solid #CCCCCC; color: #333333; } #video_utilities p {position: absolute; top:0.3em; left:0.3em; } #video_utilities_list {position: absolute; top:0; left: 10.5em; list-style-type: none; padding:0; margin:0;}'+
'#video_utilities_list > li {float: left; position: relative; margin-left: 0.1em; margin-right: 0.1em; padding: 0.3em; background: #FAFAFA;} #video_utilities_list > li > ul {display:none; position: absolute; top:1.9em; left:0; width:20em; background: #FFFFFF; border: 1px solid #CCCCCC; margin:0; padding:0; list-style-type: none;} #video_utilities_list > li > ul > li > a { display:block; padding: 0.2em; text-decoration: none; } #video_utilities_list > li > ul > li > a:hover { background: #eeeeee; }'+
'#video_utilities_list > li:hover {background: white; border: 1px solid #DDDDDD; } #video_utilities_list > li:hover > ul {display: block;}'+
'#regenerate_player { background: #BBBBBB; border: 1px solid #CCCCCC; color: white; display: block; width: 100%; height: 540px; text-align: center; line-height: 540px; font-size: 200%; text-decoration: none; } #regenerate_player:hover {background: #999999;}'
		);

	pushLinks(false);
	if (document.getElementById('category_recent'))
	{
		listenMainPage();
	}

	/* Player-related hack, need the 'watch' address and the flv player */
	if(window.location.href.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\//) /* URL is right */
	  && document.getElementById('flvplayer_container') /* Logged in */
	  )
	{

		if(GM_getValue('toolbar'))
		{
			/* Use Div to do something wrong */
			var niconicofox_inject = document.createElement('div'); niconicofox_inject.id = 'niconicofox_inject';
			niconicofox_inject.style.display = 'none';

			/* innerHTML is truly dirty but useful! */
			niconicofox_inject.innerHTML = '<input id="inject_video_v" /><input id="inject_video_id" /><input id="inject_video_isDeleted" /><input id="inject_video_isMymemory" />';

			/* Put the container of injection */
			var watchfooter= document.getElementById('WATCHFOOTER');
			watchfooter.appendChild(niconicofox_inject);

			/* Use location hack to get the Video object, which contains what we want! */
			var inject_js_str  = 
			'document.getElementById("inject_video_v").value = Video.v;'+
			'document.getElementById("inject_video_id").value = Video.id;'+
			'document.getElementById("inject_video_isDeleted").value = Video.isDeleted;'+
			'document.getElementById("inject_video_isMymemory").value = Video.isMymemory;';

			location.href='javascript: void(eval(\''+inject_js_str.replace(/\'/g,'\\\'')+'\'));';

			prepare_inject(0);
		}
	}
}

function prepare_inject(timer)
{
	if (!document.getElementById('inject_video_v').value)
	{
		if (timer==10)
		{
			alert('Inject time out! The script may be broken.');
			return;
		}
		timer = timer + 1;
		window.setTimeout(prepare_inject, 1, timer);
	}
	else
	{
		start_inject();
	}

}

function start_inject()
{


	var Video = 
	{
		v: document.getElementById('inject_video_v').value,
		id: document.getElementById('inject_video_id').value,
		isDeleted: false,
		isMymemory: false,
	}
	if (document.getElementById('inject_video_isDeleted').value=='true') { Video.isDeleted = true; }
	if (document.getElementById('inject_video_isMymemory').value=='true') { Video.isMymemory = true; }

	if (Video.isDeleted)
	{
		killPlayer();
		return;
	}
	
	var niconicofarm = "\r\n";
	/* check if Video.v is a pure integer... (mymemory / community / other countries ver.), (for hatena::diary and niconicofarm) */

	if (Video.v.match(/[A-Za-z]/))
	{
		niconicofarm = '<li><a href="http://nico.xii.jp/comment/?url='+Video.id+'" target="_blank">'+NM_getString('toolsNicoNicoFarm')+"\r\n"; // Use Nico Nico Farm (support)
	}

	/* Fetching Nico Nico's video title */
	h1 = document.getElementsByTagName('h1')[0];

	/* inject the video download link */
	if (h1.hasChildNodes())
	{
			download_link = document.createElement('a');
			download_link.className = 'fox-dl-link';

				href = window.location.href;
				/* There will be some problem if the premium user uses the normal user network (?lo=1), dirty fix */
				href = href.split("?")[0];

			download_link.href = href + '?smilefox=get';
			download_link.textContent = 'DL';

			h1.appendChild(download_link);
	}

	/* Inject Video Utilities */
	video_utilities = document.createElement('div');
	video_utilities.id = 'video_utilities';


	html = '<p>'+NM_getString('toolbarTitle')+'</p><ul id="video_utilities_list">'+"\r\n"+
		'<li>'+NM_getString('related')+''+"\r\n"+
		'<ul>'+"\r\n"+
		'<li><a href="http://d.hatena.ne.jp/video/niconico/'+Video.v+'" target="_blank">'+NM_getString('relatedHatena')+'</a></li>'+"\r\n"+
		'<li><a href="http://www.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoWww')+'</a></li>'+"\r\n"+
		'<li><a href="http://tw.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoTw')+'</a></li>'+"\r\n"+
		'<li><a href="http://es.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoEs')+'</a></li>'+"\r\n"+
		'<li><a href="http://de.nicovideo.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('relatedNicoDe')+'</a></li>'+"\r\n"+
		'</ul></li>'+"\r\n"+
		'<li>'+NM_getString('tools')+"\r\n"+ 
		'<ul>'+"\r\n"+
		'<li><a href="http://nicosound.dip.jp/sound/'+Video.id+'" target="_blank">'+NM_getString('toolsNicoSound')+'</a></li>'+"\r\n"+
		'<li><a href="http://www.nicochart.jp/watch/'+Video.id+'" target="_blank">'+NM_getString('toolsNicoChart')+'</a></li>'+"\r\n";
	html = html + niconicofarm; /* Niconico farm is general comment only */
	html = html + '</ul></li>'+"\r\n"+
		'</ul>';
	video_utilities.innerHTML = html;
	WATCHHEADER = document.getElementById('WATCHHEADER');
	WATCHHEADER.parentNode.insertBefore(video_utilities, WATCHHEADER);

}

function listenMainPage()
{
document.addEventListener('DOMAttrModified', function(event)
	{
		if(event.target.id == 'tag_modeA' || event.target.id == 'tag_modeB') { pushLinks(true); }
	}
, false);
}
function pushLinks(mainpage)
{
	/* Fetching the video links */
	if (mainpage)
	{
		videos = $$('a .video', document.getElementById('category_recent'));
	}
	else
	{
		videos = $$('a .video');
	}
	/* Run every link to check what we like */
	for (i = 0; i < videos.length; i++)
	{
		video = videos[i];
		href = video.href;

		/* Is it truly a "watch" or "mylist" links? */
		if (href.match(/^http:\/\/(www|tw|de|es)\.nicovideo\.jp\/watch\/[a-z]{0,2}[0-9]+$/)/* || href.match(/^http:\/\/(tw|www)\.nicovideo\.jp\/mylist\/[0-9]+$/)*/)
		{
			/* If it is, we will add a "download" link, to help Smilefox work :) */
			download_link = document.createElement('a');
			download_link.className = 'fox-dl-link';
			download_link.href = href+'?smilefox=get';
			download_link.textContent = 'DL';

			video.parentNode.insertBefore(download_link, video.nextSibling);
		}
	}
}
//category_recent
function killPlayer()
{
		var flvplayer = document.getElementById('flvplayer');
		flvplayer.parentNode.removeChild(flvplayer);
		var flvplayer_container = document.getElementById('flvplayer_container')

		player_deleted = document.createElement('div');
		player_deleted.innerHTML = '<a href="'+window.location.href+'" id="regenerate_player" onclick="return false;">'+NM_getString('playerKillerMsg')+'</a>';
		flvplayer_container.appendChild(player_deleted);

		document.getElementById('regenerate_player').addEventListener('click', function(event)
		{
			document.getElementById('flvplayer_container').removeChild(player_deleted);
			document.getElementById('flvplayer_container').appendChild(flvplayer);
			return false;
		}
		, true
		);
}

if (GM_getValue('enable'))
{ start(); }