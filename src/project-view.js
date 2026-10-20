// Public portal map. No private repository inventory is bundled into the site.
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};

export function mountProjectConstellation(){
  const root=document.getElementById('project-constellation');
  if(!root)return;
  root.replaceChildren();
  const hero=el('div','constellation-hero');
  const intro=el('div');
  intro.append(el('p','eyebrow','HALVETH / LEVIATHAN'),el('h2','','Eine Wallet. Mehrere Perspektiven.'),el('p','','Verbinden, öffentliche Positionen prüfen und den Weg von Beobachtung zu bewusster Aktion nachvollziehen.'));
  const stars=el('div','constellation-stars');
  stars.setAttribute('aria-hidden','true');
  for(let i=0;i<8;i++){const star=el('span','','✦');star.style.setProperty('--i',String(i));stars.append(star);}
  hero.append(intro,stars);
  const grid=el('div','constellation-grid');
  const cards=[
    {id:'wallet',title:'Wallet & Beobachtung',description:'Cosmos- und EVM-Wallets auswählen, Netzwerke freigeben und belegte Positionen mit sichtbaren Abdeckungslücken lesen.',link:'#home',label:'Zur Wallet'},
    {id:'sources',title:'Quellen & Abdeckung',description:'Netzwerkquellen, öffentliche Adressabfragen und Referenzkurse bleiben getrennt von einer Signatur oder Transaktion.',link:'#networks',label:'Netzwerke ansehen'},
    {id:'code',title:'Quellcode & Rechte',description:'Der öffentliche Code, die Lizenzkarte und die Grenzen der jeweiligen Rechte sind direkt einsehbar.',link:'https://github.com/Juri-Halveth/leviathan-wallet-portal',label:'GitHub öffnen'}
  ];
  for(const item of cards){
    const card=el('article','constellation-card');card.id='project-'+item.id;
    card.append(el('div','constellation-card-top','✦'),el('h3','',item.title),el('p','',item.description));
    const link=el('a','constellation-jump',item.label+' ↗');link.href=item.link;
    if(item.link.startsWith('https:')){link.target='_blank';link.rel='noopener noreferrer';}
    card.append(link);grid.append(card);
  }
  root.append(hero,grid,el('p','footnote','Diese Karte beschreibt das veröffentlichte Wallet-Portal. Private Projektmetadaten werden hier nicht ausgegeben.'));
}
