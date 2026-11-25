import type {SVGProps} from "react";

type SarinaCharacterProps=SVGProps<SVGSVGElement>&{large?:boolean};

/** SARINA's botanical companion mark: calm, abstract and aligned with the approved brand identity. */
export default function SarinaCharacter({large=false,className="",...props}:SarinaCharacterProps){
 const classes=[className,large?"sarina-avatar-large":""].filter(Boolean).join(" ");
 return <svg className={classes} viewBox="0 0 120 120" role="img" aria-label="نشان همراه سارینا" {...props}>
  <defs>
   <linearGradient id="sarina-mark-green" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#80b96e"/><stop offset="1" stopColor="#1d6748"/></linearGradient>
   <linearGradient id="sarina-mark-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d18a"/><stop offset="1" stopColor="#bf9142"/></linearGradient>
  </defs>
  <circle cx="60" cy="60" r="58" fill="#f0f6eb"/>
  <path d="M18 91C19 48 37 17 60 12c23 5 41 36 42 79" fill="none" stroke="#2d7650" strokeWidth="5" strokeLinecap="round"/>
  <path d="M29 86c8-21 17-33 31-42 14 9 23 21 31 42" fill="none" stroke="#a8c99a" strokeWidth="2.5" strokeLinecap="round"/>
  <path d="M60 83C38 75 34 57 39 43c17 2 28 14 21 40z" fill="url(#sarina-mark-green)"/>
  <path d="M61 83c22-8 26-26 21-40-17 2-28 14-21 40z" fill="#8dbb70"/>
  <path d="M60 86V47" stroke="#f7fbf3" strokeWidth="2.5" strokeLinecap="round"/>
  <circle cx="48" cy="34" r="7" fill="url(#sarina-mark-green)"/>
  <circle cx="72" cy="34" r="7" fill="url(#sarina-mark-gold)"/>
  <path d="M35 105c2-13 7-20 13-20s11 7 13 20" fill="#2e7650"/>
  <path d="M59 105c2-13 7-20 13-20s11 7 13 20" fill="#c39a4e"/>
 </svg>;
}
