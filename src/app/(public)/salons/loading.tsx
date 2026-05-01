export default function SalonsLoading() {
  return (
    <div style={{paddingTop:56}}>
      <div style={{maxWidth:1200,margin:"0 auto",padding:"32px 5vw 60px"}}>
        <div style={{height:36,width:220,background:"rgba(255,255,255,.06)",borderRadius:8,marginBottom:8,animation:"pulse 1.5s ease-in-out infinite"}} />
        <div style={{height:16,width:300,background:"rgba(255,255,255,.04)",borderRadius:5,marginBottom:28}} />
        <div style={{display:"flex",gap:8,marginBottom:24}}>
          {Array.from({length:6}).map((_,i) => (
            <div key={i} style={{height:32,width:90,background:"rgba(255,255,255,.04)",borderRadius:99}} />
          ))}
        </div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))",gap:16}}>
          {Array.from({length:9}).map((_,i) => (
            <div key={i} style={{background:"rgba(255,255,255,.03)",border:"1px solid var(--border)",borderRadius:16,overflow:"hidden"}}>
              <div style={{height:150,background:"rgba(255,255,255,.05)"}} />
              <div style={{padding:14}}>
                <div style={{height:17,width:"65%",background:"rgba(255,255,255,.06)",borderRadius:5,marginBottom:8}} />
                <div style={{height:12,width:"45%",background:"rgba(255,255,255,.04)",borderRadius:4,marginBottom:4}} />
                <div style={{height:12,width:"35%",background:"rgba(255,255,255,.04)",borderRadius:4,marginBottom:14}} />
                <div style={{height:34,background:"rgba(255,255,255,.04)",borderRadius:9}} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
