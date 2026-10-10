/** Illustrative use cases, not camera footage or measured detections. */
export default function VisionScene({kind}:{kind:string}){
 return <svg viewBox="0 0 480 240" width="100%" height="100%" aria-hidden="true">
  <ellipse cx="240" cy="214" rx="175" ry="12" fill="#8799a4" opacity=".16"/>
  {kind==='robotics'?<>
   <path d="M118 204H208L194 178H132Z" fill="#303c47"/><path d="M163 180V135L222 75L290 110" stroke="#fff" strokeWidth="33" fill="none" strokeLinejoin="round"/>
   <circle cx="163" cy="135" r="17" fill="#4c5d6b"/><circle cx="222" cy="75" r="17" fill="#4c5d6b"/>
   <rect x="275" y="96" width="54" height="31" rx="10" fill="#303c47"/><circle cx="312" cy="111" r="7" fill="#d53948"/>
   <rect x="288" y="159" width="69" height="48" fill="#c5ab84"/><path d="M322 159V207" stroke="#ac8c61" strokeWidth="3"/>
   <path d="M281 171V151H301M345 151H365V171M365 194V215H345M301 215H281V194" fill="none" stroke="#bd3445" strokeWidth="2"/>
  </>:kind==='drones'?<>
   <path d="M155 79L325 132M155 132L325 79" stroke="#384957" strokeWidth="9"/>
   {[[155,79],[325,132],[155,132],[325,79]].map(([x,y])=><ellipse key={x+':'+y} cx={x} cy={y} rx="42" ry="9" fill="#fff" stroke="#8c9ea9" strokeWidth="2"/>)}
   <rect x="209" y="80" width="62" height="50" rx="18" fill="#fafcfd"/><circle cx="240" cy="130" r="11" fill="#303c47"/><circle cx="240" cy="130" r="5" fill="#d53948"/>
   <path d="M233 144L204 195H282L247 144" fill="#fff" opacity=".4"/><path d="M205 186V176H218M266 176H280V186M280 199V211H266M218 211H205V199" fill="none" stroke="#bd3445" strokeWidth="2"/>
  </>:<>
   <path d="M134 112L240 38L346 112V207H134Z" fill="#fff"/><path d="M122 115L240 30L358 115" fill="none" stroke="#4d5d69" strokeWidth="11" strokeLinejoin="round"/>
   <rect x="218" y="136" width="46" height="71" fill="#697d8e"/><rect x="155" y="132" width="39" height="40" fill="#cadce7"/><rect x="285" y="132" width="39" height="40" fill="#cadce7"/>
   <rect x="269" y="146" width="8" height="18" rx="4" fill="#303c47"/><circle cx="273" cy="151" r="2" fill="#d53948"/>
   <rect x="194" y="183" width="25" height="24" fill="#c5ab84"/><path d="M188 190V177H199M214 177H226V190M226 201V214H214M199 214H188V201" fill="none" stroke="#bd3445" strokeWidth="2"/>
  </>}
 </svg>;
}
