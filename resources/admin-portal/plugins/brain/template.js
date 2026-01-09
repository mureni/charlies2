export const template = `
   <div class="panel-title">Brain</div>
   <div class="panel-subtitle">Global brain view with additive overlay plumbing per community or conversation.</div>
   <div class="status" id="brain-status"></div>
   <div class="grid">
      <section class="card">
         <div class="card-header">
            <div>
               <h3>Snapshot</h3>
               <p class="muted">Download the sqlite snapshot (filtered view uses overlays when available).</p>
            </div>
            <button class="button ghost" type="button" id="brain-refresh">Refresh</button>
         </div>
         <label class="field">
            <span>Community id (optional)</span>
            <input id="brain-community" type="text" placeholder="community-123">
         </label>
         <div class="actions">
            <button class="button" type="button" id="brain-download">Download sqlite</button>
            <button class="button ghost" type="button" id="brain-download-gzip">Download gzip</button>
         </div>
      </section>
      <section class="card">
         <div class="card-header">
            <div>
               <h3>Stats</h3>
               <p class="muted" id="brain-name">Brain stats</p>
            </div>
         </div>
         <div class="stat-grid">
            <div class="stat">
               <div class="stat-label">Lexicon entries</div>
               <div class="stat-value" id="brain-lexicon">0</div>
            </div>
            <div class="stat">
               <div class="stat-label">Trigram entries</div>
               <div class="stat-value" id="brain-ngrams">0</div>
            </div>
            <div class="stat">
               <div class="stat-label">Chain length</div>
               <div class="stat-value" id="brain-chain">3</div>
            </div>
            <div class="stat">
               <div class="stat-label">DB size</div>
               <div class="stat-value" id="brain-db">0 B</div>
            </div>
            <div class="stat">
               <div class="stat-label">Overlay contexts</div>
               <div class="stat-value" id="brain-overlays">0</div>
            </div>
         </div>
         <div class="list brain-overlays" id="brain-overlay-list"></div>
      </section>
   </div>
   <div class="grid lexicon-grid">
      <section class="card lexicon-card" id="brain-lexicon-card">
         <div class="card-header">
            <div>
               <h3>Lexicon Explorer</h3>
               <p class="muted">Search by word and inspect related trigrams.</p>
            </div>
         </div>
         <div class="row">
            <input id="brain-search" type="search" placeholder="Search lexicon">
            <select id="brain-page-size">
               <option value="25">25</option>
               <option value="50" selected>50</option>
               <option value="100">100</option>
            </select>
         </div>
         <div class="list" id="brain-word-list"></div>
         <div class="list-footer" id="brain-word-footer">Loading...</div>
      </section>
      <section class="card lexicon-card word-detail-card" id="brain-detail-card">
         <div class="card-header">
            <div>
               <h3 id="brain-word-title">Word detail</h3>
               <p class="muted" id="brain-word-meta">Select a word to inspect its trigrams.</p>
            </div>
         </div>
         <div class="detail-body" id="brain-word-body">
            <div class="empty">No word selected.</div>
         </div>
      </section>
   </div>
   <div class="grid ngram-grid">
      <section class="card ngram-card" id="brain-ngram-card">
         <div class="card-header">
            <div>
               <h3>Ngram Explorer</h3>
               <p class="muted" id="brain-ngram-status">Building the ngram index...</p>
            </div>
            <button class="button ghost" type="button" id="brain-ngram-refresh">Refresh index</button>
         </div>
         <div class="ngram-filters">
            <div class="filter-grid">
               <label class="field compact">
                  <span>Contains</span>
                  <input id="brain-ngram-contains" type="search" placeholder="token text">
               </label>
               <label class="field compact">
                  <span>Not contains</span>
                  <input id="brain-ngram-not-contains" type="search" placeholder="token text">
               </label>
               <label class="field compact">
                  <span>Next min</span>
                  <input id="brain-ngram-next-min" type="number" min="0" placeholder="0">
               </label>
               <label class="field compact">
                  <span>Next max</span>
                  <input id="brain-ngram-next-max" type="number" min="0" placeholder="any">
               </label>
            </div>
            <div class="filter-grid">
               <label class="field compact">
                  <span>Prev min</span>
                  <input id="brain-ngram-prev-min" type="number" min="0" placeholder="0">
               </label>
               <label class="field compact">
                  <span>Prev max</span>
                  <input id="brain-ngram-prev-max" type="number" min="0" placeholder="any">
               </label>
               <label class="field compact">
                  <span>Token len min</span>
                  <input id="brain-ngram-token-min" type="number" min="0" placeholder="0">
               </label>
               <label class="field compact">
                  <span>Token len max</span>
                  <input id="brain-ngram-token-max" type="number" min="0" placeholder="any">
               </label>
            </div>
            <div class="filter-grid">
               <label class="field compact">
                  <span>Can start</span>
                  <select id="brain-ngram-can-start">
                     <option value="any" selected>Any</option>
                     <option value="true">Yes</option>
                     <option value="false">No</option>
                  </select>
               </label>
               <label class="field compact">
                  <span>Can end</span>
                  <select id="brain-ngram-can-end">
                     <option value="any" selected>Any</option>
                     <option value="true">Yes</option>
                     <option value="false">No</option>
                  </select>
               </label>
            </div>
         </div>
         <div class="data-table" id="brain-ngram-table">
            <div class="data-table-header" id="brain-ngram-header">
               <button class="table-sort" type="button" data-sort="hash">Hash</button>
               <button class="table-sort" type="button" data-sort="tokens">Tokens</button>
               <button class="table-sort" type="button" data-sort="canStart">Start</button>
               <button class="table-sort" type="button" data-sort="canEnd">End</button>
               <button class="table-sort" type="button" data-sort="nextCount">Next</button>
               <button class="table-sort" type="button" data-sort="prevCount">Prev</button>
               <button class="table-sort" type="button" data-sort="tokenCount">Tokens #</button>
               <button class="table-sort" type="button" data-sort="minTokenLength">Min len</button>
               <button class="table-sort" type="button" data-sort="maxTokenLength">Max len</button>
            </div>
         <div class="data-table-body" id="brain-ngram-body">
            <div class="data-table-track" id="brain-ngram-track">
               <div class="data-table-rows" id="brain-ngram-rows"></div>
            </div>
         </div>
            <div class="data-table-footer" id="brain-ngram-footer">Loading...</div>
         </div>
      </section>
      <section class="card ngram-card ngram-detail-card" id="brain-ngram-detail-card">
         <div class="card-header">
            <div>
               <h3>Ngram detail</h3>
               <p class="muted">Inspect transitions for a specific trigram hash.</p>
            </div>
         </div>
         <div class="row">
            <input id="brain-hash-input" type="text" placeholder="ngram hash">
            <button class="button ghost" type="button" id="brain-hash-load">Load</button>
         </div>
         <div class="detail-body" id="brain-hash-body">
            <div class="empty">Paste a trigram hash to inspect details.</div>
         </div>
      </section>
   </div>
   <section class="card" id="brain-top-card">
      <div class="card-header">
         <div>
            <h3>Top tokens</h3>
            <p class="muted">Most connected tokens in the lexicon.</p>
         </div>
         <select id="brain-top-limit">
            <option value="10">Top 10</option>
            <option value="20" selected>Top 20</option>
            <option value="50">Top 50</option>
         </select>
      </div>
      <div class="bar-list" id="brain-top-list"></div>
   </section>
   <section class="card">
      <div class="card-header">
         <div>
            <h3>Overlay status</h3>
            <p class="muted">Overlays are additive and scoped to community or conversation. Editing is coming later.</p>
         </div>
      </div>
      <div class="empty">No overlay editing controls yet.</div>
   </section>
`;

