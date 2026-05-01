export default function DashboardLoading() {
  return (
    <div style={{padding:"18px 22px"}}>
      <div style={{height:24,width:180,background:"rgba(255,255,255,.06)",borderRadius:6,marginBottom:20}} />
      <div style={{height:60,background:"rgba(245,166,35,.05)",border:"1px solid rgba(245,166,35,.15)",borderRadius:12,marginBottom:16}} />
      <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10}}>
        {Array.from({length:4}).map((_,i) => (
          <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:12,padding:14}}>
            <div style={{height:10,width:"70%",background:"rgba(255,255,255,.06)",borderRadius:4,marginBottom:10}} />
            <div style={{height:28,width:"50%",background:"rgba(255,255,255,.06)",borderRadius:5}} />
          </div>
        ))}
      </div>
    </div>
  );
}
