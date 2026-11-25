// Offline mock of the Toolshop API endpoints used by the collection.
//
// It serves made-up data shaped like the real API (same fields, pagination
// format and error messages), so the collection can be run without network
// access, for example while editing tests:
//
//   npm run mock                     (starts on http://localhost:3000)
//   npm run test:mock                (starts the mock and runs the collections)
//
// Set MOCK_BUG to break one behaviour on purpose and watch the tests catch it:
//   MOCK_BUG=sort    price sort comes back unsorted
//   MOCK_BUG=search  search ignores the query and returns everything
//   MOCK_BUG=login   a wrong password is accepted

const http = require('http');

const PORT = Number(process.env.PORT || 3000);
const BUG = process.env.MOCK_BUG || '';
const PER_PAGE = 9;

let seq = 0;
const id = () => `01MOCK${String(++seq).padStart(20, '0')}`;

// ---------- data ----------
const top = [
  { id: id(), name: 'Hand Tools', slug: 'hand-tools', parent_id: null },
  { id: id(), name: 'Power Tools', slug: 'power-tools', parent_id: null },
];
const child = (name, slug, parent) => ({ id: id(), name, slug, parent_id: parent.id });
const categories = [
  ...top,
  child('Hammer', 'hammer', top[0]),
  child('Pliers', 'pliers', top[0]),
  child('Wrench', 'wrench', top[0]),
  child('Drill', 'drill', top[1]),
  child('Sander', 'sander', top[1]),
  child('Chisels', 'chisels', top[0]),
  child('Screwdriver', 'screwdriver', top[0]),
  child('Saw', 'saw', top[1]),
];
const cat = slug => categories.find(c => c.slug === slug);

const brands = [
  { id: id(), name: 'ForgeFlex Tools', slug: 'forgeflex-tools' },
  { id: id(), name: 'MightyCraft Hardware', slug: 'mightycraft-hardware' },
];

const raw = [
  ['Combination Pliers', 14.15, 'pliers'], ['Pliers', 12.01, 'pliers'], ['Long Nose Pliers', 14.24, 'pliers'],
  ['Slip Joint Pliers', 9.17, 'pliers'], ['Claw Hammer', 12.58, 'hammer'], ['Thor Hammer', 11.14, 'hammer'],
  ['Court Hammer', 18.63, 'hammer'], ['Hammer', 7.99, 'hammer'], ['Adjustable Wrench', 20.33, 'wrench'],
  ['Cordless Drill 12V', 46.50, 'drill'], ['Cordless Drill 18V', 119.55, 'drill'], ['Sheet Sander', 58.48, 'sander'],
  ['Belt Sander', 73.59, 'sander'], ['Random Orbit Sander', 100.79, 'sander'], ['Mini Wrench', 3.55, 'wrench'],
  ['Wrench Set', 24.99, 'wrench'], ['Drill Bits', 4.65, 'drill'], ['Sanding Pads', 5.55, 'sander'],
  ['Rubber Mallet Hammer', 15.20, 'hammer'], ['Bent Nose Pliers', 13.10, 'pliers'],
  ['Claw Hammer with Fiberglass Handle', 20.14, 'hammer'], ['Cordless Drill 24V', 66.54, 'drill'],
  ['Chisels Set', 12.92, 'chisels'], ['Wood Carving Chisels', 45.23, 'chisels'], ['Swiss Woodcarving Chisels', 22.96, 'chisels'],
  ['Phillips Screwdriver', 4.92, 'screwdriver'], ['Mini Screwdriver', 13.96, 'screwdriver'],
  ['Wood Saw', 12.18, 'saw'], ['Circular Saw', 80.19, 'saw'],
];
const products = raw.map(([name, price, slug], i) => {
  const c = cat(slug);
  const b = brands[i % 2];
  const pid = id();
  return {
    id: pid, name, price, description: `${name} for everyday jobs.`,
    is_location_offer: false, is_rental: false, co2_rating: 'ABCDE'[i % 5], in_stock: i % 7 !== 0, is_eco_friendly: i % 3 === 0,
    product_image: { id: id(), by_name: 'Mock', by_url: '', source_name: 'Mock', source_url: '', file_name: `${slug}.avif`, title: name },
    category: { id: c.id, name: c.name, slug: c.slug },
    brand: { id: b.id, name: b.name },
    specs: [
      { id: id(), product_id: pid, spec_name: 'Weight', spec_unit: 'g', spec_value: String(200 + i * 10) },
      { id: id(), product_id: pid, spec_name: 'Warranty', spec_unit: 'years', spec_value: '2' },
    ],
  };
});