export const getBrainRefs = (container) => ({
   statusEl: container.querySelector("#brain-status"),
   communityInput: container.querySelector("#brain-community"),
   refreshButton: container.querySelector("#brain-refresh"),
   downloadButton: container.querySelector("#brain-download"),
   downloadGzipButton: container.querySelector("#brain-download-gzip"),
   brainNameEl: container.querySelector("#brain-name"),
   lexiconEl: container.querySelector("#brain-lexicon"),
   ngramEl: container.querySelector("#brain-ngrams"),
   chainEl: container.querySelector("#brain-chain"),
   dbEl: container.querySelector("#brain-db"),
   overlayCountEl: container.querySelector("#brain-overlays"),
   overlayListEl: container.querySelector("#brain-overlay-list"),
   searchInput: container.querySelector("#brain-search"),
   pageSizeSelect: container.querySelector("#brain-page-size"),
   wordListEl: container.querySelector("#brain-word-list"),
   wordFooterEl: container.querySelector("#brain-word-footer"),
   wordTitleEl: container.querySelector("#brain-word-title"),
   wordMetaEl: container.querySelector("#brain-word-meta"),
   wordBodyEl: container.querySelector("#brain-word-body"),
   ngramStatusEl: container.querySelector("#brain-ngram-status"),
   ngramRefreshButton: container.querySelector("#brain-ngram-refresh"),
   ngramContainsInput: container.querySelector("#brain-ngram-contains"),
   ngramNotContainsInput: container.querySelector("#brain-ngram-not-contains"),
   ngramNextMinInput: container.querySelector("#brain-ngram-next-min"),
   ngramNextMaxInput: container.querySelector("#brain-ngram-next-max"),
   ngramPrevMinInput: container.querySelector("#brain-ngram-prev-min"),
   ngramPrevMaxInput: container.querySelector("#brain-ngram-prev-max"),
   ngramTokenMinInput: container.querySelector("#brain-ngram-token-min"),
   ngramTokenMaxInput: container.querySelector("#brain-ngram-token-max"),
   ngramCanStartSelect: container.querySelector("#brain-ngram-can-start"),
   ngramCanEndSelect: container.querySelector("#brain-ngram-can-end"),
   ngramHeaderEl: container.querySelector("#brain-ngram-header"),
   ngramBodyEl: container.querySelector("#brain-ngram-body"),
   ngramTrackEl: container.querySelector("#brain-ngram-track"),
   ngramRowsEl: container.querySelector("#brain-ngram-rows"),
   ngramFooterEl: container.querySelector("#brain-ngram-footer"),
   hashInput: container.querySelector("#brain-hash-input"),
   hashLoadButton: container.querySelector("#brain-hash-load"),
   hashBodyEl: container.querySelector("#brain-hash-body"),
   topLimitSelect: container.querySelector("#brain-top-limit"),
   topListEl: container.querySelector("#brain-top-list")
});
