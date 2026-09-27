(function () {
   'use strict';

   var STORAGE_KEY = 'cyberroadmap:progress:v1';
   var DATA_URL = 'roadmap/roadmap.json';

   var state = {
      data: null,
      progress: {}, // { itemId: true }
      allItemIds: [], // flat list, for reset/export
   };

   var els = {
      trail: document.getElementById('trail'),
      siteTitle: document.getElementById('site-title'),
      siteSubtitle: document.getElementById('site-subtitle'),
      ringFill: document.getElementById('ring-fill'),
      overallPct: document.getElementById('overall-pct'),
      overallDetail: document.getElementById('overall-detail'),
      btnExpand: document.getElementById('btn-expand'),
      btnExport: document.getElementById('btn-export'),
      btnImport: document.getElementById('btn-import'),
      fileImport: document.getElementById('file-import'),
      btnReset: document.getElementById('btn-reset'),
      resetBackdrop: document.getElementById('reset-backdrop'),
      resetCancel: document.getElementById('reset-cancel'),
      resetConfirm: document.getElementById('reset-confirm'),
      toast: document.getElementById('toast'),
   };

   var RING_CIRCUMFERENCE = 2 * Math.PI * 28;
   var SECTION_LABELS = {
      theory: '📖 Теория',
      practice: '⌨️ Практика',
      challenge: '🧩 Challenge',
      project: '🛠️ Project',
   };
   var SECTION_ORDER = ['theory', 'practice', 'challenge', 'project'];

   // ---------- Storage ----------

   function loadProgress() {
      try {
         var raw = localStorage.getItem(STORAGE_KEY);
         return raw ? JSON.parse(raw) : {};
      } catch (e) {
         console.error('Не удалось прочитать localStorage:', e);
         return {};
      }
   }

   function saveProgress() {
      try {
         localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
      } catch (e) {
         console.error('Не удалось сохранить прогресс:', e);
         showToast('Не получилось сохранить прогресс в этом браузере');
      }
   }

   // ---------- Bootstrap ----------

   fetch(DATA_URL)
      .then(function (res) {
         if (!res.ok) throw new Error('HTTP ' + res.status);
         return res.json();
      })
      .then(function (data) {
         state.data = data;
         state.progress = loadProgress();
         if (data.meta && data.meta.title)
            els.siteTitle.textContent = data.meta.title;
         if (data.meta && data.meta.subtitle)
            els.siteSubtitle.textContent = data.meta.subtitle;
         collectItemIds();
         render();
         updateAllProgress();
      })
      .catch(function (err) {
         els.trail.innerHTML =
            '<p style="color:#E0645A">Не удалось загрузить roadmap/roadmap.json (' +
            escapeHtml(err.message) +
            '). Если открываешь файл напрямую двойным кликом — так не сработает, сайту нужен локальный сервер или GitHub Pages.</p>';
      });

   function collectItemIds() {
      var ids = [];
      state.data.stages.forEach(function (stage) {
         stage.topics.forEach(function (topic) {
            SECTION_ORDER.forEach(function (sec) {
               (topic.sections[sec] || []).forEach(function (item) {
                  ids.push(item.id);
               });
            });
         });
      });
      state.allItemIds = ids;
   }

   // ---------- Render ----------

   function render() {
      var frag = document.createDocumentFragment();

      state.data.stages.forEach(function (stage, idx) {
         var stageEl = document.createElement('div');
         stageEl.className = 'stage';
         stageEl.dataset.stageId = stage.id;

         var line = document.createElement('div');
         line.className = 'stage-line';
         var segTop = document.createElement('div');
         segTop.className = 'seg top';
         var node = document.createElement('div');
         node.className = 'node';
         node.textContent = stage.icon;
         node.id = 'node-' + stage.id;
         var segBottom = document.createElement('div');
         segBottom.className = 'seg bottom';
         segBottom.id = 'seg-' + stage.id;
         line.appendChild(segTop);
         line.appendChild(node);
         line.appendChild(segBottom);

         var body = document.createElement('div');
         body.className = 'stage-body';

         var card = document.createElement('div');
         card.className = 'stage-card';
         card.id = 'card-' + stage.id;
         if (idx === 0) card.classList.add('open');

         var head = document.createElement('button');
         head.type = 'button';
         head.className = 'stage-head';
         head.setAttribute('aria-expanded', idx === 0 ? 'true' : 'false');
         head.innerHTML =
            '<div class="stage-head-text"><h2></h2><p class="stage-head-sub"></p></div>' +
            '<span class="stage-pct" id="stagepct-' +
            stage.id +
            '">0%</span>' +
            '<span class="chevron" aria-hidden="true">›</span>';
         head.querySelector('h2').textContent = stage.title;
         head.querySelector('.stage-head-sub').textContent =
            stage.subtitle || '';
         head.addEventListener('click', function () {
            toggleCard(card, head);
         });

         var pbar = document.createElement('div');
         pbar.className = 'progress-bar';
         pbar.innerHTML =
            '<span id="stagebar-' + stage.id + '" style="width:0%"></span>';

         var topicsWrap = document.createElement('div');
         topicsWrap.className = 'stage-topics';

         stage.topics.forEach(function (topic) {
            topicsWrap.appendChild(renderTopic(topic));
         });

         card.appendChild(head);
         card.appendChild(pbar);
         card.appendChild(topicsWrap);
         body.appendChild(card);

         stageEl.appendChild(line);
         stageEl.appendChild(body);
         frag.appendChild(stageEl);
      });

      els.trail.innerHTML = '';
      els.trail.appendChild(frag);
   }

   function renderTopic(topic) {
      var wrap = document.createElement('div');
      wrap.className = 'topic';
      wrap.id = 'topic-' + topic.id;

      var head = document.createElement('button');
      head.type = 'button';
      head.className = 'topic-head';
      head.setAttribute('aria-expanded', 'false');
      head.innerHTML =
         '<span class="topic-title"></span>' +
         '<span class="topic-pct" id="topicpct-' +
         topic.id +
         '">0%</span>' +
         '<span class="chevron" aria-hidden="true">›</span>';
      head.querySelector('.topic-title').textContent = topic.title;
      head.addEventListener('click', function () {
         toggleTopic(wrap, head);
      });

      var pbar = document.createElement('div');
      pbar.className = 'topic-progress';
      pbar.innerHTML =
         '<span id="topicbar-' + topic.id + '" style="width:0%"></span>';

      var sections = document.createElement('div');
      sections.className = 'topic-sections';

      SECTION_ORDER.forEach(function (sec) {
         var items = topic.sections[sec];
         if (!items || !items.length) return;
         var block = document.createElement('div');
         block.className = 'section-block';

         var label = document.createElement('p');
         label.className = 'section-label';
         label.textContent = SECTION_LABELS[sec];
         block.appendChild(label);

         items.forEach(function (item) {
            block.appendChild(renderItem(item));
         });

         sections.appendChild(block);
      });

      wrap.appendChild(head);
      wrap.appendChild(pbar);
      wrap.appendChild(sections);
      return wrap;
   }

   function renderItem(item) {
      var row = document.createElement('div');
      row.className = 'item-row';
      row.id = 'row-' + item.id;

      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.id = 'cb-' + item.id;
      cb.checked = !!state.progress[item.id];
      if (cb.checked) row.classList.add('checked');

      var textWrap = document.createElement('div');
      textWrap.style.flex = '1';

      var label = document.createElement('label');
      label.className = 'item-text';
      label.setAttribute('for', cb.id);
      label.textContent = item.text;
      textWrap.appendChild(label);

      if (item.links && item.links.length) {
         var linksWrap = document.createElement('div');
         linksWrap.className = 'item-links';
         item.links.forEach(function (link) {
            var a = document.createElement('a');
            a.href = link.url;
            a.target = '_blank';
            a.rel = 'noopener noreferrer';
            a.className = 'item-link';
            a.textContent = link.label + ' ↗';
            linksWrap.appendChild(a);
         });
         textWrap.appendChild(linksWrap);
      }

      cb.addEventListener('change', function () {
         onItemToggle(item.id, cb.checked, row);
      });

      row.appendChild(cb);
      row.appendChild(textWrap);
      return row;
   }

   // ---------- Toggle open/close ----------

   function toggleCard(card, head) {
      var open = card.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
   }

   function toggleTopic(wrap, head) {
      var open = wrap.classList.toggle('open');
      head.setAttribute('aria-expanded', open ? 'true' : 'false');
   }

   els.btnExpand.addEventListener('click', function () {
      var cards = document.querySelectorAll('.stage-card');
      var anyClosed = Array.prototype.some.call(cards, function (c) {
         return !c.classList.contains('open');
      });
      cards.forEach(function (c) {
         c.classList.toggle('open', anyClosed);
         var head = c.querySelector('.stage-head');
         head.setAttribute('aria-expanded', anyClosed ? 'true' : 'false');
      });
      els.btnExpand.textContent = anyClosed ? 'Свернуть всё' : 'Развернуть всё';
   });

   // ---------- Progress ----------

   function onItemToggle(itemId, checked, row) {
      if (checked) {
         state.progress[itemId] = true;
         row.classList.add('checked');
      } else {
         delete state.progress[itemId];
         row.classList.remove('checked');
      }
      saveProgress();
      updateAllProgress();
   }

   function updateAllProgress() {
      var totalChecked = 0;
      var totalCount = state.allItemIds.length;

      state.data.stages.forEach(function (stage) {
         var stageChecked = 0;
         var stageCount = 0;

         stage.topics.forEach(function (topic) {
            var topicChecked = 0;
            var topicCount = 0;

            SECTION_ORDER.forEach(function (sec) {
               (topic.sections[sec] || []).forEach(function (item) {
                  topicCount++;
                  if (state.progress[item.id]) topicChecked++;
               });
            });

            stageChecked += topicChecked;
            stageCount += topicCount;

            var tPct = topicCount
               ? Math.round((topicChecked / topicCount) * 100)
               : 0;
            setBar('topicbar-' + topic.id, tPct);
            setText('topicpct-' + topic.id, tPct + '%');
         });

         totalChecked += stageChecked;

         var sPct = stageCount
            ? Math.round((stageChecked / stageCount) * 100)
            : 0;
         setBar('stagebar-' + stage.id, sPct);
         var stagePctEl = document.getElementById('stagepct-' + stage.id);
         if (stagePctEl) {
            stagePctEl.textContent = sPct + '%';
            stagePctEl.classList.toggle('done', sPct === 100);
         }

         var node = document.getElementById('node-' + stage.id);
         if (node) {
            node.classList.toggle('in-progress', sPct > 0 && sPct < 100);
            node.classList.toggle('done', sPct === 100);
         }
         var seg = document.getElementById('seg-' + stage.id);
         if (seg) seg.classList.toggle('filled', sPct === 100);
      });

      var overallPct = totalCount
         ? Math.round((totalChecked / totalCount) * 100)
         : 0;
      els.overallPct.textContent = overallPct + '%';
      els.overallDetail.textContent =
         totalChecked + ' / ' + totalCount + ' пунктов';
      var offset = RING_CIRCUMFERENCE - (overallPct / 100) * RING_CIRCUMFERENCE;
      els.ringFill.style.strokeDashoffset = offset;
      els.ringFill.style.stroke = overallPct === 100 ? '#4FBDB0' : '#E8A33D';
   }

   function setBar(id, pct) {
      var el = document.getElementById(id);
      if (!el) return;
      el.style.width = pct + '%';
      el.classList.toggle('done', pct === 100);
   }

   function setText(id, text) {
      var el = document.getElementById(id);
      if (el) el.textContent = text;
   }

   // ---------- Export / Import ----------

   els.btnExport.addEventListener('click', function () {
      var payload = {
         exportedAt: new Date().toISOString(),
         source: (state.data.meta && state.data.meta.title) || 'roadmap',
         progress: state.progress,
      };
      var blob = new Blob([JSON.stringify(payload, null, 2)], {
         type: 'application/json',
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      var stamp = payload.exportedAt.slice(0, 10);
      a.href = url;
      a.download = 'roadmap-progress-' + stamp + '.json';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast('Прогресс экспортирован');
   });

   els.btnImport.addEventListener('click', function () {
      els.fileImport.click();
   });

   els.fileImport.addEventListener('change', function () {
      var file = els.fileImport.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
         try {
            var parsed = JSON.parse(reader.result);
            var incoming = parsed.progress || parsed; // accept raw progress object too
            if (typeof incoming !== 'object' || incoming === null)
               throw new Error('bad format');
            Object.keys(incoming).forEach(function (key) {
               if (incoming[key]) state.progress[key] = true;
            });
            saveProgress();
            render();
            updateAllProgress();
            showToast('Прогресс импортирован');
         } catch (e) {
            showToast('Не получилось прочитать файл — неверный формат');
         }
      };
      reader.readAsText(file);
      els.fileImport.value = '';
   });

   // ---------- Reset ----------

   els.btnReset.addEventListener('click', function () {
      els.resetBackdrop.hidden = false;
   });
   els.resetCancel.addEventListener('click', function () {
      els.resetBackdrop.hidden = true;
   });
   els.resetBackdrop.addEventListener('click', function (e) {
      if (e.target === els.resetBackdrop) els.resetBackdrop.hidden = true;
   });
   els.resetConfirm.addEventListener('click', function () {
      state.progress = {};
      saveProgress();
      render();
      updateAllProgress();
      els.resetBackdrop.hidden = true;
      showToast('Прогресс сброшен');
   });

   // ---------- Toast ----------

   var toastTimer = null;
   function showToast(msg) {
      els.toast.textContent = msg;
      els.toast.classList.add('show');
      clearTimeout(toastTimer);
      toastTimer = setTimeout(function () {
         els.toast.classList.remove('show');
      }, 2600);
   }

   function escapeHtml(s) {
      var div = document.createElement('div');
      div.textContent = s;
      return div.innerHTML;
   }
})();