// ---------- helpers ----------
const summary = ({ specs, ...p }) => p;

function page(list, pageNo) {
  const total = list.length;
  const last = Math.max(1, Math.ceil(total / PER_PAGE));
  const start = (pageNo - 1) * PER_PAGE;
  const data = list.slice(start, start + PER_PAGE).map(summary);
  return {
    current_page: pageNo, data, from: data.length ? start + 1 : null, last_page: last,
    per_page: PER_PAGE, to: data.length ? start + data.length : null, total,
  };
}

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise(resolve => {
    let s = '';
    req.on('data', c => (s += c));
    req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve(null); } });
  });
}

// ---------- routes ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const parts = url.pathname.split('/').filter(Boolean);
  const q = url.searchParams;

  if (req.method === 'GET' && url.pathname === '/products') {
    let list = [...products];
    if (q.get('by_category')) list = list.filter(p => p.category.id === q.get('by_category'));
    if (q.get('by_brand')) list = list.filter(p => p.brand.id === q.get('by_brand'));
    if (q.get('between')) {
      const [, min, max] = q.get('between').split(',');
      list = list.filter(p => p.price >= Number(min) && p.price <= Number(max));
    }
    if (q.get('sort')) {
      const [field, dir] = q.get('sort').split(',');
      list.sort((a, b) => (field === 'price' ? a.price - b.price : a.name.localeCompare(b.name)));
      if (dir === 'desc') list.reverse();
      if (BUG === 'sort' && field === 'price') [list[0], list[1]] = [list[1], list[0]];
    }
    return send(res, 200, page(list, Number(q.get('page') || 1)));
  }

  if (req.method === 'GET' && url.pathname === '/products/search') {
    const term = (q.get('q') || '').toLowerCase();
    const list = BUG === 'search' ? products : products.filter(p => p.name.toLowerCase().includes(term));
    return send(res, 200, page(list, Number(q.get('page') || 1)));
  }

  if (req.method === 'GET' && parts[0] === 'products' && parts.length >= 2) {
    const product = products.find(p => p.id === parts[1]);
    if (!product) return send(res, 404, { message: 'Requested item not found' });
    if (parts[2] === 'related') {
      return send(res, 200, products.filter(p => p.id !== product.id && p.category.id === product.category.id).slice(0, 4).map(summary));
    }
    return send(res, 200, product);
  }

  if (req.method === 'GET' && url.pathname === '/categories') return send(res, 200, categories);

  if (req.method === 'GET' && url.pathname === '/categories/tree') {
    return send(res, 200, top.map(t => ({ ...t, sub_categories: categories.filter(c => c.parent_id === t.id).map(c => ({ ...c, sub_categories: [] })) })));
  }

  if (req.method === 'GET' && url.pathname === '/brands') return send(res, 200, brands);

  if (req.method === 'GET' && parts[0] === 'brands' && parts.length === 2) {
    const brand = brands.find(b => b.id === parts[1]);
    return brand ? send(res, 200, brand) : send(res, 404, { message: 'Requested item not found' });
  }

  if (req.method === 'POST' && url.pathname === '/users/login') {
    const body = await readBody(req);
    if (!body || !body.email || !body.password) return send(res, 401, { error: 'Invalid login request' });
    if (BUG === 'login') return send(res, 200, { access_token: 'mock-token', token_type: 'bearer', expires_in: 300 });
    return send(res, 401, { error: 'Unauthorized' });
  }

  return send(res, 404, { message: 'Resource not found' });
});

server.listen(PORT, () => console.log(`Toolshop mock API on http://localhost:${PORT}${BUG ? ` (bug: ${BUG})` : ''}`));
