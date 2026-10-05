"use client";
import { AppSelect } from "./app-dropdown";
import "./directory-pagination.css";

export function DirectoryPagination({page,total,pageSize,onPageChange,onPageSizeChange,noun,loading=false}: {
  page:number; total:number; pageSize:number; onPageChange:(page:number)=>void;
  onPageSizeChange?:(size:number)=>void; noun:string; loading?:boolean;
}) {
  const pages=Math.max(1,Math.ceil(total/pageSize));
  const start=total?(page-1)*pageSize+1:0, end=Math.min(page*pageSize,total);
  return <footer className="directory-pagination">
    <p aria-live="polite">{loading?"Loading…":`Showing ${start}–${end} of ${total} ${noun}`}</p>
    <div className="directory-pagination-controls">
      {onPageSizeChange&&<label>Show <AppSelect aria-label={`${noun} per page`} value={pageSize} disabled={loading} onChange={event=>onPageSizeChange(Number(event.target.value))}>{[10,12,24,50,100].map(size=><option key={size} value={size}>{size}</option>)}</AppSelect> per page</label>}
      <nav aria-label={`${noun} pages`}><button type="button" disabled={loading||page<=1} onClick={()=>onPageChange(page-1)}>Previous</button><span>Page {page} of {pages}</span><button type="button" disabled={loading||page>=pages} onClick={()=>onPageChange(page+1)}>Next</button></nav>
    </div>
  </footer>;
}
