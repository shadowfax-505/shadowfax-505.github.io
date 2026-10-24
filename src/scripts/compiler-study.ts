import { analyzeExpression, ExpressionError, formatExpression, layoutTree } from '../lib/expression';

const study = document.querySelector<HTMLElement>('[data-compiler-study]');
if (study) {
  const form = study.querySelector<HTMLFormElement>('[data-compiler-form]')!;
  const input = form.querySelector<HTMLInputElement>('input')!;
  const error = study.querySelector<HTMLElement>('[data-compiler-error]')!;
  const views = Array.from(study.querySelectorAll<HTMLElement>('[data-compiler-view]'));
  const buttons = Array.from(study.querySelectorAll<HTMLButtonElement>('[data-compiler-step]'));
  let analysis = analyzeExpression(input.value);
  let current = 2;
  const animations: Animation[] = [];
  function cancelAnimations() { animations.forEach(animation=>animation.cancel()); animations.length = 0; }
  const descriptions = [
    'The characters you write: numbers, names, operators, and parentheses.',
    'A lexer groups those characters into meaningful tokens, keeping their source positions.',
    'Operator precedence and parentheses become a tree of relationships.',
    'Calculate constant subexpressions. Keep variables and non-finite operations intact.',
  ];
  function text(selector: string, value: string) { study!.querySelector(selector)!.textContent = value; }
  function show(index: number) {
    current = index;
    study!.dataset.step = String(index);
    views.forEach((view,i) => view.hidden = i !== index);
    buttons.forEach((button,i) => button.setAttribute('aria-pressed', String(i === index)));
    text('[data-compiler-view-label]', ['01 / SOURCE TEXT','02 / LEXICAL TOKENS','03 / SYNTAX TREE','04 / CONSTANT FOLDING'][index]);
    text('[data-compiler-description]', descriptions[index]);
    text('[data-compiler-count]', index === 1 ? `${analysis.tokens.length} TOKENS` : index === 3 ? `${analysis.after} NODES AFTER FOLDING` : `${analysis.before} NODES`);
    text('[data-compiler-live]', `${['Source','Tokens','Tree','Fold'][index]} view. ${analysis.tokens.length} tokens, ${analysis.before} syntax nodes, ${analysis.after} nodes after folding.`);
    cancelAnimations();
    if (document.documentElement.dataset.motion === 'on') {
      animations.push(views[index].animate([{opacity:.35,transform:'translateY(9px)'},{opacity:1,transform:'translateY(0)'}], {duration:380,easing:'cubic-bezier(.22,1,.36,1)'}));
      if(index === 2) {
        views[index].querySelectorAll<SVGElement>('.tree-edges path').forEach(path=>animations.push(path.animate([{strokeDasharray:'1',strokeDashoffset:1},{strokeDasharray:'1',strokeDashoffset:0}],{duration:650,easing:'ease-out'})));
        views[index].querySelectorAll<SVGElement>('.tree-node').forEach((node,i)=>animations.push(node.animate([{opacity:0},{opacity:1}],{duration:360,delay:i*45,fill:'backwards'})));
      }
      if(index === 1) views[index].querySelectorAll('.token').forEach((token,i)=>animations.push(token.animate([{opacity:.2},{opacity:1}],{duration:320,delay:i*35,fill:'backwards'})));
    }
  }
  function render() {
    text('[data-compiler-source]', input.value.trim());
    text('[data-fold-before]', formatExpression(analysis.tree));
    text('[data-fold-after]', formatExpression(analysis.folded));
    const foldedLength = formatExpression(analysis.folded).length;
    study!.querySelector<HTMLElement>('[data-fold-after]')!.dataset.size = foldedLength > 50 ? 'long' : foldedLength > 20 ? 'medium' : 'short';
    text('[data-fold-count]', `${analysis.before} nodes → ${analysis.after} ${analysis.after === 1 ? 'node' : 'nodes'}`);
    const strip = study!.querySelector('[data-compiler-tokens]')!;
    strip.replaceChildren(...analysis.tokens.map(token => {
      const span = document.createElement('span');
      span.className = `token token-${token.kind}`;
      const label = document.createElement('b'); label.textContent = token.text;
      const kind = document.createElement('small');
      kind.textContent = token.kind === 'symbol' ? '()'.includes(token.text) ? 'group' : 'operator' : token.kind;
      span.title = `Source position ${token.start + 1}`;
      span.append(label,kind);
      return span;
    }));
    const svg = study!.querySelector<SVGSVGElement>('[data-compiler-tree]')!;
    svg.setAttribute('aria-label', `Syntax tree for ${input.value.trim()}`);
    const create = (name: string, attributes: Record<string,string>) => {
      const element = document.createElementNS('http://www.w3.org/2000/svg',name);
      Object.entries(attributes).forEach(([name,value])=>element.setAttribute(name,value));
      return element;
    };
    const canvasWidth = analysis.before > 9 ? 700 : 440;
    svg.setAttribute('viewBox',`0 0 ${canvasWidth} 370`);
    const drawing = layoutTree(analysis.tree,canvasWidth);
    const edges = create('g',{class:'tree-edges'});
    drawing.edges.forEach(e=>edges.append(create('path',{d:`M${e.x1} ${e.y1}L${e.x2} ${e.y2}`,pathLength:'1'})));
    const nodes = create('g',{});
    drawing.nodes.forEach(n=>{
      const group = create('g',{class:`tree-node${n.operator?' tree-operator':''}`});
      const label = create('text',{x:String(n.x),y:String(n.y+7),'text-anchor':'middle'});
      const numeric = !n.operator && /^[\d.\-e+]+$/.test(n.label);
      label.textContent = n.label.length > 8 && numeric ? Number(n.label).toPrecision(3) : !numeric && n.label.length > 5 ? n.label.slice(0,4)+'…' : n.label;
      if (label.textContent.length > 3) label.setAttribute('font-size',label.textContent.length>6?'10':'13');
      const title = create('title',{}); title.textContent = n.label;
      group.append(title,create('circle',{cx:String(n.x),cy:String(n.y),r:'23'}),label);
      nodes.append(group);
    });
    svg.replaceChildren(edges,nodes);
    show(current);
  }
  function inspect() {
    try {
      const next = analyzeExpression(input.value);
      analysis = next;
      input.removeAttribute('aria-invalid');
      error.textContent = '';
      render();
    } catch (failure) {
      input.setAttribute('aria-invalid','true');
      error.textContent = (failure instanceof ExpressionError ? `At character ${failure.position + 1}: ${failure.message}` : 'This expression could not be read.') + ' The drawing keeps the last valid expression.';
      input.focus();
      if (failure instanceof ExpressionError) input.setSelectionRange(failure.position,failure.position + 1);
    }
  }
  form.addEventListener('submit',event=>{event.preventDefault();inspect();});
  study.querySelectorAll<HTMLButtonElement>('[data-expression]').forEach(button=>button.addEventListener('click',()=>{input.value=button.dataset.expression!;inspect();}));
  buttons.forEach((button,index)=>button.addEventListener('click',()=>show(index)));
  study.querySelector('[data-compiler-controls]')!.removeAttribute('hidden');
  form.hidden = false;
  // A paused or reduced-motion page also cancels an in-flight specimen transition.
  const observer = new MutationObserver(()=>{if(document.documentElement.dataset.motion!=='on')cancelAnimations();});
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-motion']});
  window.addEventListener('pagehide',event=>{if(!event.persisted){observer.disconnect();cancelAnimations();}});
}
