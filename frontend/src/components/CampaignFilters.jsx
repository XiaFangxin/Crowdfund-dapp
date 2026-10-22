import { CAMPAIGN_STATUSES } from "../utils/campaigns.js";

export default function CampaignFilters({ query, status, sort, onQuery, onStatus, onSort, disabled, categories = [], categoryId = "", onCategory, statisticsReady = false, offchainReady = false }) {
  return <div className="campaign-filters" role="search" aria-label="Find campaigns">
    <label className="filter-search">
      <span className="sr-only">Search campaigns</span>
      <input type="search" placeholder="Search campaigns..." value={query} disabled={disabled} onChange={(event) => onQuery(event.target.value)} />
    </label>
    {onCategory && <label><span className="sr-only">Category</span><select value={categoryId} onChange={event=>onCategory(event.target.value)} disabled={disabled}><option value="">All categories</option>{categories.map(category=><option key={category.id} value={category.id}>{category.name} #{category.id}{category.active ? "" : " (inactive)"}</option>)}</select></label>}
    <label>
      <span className="sr-only">Campaign status</span>
      <select value={status} disabled={disabled} onChange={(event) => onStatus(event.target.value)}>
        <option value="All">All Status</option>
        {CAMPAIGN_STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}
      </select>
    </label>
    <label>
      <span className="sr-only">Sort campaigns</span>
      <select value={sort} disabled={disabled} onChange={(event) => onSort(event.target.value)}>
        <option value="newest">Sort: Newest first</option>
        <option value="oldest">Sort: Oldest first</option>
        <option value="deadline-latest">Sort: Latest deadline</option>
        <option value="progress">Sort: Funding progress</option>
        <option value="donations" disabled={!statisticsReady}>Sort: Donation count (load statistics)</option>
        <option value="donors" disabled={!statisticsReady}>Sort: Unique donors (load statistics)</option>
        <option value="views" disabled={!offchainReady}>Sort: Approximate views</option><option value="favorites" disabled={!offchainReady}>Sort: Saved count</option>
        <option value="ending">Sort: Ending soon</option>
        <option value="raised">Sort: Most raised</option>
      </select>
    </label>
  </div>;
}
