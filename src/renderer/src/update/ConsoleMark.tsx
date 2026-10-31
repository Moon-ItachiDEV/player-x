// La console de Player X (px-icon.svg) en SVG en ligne, pour la scène des mises à jour : ses pièces sont nommées
// (.cm-screen l'écran, .cm-veil le voile blanc du tube, .cm-play le Play, .cm-P et .cm-X) pour que stage.ts les anime.
// Mêmes formes et mêmes couleurs que l'icône du dépôt (rose braise), plus un fond d'écran éteint sous .cm-screen.
// Les id sont préfixés par useId : deux consoles dans le document ne partagent jamais un dégradé ni un masque.
import { useId } from 'react'

export function ConsoleMark({ className = '' }: { className?: string }): React.JSX.Element {
  // useId peut contenir « : » ou « « » » : seuls les caractères sûrs dans url(#…) restent.
  const p = `cm${useId().replace(/[^A-Za-z0-9_-]/g, '')}`
  const u = (n: string): string => `${p}-${n}`
  const ref = (n: string): string => `url(#${p}-${n})`
  return (
    <svg className={`cm ${className}`} viewBox="0 0 1024 1024" data-fill="1" aria-hidden="true" focusable="false">
      <defs>
      <path id={u('sq')} d="M1024.0,512.0 L1023.8,652.2 L1023.4,697.0 L1022.6,729.4 L1021.5,755.8 L1020.0,778.3 L1018.3,798.1 L1016.2,815.9 L1013.8,832.1 L1011.1,846.9 L1008.0,860.7 L1004.6,873.4 L1000.9,885.3 L996.8,896.5 L992.4,906.9 L987.6,916.7 L982.4,926.0 L976.8,934.6 L970.9,942.8 L964.5,950.5 L957.7,957.7 L950.5,964.5 L942.8,970.9 L934.6,976.8 L926.0,982.4 L916.7,987.6 L906.9,992.4 L896.5,996.8 L885.3,1000.9 L873.4,1004.6 L860.7,1008.0 L846.9,1011.1 L832.1,1013.8 L815.9,1016.2 L798.1,1018.3 L778.3,1020.0 L755.8,1021.5 L729.4,1022.6 L697.0,1023.4 L652.2,1023.8 L512.0,1024.0 L371.8,1023.8 L327.0,1023.4 L294.6,1022.6 L268.2,1021.5 L245.7,1020.0 L225.9,1018.3 L208.1,1016.2 L191.9,1013.8 L177.1,1011.1 L163.3,1008.0 L150.6,1004.6 L138.7,1000.9 L127.5,996.8 L117.1,992.4 L107.3,987.6 L98.0,982.4 L89.4,976.8 L81.2,970.9 L73.5,964.5 L66.3,957.7 L59.5,950.5 L53.1,942.8 L47.2,934.6 L41.6,926.0 L36.4,916.7 L31.6,906.9 L27.2,896.5 L23.1,885.3 L19.4,873.4 L16.0,860.7 L12.9,846.9 L10.2,832.1 L7.8,815.9 L5.7,798.1 L4.0,778.3 L2.5,755.8 L1.4,729.4 L0.6,697.0 L0.2,652.2 L0.0,512.0 L0.2,371.8 L0.6,327.0 L1.4,294.6 L2.5,268.2 L4.0,245.7 L5.7,225.9 L7.8,208.1 L10.2,191.9 L12.9,177.1 L16.0,163.3 L19.4,150.6 L23.1,138.7 L27.2,127.5 L31.6,117.1 L36.4,107.3 L41.6,98.0 L47.2,89.4 L53.1,81.2 L59.5,73.5 L66.3,66.3 L73.5,59.5 L81.2,53.1 L89.4,47.2 L98.0,41.6 L107.3,36.4 L117.1,31.6 L127.5,27.2 L138.7,23.1 L150.6,19.4 L163.3,16.0 L177.1,12.9 L191.9,10.2 L208.1,7.8 L225.9,5.7 L245.7,4.0 L268.2,2.5 L294.6,1.4 L327.0,0.6 L371.8,0.2 L512.0,0.0 L652.2,0.2 L697.0,0.6 L729.4,1.4 L755.8,2.5 L778.3,4.0 L798.1,5.7 L815.9,7.8 L832.1,10.2 L846.9,12.9 L860.7,16.0 L873.4,19.4 L885.3,23.1 L896.5,27.2 L906.9,31.6 L916.7,36.4 L926.0,41.6 L934.6,47.2 L942.8,53.1 L950.5,59.5 L957.7,66.3 L964.5,73.5 L970.9,81.2 L976.8,89.4 L982.4,98.0 L987.6,107.3 L992.4,117.1 L996.8,127.5 L1000.9,138.7 L1004.6,150.6 L1008.0,163.3 L1011.1,177.1 L1013.8,191.9 L1016.2,208.1 L1018.3,225.9 L1020.0,245.7 L1021.5,268.2 L1022.6,294.6 L1023.4,327.0 L1023.8,371.8 Z"/>
      <clipPath id={u('csq')}><use href={`#${u('sq')}`}/></clipPath>
      <clipPath id={u('cbody')}><rect x="112" y="322" width="800" height="388" rx="150"/></clipPath>
      <clipPath id={u('cscr')}><rect x="338" y="384" width="348" height="232" rx="22"/></clipPath>
      <linearGradient id={u('bg')} x1="0.2" y1="0" x2="0.8" y2="1"><stop offset="0" stopColor="#EC5F7C"/><stop offset=".5" stopColor="#E04065"/><stop offset="1" stopColor="#B82348"/></linearGradient>
      <radialGradient id={u('bgA')} cx="0.1" cy="0.08" r="0.75"><stop offset="0" stopColor="#FF9CB1"/><stop offset="1" stopColor="#FF9CB1" stopOpacity="0"/></radialGradient>
      <radialGradient id={u('bgB')} cx="0.92" cy="0.95" r="0.75"><stop offset="0" stopColor="#A11539"/><stop offset="1" stopColor="#A11539" stopOpacity="0"/></radialGradient>
      <linearGradient id={u('body')} gradientUnits="userSpaceOnUse" x1="0" y1="322" x2="0" y2="710"><stop offset="0" stopColor="#FFFFFF"/><stop offset=".55" stopColor="#FFF2F8"/><stop offset="1" stopColor="#F6CFD8"/></linearGradient>
      <linearGradient id={u('tint')} gradientUnits="userSpaceOnUse" x1="112" y1="0" x2="912" y2="0"><stop offset="0" stopColor="#FFC2CF" stopOpacity=".3"/><stop offset=".5" stopColor="#fff" stopOpacity="0"/><stop offset="1" stopColor="#FFC2CF" stopOpacity=".3"/></linearGradient>
      <linearGradient id={u('rim')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".95"/><stop offset=".25" stopColor="#fff" stopOpacity=".2"/><stop offset=".8" stopColor="#fff" stopOpacity=".05"/><stop offset="1" stopColor="#fff" stopOpacity=".5"/></linearGradient>
      <linearGradient id={u('sheen')} gradientUnits="userSpaceOnUse" x1="0" y1="322" x2="0" y2="470"><stop offset="0" stopColor="#fff" stopOpacity=".9"/><stop offset="1" stopColor="#fff" stopOpacity="0"/></linearGradient>
      <linearGradient id={u('trig')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".95"/><stop offset="1" stopColor="#FBDDE4" stopOpacity=".7"/></linearGradient>
      <linearGradient id={u('bezel')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#FFE3E8"/><stop offset="1" stopColor="#F5B4C2"/></linearGradient>
      <linearGradient id={u('scrglass')} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".28"/><stop offset=".4" stopColor="#fff" stopOpacity="0"/></linearGradient>
      <linearGradient id={u('P')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C52A50"/><stop offset="1" stopColor="#A11539"/></linearGradient>
      <linearGradient id={u('X')} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#C52A50"/><stop offset="1" stopColor="#A11539"/></linearGradient>
      <radialGradient id={u('cap')} cx=".45" cy=".35" r=".7"><stop offset="0" stopColor="#FFFFFF"/><stop offset=".7" stopColor="#FCEEF2"/><stop offset="1" stopColor="#F0C8D1"/></radialGradient>
      <radialGradient id={u('well')} cx=".5" cy=".4" r=".6"><stop offset=".6" stopColor="#EFA8B7"/><stop offset="1" stopColor="#D47C8F"/></radialGradient>
      <pattern id={u('grille')} width="10" height="10" patternUnits="userSpaceOnUse"><circle cx="5" cy="5" r="2.6" fill="#E192A4"/><circle cx="5" cy="4.4" r="1.6" fill="#B54A64" opacity=".6"/></pattern>
      <filter id={u('f60')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="40"/></filter>
      <filter id={u('f18')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
      <filter id={u('f6')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
      <filter id={u('f3')} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3"/></filter>
      <g id={u('Pg')}><path fillRule="evenodd" transform="translate(116 335) scale(0.21)" d="M330,320 A70,70 0 0 1 400,250 L560,250 A175,175 0 0 1 560,600 L470,600 L470,710 A70,70 0 0 1 330,710 Z M531.7,359.7 L621.4,409.2 A18,18 0 0 1 621.4,440.8 L531.7,490.3 A18,18 0 0 1 505.0,474.5 L505.0,375.5 A18,18 0 0 1 531.7,359.7 Z"/></g>
      <g id={u('Xg')}><path transform="translate(274 44) scale(0.78)" d="M672.0,472.6 L696.7,447.9 A25.0,25.0 0 0 1 732.1,483.3 L707.4,508.0 L732.1,532.7 A25.0,25.0 0 0 1 696.7,568.1 L672.0,543.4 L647.3,568.1 A25.0,25.0 0 0 1 611.9,532.7 L636.6,508.0 L611.9,483.3 A25.0,25.0 0 0 1 647.3,447.9 Z"/></g>
      </defs>
      <g clipPath={ref('csq')}>
      <rect width="1024" height="1024" fill={ref('bg')}/>
      <rect width="1024" height="1024" fill={ref('bgA')} opacity=".45"/>
      <rect width="1024" height="1024" fill={ref('bgB')} opacity=".5"/>
      <rect width="1024" height="1024" fill="#fff" opacity=".03"/>
      <circle cx="512" cy="500" r="470" fill="#FFC2CF" opacity=".10"/>
      <circle cx="512" cy="500" r="370" fill="#FFC2CF" opacity=".11"/>
      <circle cx="512" cy="500" r="270" fill="#FFC2CF" opacity=".12"/>
      <circle cx="512" cy="500" r="470" fill="none" stroke="#FFC2CF" strokeOpacity=".22" strokeWidth="2"/>
      <circle cx="512" cy="500" r="370" fill="none" stroke="#FFC2CF" strokeOpacity=".22" strokeWidth="2"/>
      {/* ombre colorée */}
      <ellipse cx="512" cy="760" rx="380" ry="70" fill="#7A0E2B" opacity=".45" filter={ref('f60')}/>
      <ellipse cx="512" cy="722" rx="350" ry="26" fill="#5E0A21" opacity=".35" filter={ref('f18')}/>
      {/* gâchettes sur la tranche */}
      <g>
       <rect x="168" y="290" width="210" height="70" rx="30" fill={ref('trig')}/>
       <rect x="168" y="290" width="210" height="70" rx="30" fill="none" stroke="#fff" strokeWidth="3" opacity=".9"/>
       <rect x="190" y="298" width="166" height="10" rx="5" fill="#fff" opacity=".9"/>
       <rect x="646" y="290" width="210" height="70" rx="30" fill={ref('trig')}/>
       <rect x="646" y="290" width="210" height="70" rx="30" fill="none" stroke="#fff" strokeWidth="3" opacity=".9"/>
       <rect x="668" y="298" width="166" height="10" rx="5" fill="#fff" opacity=".9"/>
       <rect x="168" y="336" width="210" height="16" fill="#EDB3C0" opacity=".55"/>
       <rect x="646" y="336" width="210" height="16" fill="#EDB3C0" opacity=".55"/>
      </g>
      {/* tranche (épaisseur) */}
      <rect x="112" y="336" width="800" height="388" rx="150" fill="#E8A2B3"/>
      <rect x="112" y="336" width="800" height="388" rx="150" fill={ref('tint')}/>
      {/* corps */}
      <rect x="112" y="322" width="800" height="388" rx="150" fill={ref('body')}/>
      <g clipPath={ref('cbody')}>
       <rect x="112" y="322" width="800" height="388" fill={ref('tint')}/>
       <rect x="112" y="322" width="800" height="150" fill={ref('sheen')} opacity=".7"/>
       {/* occlusion autour de l'écran */}
       <rect x="318" y="366" width="388" height="270" rx="38" fill="#B4415F" opacity=".35" filter={ref('f18')}/>
       {/* grilles haut-parleurs */}
       <rect x="174" y="630" width="104" height="38" rx="16" fill={ref('grille')} opacity=".75"/>
       <rect x="746" y="630" width="104" height="38" rx="16" fill={ref('grille')} opacity=".75"/>
      </g>
      <rect x="112" y="322" width="800" height="388" rx="150" fill="none" stroke={ref('rim')} strokeWidth="5"/>
      {/* écran */}
      <rect x="324" y="370" width="376" height="260" rx="34" fill={ref('bezel')}/>
      <rect x="324" y="370" width="376" height="260" rx="34" fill="none" stroke="#fff" strokeOpacity=".9" strokeWidth="3"/>
      <g clipPath={ref('cscr')}>
       {/* écran éteint, sous le tube */}
       <rect x="338" y="384" width="348" height="232" fill="#1F0A12"/>
       <g className="cm-screen">
       <rect x="338" y="384" width="348" height="232" fill="#F39BAD"/>
       <g filter={ref('f18')}>
        <circle cx="400" cy="430" r="90" fill="#FFC2CF"/>
        <circle cx="640" cy="590" r="100" fill="#E04065" opacity=".55"/>
        <circle cx="620" cy="420" r="70" fill="#FFE3E8" opacity=".9"/>
        <circle cx="410" cy="600" r="80" fill="#E8617E" opacity=".5"/>
        <rect x="480" y="480" width="80" height="140" rx="30" fill="#C52A50" opacity=".3"/>
       </g>
       {/* Play lumineux */}
       <g className="cm-play">
       <circle cx="512" cy="500" r="74" fill="#fff" opacity=".55" filter={ref('f18')}/>
       <circle cx="512" cy="500" r="54" fill="#E04065" opacity=".28"/>
       <circle cx="512" cy="500" r="54" fill="none" stroke="#fff" strokeOpacity=".8" strokeWidth="3"/>
       <path filter={ref('f3')} opacity=".35" fill="#A11539" transform="translate(0 3)" d="M497,470 Q492,467 492,474 L492,526 Q492,533 497,530 L540,505 Q546,500 540,495 Z"/>
       <path d="M497,470 Q492,467 492,474 L492,526 Q492,533 497,530 L540,505 Q546,500 540,495 Z" fill="#fff"/>
       </g>
       {/* barre de progression */}
       <rect x="364" y="590" width="296" height="6" rx="3" fill="#fff" opacity=".45"/>
       <rect x="364" y="590" width="120" height="6" rx="3" fill="#fff" opacity=".9"/>
       <rect x="338" y="384" width="348" height="232" fill={ref('scrglass')}/>
        {/* voile : l'éclair blanc du tube, qui se resserre avec lui */}
        <rect className="cm-veil" x="338" y="384" width="348" height="232" fill="#fff" opacity="0"/>
       </g>
      </g>
      {/* touches menu sous l'écran */}
      <rect x="458" y="652" width="38" height="12" rx="6" fill="#F2C3CD"/>
      <rect x="528" y="652" width="38" height="12" rx="6" fill="#F2C3CD"/>
      <rect x="458" y="652" width="38" height="5" rx="2.5" fill="#fff" opacity=".8"/>
      <rect x="528" y="652" width="38" height="5" rx="2.5" fill="#fff" opacity=".8"/>
      <circle cx="512" cy="347" r="5" fill="#E04065"/><circle cx="512" cy="347" r="10" fill="#E04065" opacity=".35" filter={ref('f3')}/>
      {/* plaques de verre teinté */}
      <rect x="164" y="378" width="124" height="128" rx="40" fill="#FFC2CF" opacity=".35"/>
      <rect x="164" y="378" width="124" height="128" rx="40" fill="none" stroke="#fff" strokeWidth="3" opacity=".9"/>
      <rect x="164" y="382" width="124" height="124" rx="40" fill="none" stroke="#A11539" strokeOpacity=".18" strokeWidth="2"/>
      <rect x="736" y="378" width="124" height="128" rx="40" fill="#FFC2CF" opacity=".35"/>
      <rect x="736" y="378" width="124" height="128" rx="40" fill="none" stroke="#fff" strokeWidth="3" opacity=".9"/>
      <rect x="736" y="382" width="124" height="124" rx="40" fill="none" stroke="#A11539" strokeOpacity=".18" strokeWidth="2"/>
      {/* P à gauche */}
      <g className="cm-P">
      <g transform="translate(0 6)" opacity=".35" filter={ref('f6')} fill="#7A0E2B"><use href={`#${u('Pg')}`}/></g>
      <g fill={ref('P')}><use href={`#${u('Pg')}`}/></g>
      <g fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3"><use href={`#${u('Pg')}`}/></g>
      </g>
      {/* X à droite */}
      <g className="cm-X">
      <g transform="translate(0 6)" opacity=".35" filter={ref('f6')} fill="#7A0E2B"><use href={`#${u('Xg')}`}/></g>
      <g fill={ref('X')}><use href={`#${u('Xg')}`}/></g>
      <g fill="none" stroke="#fff" strokeOpacity=".55" strokeWidth="3"><use href={`#${u('Xg')}`}/></g>
      </g>
      {/* sticks */}
      <g>
       <circle cx="226" cy="572" r="44" fill={ref('well')}/>
       <circle cx="226" cy="578" r="34" fill="#8A1B36" opacity=".4" filter={ref('f6')}/>
       <circle cx="226" cy="570" r="33" fill={ref('cap')}/>
       <circle cx="226" cy="570" r="20" fill="none" stroke="#F2C3CD" strokeWidth="3"/>
       <circle cx="226" cy="570" r="33" fill="none" stroke="#fff" strokeWidth="2.5"/>
       <circle cx="798" cy="572" r="44" fill={ref('well')}/>
       <circle cx="798" cy="578" r="34" fill="#8A1B36" opacity=".4" filter={ref('f6')}/>
       <circle cx="798" cy="570" r="33" fill={ref('cap')}/>
       <circle cx="798" cy="570" r="20" fill="none" stroke="#F2C3CD" strokeWidth="3"/>
       <circle cx="798" cy="570" r="33" fill="none" stroke="#fff" strokeWidth="2.5"/>
      </g>
      <path d="M240,704 Q512,716 784,704" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity=".7"/>
      <rect x="118" y="470" width="6" height="90" rx="3" fill="#fff" opacity=".7"/><rect x="900" y="470" width="6" height="90" rx="3" fill="#fff" opacity=".45"/>
      {/* reflet net en haut */}
      <path d="M200,336 Q512,326 824,336" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".9"/>
      </g>
      <use href={`#${u('sq')}`} fill="none" stroke="#fff" strokeOpacity=".18" strokeWidth="4"/>
    </svg>
  )
}
