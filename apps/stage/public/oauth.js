(function () {
  var query = window.location.search;
  var link = 'stage://oauth' + query;
  var open = document.getElementById('open');
  if (open) open.setAttribute('href', link);
  if (new URLSearchParams(query).has('privy_oauth_code')) window.location.href = link;
})();
