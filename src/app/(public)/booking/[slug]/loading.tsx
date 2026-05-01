export default function BookingLoading() {
  return (
    <div style={{paddingTop:56,minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{textAlign:"center"}}>
        <div style={{width:48,height:48,border:"3px solid var(--border2)",borderTopColor:"var(--g2)",borderRadius:"50%",animation:"spin .8s linear infinite",margin:"0 auto 16px"}} />
        <div style={{fontSize:13,color:"var(--text3)"}}>Chargement du salon…</div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
