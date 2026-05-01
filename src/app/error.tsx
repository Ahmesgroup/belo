"use client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html>
      <body style={{margin:0,background:"#060a0f",color:"#e2e8f0",fontFamily:"system-ui,sans-serif",display:"flex",alignItems:"center",justifyContent:"center",minHeight:"100vh"}}>
        <div style={{textAlign:"center",padding:"0 20px",maxWidth:400}}>
          <div style={{fontSize:48,marginBottom:16}}>⚠️</div>
          <h2 style={{fontFamily:"Georgia,serif",fontSize:22,fontWeight:700,marginBottom:8}}>
            Quelque chose s'est mal passé
          </h2>
          <p style={{color:"rgba(226,232,240,.6)",fontSize:14,marginBottom:24,lineHeight:1.6}}>
            Une erreur inattendue s'est produite. Nos équipes ont été notifiées.
          </p>
          {error.digest && (
            <p style={{fontSize:11,color:"rgba(226,232,240,.3)",marginBottom:20,fontFamily:"monospace"}}>
              Ref: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{padding:"11px 24px",borderRadius:10,background:"#22d38a",color:"#111",border:"none",fontWeight:700,fontSize:14,cursor:"pointer"}}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  );
}
