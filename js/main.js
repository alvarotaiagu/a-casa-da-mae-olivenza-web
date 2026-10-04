/* ═══════════════════════════════════════════════════════════════════════════
   A Casa da Mãe · «La baldosa»
   Cortina «enlosar»: el símbolo se traza (aro, bolas, flor, cruz), se rellena
   y se encaja en su cuadrado; la baldosa se replica en retícula hasta cubrir
   la pantalla y las baldosas se levantan desde el centro. La central es la
   última: se encoge y vuela al logo del menú.
   Después la retícula ordena la página: juntas del hero, cenefas, el corte de
   la casa, el marco de las placas, las filas de las opiniones y el pie, que se
   vuelve a enlosar.

   Banderas separadas a propósito:
     gsapReady  → hay motor de animación (GSAP + ScrollTrigger cargados)
     movimiento → además el usuario NO ha pedido reducir el movimiento
   Con movimiento reducido el CONTENIDO sigue (el siglo, las plantas
   encendidas, la galería, el formulario); lo que se apaga es el viaje.

   Los trazos con pathLength="1" llevan autoRound:false (si no, GSAP redondea
   1px → 0px y el trazo aparece de golpe).
   ═══════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var html = document.documentElement;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var esTactil = window.matchMedia('(hover: none), (pointer: coarse)').matches;
  var gsapReady = !!(window.gsap && window.ScrollTrigger);
  var movimiento = gsapReady && !reduce;
  var gsap = window.gsap;
  var ST = window.ScrollTrigger;

  if (gsapReady) gsap.registerPlugin(ST);
  html.classList.add(movimiento ? 'con-movimiento' : 'sin-movimiento');

  /* lo mismo que data/config.json, por si el JSON no llega (abierto con doble clic) */
  var CONFIG = {
    telefono: '645 90 29 55', telefonoEnlace: '+34645902955',
    whatsapp: '34645902955', email: 'acasadamae.olivenza@gmail.com',
    motor: 'https://acasadamae.com/reservas-acasadamae/'
  };
  var ESTANCIAS = {
    habitaciones: ['Las habitaciones', 'Tres habitaciones dobles con baño propio; una está adaptada. Suelo radiante, climatización y wifi.'],
    salon: ['El salón comedor', 'Bajo bóvedas de ladrillo. Común para las tres habitaciones.'],
    cocina: ['La cocina', 'Común para la planta baja: para prepararse el desayuno o algo de comer.'],
    lectura: ['La sala de lectura', 'Un rincón tranquilo de la planta baja.'],
    patio: ['El patio', 'Patio tradicional con su fuente, buganvillas y un retablo de azulejo.'],
    banos: ['Los baños', 'Cada habitación tiene el suyo; uno está adaptado.'],
    casa: ['La casa', 'El pasillo con su suelo hidráulico, las rejas y la entrada.'],
    magdalena: ['La Magdalena', 'Apartamento de la planta alta, con cocina y salón.'],
    cadaval: ['Duques de Cadaval', 'Apartamento de la planta alta, con cocina y salón.'],
    calvario: ['Puerta del Calvario', 'Apartamento de la planta alta, con cocina y salón.'],
    maria: ['Santa María del Castillo', 'Apartamento de la planta alta, con cocina y salón.'],
    placas: ['Las placas', 'Cada apartamento tiene la suya, pintada a mano, en la puerta.'],
    alta: ['La planta alta', 'Vigas de madera, papeles pintados y vistas al casco histórico.']
  };

  function $(s, r) { return (r || document).querySelector(s); }
  function todos(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function densidad() { return html.classList.contains('densidad-sobria') ? 'sobria' : 'baldosa'; }
  function esMovil() { return window.matchMedia('(max-width: 860px)').matches; }
  function alturaCabecera() { var c = $('#cabecera'); return c ? c.offsetHeight : 76; }
  function refrescar() { if (ST) ST.refresh(); }
  function limitar(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function esperar(fn, ms) { var t; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }
  function cuandoVisible(nodos, umbral, alEntrar, margen) {
    if (!('IntersectionObserver' in window)) { nodos.forEach(alEntrar); return; }
    var obs = new IntersectionObserver(function (entradas) {
      entradas.forEach(function (en) {
        if (!en.isIntersecting) return;
        obs.unobserve(en.target);
        alEntrar(en.target);
      });
    }, { threshold: umbral, rootMargin: margen || '0px' });
    nodos.forEach(function (n) { obs.observe(n); });
  }

  window.LaMae = window.LaMae || {};
  window.LaMae.densidad = densidad;
  window.LaMae.movimiento = movimiento;

  /* ───────────────────── fotos: datos incrustados por construir.mjs ───────────────────── */
  var FOTOS = [];
  try { FOTOS = JSON.parse($('#datos-fotos').textContent); } catch (e) { FOTOS = []; }
  function picture(f, sizes, carga) {
    var set = function (ext) { return f.anchos.map(function (a) { return 'assets/fotos/' + f.id + '-' + a + '.' + ext + ' ' + a + 'w'; }).join(', '); };
    var mayor = f.anchos[f.anchos.length - 1];
    var p = document.createElement('picture');
    ['avif', 'webp'].forEach(function (ext) {
      var s = document.createElement('source');
      s.type = 'image/' + ext; s.srcset = set(ext); s.sizes = sizes; p.appendChild(s);
    });
    var img = document.createElement('img');
    img.src = 'assets/fotos/' + f.id + '-' + mayor + '.jpg';
    img.srcset = set('jpg'); img.sizes = sizes;
    img.width = mayor; img.height = Math.round(f.h * mayor / f.w);
    img.alt = f.alt; img.decoding = 'async';
    if (carga !== 'eager') img.loading = 'lazy';
    p.appendChild(img);
    return p;
  }

  if (window.fetch && location.protocol !== 'file:') {
    fetch('data/config.json').then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
      if (!c) return;
      Object.keys(CONFIG).forEach(function (k) { if (k in c && c[k]) CONFIG[k] = c[k]; });
    }).catch(function () {});
  }

  /* ───────────────────────── Lenis ───────────────────────── */
  var lenis = null;
  if (movimiento && window.Lenis) {
    lenis = new window.Lenis({ lerp: 0.12, smoothWheel: true });
    lenis.on('scroll', ST.update);
    gsap.ticker.add(function (t) { lenis.raf(t * 1000); });
  }
  window.LaMae.lenis = lenis;

  function irA(destino) {
    var desfase = -alturaCabecera() + 1;
    if (destino === 0) { if (lenis) lenis.scrollTo(0, { duration: 1.4 }); else window.scrollTo(0, 0); return; }
    if (lenis) { lenis.scrollTo(destino, { offset: desfase, duration: 1.5 }); return; }
    var el = typeof destino === 'string' ? document.querySelector(destino) : destino;
    if (el) window.scrollTo(0, el.getBoundingClientRect().top + window.pageYOffset + desfase);
  }
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute('href');
    if (id === '#' || id === '#contenido' || !document.querySelector(id)) return;
    e.preventDefault();
    cerrarMenu();
    irA(id === '#inicio' ? 0 : id);
  });

  /* ───────────────────── titulares partidos (char-reveal) ───────────────────── */
  function partir(el) {
    var modo = el.dataset.revelar;
    var texto = el.textContent.replace(/\s+/g, ' ').trim();
    el.setAttribute('aria-label', texto);
    var piezas = [];
    function trocear(cadena, destino) {
      cadena.split(/(\s+)/).forEach(function (trozo) {
        if (!trozo) return;
        if (/^\s+$/.test(trozo)) { destino.appendChild(document.createTextNode(' ')); return; }
        var caja = document.createElement('span');
        caja.className = 'palabra';
        caja.setAttribute('aria-hidden', 'true');
        if (modo === 'letras') {
          Array.from(trozo).forEach(function (c) {
            var s = document.createElement('span');
            s.className = 'letra'; s.textContent = c;
            caja.appendChild(s); piezas.push(s);
          });
        } else {
          var s = document.createElement('span');
          s.className = 'palabra-int'; s.textContent = trozo;
          caja.appendChild(s); piezas.push(s);
        }
        destino.appendChild(caja);
      });
    }
    var hijos = Array.prototype.slice.call(el.childNodes);
    el.textContent = '';
    hijos.forEach(function (n, k) {
      if (n.nodeType === 3) {
        var t = n.textContent;
        /* la puntuación pegada a un énfasis («cuántos</em>.») va con su palabra: si no, el punto se va solo a otra línea */
        var pegada = k > 0 && hijos[k - 1].nodeType === 1 ? (t.match(/^[^\s]+/) || [''])[0] : '';
        var ultima = pegada ? el.querySelectorAll('.palabra') : [];
        if (pegada && ultima.length) {
          var s = document.createElement('span');
          s.className = (modo === 'letras' ? 'letra' : 'palabra-int') + ' punto';
          s.textContent = pegada;
          ultima[ultima.length - 1].appendChild(s);
          piezas.push(s);
          t = t.slice(pegada.length);
        }
        trocear(t, el);
        return;
      }
      if (n.nodeType === 1) {
        var envoltura = n.cloneNode(false);
        envoltura.setAttribute('aria-hidden', 'true');
        el.appendChild(envoltura);
        trocear(n.textContent, envoltura);
      }
    });
    return piezas;
  }
  function revelar(el, piezas, retardo) {
    var letras = el.dataset.revelar === 'letras';
    gsap.to(piezas, {
      y: 0, yPercent: 0, duration: 1.15, ease: 'expo.out', delay: retardo || 0,
      stagger: letras ? Math.min(0.035, 1.1 / piezas.length) : 0.07
    });
  }

  /* ─────────────────── la cortina avisa del momento de apertura ─────────────────── */
  var cortinaAbierta = false;
  function avisarApertura() {
    if (cortinaAbierta) return;
    cortinaAbierta = true;
    document.dispatchEvent(new CustomEvent('cortina-abre'));
  }
  function alAbrirse(fn) { if (cortinaAbierta) fn(); else document.addEventListener('cortina-abre', fn, { once: true }); }
  window.LaMae.alAbrirse = alAbrirse;

  todos('[data-revelar]').forEach(function (el) {
    var piezas = partir(el);
    if (!movimiento) return;
    if (el.closest('.hero')) { alAbrirse(function () { revelar(el, piezas, 0.15); }); return; }
    /* una sola vez: IntersectionObserver (ScrollTrigger once:true no dispara si ya está en pantalla) */
    cuandoVisible([el], 0.3, function () { revelar(el, piezas); });
  });

  /* ═══════════════ cortina «enlosar» ═══════════════
     Geometría compartida con la baldosa (assets/baldosa.svg): el medallón ocupa
     el cuadrado central de lado MED (en % del lado de la baldosa). */
  (function cortina() {
    var c = $('#cortina');
    if (!c) return;
    var retirada = false;
    var marca = $('#marca-simbolo');
    function retirar() {
      if (retirada) return;
      retirada = true;
      c.classList.add('fuera');
      c.setAttribute('hidden', '');
      if (marca) marca.style.visibility = '';
      avisarApertura();
      if (gsapReady) {
        /* durante la cortina GSAP se traga los atascos; después, Lenis manda */
        if (lenis) { lenis.start(); gsap.ticker.lagSmoothing(0); } else gsap.ticker.lagSmoothing(500, 33);
      }
      setTimeout(refrescar, 30);
    }
    window.LaMae.retirarCortina = retirar;
    if (!movimiento) { retirar(); return; }

    var baldosaOrigen = $('#baldosa');
    /* diámetro del aro del medallón, en % del lado de la baldosa */
    var MED = parseFloat((baldosaOrigen && baldosaOrigen.getAttribute('data-medallon')) || '70.71');
    var fondo = $('#cortina-fondo'), cajaLosas = $('#cortina-losas');
    var pieza = $('#cortina-pieza'), cuadro = $('#cortina-cuadro'), esquinas = $('#cortina-esquinas'), simb = $('#cortina-simbolo');

    /* la página arranca arriba: la retícula destapa el hero */
    if (!location.hash) {
      if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }
    if (lenis) lenis.stop();
    /* reloj que se traga los atascos de la carga en frío (un tirón cuenta como 1/30 s) */
    gsap.ticker.lagSmoothing(100, 33);

    /* el medallón de la baldosa (las piezas del logo, a la escala medida en el suelo):
       cada pieza dos veces, el relleno y el trazo (pathLength=1) */
    var ORDEN = ['s-aro', 's-bolas', 's-flor', 's-cruz'];
    var NS = 'http://www.w3.org/2000/svg';
    var rellenos = {}, trazos = [];
    function clonar(id, clase) {
      var o = baldosaOrigen && baldosaOrigen.querySelector('[data-pieza="' + id + '"]');
      if (!o) return null;
      var n = document.createElementNS(NS, 'path');
      ['d', 'transform', 'fill-rule'].forEach(function (a) { if (o.getAttribute(a)) n.setAttribute(a, o.getAttribute(a)); });
      n.setAttribute('class', clase);
      simb.appendChild(n);
      return n;
    }
    ['s-disco', 's-flor', 's-cruz', 's-puntos', 's-aro', 's-bolas'].forEach(function (id) {
      var r = clonar(id, id + ' relleno');
      if (r) rellenos[id] = r;
    });
    ORDEN.forEach(function (id) {
      var t = clonar(id, 'traza');
      if (!t) return;
      t.setAttribute('pathLength', '1');
      trazos.push(t);
    });
    /* las esquinas de la baldosa: los cuartos de círculo (clon del grupo del símbolo de la baldosa) */
    var grupoEsquinas = baldosaOrigen && baldosaOrigen.querySelector('#b-esquinas');
    if (grupoEsquinas) esquinas.innerHTML = grupoEsquinas.outerHTML.replace(/ id="b-esquinas"/, '');
    var piezasEsquina = todos('.b-esquina', esquinas);

    var losas = [], W, H, m, P, cx, cy;
    function montarLosas() {
      W = window.innerWidth; H = window.innerHeight;
      var movil = W < 700;
      m = movil ? Math.max(96, Math.round(W / 3.4)) : 132;
      function cuenta() {
        return (2 * Math.ceil((W / 2 - m / 2) / m) + 1) * (2 * Math.ceil((H / 2 - m / 2) / m) + 1);
      }
      while (cuenta() > 120) m += 8;
      var ci = Math.ceil((W / 2 - m / 2) / m), cj = Math.ceil((H / 2 - m / 2) / m);
      var x0 = Math.round(W / 2 - m / 2), y0 = Math.round(H / 2 - m / 2);
      cajaLosas.textContent = '';
      losas = [];
      for (var j = -cj; j <= cj; j++) {
        for (var i = -ci; i <= ci; i++) {
          var d = document.createElement('div');
          d.className = 'cortina__losa';
          d.style.width = d.style.height = m + 'px';
          d.style.left = (x0 + i * m) + 'px';
          d.style.top = (y0 + j * m) + 'px';
          var dist = Math.sqrt(i * i + j * j);
          d._dist = dist;
          if (i === 0 && j === 0) d.classList.add('cortina__losa--centro');
          cajaLosas.appendChild(d);
          losas.push(d);
        }
      }
      cx = W / 2; cy = H / 2;
      /* la pieza grande del principio: el símbolo a ~42 % del lado corto */
      P = Math.round(Math.min(W, H) * 0.42 / (MED / 100));
      pieza.style.width = pieza.style.height = P + 'px';
      gsap.set(pieza, { x: cx - P / 2, y: cy - P / 2, scale: 1, transformOrigin: '0 0' });
      gsap.set(losas, { scale: 0, rotationX: 0, opacity: 1 });
    }
    montarLosas();
    window.LaMae.cortinaLosas = function () { return losas.length; };
    window.LaMae.cortinaModulo = function () { return m; };

    gsap.set(trazos, { strokeDasharray: 1, strokeDashoffset: 1 });
    /* el cuadro de cal no existe mientras se traza (si no, la línea de cal no se ve sobre él) */
    gsap.set(cuadro, { scale: MED / 100, borderRadius: '50%', opacity: 0 });
    /* el logo del menú espera a que llegue la baldosa que vuela */
    if (marca) marca.style.visibility = 'hidden';
    gsap.set(piezasEsquina, { scale: 0, svgOrigin: function (k, el) { return el.getAttribute('data-origen') || '0 0'; } });

    var fuentes = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
    var tope = new Promise(function (ok) { setTimeout(ok, 900); });
    Promise.race([fuentes, tope]).then(function () {
      var tl = gsap.timeline({ onComplete: retirar });
      var resto = losas.filter(function (d) { return d._dist > 0; });
      var centro = losas.filter(function (d) { return d._dist === 0; })[0];
      var maxD = Math.max.apply(null, losas.map(function (d) { return d._dist; }));

      /* 1 · el símbolo se traza en línea de cal: aro → bolas → flor → cruz */
      tl.addLabel('traza');
      tl.to(trazos, { strokeDashoffset: 0, duration: 0.3, stagger: 0.13, ease: 'power2.inOut', autoRound: false });

      /* 2 · se rellena y se encaja en su cuadrado: aparecen los cuartos de círculo */
      tl.addLabel('encaja', '-=0.05');
      tl.to(Object.keys(rellenos).map(function (k) { return rellenos[k]; }), { opacity: 1, duration: 0.35, ease: 'power1.out' }, 'encaja');
      tl.to(trazos, { opacity: 0, duration: 0.3 }, 'encaja+=0.1');
      tl.to(cuadro, { opacity: 1, duration: 0.22, ease: 'power1.out' }, 'encaja');
      tl.to(cuadro, { scale: 1, borderRadius: '0%', duration: 0.5, ease: 'expo.inOut' }, 'encaja');
      tl.to(piezasEsquina, { scale: 1, duration: 0.36, stagger: 0.04, ease: 'back.out(1.6)' }, 'encaja+=0.3');

      /* 3 · se replica en retícula desde el centro (retardo por distancia) */
      tl.addLabel('replica', '+=0.02');
      tl.to(pieza, { scale: m / P, x: Math.round(cx - m / 2), y: Math.round(cy - m / 2), duration: 0.5, ease: 'expo.inOut' }, 'replica');
      /* el retardo por distancia va en cada baldosa (stagger en función) */
      tl.to(resto, {
        scale: 1, duration: 0.34, ease: 'back.out(1.4)',
        stagger: function (k, el) { return el._dist / maxD * 0.4; }
      }, 'replica+=0.2');
      tl.call(function () { fondo.style.opacity = '0'; if (centro) gsap.set(centro, { scale: 1 }); }, null, 'replica+=0.95');

      /* 4 · se levantan desde el centro hacia fuera; la central, la última, vuela al logo */
      tl.addLabel('levanta', 'replica+=0.97');
      tl.call(avisarApertura, null, 'levanta');
      tl.to(resto, {
        rotationX: 88, opacity: 0, duration: 0.5, ease: 'expo.inOut',
        stagger: function (k, el) { return (el._dist - 1) / Math.max(1, maxD - 1) * 0.42; }
      }, 'levanta');
      tl.addLabel('vuelo', 'levanta+=0.46');
      if (centro) tl.set(centro, { opacity: 0 }, 'vuelo');
      var vuelo = { p: 0 };
      var desde = null;
      tl.to(vuelo, {
        p: 1, duration: 0.56, ease: 'expo.inOut',
        onStart: function () { desde = { x: gsap.getProperty(pieza, 'x'), y: gsap.getProperty(pieza, 'y'), s: gsap.getProperty(pieza, 'scale') }; },
        onUpdate: function () {
          if (!desde) return;
          /* el destino se mide en cada fotograma (las letras cargan y la cabecera se mueve) */
          var r = marca.getBoundingClientRect();
          /* la pieza cuyo aro mide lo que el aro del logo (en el logo, el aro ocupa 192 de 200) */
          var lado = r.width * 0.96 / (MED / 100);
          var hx = r.left + r.width / 2 - lado / 2, hy = r.top + r.height / 2 - lado / 2;
          var p = vuelo.p;
          gsap.set(pieza, { x: desde.x + (hx - desde.x) * p, y: desde.y + (hy - desde.y) * p, scale: desde.s + (lado / P - desde.s) * p });
          cuadro.style.opacity = esquinas.style.opacity = String(1 - limitar(p * 1.6, 0, 1));
          /* en el aire deja de ser baldosa azul y toma los colores del logo */
          simb.classList.toggle('es-logo', p > 0.25);
          window.__cortinaFinal = { x: hx, y: hy, lado: lado };
        }
      }, 'vuelo');
      window.__cortinaTl = tl;
      window.LaMae.cortinaTl = tl;
    });

    /* si la ventana cambia de tamaño a medias, se termina sin más */
    window.addEventListener('resize', function () { if (!retirada && window.__cortinaTl) window.__cortinaTl.progress(1); });
  })();

  /* ═══════════════ hero: retícula fantasma de juntas ═══════════════ */
  (function reticula() {
    var caja = $('#reticula'), suelo = $('#hero-suelo');
    if (!caja || !suelo) return;
    var celdas = [], cols = 0, filas = 0, ultima = -1;
    function montar() {
      var r = suelo.getBoundingClientRect();
      var lado = esMovil() ? 64 : 84;
      cols = Math.max(3, Math.round(r.width / lado));
      filas = Math.max(3, Math.round(r.height / lado));
      caja.style.gridTemplateColumns = 'repeat(' + cols + ', 1fr)';
      caja.style.gridTemplateRows = 'repeat(' + filas + ', 1fr)';
      caja.textContent = '';
      celdas = [];
      for (var k = 0; k < cols * filas; k++) { var i = document.createElement('i'); caja.appendChild(i); celdas.push(i); }
      ultima = -1;
    }
    montar();
    window.addEventListener('resize', esperar(montar, 200));
    window.LaMae.reticula = { celdas: function () { return celdas.length; } };
    if (!movimiento || esTactil) return;                /* en táctil y con movimiento reducido, quieta */
    suelo.addEventListener('pointermove', function (e) {
      if (densidad() !== 'baldosa' || (e.pointerType && e.pointerType !== 'mouse')) return;
      var r = suelo.getBoundingClientRect();
      var ci = Math.floor((e.clientX - r.left) / r.width * cols), fj = Math.floor((e.clientY - r.top) / r.height * filas);
      ci = limitar(ci, 0, cols - 1); fj = limitar(fj, 0, filas - 1);
      var k = fj * cols + ci;
      if (k === ultima) return;
      ultima = k;
      var luz = celdas[k];
      luz.classList.add('es-luz');
      setTimeout(function () { luz.classList.remove('es-luz'); }, 160);
      /* las vecinas se ladean unos grados, con retardo: como una baldosa suelta que se pisa */
      for (var dj = -1; dj <= 1; dj++) {
        for (var di = -1; di <= 1; di++) {
          if (!di && !dj) continue;
          var x = ci + di, y = fj + dj;
          if (x < 0 || y < 0 || x >= cols || y >= filas) continue;
          var v = celdas[y * cols + x];
          gsap.killTweensOf(v);
          gsap.timeline()
            .to(v, { rotationX: -dj * 9, rotationY: di * 9, duration: 0.35, ease: 'power2.out', delay: 0.05 + 0.04 * (Math.abs(di) + Math.abs(dj)) })
            .to(v, { rotationX: 0, rotationY: 0, duration: 0.9, ease: 'power3.out' });
        }
      }
    });
  })();

  /* ───────────────── el siglo cuenta en números romanos: I … XVIII ───────────────── */
  function romano(n) {
    var v = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']], s = '';
    v.forEach(function (p) { while (n >= p[0]) { s += p[1]; n -= p[0]; } });
    return s;
  }
  cuandoVisible(todos('[data-romano]'), 0.6, function (el) {
    var fin = parseInt(el.dataset.romano, 10);
    if (!movimiento) { el.textContent = romano(fin); return; }
    var o = { v: 1 };
    el.textContent = 'I';
    gsap.to(o, { v: fin, duration: 1.5, ease: 'power2.out', onUpdate: function () { el.textContent = romano(Math.round(o.v)); } });
  });

  /* ───────────────── apariciones de una sola vez ───────────────── */
  cuandoVisible(todos('.destapa'), 0.2, function (el) { el.classList.add('es-visible'); });
  cuandoVisible(todos('.arco'), 0.25, function (el) { el.classList.add('es-visible'); });
  cuandoVisible(todos('.categorias li'), 0.6, function (el) { el.classList.add('es-visible'); });
  cuandoVisible(todos('.plano'), 0.25, function (el) { el.classList.add('es-visible'); });

  /* ═══════════════ 3 · dos plantas: anclada en escritorio ═══════════════ */
  (function plantas() {
    var sec = $('#plantas');
    if (!sec) return;
    var alta = $('#corte-alta'), baja = $('#corte-baja'), iA = $('#item-alta'), iB = $('#item-baja');
    function estado(p) {
      var b = p > 0.12, a = p > 0.55;
      baja.classList.toggle('es-encendida', b); iB.classList.toggle('es-encendida', b);
      alta.classList.toggle('es-encendida', a); iA.classList.toggle('es-encendida', a);
    }
    var anclaje = null;
    function montar() {
      if (anclaje) { anclaje.kill(true); anclaje = null; }
      sec.classList.remove('es-anclada');
      if (!movimiento || esMovil()) { estado(1); return; }   /* móvil, sin GSAP o movimiento reducido: las dos encendidas */
      sec.classList.add('es-anclada');
      anclaje = ST.create({
        trigger: sec, start: 'top top', end: '+=110%', pin: true, invalidateOnRefresh: true,
        onUpdate: function (s) { estado(s.progress); }
      });
      estado(anclaje.progress);
    }
    montar();
    var anchoPrevio = window.innerWidth;
    window.addEventListener('resize', esperar(function () {
      if (Math.abs(window.innerWidth - anchoPrevio) < 2) return;
      anchoPrevio = window.innerWidth;
      montar(); refrescar();
    }, 200));
    window.LaMae.plantas = { anclada: function () { return !!anclaje; }, progreso: function () { return anclaje ? anclaje.progress : 1; } };
  })();

  /* ═══════════════ galería de una estancia o de un apartamento (dialog) ═══════════════ */
  var galeria = (function () {
    var dlg = $('#galeria');
    if (!dlg || !dlg.showModal) return null;
    var lista = [], i = 0, origen = null;
    var foto = $('#galeria-foto'), cuenta = $('#galeria-cuenta');
    function pintar() {
      var f = lista[i];
      foto.textContent = '';
      foto.appendChild(picture(f, 'min(1100px, 100vw)', 'eager'));
      var cap = document.createElement('figcaption');
      cap.textContent = f.alt;
      foto.appendChild(cap);
      cuenta.textContent = (i + 1) + ' de ' + lista.length;
    }
    function abrir(estancia, idFoto, desde) {
      lista = FOTOS.filter(function (f) { return f.estancia === estancia; });
      if (!lista.length) return;
      i = Math.max(0, lista.findIndex(function (f) { return f.id === idFoto; }));
      var t = ESTANCIAS[estancia] || [estancia, ''];
      $('#galeria-titulo').textContent = t[0];
      $('#galeria-texto').textContent = t[1];
      origen = desde || null;
      pintar();
      dlg.showModal();
      if (lenis) lenis.stop();
    }
    function mover(d) { i = (i + d + lista.length) % lista.length; pintar(); }
    $('#galeria-antes').addEventListener('click', function () { mover(-1); });
    $('#galeria-despues').addEventListener('click', function () { mover(1); });
    $('#galeria-cerrar').addEventListener('click', function () { dlg.close(); });
    dlg.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') { e.preventDefault(); mover(-1); }
      if (e.key === 'ArrowRight') { e.preventDefault(); mover(1); }
    });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) dlg.close(); });
    /* Escape cierra el <dialog> solo; aquí se devuelve el foco a quien lo abrió */
    dlg.addEventListener('close', function () { if (lenis) lenis.start(); if (origen) origen.focus(); });
    todos('[data-estancia]').forEach(function (b) {
      if (b.tagName !== 'BUTTON') return;
      b.addEventListener('click', function () { abrir(b.dataset.estancia, null, b); });
    });
    return { abrir: abrir };
  })();
  window.LaMae.galeria = galeria;

  /* ═══════════════ 5 · las placas se voltean (ratón y foco por CSS; toque aquí) ═══════════════ */
  todos('.placa').forEach(function (placa) {
    var giro = $('.placa__giro', placa), boton = $('.placa__boton', placa);
    if (!giro || !boton) return;
    giro.addEventListener('click', function () {
      if (densidad() === 'baldosa' && esTactil && !placa.classList.contains('es-volteada')) {
        todos('.placa.es-volteada').forEach(function (o) { if (o !== placa) o.classList.remove('es-volteada'); });
        placa.classList.add('es-volteada');
        return;
      }
      if (galeria) galeria.abrir(boton.dataset.estancia, null, boton);
    });
  });

  /* ───────────────── cinta de opiniones: velocidad ligada al scroll ───────────────── */
  (function cinta() {
    var pista = $('#citas-pista');
    if (!pista || !movimiento) return;
    todos('li', pista).forEach(function (li) {
      var c = li.cloneNode(true);
      c.setAttribute('aria-hidden', 'true');
      pista.appendChild(c);
    });
    var x = 0, mitad = 0, visible = false;
    function medir() { mitad = pista.scrollWidth / 2; }
    medir();
    window.addEventListener('resize', esperar(medir, 200));
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(medir);
    new IntersectionObserver(function (e) { visible = e[0].isIntersecting; }).observe(pista);
    gsap.ticker.add(function () {
      if (densidad() !== 'baldosa') { if (x) { x = 0; pista.style.transform = ''; } return; }
      if (!visible || !mitad) return;
      var vel = lenis ? Math.abs(lenis.velocity || 0) : 0;
      x -= 0.45 + Math.min(vel, 40) * 0.12;
      if (-x >= mitad) x += mitad;
      pista.style.transform = 'translate3d(' + x.toFixed(2) + 'px,0,0)';
    });
  })();

  /* ═══════════════ pie: el suelo se vuelve a enlosar, desde los bordes ═══════════════ */
  (function suelo() {
    var caja = $('#suelo'), capa = $('#suelo-losas');
    if (!caja || !capa) return;
    function montar() {
      var W = caja.clientWidth, H = caja.clientHeight;
      if (!W || !H) return;
      var s = esMovil() ? 56 : 72;
      var ci = Math.ceil((W / 2 - s / 2) / s), cj = Math.ceil((H / 2 - s / 2) / s);
      var x0 = Math.round(W / 2 - s / 2), y0 = Math.round(H / 2 - s / 2);
      var frag = document.createDocumentFragment();
      for (var j = -cj; j <= cj; j++) {
        for (var i = -ci; i <= ci; i++) {
          var b = document.createElement('i');
          b.style.width = b.style.height = s + 'px';
          b.style.left = (x0 + i * s) + 'px';
          b.style.top = (y0 + j * s) + 'px';
          /* desde los bordes hacia el centro: la que está más lejos del centro, antes */
          var hacia = Math.max(ci - Math.abs(i), cj - Math.abs(j));
          b.style.transitionDelay = (hacia * 0.11 + ((i * 7 + j * 13) % 5 + 5) % 5 * 0.025).toFixed(3) + 's';
          frag.appendChild(b);
        }
      }
      capa.textContent = '';
      capa.appendChild(frag);
      caja.classList.add('es-construido');
    }
    montar();
    var anchoPrevio = window.innerWidth;
    window.addEventListener('resize', esperar(function () {
      if (Math.abs(window.innerWidth - anchoPrevio) < 2) return;
      anchoPrevio = window.innerWidth; montar();
    }, 250));
    cuandoVisible([caja], 0.3, function () { caja.classList.add('es-visible'); });
  })();

  /* ───────────────── botones magnéticos ───────────────── */
  (function imanes() {
    if (!movimiento || esTactil) return;
    todos('.iman').forEach(function (el) {
      var aX = gsap.quickTo(el, 'x', { duration: 0.55, ease: 'power3.out' });
      var aY = gsap.quickTo(el, 'y', { duration: 0.55, ease: 'power3.out' });
      el.addEventListener('pointermove', function (e) {
        var c = el.getBoundingClientRect();
        aX((e.clientX - (c.left + c.width / 2)) * 0.3);
        aY((e.clientY - (c.top + c.height / 2)) * 0.4);
      });
      el.addEventListener('pointerleave', function () { aX(0); aY(0); });
    });
  })();

  /* ───────────────── cursor propio: punto de tinta + aro azul ───────────────── */
  (function cursor() {
    if (!movimiento || esTactil) return;
    var aro = document.createElement('div');
    var pt = document.createElement('div');
    aro.className = 'cursor';
    pt.className = 'cursor-punto';
    [aro, pt].forEach(function (n) { n.setAttribute('aria-hidden', 'true'); document.body.appendChild(n); });
    var aX = gsap.quickTo(aro, 'x', { duration: 0.28, ease: 'power3.out' });
    var aY = gsap.quickTo(aro, 'y', { duration: 0.28, ease: 'power3.out' });
    var ultimo = null;
    function mostrar(si) { aro.classList.toggle('cursor--vivo', si); pt.classList.toggle('cursor--vivo', si); }
    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      if (!aro.classList.contains('cursor--vivo')) { gsap.set(aro, { x: e.clientX, y: e.clientY }); mostrar(true); }
      /* el del sistema se oculta solo cuando el propio ya se ve */
      if (!html.classList.contains('con-cursor')) html.classList.add('con-cursor');
      gsap.set(pt, { x: e.clientX, y: e.clientY });
      aX(e.clientX); aY(e.clientY);
      if (e.target !== ultimo) {
        ultimo = e.target;
        var t = e.target.closest ? e.target : null;
        var sobre = !!(t && t.closest('a, button, label, input, select, textarea, [role="button"], .placa__giro'));
        var oscuro = !!(t && t.closest('.fechas, .cookies, .mando, .galeria__foto'));
        aro.classList.toggle('cursor--activo', sobre);
        aro.classList.toggle('cursor--oscuro', oscuro);
        pt.classList.toggle('cursor-punto--activo', sobre);
      }
    });
    html.addEventListener('mouseleave', function () { mostrar(false); });
    html.addEventListener('mouseenter', function () { if (html.classList.contains('con-cursor')) mostrar(true); });
  })();

  /* ───────────────── cabecera fija y menú móvil ───────────────── */
  var cabecera = $('#cabecera');
  var boton = $('#hamburguesa');
  (function cabeceraFija() {
    if (!cabecera) return;
    function actualizar() { cabecera.classList.toggle('cabecera--fija', window.pageYOffset > 40); }
    window.addEventListener('scroll', actualizar, { passive: true });
    actualizar();
  })();
  function cerrarMenu() {
    if (!cabecera || !boton || !cabecera.classList.contains('menu-abierto')) return;
    cabecera.classList.remove('menu-abierto');
    boton.setAttribute('aria-expanded', 'false');
    boton.querySelector('.visualmente-oculto').textContent = 'Abrir menú';
    if (lenis) lenis.start();
  }
  if (boton) {
    boton.addEventListener('click', function () {
      var abierto = cabecera.classList.toggle('menu-abierto');
      boton.setAttribute('aria-expanded', abierto ? 'true' : 'false');
      boton.querySelector('.visualmente-oculto').textContent = abierto ? 'Cerrar menú' : 'Abrir menú';
      if (lenis) { if (abierto) lenis.stop(); else lenis.start(); }
    });
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') cerrarMenu(); });

  /* ───────────────── mapa: Google solo bajo clic ───────────────── */
  (function mapa() {
    var btn = $('#mapa-boton'), caja = $('#mapa-consentimiento');
    if (!btn || !caja) return;
    btn.addEventListener('click', function () {
      var marco = document.createElement('iframe');
      marco.src = 'https://www.google.com/maps?q=' + encodeURIComponent('A Casa da Mãe, Calle Díaz Brito 16, 06100 Olivenza') + '&output=embed';
      marco.loading = 'lazy';
      marco.title = 'Mapa: A Casa da Mãe, calle Díaz Brito 16, Olivenza';
      marco.allowFullscreen = true;
      marco.referrerPolicy = 'no-referrer-when-downgrade';
      caja.parentNode.replaceChild(marco, caja);
      setTimeout(refrescar, 60);
    });
  })();

  /* ───────────────── consultar fechas: el mensaje para la casa ───────────────── */
  function copiar(texto) {
    if (navigator.clipboard && window.isSecureContext) {
      return navigator.clipboard.writeText(texto).then(function () { return true; }, function () { return copiarViejo(texto); });
    }
    return Promise.resolve(copiarViejo(texto));
  }
  function copiarViejo(texto) {
    var t = document.createElement('textarea');
    t.value = texto; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
    document.body.appendChild(t); t.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) {}
    document.body.removeChild(t);
    return ok;
  }

  (function reserva() {
    var form = $('#reserva');
    if (!form) return;
    var llegada = $('#llegada'), salida = $('#salida');
    var errFechas = $('#fechas-error'), err = $('#reserva-error');
    var listo = $('#reserva-listo'), salidaTxt = $('#reserva-texto');
    var estado = $('#reserva-estado');
    var texto = '';
    var DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    var MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    function aFecha(v) { var p = v.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
    function iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
    function largo(d, conAnio) { return DIAS[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES[d.getMonth()] + (conAnio ? ' de ' + d.getFullYear() : ''); }
    var hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    llegada.min = iso(hoy);

    function comprobarFechas(final) {
      llegada.removeAttribute('aria-invalid'); salida.removeAttribute('aria-invalid');
      if (!llegada.value || !salida.value) {
        errFechas.textContent = final ? 'Elija la fecha de llegada y la de salida.' : '';
        if (final) (llegada.value ? salida : llegada).setAttribute('aria-invalid', 'true');
        return false;
      }
      if (aFecha(salida.value) <= aFecha(llegada.value)) {
        errFechas.textContent = 'La salida tiene que ser posterior a la llegada.';
        salida.setAttribute('aria-invalid', 'true');
        return false;
      }
      errFechas.textContent = '';
      return true;
    }
    llegada.addEventListener('change', function () {
      if (llegada.value) { var a = aFecha(llegada.value); a.setDate(a.getDate() + 1); salida.min = iso(a); }
      if (salida.value) comprobarFechas(false);
    });
    salida.addEventListener('change', function () { comprobarFechas(false); });

    var PLANTA = {
      baja: 'Nos interesa la planta baja (una habitación doble).',
      alta: 'Nos interesa la planta alta (un apartamento).',
      igual: 'Nos da igual la planta.'
    };
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var okFechas = comprobarFechas(true);
      var nombre = form.elements.nombre.value.trim();
      form.elements.nombre.toggleAttribute('aria-invalid', !nombre);
      err.textContent = nombre ? '' : 'Falta su nombre, para saber quién pregunta.';
      if (!okFechas || !nombre) { listo.hidden = true; return; }
      var a = aFecha(llegada.value), b = aFecha(salida.value);
      var noches = Math.round((b - a) / 864e5);
      var ad = Math.max(1, parseInt(form.elements.adultos.value, 10) || 1);
      var ni = Math.max(0, parseInt(form.elements.ninos.value, 10) || 0);
      var quienes = ad + (ad === 1 ? ' adulto' : ' adultos') + (ni ? ' y ' + ni + (ni === 1 ? ' niño' : ' niños') : '');
      var mismoAnio = a.getFullYear() === b.getFullYear();
      var planta = (form.elements.planta.value || 'igual');
      var lineas = [
        'Hola, quería consultar disponibilidad en A Casa da Mãe del ' + largo(a, !mismoAnio) + ' al ' + largo(b, true) +
          ' (' + noches + (noches === 1 ? ' noche' : ' noches') + '), para ' + quienes + '.',
        PLANTA[planta] || PLANTA.igual
      ];
      var msg = form.elements.mensaje.value.trim();
      if (msg) lineas.push('', msg);
      lineas.push('', '¿Tienen libre esas fechas?', '', 'Un saludo,', nombre);
      texto = lineas.join('\n');
      salidaTxt.textContent = texto;
      var cod = encodeURIComponent(texto);
      $('#reserva-whatsapp').href = 'https://wa.me/' + CONFIG.whatsapp + '?text=' + cod;
      /* sms:+34…?&body=… lo entienden iOS y Android */
      $('#reserva-sms').href = 'sms:' + CONFIG.telefonoEnlace + '?&body=' + cod;
      $('#reserva-email').href = 'mailto:' + CONFIG.email + '?subject=' + encodeURIComponent('Consulta de fechas · A Casa da Mãe') + '&body=' + cod;
      estado.textContent = '';
      listo.hidden = false;
      setTimeout(refrescar, 30);
      if (listo.scrollIntoView) listo.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    });
    $('#reserva-copiar').addEventListener('click', function () {
      copiar(texto).then(function (ok) {
        estado.textContent = ok ? 'Mensaje copiado. Péguelo donde prefiera.' : 'No se ha podido copiar: seleccione el texto y cópielo a mano.';
      });
    });
  })();

  /* ───────────────── aviso de cookies ───────────────── */
  (function cookies() {
    var caja = $('#cookies'), ok = $('#cookies-aceptar'), reabrir = $('#cookies-reabrir');
    if (!caja || !ok) return;
    function ver(si) {
      caja.hidden = !si;                      /* el CSS pone display solo si NO hay [hidden] */
      document.body.classList.toggle('cookies-visibles', si);
    }
    var guardado = null;
    try { guardado = localStorage.getItem('casadamae-cookies'); } catch (e) {}
    if (guardado !== 'ok') ver(true);
    ok.addEventListener('click', function () {
      ver(false);
      try { localStorage.setItem('casadamae-cookies', 'ok'); } catch (e) {}
    });
    if (reabrir) reabrir.addEventListener('click', function () { ver(true); ok.focus(); });
  })();

  var anio = $('#anio');
  if (anio) anio.textContent = new Date().getFullYear();

  if (gsapReady && document.fonts && document.fonts.ready) document.fonts.ready.then(refrescar);
  /* contenido que cambia de alto (mensaje, mapa, galería): el fin de página de ScrollTrigger se queda viejo */
  if (gsapReady && 'ResizeObserver' in window) {
    var altoPrevio = 0;
    var refrescarTarde = esperar(refrescar, 150);
    new ResizeObserver(function () {
      var a = document.body.offsetHeight;
      if (Math.abs(a - altoPrevio) < 40) return;
      altoPrevio = a;
      refrescarTarde();
    }).observe(document.body);
  }

  /* ═══════════════════════════════════════════════════════════════════════
     [MANDO DE MAQUETA] — SOLO REVISIÓN INTERNA. NO PUBLICAR.
     Borrar este bloque entero, el bloque CSS marcado igual en estilos.css,
     el <div class="mando">, la galería completa y la tabla de puntuaciones
     del HTML, y la parte de densidad del script bloqueante del <head>.
     Receta en el README (o node scripts/quitar-mando.mjs).
     ═══════════════════════════════════════════════════════════════════════ */
  (function mandoMaqueta() {
    var mando = $('#mando');
    if (!mando) return;
    /* solo con ?revision: el enlace que recibe el cliente sale limpio */
    if (!/[?&]revision\b/.test(window.location.search)) return;
    mando.hidden = false;                       /* sin JS no haría nada: lo enseña el JS */
    var botones = todos('[data-densidad]', mando);

    /* galería completa filtrable: solo se construye cuando hace falta (sobria) */
    var GRUPOS = [
      ['todas', 'Todas', function () { return true; }],
      ['baja', 'Planta baja', function (e) { return ['habitaciones', 'salon', 'cocina', 'lectura', 'banos', 'casa'].indexOf(e) > -1; }],
      ['patio', 'Patio', function (e) { return e === 'patio'; }],
      ['magdalena', 'La Magdalena', function (e) { return e === 'magdalena'; }],
      ['cadaval', 'Duques de Cadaval', function (e) { return e === 'cadaval'; }],
      ['calvario', 'Puerta del Calvario', function (e) { return e === 'calvario'; }],
      ['maria', 'Santa María del Castillo', function (e) { return e === 'maria'; }]
    ];
    var hecha = false;
    function galeriaCompleta() {
      if (hecha) return;
      hecha = true;
      var filtros = $('#completa-filtros'), rejilla = $('#completa-rejilla');
      GRUPOS.forEach(function (g, n) {
        var b = document.createElement('button');
        b.type = 'button';
        b.textContent = g[1];
        b.setAttribute('aria-pressed', n === 0 ? 'true' : 'false');
        b.addEventListener('click', function () {
          todos('button', filtros).forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
          todos('li', rejilla).forEach(function (li) { li.hidden = !g[2](li.dataset.estancia); });
          setTimeout(refrescar, 60);
        });
        filtros.appendChild(b);
      });
      FOTOS.forEach(function (f) {
        var li = document.createElement('li');
        li.dataset.estancia = f.estancia;
        var b = document.createElement('button');
        b.type = 'button';
        b.setAttribute('aria-label', 'Ampliar: ' + f.alt);
        b.appendChild(picture(f, '(max-width: 640px) 50vw, 220px', 'lazy'));
        b.addEventListener('click', function () { if (galeria) galeria.abrir(f.estancia, f.id, b); });
        li.appendChild(b);
        rejilla.appendChild(li);
      });
    }
    function aplicar(d) {
      html.classList.remove('densidad-baldosa', 'densidad-sobria');
      html.classList.add('densidad-' + d);
      botones.forEach(function (b) { b.setAttribute('aria-pressed', b.getAttribute('data-densidad') === d ? 'true' : 'false'); });
      try { localStorage.setItem('casadamae-densidad', d); } catch (e) {}
      if (d === 'sobria') galeriaCompleta();
      document.dispatchEvent(new CustomEvent('densidad-cambiada', { detail: d }));
      setTimeout(refrescar, 90);
    }
    var actual = densidad();
    if (actual === 'sobria') galeriaCompleta();
    botones.forEach(function (b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-densidad') === actual ? 'true' : 'false');
      b.addEventListener('click', function () { aplicar(b.getAttribute('data-densidad')); });
    });
  })();
  /* ═══════════ fin del bloque [MANDO DE MAQUETA] ═══════════ */
})();
