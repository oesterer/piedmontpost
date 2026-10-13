const query = document.getElementById('article-query');
const section = document.getElementById('section-filter');
const stories = [...document.querySelectorAll('.story-card')];
const normalize = text => text.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const corpus = stories.map(story => normalize(story.dataset.search));
function filter() {
 const terms = normalize(query.value).trim().split(/\s+/).filter(Boolean);
 let count = 0;
 stories.forEach((story, index) => {
  const visible = (!section.value || story.dataset.section === section.value) && terms.every(term => corpus[index].includes(term));
  story.hidden = !visible;
  if (visible) count++;
 });
 document.getElementById('article-status').textContent = count + ' ' + (count === 1 ? 'story' : 'stories') + (terms.length || section.value ? ' matching your selection' : ' in this edition');
 document.getElementById('no-stories').hidden = count > 0;
 const params = new URLSearchParams();
 if (query.value) params.set('q', query.value);
 if (section.value) params.set('section', section.value);
 // Browsing the standalone HTML files locally does not require a web server.
 if (location.protocol !== 'file:') history.replaceState(null, '', location.pathname + (params.size ? '?' + params : ''));
}
const params = new URLSearchParams(location.search);
query.value = params.get('q') || '';
section.value = params.get('section') || '';
query.addEventListener('input', filter);
section.addEventListener('change', filter);
filter();
