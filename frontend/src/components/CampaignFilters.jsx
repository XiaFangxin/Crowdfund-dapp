import { CAMPAIGN_STATUSES } from "../utils/campaigns.js";

export default function CampaignFilters({ query, status, sort, onQuery, onStatus, onSort, disabled }) {
  return <div className="campaign-filters" role="search" aria-label="Find campaigns">
    <label className="filter-search">
      <span className="sr-only">Search campaigns</span>
      <input type="search" placeholder="Search campaigns..." value={query} disabled={disabled} onChange={(event) => onQuery(event.target.value)} />
    </label>
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
        <option value="ending">Sort: Ending soon</option>
        <option value="raised">Sort: Most raised</option>
      </select>
    </label>
  </div>;
}
